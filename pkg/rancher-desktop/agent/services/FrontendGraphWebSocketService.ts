import type { Ref } from 'vue';
import type { AgentResponse, SensoryInput } from '../types';
import { getWebSocketClientService, type WebSocketMessage } from './WebSocketClientService';
import { AbortService } from './AbortService';
import { GraphRegistry, nextThreadId, nextMessageId } from './GraphRegistry';

export type FrontendGraphWebSocketDeps = {
  currentThreadId: Ref<string | null>;
  sensory: { createTextInput: (text: string) => SensoryInput };
  responseHandler: {
    hasErrors: (resp: AgentResponse) => boolean;
    getError: (resp: AgentResponse) => string | null | undefined;
    formatText: (resp: AgentResponse) => string | undefined;
  };
  onAgentResponse?: (resp: AgentResponse) => void;
};

export class FrontendGraphWebSocketService {
  private readonly wsService = getWebSocketClientService();
  private unsubscribe: (() => void) | null = null;
  private activeAbort: AbortService | null = null;

  constructor(private readonly deps: FrontendGraphWebSocketDeps) {
    this.initialize();
  }

  dispose(): void {
    if (this.unsubscribe) {
      this.unsubscribe();
      this.unsubscribe = null;
    }
    if (this.activeAbort) {
      this.activeAbort.abort();
      this.activeAbort = null;
    }
  }

  private initialize(): void {
    this.wsService.connect('chat-controller');
    this.unsubscribe = this.wsService.onMessage('chat-controller', (msg) => {
      this.handleWebSocketMessage(msg);
    });
  }

  private async handleWebSocketMessage(msg: WebSocketMessage): Promise<void> {
    if (msg.type === 'stop_run') {
      console.log('[FrontendGraphWS] stop_run received');
      this.activeAbort?.abort();
      return;
    }

    if (msg.type !== 'user_message') return;

    const data = typeof msg.data === 'string' ? { content: msg.data } : (msg.data as any);
    const content = (data?.content ?? '').trim();
    if (!content) return;

    const threadIdFromMsg = data?.threadId as string | undefined;

    // Scheduler ack
    const metadata = data?.metadata;
    if (metadata?.origin === 'scheduler' && typeof metadata?.eventId === 'number') {
      this.wsService.send('chat-controller', {
        type: 'scheduler_ack',
        data: { eventId: metadata.eventId },
        timestamp: Date.now(),
      });
    }

    await this.processUserInput(content, threadIdFromMsg);
  }

  private async processUserInput(userText: string, threadIdFromMsg?: string): Promise<void> {
    const channelId = 'chat-controller';

    try {
      // Use threadId from WS message if present, else generate new
      const threadId = threadIdFromMsg || nextThreadId();

      // Get or create persistent graph for this thread
      const { graph, state } = GraphRegistry.getOrCreate(channelId, threadId);

      // === NEW: Notify AgentPersonaService about the threadId ===
      if (!threadIdFromMsg) {
        this.wsService.send(channelId, {
          type: 'thread_created',
          data: {
            threadId: state.metadata.threadId
          },
          timestamp: Date.now()
        });
      }

      // Update local ref (for UI)
      if (!this.deps.currentThreadId.value) {
        this.deps.currentThreadId.value = threadId;
      }

      state.metadata.wsChannel = channelId;

      // Append new user message
      const newMsg = {
        id: nextMessageId(),
        role: 'user',
        content: userText,
        timestamp: Date.now(),
        metadata: { source: 'user' }
      };
      state.messages.push(newMsg as any);

      // Execute on the persistent graph
      await graph.execute(state);

      // Build response from final state
      const content = state.metadata.finalSummary?.trim() || (state.metadata as any).response?.trim() || '';

      const response: AgentResponse = {
        id: `resp_${Date.now()}`,
        threadId: state.metadata.threadId,
        type: 'text',
        content,
        refined: !!state.metadata.strategicCriticVerdict,
        metadata: { ...state.metadata },
        timestamp: Date.now()
      };

      if (this.deps.responseHandler.hasErrors(response)) {
        const err = this.deps.responseHandler.getError(response);
        throw new Error(err || 'Unknown error');
      }

      const formatted = this.deps.responseHandler.formatText(response) || response.content;
      if (formatted.trim()) {
        this.emitAssistantMessage(formatted.trim());
      }

      this.deps.onAgentResponse?.(response);
    } catch (err: any) {
      if (err.name === 'AbortError') {
        console.log('[FrontendGraphWS] Execution aborted');
        this.emitSystemMessage('Execution stopped.');
      } else {
        console.error('[FrontendGraphWS] Error:', err);
        this.emitSystemMessage(`Error: ${err.message || String(err)}`);
      }
    } finally {
      this.activeAbort = null;
    }
  }

  private emitAssistantMessage(content: string): void {
    this.wsService.send('chat-controller', {
      type: 'assistant_message',
      data: { role: 'assistant', content },
      timestamp: Date.now(),
    });
  }

  private emitSystemMessage(content: string): void {
    this.wsService.send('chat-controller', {
      type: 'system_message',
      data: content,
      timestamp: Date.now(),
    });
  }
}