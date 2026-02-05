// BaseNode - Abstract base class for all graph nodes
// Uses LLMServiceFactory for LLM interactions (supports both local Ollama and remote APIs)

import type { GraphNode, ThreadState, NodeResult, Message, ToolResult } from '../types';
import type { ILLMService } from '../services/ILLMService';
import type { ChatMessage } from '../services/ILLMService';
import { getLLMService, getCurrentMode } from '../services/LLMServiceFactory';
import { getOllamaService } from '../services/OllamaService';
import { getAwarenessService } from '../services/AwarenessService';
import { getAgentConfig } from '../services/ConfigService';
import type { AbortService } from '../services/AbortService';
import { getToolRegistry, registerDefaultTools } from '../tools';
import { getWebSocketClientService, type WebSocketMessageHandler } from '../services/WebSocketClientService';

// Import soul.md via raw-loader (configured in vue.config.mjs)
// @ts-ignore - raw-loader import
import soulPromptRaw from '../prompts/soul.md';

function getSoulPrompt(): string {
  let config;
  try {
    config = getAgentConfig();
  } catch {
    config = { soulPrompt: '', botName: 'Sulla', primaryUserName: '' };
  }

  const override = config.soulPrompt || '';
  const botName = config.botName || 'Sulla';
  const primaryUserName = config.primaryUserName || '';

  // Build prefix with bot name and optional user name
  const prefix = primaryUserName.trim()
    ? `You are Sulla Desktop, and you like to be called ${botName}\nThe Primary User's name is: ${primaryUserName}\n\n`
    : `You are Sulla Desktop, and you like to be called ${botName}\n\n`;

  // Use override if present, otherwise fall back to bundled soul.md
  let soulContent: string;
  if (override.trim()) {
    soulContent = override.trim();
  } else {
    // raw-loader may return { default: string } or string depending on config
    const content = typeof soulPromptRaw === 'string' ? soulPromptRaw : soulPromptRaw.default;
    soulContent = (content || '').trim();
  }

  return prefix + soulContent;
}

export interface LLMOptions {
  model?: string;
  maxTokens?: number;
  format?: 'json' | undefined;
}

export interface LLMResponse {
  content: string;
  model: string;
  evalCount?: number;
  evalDuration?: number;
}

export type ToolPromptDetail = 'names' | 'tactical' | 'planning';

export type KnowledgeGraphInstructionType = 'planner' | 'executor' | 'critic';

export interface PromptEnrichmentOptions {
  includeSoul?: boolean;
  includeAwareness?: boolean;
  includeMemory?: boolean;
  includeConversation?: boolean;
  conversationOverride?: string;
  maxHistoryItems?: number;
  includeTools?: boolean;
  toolDetail?: ToolPromptDetail;
  includeSkills?: boolean;
  includeStrategicPlan?: boolean;
  includeTacticalPlan?: boolean;
  includeKnowledgeGraphInstructions?: KnowledgeGraphInstructionType;
}

export const JSON_ONLY_RESPONSE_INSTRUCTIONS = `When you respond it will be parsed as JSON and ONLY the following object will be read.
Any text outside this exact structure will break downstream parsing.

Respond ONLY with this valid JSON — nothing before, nothing after, no fences, no commentary:`;

export abstract class BaseNode implements GraphNode {
  id: string;
  name: string;
  protected availableModel: string | null = null;
  protected llmService: ILLMService | null = null;

  constructor(id: string, name: string) {
    this.id = id;
    this.name = name;
  }

  private logRawLLMResponse(prefix: string, model: string, content: string): void {
    const chunkSize = 2000;
    const safeModel = String(model || 'unknown');
    console.log(`[${prefix}] Raw LLM response start (model=${safeModel})`);
    for (let i = 0; i < content.length; i += chunkSize) {
      console.log(content.substring(i, i + chunkSize));
    }
    console.log(`[${prefix}] Raw LLM response end (model=${safeModel})`);
  }

