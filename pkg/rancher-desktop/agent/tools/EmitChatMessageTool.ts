import type { ThreadState, ToolResult } from '../types';
import type { ToolContext } from './BaseTool';
import { BaseTool } from './BaseTool';
import { getWebSocketClientService } from '../services/WebSocketClientService';

export class EmitChatMessageTool extends BaseTool {
  readonly name = 'emit_chat_message';
  readonly category = 'agent';

  getPlanningInstructions(): string {
    return [
      '35) emit_chat_message',
      '- Purpose: Emit a user-visible chat bubble during plan execution to explain what you\'re doing.',
      '- args:',
      '  - content (string): The message to show to the user.',
      '  - role (string, optional): "assistant" | "system". Defaults to "assistant".',
      '  - kind (string, optional): Optional UI kind tag. Defaults to "progress".',
    ].join('\n');
  }

  async execute(state: ThreadState, context: ToolContext): Promise<ToolResult> {
    const args = (context.args && typeof context.args === 'object') ? context.args : {};
    const rawContent = typeof (args as any).content === 'string'
      ? String((args as any).content)
      : (typeof (args as any).message === 'string' ? String((args as any).message) : '');
    const content = rawContent
      .replace(/\\n/g, '\n')
      .replace(/\\t/g, '\t');
    const role = typeof (args as any).role === 'string' ? String((args as any).role) : 'assistant';
    const kind = typeof (args as any).kind === 'string' ? String((args as any).kind) : 'progress';

    // Get connection ID from state metadata or use default
    const connectionId = (state.metadata?.wsConnectionId as string) || 'chat-controller';

    if (content.trim()) {
      // Send via WebSocket so persona receives it
      const wsService = getWebSocketClientService();
      wsService.send(connectionId, {
        type: 'assistant_message',
        payload: { role, content, kind },
        timestamp: Date.now(),
      });

    }

    return { toolName: this.name, success: true, result: { emitted: !!content.trim() } };
  }
}
