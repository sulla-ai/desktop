import type { BaseThreadState, HierarchicalThreadState, NodeResult } from './Graph';
import type { ToolResult, ToolCall, ThreadState } from '../types';
import type { WebSocketMessageHandler } from '../services/WebSocketClientService';
import { getCurrentMode, getLocalService, getService } from '../languagemodels';
import { parseJson } from '../services/JsonParseService';
import { getWebSocketClientService } from '../services/WebSocketClientService';
import { getToolRegistry } from '../tools';
import { getAgentConfig } from '../services/ConfigService';
import { AgentAwareness } from '../database/models/AgentAwareness';
import { BaseLanguageModel, ChatMessage, NormalizedResponse } from '../languagemodels/BaseLanguageModel';

// ============================================================================
// DEFAULT SETTINGS
// ============================================================================

const DEFAULT_WS_CHANNEL = 'chat-controller-backend';

export const JSON_ONLY_RESPONSE_INSTRUCTIONS = `When you respond it will be parsed as JSON and ONLY the following object will be read.
Any text outside this exact structure will break downstream parsing.\nRespond ONLY with this valid JSON — nothing before, nothing after, no fences, no commentary:`;

export const TOOLS_RESPONSE_JSON = `  {"tools": [
    ["tool_name", "arg1", "arg2"] - run any tool with exec form
    ["emit_chat_message", "Respond to the users inquiry"]
  ],}`;

// ============================================================================
// INTERFACES AND TYPES
// ============================================================================

export interface LLMCallOptions {
    model?: string;
    maxTokens?: number;
    format?: 'json' | undefined;
    signal?: AbortSignal;
}

export interface LLMResponse {
    content: string | Record<string, any>;
    model: string;
}

export interface PromptEnrichmentOptions {
  includeSoul?: boolean;
  includeAwareness?: boolean;
  includeMemory?: boolean;
  includeTools?: boolean;
  includeStrategicPlan?: boolean;
  includeTacticalPlan?: boolean;
  includeKnowledgebasePlan: boolean;
}


// ============================================================================
// Supporting functions
// ============================================================================

function getSoulPrompt(): string {
  let config;
  try {
    config = getAgentConfig();
  } catch {
    config = { soulPrompt: '', botName: 'Sulla', primaryUserName: '' };
  }

  const prompt = config.soulPrompt || '';
  const botName = config.botName || 'Sulla';
  const primaryUserName = config.primaryUserName || '';

  // Build prefix with bot name and optional user name
  const prefix = primaryUserName.trim()
    ? `You are Sulla Desktop, and you like to be called ${botName}\nThe Primary User's name is: ${primaryUserName}\n\n`
    : `You are Sulla Desktop, and you like to be called ${botName}\n\n`;

  return prefix + prompt;
}

// ============================================================================
// Primary Classes
// ============================================================================

/**
 * 
 */
export abstract class BaseNode {
    id: string;
    name: string;
    protected llm: BaseLanguageModel | null = null;

    constructor(id: string, name: string) {
        this.id = id;
        this.name = name;
    }

    abstract execute(state: ThreadState): Promise<NodeResult<BaseThreadState>>;