  protected async enrichPrompt(
    basePrompt: string,
    state: ThreadState,
    options: PromptEnrichmentOptions = {},
  ): Promise<string> {
    const parts: string[] = [];

    if (options.includeSoul) {
      const soulPrompt = getSoulPrompt();
      if (soulPrompt.trim()) {
        parts.push(soulPrompt);
      }
    }

    if (options.includeAwareness) {
      try {
        const awareness = getAwarenessService();
        await awareness.initialize();
        const identity = awareness.identityPrompt;
        if (identity.trim()) {
          parts.push(`Awareness context:\n${identity}`);
        }
      } catch {
        // best effort
      }
    }

    if (options.includeMemory) {
      const kb = (state.metadata as any).knowledgeBaseContext;
      const summaries = (state.metadata as any).chatSummariesContext;
      const messages = (state.metadata as any).chatMessagesContext;
      const legacy = state.metadata.memoryContext;

      if (kb) {
        parts.push(`Relevant context from KnowledgeBase:\n${String(kb)}`);
      }
      if (summaries) {
        parts.push(`Relevant context from ChatSummaries:\n${String(summaries)}`);
      }
      if (messages) {
        parts.push(`Relevant context from ChatMessages:\n${String(messages)}`);
      }

      if (!kb && !summaries && !messages && legacy) {
        parts.push(`Relevant context from memory:\n${String(legacy)}`);
      }
    }

    if (options.includeConversation) {
      const override = options.conversationOverride;
      if (override && override.trim()) {
        parts.push(`Conversation history:\n${override.trim()}`);
      } else {
        const maxItems = options.maxHistoryItems || 10;
        const historySource = state.messages.length > 0 ? state.messages : state.shortTermMemory;
        const userAssistantMessages = historySource.filter(m => m.role === 'user' || m.role === 'assistant');
        if (userAssistantMessages.length > 0) {
          const lines = userAssistantMessages
            .slice(-maxItems)
            .map(m => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`);
          parts.push(`Conversation history:\n${lines.join('\n')}`);
        }
      }
    }

    if (options.includeTools) {
      try {
        const { registerDefaultTools, getToolRegistry } = await import('../tools');
        registerDefaultTools();
        const registry = getToolRegistry();
        const detail: ToolPromptDetail = options.toolDetail || 'names';

        parts.push([
          'Tooling constraints (mandatory):',
          '- You may ONLY use tools that appear in the "Available tools" list below.',
          '- Tool names must match EXACTLY (case-sensitive).',
          '- Do NOT invent tools. Any unknown tool will fail and you will be forced to revise.',
          '- Use EXEC FORM format: ["tool_name", "arg1", "arg2", ...]',
          '- Example: ["kubectl", "get", "pods"] calls kubectl in the command line',
        ].join('\n'));

        if (detail === 'tactical') {
          parts.push(`Available tools:\n${registry.getTacticalInstructionsBlock()}`);
        } else if (detail === 'planning') {
          const toolParts = registry.listUnique().map(t => t.getPlanningInstructions());
          parts.push(`Available tools:\n${toolParts.join('\n\n')}`);
        } else {
          const toolLines = registry.listUnique().map(t => `- ${t.name}`);
          parts.push(`Available tools:\n${toolLines.join('\n')}`);
        }
      } catch {
        // best effort
      }
    }

    if (options.includeSkills) {
      try {
        const { getSkillService } = await import('../services/SkillService');
        const skillService = getSkillService();
        await skillService.initialize();
        const enabledSkills = await skillService.listEnabledSkills();

        parts.push([
          'Skill constraints (mandatory):',
          '- You may ONLY use skills that appear in the "Enabled skills" list below.',
          '- Do NOT invent skills, plugins, or capabilities.',
          '- If a desired capability is not listed as a tool or enabled skill, you must proceed without it.',
        ].join('\n'));

        if (enabledSkills.length > 0) {
          const lines = enabledSkills.map(s => `- ${s.id}: ${s.description || s.title || ''}`);
          parts.push(`Enabled skills:\n${lines.join('\n')}`);
        } else {
          parts.push('Enabled skills:\n(none)');
        }
      } catch {
        // best effort
      }
    }

    if (options.includeStrategicPlan || options.includeTacticalPlan) {
      const planBlock = this.buildPlanContextBlock(state, !!options.includeStrategicPlan, !!options.includeTacticalPlan);
      if (planBlock) {
        parts.push(planBlock);
      }
    }

    if (options.includeKnowledgeGraphInstructions) {
      const kgType = options.includeKnowledgeGraphInstructions;
      if (kgType === 'planner') {
        parts.push(this.getKnowledgeGraphInstructionsForPlanner());
      } else if (kgType === 'executor') {
        parts.push(this.getKnowledgeGraphInstructionsForExecutor());
      } else if (kgType === 'critic') {
        parts.push(this.getKnowledgeGraphInstructionsForCritic());
      }
    }

    const now = new Date();
    const date = now.toISOString().slice(0, 10);
    const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'unknown';
    parts.push(`Current date: ${date}\nTime zone: ${timeZone}`);

    parts.push(basePrompt);

    return parts.join('\n\n');
  }


  /**
   * Build a context block showing strategic and tactical plan progress
   * @param strategicOnly If true, only include strategic plan (no tactical steps)
   */
  protected buildPlanContextBlock(state: ThreadState, includeStrategic: boolean, includeTactical: boolean): string | null {
    const strategicPlan = state.metadata.strategicPlan as {
      goal?: string;
      milestones?: Array<{ id: string; title: string; description?: string; status?: string }>;
    } | undefined;

    const tacticalPlan = state.metadata.tacticalPlan as {
      milestoneId?: string;
      steps?: Array<{ id: string; action: string; description?: string; status?: string }>;
    } | undefined;

    const parts: string[] = [];

    // Strategic plan milestones
    if (includeStrategic && strategicPlan?.milestones && strategicPlan.milestones.length > 0) {
      const milestoneLines = strategicPlan.milestones.map((m, idx) => {
        const status = m.status || 'pending';
        const statusIcon = status === 'completed' ? '✓' : status === 'in_progress' ? '→' : status === 'failed' ? '✗' : '○';
        const title = status === 'in_progress' ? `**${m.title}**` : m.title;
        return `  ${statusIcon} Step ${idx + 1}: ${title} [${status}]`;
      });
      parts.push(`## Strategic Plan
        Goal: ${strategicPlan.goal || 'Not specified'}
        
        ### Milestones:
        ${milestoneLines.join('\n')}`);
    }

    // Tactical plan steps for current milestone
    if (includeTactical && tacticalPlan?.steps && tacticalPlan.steps.length > 0) {
      const stepLines = tacticalPlan.steps.map((s, idx) => {
        const status = s.status || 'pending';
        const statusIcon = status === 'done' ? '✓' : status === 'in_progress' ? '→' : status === 'failed' ? '✗' : '○';
        const action = status === 'in_progress' ? `**${s.action}**` : s.action;
        return `  ${statusIcon} Step ${idx + 1}: ${action} [${status}]`;
      });
      parts.push(`#### Tactical Plan (Current Milestone)
        Steps:
        ${stepLines.join('\n')}`);
    }

    return parts.length > 0 ? parts.join('\n\n') : null;
  }

  protected getKnowledgeGraphInstructionsForPlanner(): string {
    return `## Your Standard Operating Procedure for creating KnowledgeBase Articles
You MUST follow this SOP exactly as written whenever you are creating any knowledgebase article:
1. Create a milestone to gather the information
2. Create a milestone to generate the article
3. Create a milestone to save/store the article. Add the ("generateKnowledgeBase": true) flag to this milestone.

Example:
{
  "milestones": [
    {
      "id": "milestone_kb",
      "title": "Document the solution",
      "description": "Create a KnowledgeBase article capturing this workflow",
      "generateKnowledgeBase": true
    }
  ]
}
The KnowledgeGraph will save the article.

When to trigger the KnowledgeBase SOP:
- When you're creating a new SOP
- When you're storing anything in "memory"
- When you want to save any information for later use
- User explicitly asked for documentation
- Complex workflow that should be preserved for future reference
- New architecture decisions or patterns established
- You learned how to do something new
- When creating an Standard Operating Procedure (SOP)`;
  }

  protected getKnowledgeGraphInstructionsForExecutor(): string {
    return `
- There is NO tool named "knowledge_base_create_page" do not attempt to call it.
- The actualy saving of knowledgebase articles is handled automatically by other systems.
`;
  }

  protected getKnowledgeGraphInstructionsForCritic(): string {
    return `## KnowledgeBase Article Generation
If the conversation contains knowledge worth preserving for future reference, include in your response:
{
  "triggerKnowledgeBase": true,
  "kbReason": "Brief explanation of why this is worth documenting"
}
This triggers KnowledgeGraph asynchronously after the plan completes - it does not block the user.

When to trigger KB generation:
- Non-trivial problem was solved worth documenting
- Troubleshooting steps that could help in the future
- New patterns or workflows were established
- Information that would be useful to recall later`;
  }

  private createInternalMessageId(prefix: string): string {
    return `${prefix}_${Date.now()}_${Math.floor(Math.random() * 1_000_000)}`;
  }

  private toChatMessagesFromThread(state: ThreadState): ChatMessage[] {
    const out: ChatMessage[] = [];
    for (const m of state.messages) {
      if (m.role !== 'user' && m.role !== 'assistant' && m.role !== 'system') {
        continue;
      }
      out.push({ role: m.role, content: m.content });
    }
    return out;
  }

  abstract execute(state: ThreadState): Promise<{ state: ThreadState; next: NodeResult }>;

  async initialize(): Promise<void> {
    console.log(`[Agent:${this.name}] Initializing...`);

    // Get the appropriate LLM service (local or remote)
    this.llmService = getLLMService();
    await this.llmService.initialize();

    this.availableModel = this.llmService.getModel();
    const mode = getCurrentMode();

    console.log(`[Agent:${this.name}] Mode: ${mode}, Model: ${this.availableModel || 'none'}`);
  }

  async destroy(): Promise<void> {
    this.llmService = null;
  }

  /**
   * Pull a model from Ollama (only works for local mode)
   */
  protected async pullModel(modelName: string): Promise<boolean> {
    if (getCurrentMode() !== 'local') {
      console.warn(`[Agent:${this.name}] Cannot pull model in remote mode`);

      return false;
    }

    const ollama = getOllamaService();

    return ollama.pullModel(modelName);
  }

  /**
   * Send a prompt to the LLM (works for both local and remote)
   * Falls back to local Ollama if remote service is unavailable
   * If state contains heartbeatModel override, uses that model instead
   */
  protected async prompt(prompt: string, state?: ThreadState, storeInMessages = true): Promise<LLMResponse | null> {
    const abort = (state?.metadata && (state.metadata as any).__abort) as AbortService | undefined;

    // Check for heartbeat model override in state metadata
    const heartbeatModel = state?.metadata?.heartbeatModel as string | undefined;
    
    if (heartbeatModel && heartbeatModel !== 'default') {
      return this.promptWithModelOverride(prompt, heartbeatModel, state);
    }

    if (!this.llmService) {
      this.llmService = getLLMService();
      await this.llmService.initialize();
      this.availableModel = this.llmService.getModel();
    }

    // If primary service is not available, try fallback to Ollama
    if (!this.llmService.isAvailable()) {
      console.warn(`[Agent:${this.name}] Primary LLM service not available, attempting fallback to Ollama`);
      
      try {
        const ollama = getOllamaService();
        await ollama.initialize();
        
        if (ollama.isAvailable()) {
          console.log(`[Agent:${this.name}] Falling back to local Ollama`);
          this.llmService = ollama;
          this.availableModel = ollama.getModel();
        } else {
          console.error(`[Agent:${this.name}] Ollama fallback also not available`);
          return null;
        }
      } catch (err) {
        console.error(`[Agent:${this.name}] Fallback to Ollama failed:`, err);
        return null;
      }
    }

    const model = this.availableModel || this.llmService.getModel();

    try {
      let messages: ChatMessage[] = [{ role: 'user', content: prompt }];
      if (state) {
        messages = this.toChatMessagesFromThread(state);
        messages.push({ role: 'system', content: prompt });
      }

      console.warn(`[Agent:${this.name}] model ${model}`);
      const content = await this.llmService.chat(messages, { signal: abort?.signal });

      if (!content) {
        console.warn(`[Agent:${this.name}] No response from LLM`);

        return null;
      }

      if (state && storeInMessages) {
        const responseMsg: Message = {
          id: this.createInternalMessageId('node_response'),
          role: 'assistant',
          content,
          timestamp: Date.now(),
          metadata: { nodeId: this.id, nodeName: this.name, kind: 'node_response', model },
        };
        state.messages.push(responseMsg);
      }

      const result = {
        content,
        model,
      };

      console.log(`[Agent:${this.name}] Response received (${result.content.length} chars)`);
      this.logRawLLMResponse(`Agent:${this.name}`, model, result.content);

      return result;
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        throw err;
      }
      console.error(`[Agent:${this.name}] Prompt failed:`, err);

      return null;
    }
  }

  /**
   * Send a prompt with a specific model override (for heartbeat)
   * Format: 'local:modelname' or 'remote:provider:model'
   */
  private async promptWithModelOverride(prompt: string, modelOverride: string, state?: ThreadState): Promise<LLMResponse | null> {
    console.log(`[Agent:${this.name}] Using model override: ${modelOverride}`);

    const abort = (state?.metadata && (state.metadata as any).__abort) as AbortService | undefined;
    
    try {
      if (modelOverride.startsWith('local:')) {
        // Local Ollama model
        const modelName = modelOverride.substring(6); // Remove 'local:' prefix
        const ollama = getOllamaService();
        await ollama.initialize();
        
        if (!ollama.isAvailable()) {
          console.error(`[Agent:${this.name}] Ollama not available for model override`);
          return null;
        }
        
        let messages: ChatMessage[] = [{ role: 'user', content: prompt }];
        if (state) {
          messages = this.toChatMessagesFromThread(state);
          messages.push({ role: 'system', content: prompt });
        }

        console.log(`[Agent:${this.name}] LLM chat payload prepared (override=${modelOverride}, model=${modelName}, messages=${messages.length})`);

        const content = await ollama.chatWithModel(messages, modelName, { signal: abort?.signal });
        
        if (!content) {
          return null;
        }

        console.log(`[Agent:${this.name}] Response received (${content.length} chars)`);
        this.logRawLLMResponse(`Agent:${this.name}`, modelName, content);
        
        if (state) {
          const responseMsg: Message = {
            id: this.createInternalMessageId('node_response'),
            role: 'assistant',
            content,
            timestamp: Date.now(),
            metadata: { nodeId: this.id, nodeName: this.name, kind: 'node_response', model: modelName, modelOverride },
          };
          state.messages.push(responseMsg);
        }

        return { content, model: modelName };
      } else if (modelOverride.startsWith('remote:')) {
        // Remote model: format is 'remote:provider:model'
        const parts = modelOverride.substring(7).split(':'); // Remove 'remote:' prefix
        if (parts.length < 2) {
          console.error(`[Agent:${this.name}] Invalid remote model format: ${modelOverride}`);
          return null;
        }
        
        const [provider, ...modelParts] = parts;
        const modelName = modelParts.join(':');
        
        // Import and use RemoteModelService with override
        const { getRemoteModelService } = await import('../services/RemoteModelService');
        const remoteService = getRemoteModelService();
        await remoteService.initialize();
        
        if (!remoteService.isAvailable()) {
          console.error(`[Agent:${this.name}] Remote service not available for model override`);
          return null;
        }
        
        // Use the remote service with the specific model
        // Remote override API currently accepts a single prompt string.
        // When state is provided, serialize the accumulated thread into a single prompt.
        const effectivePrompt = state
          ? `${this.toChatMessagesFromThread(state).map(m => `${m.role}: ${m.content}`).join('\n\n')}\n\nsystem: ${prompt}`
          : prompt;

        console.log(`[Agent:${this.name}] LLM generate payload prepared (override=${modelOverride}, model=${provider}:${modelName}, chars=${effectivePrompt.length})`);

        const content = await (remoteService as unknown as { generateWithModel: (p: string, providerId: string, model: string, options?: { signal?: AbortSignal }) => Promise<string | null> })
          .generateWithModel(effectivePrompt, provider, modelName, { signal: abort?.signal });
        
        if (!content) {
          return null;
        }

        console.log(`[Agent:${this.name}] Response received (${content.length} chars)`);
        this.logRawLLMResponse(`Agent:${this.name}`, `${provider}:${modelName}`, content);
        
        if (state) {
          const responseMsg: Message = {
            id: this.createInternalMessageId('node_response'),
            role: 'assistant',
            content,
            timestamp: Date.now(),
            metadata: { nodeId: this.id, nodeName: this.name, kind: 'node_response', model: `${provider}:${modelName}`, modelOverride },
          };
          state.messages.push(responseMsg);
        }

        return { content, model: `${provider}:${modelName}` };
      } else {
        console.error(`[Agent:${this.name}] Unknown model override format: ${modelOverride}`);
        return null;
      }
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        throw err;
      }
      console.error(`[Agent:${this.name}] Model override prompt failed:`, err);
      return null;
    }
  }

  /**
   * Send a prompt and parse JSON response
   */
  protected async promptJSON<T = unknown>(prompt: string, state?: ThreadState, storeInMessages = true): Promise<T | null> {
    const response = await this.prompt(prompt, state, storeInMessages);

    if (!response) {
      return null;
    }

    try {
      return JSON.parse(response.content) as T;
    } catch {
      return null;
    }
  }

  /**
   * Build a prompt with context from thread state
   */
  protected buildContextualPrompt(
    instruction: string,
    state: ThreadState,
    options: { includeMemory?: boolean; includeHistory?: boolean; maxHistoryItems?: number } = {},
  ): string {
    const parts: string[] = [];

    parts.push(getAwarenessService().identityPrompt);
    parts.push('');

    const historyForLog: Array<{ role: string; content: string }> = [];
    if (options.includeHistory && state.shortTermMemory.length > 0) {
      const maxItems = options.maxHistoryItems || 6;
      historyForLog.push(...state.shortTermMemory.slice(-maxItems));
    }

    // Add memory context if available and requested
    if (options.includeMemory && state.metadata.memoryContext) {
      parts.push('Relevant context from memory:');
      parts.push(state.metadata.memoryContext as string);
      parts.push('');
    }

    // Add conversation history if requested
    // Use full messages array for better continuity, fall back to shortTermMemory
    // Filter out system messages to avoid confusing the LLM with prior prompt context
    if (options.includeHistory) {
      const maxItems = options.maxHistoryItems || 10;
      const historySource = state.messages.length > 0 ? state.messages : state.shortTermMemory;
      const userAssistantMessages = historySource.filter(m => m.role === 'user' || m.role === 'assistant');

      if (userAssistantMessages.length > 0) {
        parts.push('Conversation history:');
        userAssistantMessages.slice(-maxItems).forEach(m => {
          parts.push(`${ m.role === 'user' ? 'User' : 'Assistant' }: ${ m.content }`);
        });
        parts.push('');
      }
    }

    // Add the main instruction
    parts.push(instruction);

    const finalPrompt = parts.join('\n');

    return finalPrompt;
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
   * Connection ID is read from state.metadata.wsConnectionId (defaults to 'chat-controller')
   * @param state ThreadState containing the connection ID in metadata
   * @param content Message content to display
   * @param role 'assistant' | 'system' - defaults to 'assistant'
   * @param kind Optional UI kind tag - defaults to 'progress'
   * @returns true if message was sent via WebSocket
   */
  protected emitChatMessage(
    state: ThreadState,
    content: string,
    role: 'assistant' | 'system' = 'assistant',
    kind: string = 'progress',
  ): boolean {
    if (!content.trim()) {
      return false;
    }

    // Get connection ID from state or use default
    const connectionId = (state.metadata.wsConnectionId as string) || 'chat-controller';

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
   * Emit a progress event via WebSocket
   * @param state ThreadState containing the connection ID in metadata
   * @param phase Progress phase (node_start, tool_call, tool_result, etc.)
   * @param data Progress event data
   * @returns true if message was sent via WebSocket
   */
  protected emitProgress(
    state: ThreadState,
    phase: string,
    data: Record<string, unknown> = {},
  ): boolean {
    const connectionId = (state.metadata.wsConnectionId as string) || 'chat-controller';

    if (!this.isWebSocketConnected(connectionId)) {
      this.connectWebSocket(connectionId);
    }

    const sent = this.dispatchToWebSocket(connectionId, {
      type: 'progress',
      data: {
        phase,
        nodeId: this.id,
        nodeName: this.name,
        ...data,
        timestamp: Date.now(),
      },
    });

    if (!sent) {
      console.warn(`[Agent:${this.name}] Failed to send progress event via WebSocket`);
    }

    return sent;
  }

  /**
   * Check if chat message emission via WebSocket is available
   * @param state ThreadState containing the connection ID in metadata
   */
  protected canEmitChatMessage(state: ThreadState): boolean {
    const connectionId = (state.metadata.wsConnectionId as string) || 'chat-controller';
    return this.isWebSocketConnected(connectionId);
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
   * Execute multiple tool calls and return results
   */
  protected async executeToolCalls(
    state: ThreadState,
    tools: unknown[],
  ): Promise<Array<{ toolName: string; success: boolean; result?: unknown; error?: string }>> {
    console.log(`[BaseNode:${this.name}] Executing ${tools.length} tool calls:`, JSON.stringify(tools, null, 2));
    
    const { getToolRegistry, registerDefaultTools } = await import('../tools');
    registerDefaultTools();
    const registry = getToolRegistry();

    const normalized = this.normalizeToolCalls(tools);
    const results: Array<{ toolName: string; success: boolean; result?: unknown; error?: string }> = [];

    for (const { toolName, args } of normalized) {
      console.log(`[BaseNode:${this.name}] Executing tool: ${toolName} with args:`, JSON.stringify(args, null, 2));
      
      const tool = registry.get(toolName);
      if (!tool) {
        const error = `Unknown tool: ${toolName}`;
        console.error(`[BaseNode:${this.name}] Tool execution failed:`, error);
        results.push({ toolName, success: false, error });
        continue;
      }

      try {
        const result = await tool.execute(state, {
          toolName,
          args,
        });
        
        console.log(`[BaseNode:${this.name}] Tool ${toolName} result:`, {
          success: result.success,
          result: result.result,
          error: result.error
        });
        
        results.push({
          toolName,
          success: result.success,
          result: result.result,
          error: result.error,
        });
      } catch (err: any) {
        const error = err.message || String(err);
        console.error(`[BaseNode:${this.name}] Tool ${toolName} threw exception:`, error);
        results.push({ toolName, success: false, error });
      }
    }

    console.log(`[BaseNode:${this.name}] All tool executions completed. Results:`, JSON.stringify(results, null, 2));
    return results;
  }

  public async executeSingleToolAction(
    state: ThreadState,
    toolName: string,
    args?: Record<string, unknown>,
  ): Promise<ToolResult> {
    registerDefaultTools();
    const registry = getToolRegistry();

    const tool = registry.get(toolName);
    if (!tool) {
      return { toolName, success: false, error: `Unknown tool action: ${toolName}` };
    }

    const toolRunId = `${Date.now()}_${toolName}_${Math.floor(Math.random() * 1_000_000)}`;

    // Skip tool_call progress event for chat message tools to avoid UI tool cards
    const isChatTool = toolName === 'emit_chat_message' || toolName === 'emit_chat_image';
    if (!isChatTool) {
      this.emitProgress(state, 'tool_call', { toolRunId, toolName, args: args || {} });
    }

    const result = await tool.execute(state, {
      toolName: toolName,
      args,
    });

    // Skip tool_result progress event for chat tools
    if (!isChatTool) {
      this.emitProgress(state, 'tool_result', { toolRunId, toolName, success: result.success, error: result.error || null, result: result.result });
      await this.appendToolResultMessage(state, toolName, result);
    }
    
    return result;
  }

  public async appendToolResultMessage(state: ThreadState, action: string, result: ToolResult): Promise<void> {
    const summary = result.success
      ? `Tool ${action} succeeded`
      : `Tool ${action} failed: ${result.error || 'unknown error'}`;

    let toolHelpInfo = null;
    
    // If tool failed, get full help information to help LLM understand proper usage
    if (!result.success) {
      try {
        const { getToolRegistry, registerDefaultTools } = await import('../tools');
        registerDefaultTools();
        const registry = getToolRegistry();
        const tool = registry.get(action);
        
        if (tool) {
          toolHelpInfo = tool.getPlanningInstructions();
        }
      } catch (error) {
        console.warn(`[BaseNode] Failed to get help info for tool ${action}:`, error);
      }
    }

    const content = JSON.stringify(
      {
        tool: action,
        success: result.success,
        error: result.error || null,
        // Only include result if small; otherwise just summary
        result: result.result && JSON.stringify(result.result).length < 5000
          ? result.result
          : '[result truncated — see logs]',
        // Include full help information for failed tools
        helpInfo: toolHelpInfo,
      },
      null,
      2
    );

    const id = `tool_result_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    state.messages.push({
      id,
      role: 'assistant',
      content,
      timestamp: Date.now(),
      metadata: {
        nodeId: this.id,
        nodeName: this.name,
        kind: 'tool_result',
        toolName: action,
        success: result.success,
        summary, // short human-readable line for chat UI
      },
    });
  }

  public appendExecutionNote(state: ThreadState, note: string): void {
    const text = String(note || '').trim();
    if (!text) {
      return;
    }

    const existing = Array.isArray((state.metadata as any).executionNotes)
      ? ((state.metadata as any).executionNotes as unknown[]).map(String)
      : [];

    const next = [...existing, text].slice(-12);
    (state.metadata as any).executionNotes = next;
  }

  public appendToolResult(state: ThreadState, action: string, result: ToolResult): void {
    const prior = (state.metadata as any).toolResults;
    const priorObj = (prior && typeof prior === 'object') ? (prior as Record<string, ToolResult>) : {};
    (state.metadata as any).toolResults = { ...priorObj, [action]: result };

    const historyExisting = Array.isArray((state.metadata as any).toolResultsHistory)
      ? ((state.metadata as any).toolResultsHistory as unknown[])
      : [];
    const entry = {
      at: Date.now(),
      toolName: action,
      success: !!result.success,
      error: result.error || null,
      result: result.result,
    };
    (state.metadata as any).toolResultsHistory = [...historyExisting, entry].slice(-12);
  }

  public async promptLLM(state: ThreadState, prompt: string): Promise<string | null> {
    try {
      const enriched = await this.enrichPrompt(prompt, state, {
        includeSoul: false,
        includeAwareness: false,
        includeMemory: false,
      });

      const llm = getLLMService();
      await llm.initialize();
      if (!llm.isAvailable()) {
        return null;
      }

      return await llm.generate(enriched);
    } catch {
      return null;
    }
  }
}
