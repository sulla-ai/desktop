import { computed, nextTick, ref } from 'vue';
import type { ComputedRef, Ref } from 'vue';

import type { ConversationThread } from '@pkg/agent/ConversationThread';
import { onGlobalEvent, offGlobalEvent } from '@pkg/agent/ConversationThread';
import type { AgentResponse, SensoryInput, ThreadContext, AgentEvent } from '@pkg/agent/types';
import { AbortService } from '@pkg/agent/services/AbortService';
import { getWebSocketClientService, type WebSocketMessage } from '@pkg/agent/services/WebSocketClientService';

import type { StartupProgressController } from './StartupProgressController';

export type ChatMessage = {
  id: string;
  role: 'user' | 'assistant' | 'error' | 'system';
  content: string;
  kind?: 'text' | 'tool' | 'planner' | 'critic' | 'progress';
  image?: {
    dataUrl: string;
    alt?: string;
    contentType?: string;
    path?: string;
  };
  toolCard?: {
    toolRunId: string;
    toolName: string;
    status: 'running' | 'success' | 'failed';
    args?: Record<string, unknown>;
    result?: unknown;
    error?: string | null;
  };
};

export class AgentChatController {
  readonly query = ref('');
  readonly loading = ref(false);
  readonly messages = ref<ChatMessage[]>([]);
  readonly transcriptEl = ref<HTMLElement | null>(null);
  readonly hasMessages: ComputedRef<boolean> = computed(() => this.messages.value.length > 0);

  private activeAbort: AbortService | null = null;

  private readonly showInternalProgress = false;
  // !!((import.meta as any)?.env?.DEV ?? (typeof process !== 'undefined' && (process as any)?.env?.NODE_ENV !== 'production'));

  private readonly pendingPrompts: string[] = [];
  private drainingQueue = false;

  private readonly toolCardsByRunId = new Map<string, string>();
  private readonly toolCallArgsByRunId = new Map<string, Record<string, unknown>>();


  constructor(private readonly deps: {
    systemReady: Ref<boolean>;
    currentThreadId: Ref<string | null>;

    sensory: { createTextInput: (text: string) => SensoryInput };
    getThread: (threadId: string) => ConversationThread;
    responseHandler: {
      hasErrors: (resp: AgentResponse) => boolean;
      getError: (resp: AgentResponse) => string | null | undefined;
      formatText: (resp: AgentResponse) => string | undefined;
    };

    onAgentResponse?: (resp: AgentResponse) => void;

    onAgentEvent?: (event: { type: string; threadId: string; data: any; timestamp: number }) => void;

    startupProgress: StartupProgressController;
  }) {
    // Subscribe to global events from all threads (including heartbeat)
    this.globalEventHandler = (event: AgentEvent) => {
      this.deps.onAgentEvent?.(event as any);
      this.handleAgentEvent(event as any);
    };
    onGlobalEvent(this.globalEventHandler);

    if (!this.deps.currentThreadId.value) {
      this.deps.currentThreadId.value = `thread_${ Date.now() }`;
    }
  }

  private globalEventHandler: ((event: AgentEvent) => void) | null = null;
  private subscribedThreadId: string | null = null;

  /**
   * Clean up event subscriptions
   */
  dispose(): void {
    if (this.globalEventHandler) {
      offGlobalEvent(this.globalEventHandler);
      this.globalEventHandler = null;
    }
  }

  private ensureThreadEventSubscription(threadId: string): void {
    // Thread subscription is no longer needed - we use global events instead
    // This prevents duplicate messages since global events capture all thread events
    this.subscribedThreadId = threadId;
  }