    /**
     * 
     * @param basePrompt 
     * @param state 
     * @param options 
     * @returns 
     */
    protected async enrichPrompt(
        basePrompt: string,
        state: ThreadState,
        options: PromptEnrichmentOptions,
    ): Promise<string> {

        const parts: string[] = [];

        if (options.includeSoul) {
            const soulPrompt = getSoulPrompt();
            if (soulPrompt.trim()) {
                parts.push(soulPrompt);
            }
        }

        if (options.includeAwareness) {
            const awarenessPrompt = await AgentAwareness.getAgentAwarenessPrompt();
            if (awarenessPrompt.trim()) {
                parts.push(awarenessPrompt);
            }
        }

        if (options.includeMemory) {
            const kb = state.metadata.memory.knowledgeBaseContext;
            const summaries = state.metadata.memory.chatSummariesContext;

            if (kb) {
                parts.push(`Relevant context from KnowledgeBase:\n${String(kb)}`);
            }
            if (summaries) {
                parts.push(`Relevant context from ChatSummaries:\n${String(summaries)}`);
            }
        }

        if (options.includeTools) {
            try {
                const { registerDefaultTools, getToolRegistry } = await import('../tools');
                registerDefaultTools();
                const registry = getToolRegistry();

                parts.push([
                    'Tooling constraints (mandatory):',
                    '- You may ONLY use tools that appear in the "Available tools" list below.',
                    '- Tool names must match EXACTLY (case-sensitive).',
                    '- Do NOT invent tools. Any unknown tool will fail and you will be forced to revise.',
                    '- Use EXEC FORM format: ["tool_name", "arg1", "arg2", ...]',
                    '- Example: ["kubectl", "get", "pods"] calls kubectl in the command line',
                ].join('\n'));

                const toolPrompt = registry.getPlanningInstructionsBlock();
                parts.push(toolPrompt);
            } catch {
                // best effort
            }
        }

        if (options.includeStrategicPlan) {
            const planBlock = this.buildStrategicPlanContextBlock(state);
            if (planBlock) {
                parts.push(planBlock);
            }
        }

        if (options.includeTacticalPlan) {
            const planBlock = this.buildTacticalPlanContextBlock(state);
            if (planBlock) {
                parts.push(planBlock);
            }
        }

        if (options.includeKnowledgebasePlan) {
            const planBlock = this.buildTacticalPlanContextBlock(state);
            if (planBlock) {
                parts.push(planBlock);
            }
        }

        const now = new Date();
        const formattedTime = now.toLocaleString('en-US', {
            timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: true,
        });
        const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'unknown';
        parts.push(`Current datetime: ${formattedTime}\nComputers set time zone: ${timeZone}`);

        parts.push(basePrompt);

        return parts.join('\n\n');
    }

    /**
     * 
     * @param state 
     * @param systemPrompt 
     * @param options 
     * @returns 
     */
    protected async chat(
        state: BaseThreadState,
        systemPrompt: string,
        options: LLMCallOptions = {}
    ): Promise<any | null> {
        const reply = await this.normaliedChat(state, systemPrompt, options);
        if (!reply) return null;
        if (options.format === 'json') {
            const parsedReply = this.parseJson(reply.content);
            console.log(`[${this.name}] Parsed JSON:`, parsedReply);
            return parsedReply;
        }
        return reply.content;
    }

    /**
     * Unified chat: takes state + new system prompt + user message.
     * - Replaces last system prompt (or appends new one)
     * - Appends user message
     * - Calls primary LLM
     * - On any error/failure → fallback to local Ollama if remote
     * - Appends assistant response to state.messages
     * - Parses JSON if format='json'
     * - No raw response logging
     */
    protected async normaliedChat(
        state: BaseThreadState,
        systemPrompt: string,
        options: LLMCallOptions = {}
    ): Promise<NormalizedResponse | null> {
        
        const context = state.metadata.llmLocal ? 'local' : 'remote';
        this.llm = getService(context, state.metadata.llmModel);

        // Prepare messages from state
        let messages = [...state.messages];

        // Remove all system prompts
        messages = messages.filter(m => m.role !== 'system');

        // Append new system prompt
        messages.push({ role: 'system', content: systemPrompt.trim() });

        console.log('[BaseNode] Chat messages:', messages);
        console.log('[BaseNode] state.metadata.llmModel:', state.metadata.llmModel);
        console.log('[BaseNode] state.metadata.llmLocal:', context);
        try {
            // Primary attempt
            let reply: NormalizedResponse | null = await this.llm.chat(messages, {
                model: state.metadata.llmModel,
                maxTokens: options.maxTokens,
                format: options.format,
                signal: options.signal,
            });

            if (!reply) throw new Error('No response from primary LLM');

            // Append to state
            this.appendResponse(state, reply.content);

            return reply;
        } catch (err) {
            if ((err as any)?.name === 'AbortError') throw err;

            console.warn(`[BaseNode:${this.name}] Primary LLM failed:`, err instanceof Error ? err.message : String(err));

            // Fallback only if primary was remote
            if (getCurrentMode() !== 'local') {
                try {
                    const ollama = getLocalService();
                    if (ollama.isAvailable()) {
                        // Filter messages to only include ChatMessage-compatible roles
                        const chatMessages = messages.filter(msg =>
                            ['system', 'user', 'assistant'].includes(msg.role)
                        ) as ChatMessage[];
                        const reply = await ollama.chat(chatMessages, { signal: options.signal });
                        if (reply) {
                            this.appendResponse(state, reply.content);
                            return reply;
                        }
                    }
                } catch (fallbackErr) {
                    console.error(`[BaseNode:${this.name}] Ollama fallback failed:`, fallbackErr);
                }
            }

            return null;
        }
    }

