import type { Ref } from 'vue';

import type { AgentResponse, SensoryInput } from '../types';
import { getWebSocketClientService, type WebSocketMessage } from './WebSocketClientService';
import { runHierarchicalGraph } from './GraphExecutionService';
import { AbortService } from './AbortService';

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
      try {
        this.activeAbort.abort();
      } catch {
        // ignore
      }
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
      if (this.activeAbort && !this.activeAbort.signal.aborted) {
        try {
          this.activeAbort.abort();
        } catch {
          // ignore
        }
      }
      return;
    }

    if (msg.type !== 'user_message') {
      return;
    }

    const payload = typeof msg.payload === 'string' ? { content: msg.payload } : (msg.payload as any);
    const content = typeof payload?.content === 'string' ? payload.content : '';

    if (!content.trim()) {
      return;
    }

    // Send scheduler acknowledgement if message originated from scheduler
    const metadata = payload?.metadata;
    if (metadata?.origin === 'scheduler' && typeof metadata?.eventId === 'number') {
      this.wsService.send('chat-controller', {
        type: 'scheduler_ack',
        payload: { eventId: metadata.eventId },
        timestamp: Date.now(),
      });
    }

    await this.processUserInput(content.trim());
  }

  private async processUserInput(userText: string): Promise<void> {
    const channelId = 'chat-controller';
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

      const response = await runHierarchicalGraph({
        input,
        wsConnectionId: channelId,
        threadId: this.deps.currentThreadId.value || undefined,
        onAgentResponse: this.deps.onAgentResponse,
        abort: this.activeAbort,
      });

      if (!response) {
        return;
      }

      this.deps.currentThreadId.value = response.threadId;

      if (this.deps.responseHandler.hasErrors(response)) {
        const err = this.deps.responseHandler.getError(response);
        throw new Error(err || 'Unknown error');
      }

      const formatted = this.deps.responseHandler.formatText(response) || response.content;
      if (formatted.trim()) {
        this.emitAssistantMessage(formatted.trim());
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      this.emitSystemMessage(`Error: ${message}`);
    } finally {
      this.activeAbort = null;
    }
  }

  private emitAssistantMessage(content: string): void {
    this.wsService.send('chat-controller', {
      type: 'assistant_message',
      payload: {
        role: 'assistant',
        content,
      },
      timestamp: Date.now(),
    });
  }

  private emitSystemMessage(content: string): void {
    this.wsService.send('chat-controller', {
      type: 'system_message',
      payload: content,
      timestamp: Date.now(),
    });
  }
}