  private handleAgentEvent(event: { type: string; threadId: string; data: any; timestamp: number }) {
    if (event.type !== 'progress') {
      return;
    }

    const phase = event.data?.phase;
    if (!phase) {
      return;
    }

    if (!this.showInternalProgress && (phase === 'plan_created' || phase === 'plan_revised' || phase === 'todo_created' || phase === 'todo_updated' || phase === 'todo_deleted' || phase === 'todo_status')) {
      return;
    }

    if (phase === 'plan_created' || phase === 'plan_revised') {
      const planId = Number(event.data.planId);
      const revision = event.data.revision !== undefined ? Number(event.data.revision) : null;
      const goal = typeof event.data.goal === 'string' ? event.data.goal : '';
      const label = phase === 'plan_created' ? 'Plan created' : 'Plan revised';
      const lines = [
        `${label}${Number.isFinite(planId) ? ` (id=${planId}${revision !== null && Number.isFinite(revision) ? ` rev=${revision}` : ''})` : ''}`,
        goal ? `Goal: ${goal}` : null,
      ].filter(Boolean).join('\n');
      this.messages.value.push({ id: `${Date.now()}_${phase}`, role: 'system', kind: 'planner', content: lines });
      return;
    }

    if (phase === 'chat_image') {
      const role = String(event.data.role || 'assistant');
      const dataUrl = typeof event.data.dataUrl === 'string' ? String(event.data.dataUrl) : '';
      const alt = typeof event.data.alt === 'string' ? String(event.data.alt) : '';
      const contentType = typeof event.data.contentType === 'string' ? String(event.data.contentType) : '';
      const filePath = typeof event.data.path === 'string' ? String(event.data.path) : '';

      if (!dataUrl.trim()) {
        return;
      }

      if (role === 'assistant') {
        this.messages.value.push({
          id: `${Date.now()}_chat_image`,
          role: 'assistant',
          content: '',
          image: { dataUrl, alt, contentType, path: filePath },
        });
      } else {
        const kind = (typeof event.data.kind === 'string' ? (event.data.kind as any) : 'progress');
        this.messages.value.push({
          id: `${Date.now()}_chat_image`,
          role: 'system',
          kind,
          content: '',
          image: { dataUrl, alt, contentType, path: filePath },
        });
      }
      return;
    }

    if (phase === 'todo_created') {
      const planId = Number(event.data.planId);
      const todoId = Number(event.data.todoId);
      const title = typeof event.data.title === 'string' ? event.data.title : '';
      const orderIndex = event.data.orderIndex !== undefined ? Number(event.data.orderIndex) : null;
      this.messages.value.push({
        id: `${Date.now()}_todo_created_${todoId}`,
        role: 'system',
        kind: 'planner',
        content: `Todo created (plan=${planId} todo=${todoId}${orderIndex !== null && Number.isFinite(orderIndex) ? ` idx=${orderIndex}` : ''})\n${title}`,
      });
      return;
    }

    if (phase === 'todo_deleted') {
      const planId = Number(event.data.planId);
      const todoId = Number(event.data.todoId);
      this.messages.value.push({
        id: `${Date.now()}_todo_deleted_${todoId}`,
        role: 'system',
        kind: 'planner',
        content: `Todo deleted (plan=${planId} todo=${todoId})`,
      });
      return;
    }

    if (phase === 'todo_updated') {
      const planId = Number(event.data.planId);
      const todoId = Number(event.data.todoId);
      const title = typeof event.data.title === 'string' ? event.data.title : '';
      const orderIndex = event.data.orderIndex !== undefined ? Number(event.data.orderIndex) : null;
      const status = typeof event.data.status === 'string' ? event.data.status : '';
      this.messages.value.push({
        id: `${Date.now()}_todo_updated_${todoId}`,
        role: 'system',
        kind: 'planner',
        content: `Todo updated (plan=${planId} todo=${todoId}${orderIndex !== null && Number.isFinite(orderIndex) ? ` idx=${orderIndex}` : ''})\n${title}${title ? '\n' : ''}${status}`,
      });
      return;
    }

    if (phase === 'todo_status') {
      const planId = Number(event.data.planId);
      const todoId = Number(event.data.todoId);
      const title = typeof event.data.title === 'string' ? event.data.title : '';
      const status = typeof event.data.status === 'string' ? event.data.status : '';
      this.messages.value.push({
        id: `${Date.now()}_todo_status_${todoId}_${status}`,
        role: 'system',
        kind: 'progress',
        content: `Todo status (plan=${planId} todo=${todoId})\n${title}${title ? '\n' : ''}${status}`,
      });
      return;
    }

    if (phase === 'tool_call') {
      const toolName = String(event.data.toolName || 'tool');
      if (toolName === 'emit_chat_message' || toolName === 'emit_chat_image') {
        return;
      }
      const toolRunId = String(event.data.toolRunId || `${Date.now()}_${toolName}`);
      const args = (event.data.args && typeof event.data.args === 'object') ? (event.data.args as Record<string, unknown>) : {};
      this.toolCallArgsByRunId.set(toolRunId, args);

      const id = `tool_${toolRunId}`;
      this.toolCardsByRunId.set(toolRunId, id);

      // Don't show "running" tool cards in the UI - only show results
      return;
    }

    if (phase === 'tool_result') {
      const toolName = String(event.data.toolName || 'tool');
      if (toolName === 'emit_chat_message' || toolName === 'emit_chat_image') {
        return;
      }
      const toolRunId = String(event.data.toolRunId || '');
      const success = !!event.data.success;
      const error = event.data.error ? String(event.data.error) : null;
      const result = (event.data && 'result' in event.data) ? event.data.result : undefined;

      const args = toolRunId ? this.toolCallArgsByRunId.get(toolRunId) : undefined;

      const existingId = toolRunId ? this.toolCardsByRunId.get(toolRunId) : undefined;
      if (existingId) {
        const idx = this.messages.value.findIndex(m => m.id === existingId);
        if (idx >= 0) {
          const prior = this.messages.value[idx];
          this.messages.value[idx] = {
            ...prior,
            kind: 'tool',
            content: '',
            toolCard: {
              toolRunId,
              toolName,
              status: success ? 'success' : 'failed',
              args: args || prior.toolCard?.args,
              result,
              error,
            },
          };
          return;
        }
      }

      const id = `tool_${toolRunId || `${Date.now()}_${toolName}`}`;
      this.messages.value.push({
        id,
        role: 'system',
        kind: 'tool',
        content: '',
        toolCard: {
          toolRunId: toolRunId || id,
          toolName,
          status: success ? 'success' : 'failed',
          args,
          result,
          error,
        },
      });
      if (toolRunId) {
        this.toolCardsByRunId.set(toolRunId, id);
      }
      return;
    }

    if (phase === 'chat_message') {
      const role = String(event.data.role || 'assistant');
      const content = String(event.data.content || '').trim();
      if (!content) {
        return;
      }
      if (role === 'assistant') {
        this.messages.value.push({ id: `${Date.now()}_chat_message`, role: 'assistant', content });
      } else {
        const kind = (typeof event.data.kind === 'string' ? (event.data.kind as any) : 'progress');
        this.messages.value.push({ id: `${Date.now()}_chat_message`, role: 'system', kind, content });
      }
      return;
    }

    if (phase === 'critic_decision') {
      if (!this.showInternalProgress) {
        return;
      }
      const decision = String(event.data.decision || '');
      const reason = String(event.data.reason || '');
      this.messages.value.push({ id: `${Date.now()}_critic`, role: 'system', kind: 'critic', content: `Critic: ${decision}${reason ? `\n${reason}` : ''}` });
      return;
    }

    if (phase === 'node_start') {
      if (!this.showInternalProgress) {
        return;
      }
      const nodeName = String(event.data.nodeName || event.data.nodeId || 'node');
      this.messages.value.push({ id: `${Date.now()}_node_start`, role: 'system', kind: 'progress', content: `→ ${nodeName}` });
    }
  }