    /**
     * Clears out any thinking context
     * Parses JSON with our best attempt parser
     * 
     * @param raw 
     * @returns 
     */
    protected parseJson<T = unknown>(raw: string | null | undefined): T | null {
        // If it's already an object, return it as-is
        if (typeof raw === 'object') {
            return raw as T;
        }
        if (!raw || typeof raw !== 'string') return null;

        return parseJson(raw);
    }
 
    /**
     * Build a context block showing strategic plan progress
     */
    protected buildStrategicPlanContextBlock(state: any): string | null {
        const plan = state.metadata.plan;
        if (!plan || !plan.model || !plan.milestones || plan.milestones.length === 0) {
            return null;
        }

        const goal = plan.model.data || '';
        const activeIndex = plan.activeMilestoneIndex;

        const milestoneLines = plan.milestones.map((mWrapper: { model: { status?: string, title?: string } }, idx: number) => {
            const m = mWrapper.model;
            const status = m.status || 'pending';
            let statusIcon = '○';
            if (status === 'done') statusIcon = '✓';
            else if (status === 'in_progress') statusIcon = '→';
            else if (status === 'blocked') statusIcon = '✗';

            const isActive = idx === activeIndex || status === 'in_progress';
            const title = isActive ? `**${m.title}**` : m.title;

            return ` ${statusIcon} Milestone ${idx + 1}: ${title} [${status}]`;
        });

        return `## Strategic Plan\nGoal: ${goal}\n\n### Milestones:\n${milestoneLines.join('\n')}`;
    }

    /**
     * Build a context block showing tactical plan progress for current milestone
     */
    protected buildTacticalPlanContextBlock(state: any): string | null {
        const steps = state.metadata.kbCurrentSteps;
        if (!steps || steps.length === 0) {
            return null;
        }

        const activeIndex = state.metadata.kbActiveStepIndex;

        const stepLines = steps.map((s:any, idx:number) => {
            const status = s.done ? 'done' : (idx === activeIndex ? 'in_progress' : 'pending');
            let statusIcon = '○';
            if (status === 'done') statusIcon = '✓';
            else if (status === 'in_progress') statusIcon = '→';

            const isActive = status === 'in_progress';
            const description = isActive ? `**${s.description}**` : s.description;

            return ` ${statusIcon} Step ${idx + 1}: ${description} [${status}]`;
        });

        return `#### Tactical Plan (Current Milestone)\nSteps:\n${stepLines.join('\n')}`;
    }

