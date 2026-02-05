import type { ThreadState, ToolResult } from '../types';
import { BaseTool } from './BaseTool';
import type { ToolContext } from './BaseTool';
import { getWebSocketClientService } from '../services/WebSocketClientService';

export class EmitChatMessageTool extends BaseTool {
  override readonly name = 'emit_chat_message';
  override readonly aliases = ['emit', 'emit_chat'];
  
  override getPlanningInstructions(): string {
    return `["emit_chat_message", "Your message here"] - Send message to user in chat

Examples:
["emit_chat_message", "Thinking step 1..."]
["emit_chat_message", "Found 42 leads — processing now", "--kind", "progress"]
["emit_chat_message", "High-ticket close complete! $12k booked.", "--role", "assistant", "--kind", "final"]
`.trim();
  }

  override async execute(state: ThreadState, context: ToolContext): Promise<ToolResult> {
    // Handle help request first
    const helpResult = await this.handleHelpRequest(context);
    if (helpResult) return helpResult;

    const args = this.getArgsArray(context); // everything after "emit_chat_message"

    if (!args.length) {
      return { toolName: this.name, success: false, error: 'Missing message content' };
    }

    // First arg is always the message (exec form convention)
    let content = args[0].trim();

    // Parse remaining flags with your existing argsToObject
    const params = this.argsToObject(args.slice(1));

    const kind = (params.kind as string) || 'progress';
    const role = (params.role as string) || 'assistant';

    // Clean up escaped characters
    content = content
      .replace(/\\n/g, '\n')
      .replace(/\\t/g, '\t');

    if (!content) {
      return { toolName: this.name, success: false, error: 'Empty message content' };
    }

    // Get connection ID (same as before)
    const connectionId = (state.metadata?.wsConnectionId as string) || 'chat-controller';

    console.log(`[emit_chat_message] Sending:`, { role, kind, content });

    const wsService = getWebSocketClientService();
    wsService.send(connectionId, {
      type: 'assistant_message',
      data: { role, content, kind },
      timestamp: Date.now(),
    });

    return {
      toolName: this.name,
      success: true,
      result: { emitted: true, kind, role, contentLength: content.length },
    };
  }
}