  private async processUserText(userText: string): Promise<void> {
    this.loading.value = true;

    // New run: cancel any prior in-flight work
    if (this.activeAbort) {
      try {
        this.activeAbort.abort();
      } catch {
        // ignore
      }
    }
    this.activeAbort = new AbortService();

    try {
      const input = this.deps.sensory.createTextInput(userText);

      const currentThreadId = this.deps.currentThreadId.value || undefined;

      if (!currentThreadId) {
        throw new Error('No threadId available');
      }

      const threadId = currentThreadId;

      this.ensureThreadEventSubscription(threadId);

      const thread = this.deps.getThread(threadId);
      await thread.initialize();

      // Set frontend WebSocket connection ID for user-triggered processing
      const state = thread.getState();
      state.metadata.wsConnectionId = 'chat-controller';

      const agentResponse = await thread.process(input, { abort: this.activeAbort });

      this.deps.onAgentResponse?.(agentResponse);

      if (this.deps.responseHandler.hasErrors(agentResponse)) {
        const err = this.deps.responseHandler.getError(agentResponse);
        throw new Error(err || 'Unknown error');
      }

      const formatted = this.deps.responseHandler.formatText(agentResponse) || '';
      this.messages.value.push({ id: `${Date.now()}_assistant`, role: 'assistant', content: formatted });
    } catch (err: unknown) {
      // Swallow AbortError: user explicitly hit Stop.
      if ((err instanceof Error && err.name === 'AbortError') || (this.activeAbort?.signal.aborted === true)) {
        return;
      }
      const message = err instanceof Error ? err.message : String(err);
      this.messages.value.push({ 
        id: `${Date.now()}_error`, 
        role: 'error', 
        content: `Error: ${message}` 
      });
    } finally {
      this.activeAbort = null;
      this.loading.value = false;
    }
  }