    /**
     * Build a context block showing knowledge base article progress and content
     */
    protected buildKnowledgeBaseContextBlock(state: any): string | null {
        const parts: string[] = [];

        // Action plan steps
        const steps = state.metadata.kbCurrentSteps || [];
        if (steps.length > 0) {
            const activeIndex = state.metadata.kbActiveStepIndex;
            const stepLines = steps.map((s: any, idx: number) => {
                const status = s.done ? 'done' : (idx === activeIndex ? 'in_progress' : 'pending');
                let statusIcon = '○';
                if (status === 'done') statusIcon = '✓';
                else if (status === 'in_progress') statusIcon = '→';

                const isActive = status === 'in_progress';
                const description = isActive ? `**${s.description}**` : s.description;

                return ` ${statusIcon} Step ${idx + 1}: ${description} [${status}]`;
            });

            parts.push(`### Action Plan\nSteps:\n${stepLines.join('\n')}`);
        }

        // Article schema
        const schema = state.metadata.kbArticleSchema || {};
        const schemaLines = Object.entries(schema).map(([key, value]) => {
            const valStr = Array.isArray(value) ? value.join(', ') : value?.toString() || 'Not set';
            return `- **${key}**: ${valStr}`;
        });
        if (schemaLines.length > 0) {
            parts.push(`### Article Schema\n${schemaLines.join('\n')}`);
        }

        // Article research (JSON block)
        const research = state.metadata.kbArticleResearch;
        if (research?.trim()) {
            parts.push(`### Article Research\n\`\`\`json\n${research.trim()}\n\`\`\``);
        }

        // Final content (Markdown block)
        const finalContent = state.metadata.kbFinalContent;
        if (finalContent?.trim()) {
            parts.push(`### Final Content\n\`\`\`markdown\n${finalContent.trim()}\n\`\`\``);
        }

        return parts.length > 0 ? parts.join('\n\n') : null;
    }
    
    /**
     * Pull a model from Ollama (only works for local mode)
     */
    protected async pullModel(modelName: string): Promise<boolean> {
        if (getCurrentMode() !== 'local') {
            console.warn(`[Agent:${this.name}] Cannot pull model in remote mode`);
            return false;
        }

        const ollama = getService('local', modelName) as any;
        return ollama.pullModel?.(modelName) ?? false;
    }

    /**
     * Optional: append assistant response to state.messages
     */
    protected appendResponse(state: BaseThreadState, content: string): void {
        // Ensure content is a string
        const contentStr = typeof content === 'string' ? content : JSON.stringify(content);
        
        state.messages.push({
            role: 'assistant',
            content: contentStr,
            metadata: {
                nodeId: this.id,
                timestamp: Date.now()
            }
        });
    }

    /**
     * Connect to a WebSocket server and optionally register a message handler
     * @param connectionId Unique identifier for this connection
     * @param url WebSocket URL (defaults to ws://localhost:8080/)
     * @param onMessage Optional handler for incoming messages
     * @returns true if connection initiated
     */
    protected connectWebSocket(
        connectionId: string,
        onMessage?: WebSocketMessageHandler
    ): boolean {
        const wsService = getWebSocketClientService();
        const connected = wsService.connect(connectionId);

        if (connected && onMessage) {
            // Small delay to allow connection to establish before registering handler
            setTimeout(() => {
                wsService.onMessage(connectionId, onMessage);
            }, 100);
        }

        return connected;
    }

    /**
     * Send a message to a WebSocket connection
     * @param connectionId Connection identifier
     * @param message Message to send (object or string)
     * @returns true if sent successfully
     */
    protected dispatchToWebSocket(connectionId: string, message: unknown): boolean {
        const wsService = getWebSocketClientService();
        return wsService.send(connectionId, message);
    }

    /**
     * Register a handler for WebSocket messages
     * @param connectionId Connection identifier
     * @param handler Callback function for incoming messages
     * @returns Unsubscribe function or null if connection not found
     */
    protected listenToWebSocket(
        connectionId: string,
        handler: WebSocketMessageHandler,
    ): (() => void) | null {
        const wsService = getWebSocketClientService();
        return wsService.onMessage(connectionId, handler);
    }

    /**
     * Disconnect from a WebSocket server
     * @param connectionId Connection identifier
     */
    protected disconnectWebSocket(connectionId: string): void {
        const wsService = getWebSocketClientService();
        wsService.disconnect(connectionId);
    }

    /**
     * Check if a WebSocket connection is active
     * @param connectionId Connection identifier
     */
    protected isWebSocketConnected(connectionId: string): boolean {
        const wsService = getWebSocketClientService();
        return wsService.isConnected(connectionId);
    }


