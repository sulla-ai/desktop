import { getWebSocketClientService, type WebSocketMessage } from './WebSocketClientService';
import { runHierarchicalGraph } from './GraphExecutionService';
import { getSensory } from '../SensoryInput';

const BACKEND_CHANNEL_ID = 'chat-controller-backend';

export class BackendGraphWebSocketService {
  private readonly wsService = getWebSocketClientService();
  private unsubscribe: (() => void) | null = null;

  constructor() {
    this.initialize();
  }

  dispose(): void {
    if (this.unsubscribe) {
      this.unsubscribe();
      this.unsubscribe = null;
    }
  }

  private initialize(): void {
    this.wsService.connect(BACKEND_CHANNEL_ID);
    this.unsubscribe = this.wsService.onMessage(BACKEND_CHANNEL_ID, (msg) => {
      this.handleWebSocketMessage(msg);
    });
  }

  private async handleWebSocketMessage(msg: WebSocketMessage): Promise<void> {
    if (msg.type !== 'user_message') {
      return;
    }

    const data = typeof msg.data === 'string' ? { content: msg.data } : (msg.data as any);
    const content = typeof data?.content === 'string' ? data.content : '';

    if (!content.trim()) {
      return;
    }

    await this.processMessage(content.trim());
  }

  private async processMessage(content: string): Promise<void> {
    try {
      const sensory = getSensory();
      const input = sensory.createTextInput(content);

      await runHierarchicalGraph({
        input,
        wsConnectionId: BACKEND_CHANNEL_ID,
      });
    } catch (err) {
      console.error('[BackendGraphWebSocketService] Failed to process message:', err);
    }
  }
}