  stop(): void {
    if (this.activeAbort) {
      try {
        this.activeAbort.abort();
      } catch {
        // ignore
      }
    }
    // Clear any queued prompts; user wants to send a different message.
    this.pendingPrompts.splice(0, this.pendingPrompts.length);
    this.loading.value = false;
  }

  private async drainPromptQueue(): Promise<void> {
    if (this.drainingQueue) {
      return;
    }
    this.drainingQueue = true;
    try {
      while (!this.loading.value && this.pendingPrompts.length > 0) {
        const next = this.pendingPrompts.shift();
        if (!next) {
          continue;
        }
        await this.processUserText(next);
      }
    } finally {
      this.drainingQueue = false;
    }
  }

  async send(): Promise<void> {
    if (!this.query.value.trim()) {
      return;
    }

    const userText = this.query.value;
    this.query.value = '';
    this.messages.value.push({ id: `${Date.now()}_user`, role: 'user', content: userText });

    if (this.loading.value) {
      this.pendingPrompts.push(userText);
      return;
    }

    await this.processUserText(userText);
    await this.drainPromptQueue();
  }

  /**
   * Connect to WebSocket server to listen for backend messages
   * @param url WebSocket URL
   * @returns true if connection initiated
   */
  connectWebSocket(): boolean {
    const wsService = getWebSocketClientService();
    const connected = wsService.connect('chat-controller');

    if (connected) {
      // Listen for incoming messages from WebSocket
      setTimeout(() => {
        wsService.onMessage('chat-controller', (msg: WebSocketMessage) => {
          this.handleWebSocketMessage(msg);
        });
      }, 100);
    }

    return connected;
  }

  /**
   * Disconnect from WebSocket server
   */
  disconnectWebSocket(): void {
    const wsService = getWebSocketClientService();
    wsService.disconnect('chat-controller');
  }

  /**
   * Handle incoming WebSocket messages from backend
   * @param msg WebSocket message received
   */
  private handleWebSocketMessage(msg: WebSocketMessage): void {
    console.log('[AgentChatController] WebSocket message received:', msg);

    // Handle different message types
    switch (msg.type) {
      case 'chat_message':
      case 'assistant_message':
        // Add assistant message from external source
        if (typeof msg.payload === 'string') {
          this.messages.value.push({
            id: `${Date.now()}_ws_assistant`,
            role: 'assistant',
            content: msg.payload,
          });
        } else if (msg.payload && typeof (msg.payload as any).content === 'string') {
          this.messages.value.push({
            id: `${Date.now()}_ws_assistant`,
            role: (msg.payload as any).role || 'assistant',
            content: (msg.payload as any).content,
          });
        }
        break;

      case 'user_message':
        // External user message received - process it
        if (typeof msg.payload === 'string') {
          this.messages.value.push({
            id: `${Date.now()}_ws_user`,
            role: 'user',
            content: msg.payload,
          });
          // Process the message through the agent
          this.processUserText(msg.payload);
        }
        break;

      case 'system_message':
        // System notification
        if (typeof msg.payload === 'string') {
          this.messages.value.push({
            id: `${Date.now()}_ws_system`,
            role: 'system',
            content: msg.payload,
          });
        }
        break;

      default:
        console.log('[AgentChatController] Unknown WebSocket message type:', msg.type);
    }

    // Scroll to bottom after adding message
    nextTick(() => {
      this.scrollToBottom();
    });
  }

  /**
   * Scroll chat transcript to bottom
   */
  private scrollToBottom(): void {
    nextTick(() => {
      const el = this.transcriptEl.value;
      if (el) {
        el.scrollTop = el.scrollHeight;
      }
    });
  }

  /**
   * Check if WebSocket is connected
   */
  isWebSocketConnected(): boolean {
    const wsService = getWebSocketClientService();
    return wsService.isConnected('chat-controller');
  }

}