    /**
     * Emit a chat message to the UI dashboard via WebSocket
     * Connection ID is read from state.metadata.wsChannel (defaults to 'chat-controller')
     * @param state BaseThreadState containing the connection ID in metadata
     * @param content Message content to display
     * @param role 'assistant' | 'system' - defaults to 'assistant'
     * @param kind Optional UI kind tag - defaults to 'progress'
     * @returns true if message was sent via WebSocket
     */
    protected wsChatMessage(
        state: BaseThreadState,
        content: string,
        role: 'assistant' | 'system' = 'assistant',
        kind: string = 'progress',
    ): boolean {
        if (!content.trim()) {
            return false;
        }

        // Get connection ID from state or use default
        const connectionId = (state.metadata.wsChannel as string) || DEFAULT_WS_CHANNEL;

        // Ensure WebSocket connection exists
        if (!this.isWebSocketConnected(connectionId)) {
            this.connectWebSocket(connectionId);
        }

        // Send via WebSocket
        const sent = this.dispatchToWebSocket(connectionId, {
            type: 'assistant_message',
            data: {
                content: content.trim(),
                role,
                kind,
                timestamp: Date.now(),
            },
        });

        if (!sent) {
            console.warn(`[Agent:${this.name}] Failed to send chat message via WebSocket`);
        }

        return sent;
    }

    /**
     * Emit a tool call event to create/update tool cards in the UI
     * @param state BaseThreadState containing the WebSocket channel
     * @param toolRunId Unique identifier for this tool execution
     * @param toolName Name of the tool being called
     * @param args Arguments passed to the tool
     * @returns true if event was sent via WebSocket
     */
    protected emitToolCallEvent(
        state: BaseThreadState,
        toolRunId: string,
        toolName: string,
        args: Record<string, any>
    ): boolean {
        const connectionId = (state.metadata.wsChannel as string) || DEFAULT_WS_CHANNEL;
        
        return this.dispatchToWebSocket(connectionId, {
            type: 'progress',
            data: {
                phase: 'tool_call',
                toolRunId,
                toolName,
                args
            },
            timestamp: Date.now()
        });
    }

    /**
     * Emit a tool result event to update tool card status in the UI
     * @param state BaseThreadState containing the WebSocket channel
     * @param toolRunId Same ID from the tool_call event
     * @param success Whether the tool execution succeeded
     * @param error Optional error message if success is false
     * @param result Optional result data if success is true
     * @returns true if event was sent via WebSocket
     */
    protected emitToolResultEvent(
        state: BaseThreadState,
        toolRunId: string,
        success: boolean,
        error?: string,
        result?: any
    ): boolean {
        const connectionId = (state.metadata.wsChannel as string) || DEFAULT_WS_CHANNEL;
        
        return this.dispatchToWebSocket(connectionId, {
            type: 'progress',
            data: {
                phase: 'tool_result',
                toolRunId,
                success,
                error,
                result
            },
            timestamp: Date.now()
        });
    }

    /**
     * Normalize tool calls from exec form arrays
     * Exec form: ["tool_name", "arg1", "arg2"]
     * Tool name is used directly from the first element (must match tool.name exactly)
     * @param tools Raw tools array from LLM response (parsed.tools)
     * @returns Normalized actions with toolName and args
     */
    protected normalizeToolCalls(tools: unknown[]): Array<{ toolName: string; args: string[] }> {
        const result: Array<{ toolName: string; args: string[] }> = [];

        for (const item of tools) {
            // Exec form: array like ["kubectl", "get", "pods"] or ["emit_chat_message", "message"]
            if (Array.isArray(item) && item.length > 0) {
                const toolName = String(item[0]);
                const execArgs = item.slice(1);

                result.push({
                    toolName,
                    args: execArgs,
                });
            }
        }

        return result;
    }

    /**
     * Execute multiple tool calls, append results as 'tool' messages, return results array.
     * - Appends each result immediately after execution (LLM sees sequential feedback)
     * - Uses role: 'tool' + name/tool_call_id for API compatibility
     * - Failed tools include help info
     * - Minimal logging (no full JSON dump)
     */
    protected async executeToolCalls(
        state: BaseThreadState,
        tools: unknown[],
        allowedTools?: string[]
    ): Promise<Array<{ toolName: string; success: boolean; result?: unknown; error?: string }>> {
        if (!tools?.length) return [];

        const registry = getToolRegistry(); // assume global registration
        const results: Array<{ toolName: string; success: boolean; result?: unknown; error?: string }> = [];

        const normalized = this.normalizeToolCalls(tools);

        for (const { toolName, args } of normalized) {
            // Generate unique tool run ID for this execution
            const toolRunId = `${toolName}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

            // Disallowed → emit tool call and failure, then continue
            if (allowedTools?.length && !allowedTools.includes(toolName)) {
                this.emitToolCallEvent(state, toolRunId, toolName, { args });
                this.emitToolResultEvent(state, toolRunId, false, `Tool not allowed in this node: ${toolName}`);
                
                await this.appendToolResultMessage(state, toolName, {
                    toolName,
                    success: false,
                    error: `Tool not allowed in this node: ${toolName}`
                });
                results.push({ toolName, success: false, error: 'Not allowed' });
                continue;
            }

            const tool = registry.get(toolName);
            if (!tool) {
                this.emitToolCallEvent(state, toolRunId, toolName, { args });
                this.emitToolResultEvent(state, toolRunId, false, `Unknown tool: ${toolName}`);
                
                await this.appendToolResultMessage(state, toolName, {
                    toolName,
                    success: false,
                    error: `Unknown tool: ${toolName}`
                });
                results.push({ toolName, success: false, error: 'Unknown tool' });
                continue;
            }

            // Emit tool call event before execution
            this.emitToolCallEvent(state, toolRunId, toolName, { args });

            try {
                const outcome = await tool.execute(state, { toolName, args });

                // Emit tool result event on success
                this.emitToolResultEvent(state, toolRunId, outcome.success, outcome.error, outcome.result);

                await this.appendToolResultMessage(state, toolName, outcome);

                results.push({
                    toolName,
                    success: outcome.success,
                    result: outcome.result,
                    error: outcome.error
                });
            } catch (err: any) {
                const error = err.message || String(err);
                
                // Emit tool result event on error
                this.emitToolResultEvent(state, toolRunId, false, error);
                
                await this.appendToolResultMessage(state, toolName, {
                    toolName,
                    success: false,
                    error
                });
                results.push({ toolName, success: false, error });
            }
        }

        return results;
    }

    /**
     * Append tool result as a 'tool' message to state.messages.
     * Role: 'tool' — standard for most LLM APIs (OpenAI, Anthropic, Grok).
     * Includes short summary + full JSON payload for context.
     * Failed tools add help instructions.
     */
    public async appendToolResultMessage(
        state: BaseThreadState,
        action: string,
        result: ToolResult
    ): Promise<void> {
        // Skip appending tool results for emit_chat_message
        if (action === 'emit_chat_message') {
            return;
        }

        const summary = result.success
            ? `Tool ${action} succeeded`
            : `Tool ${action} failed: ${result.error || 'unknown error'}`;

        let toolHelpInfo = null;
        if (!result.success) {
            try {
                const { getToolRegistry, registerDefaultTools } = await import('../tools');
                registerDefaultTools();
                const registry = getToolRegistry();
                const tool = registry.get(action);
                if (tool) toolHelpInfo = tool.getPlanningInstructions();
            } catch { }
        }

        const content = JSON.stringify(
            {
                tool: action,
                success: result.success,
                error: result.error || null,
                result: result.result && JSON.stringify(result.result).length < 5000
                    ? result.result
                    : '[truncated — see logs]',
                helpInfo: toolHelpInfo,
                toolCallId: result.toolCallId
            },
            null,
            2
        );

        state.messages.push({
            role: 'tool',
            content,
            name: action,                     // tool name as sender
            tool_call_id: result.toolCallId,  // link back to call
            metadata: {
                nodeId: this.id,
                nodeName: this.name,
                kind: 'tool_result',
                toolName: action,
                success: result.success,
                summary,
                timestamp: Date.now()
            }
        });
    }
}