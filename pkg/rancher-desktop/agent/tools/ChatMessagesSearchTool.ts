import type { ThreadState, ToolResult } from '../types';
import { BaseTool } from './BaseTool';
import type { ToolContext } from './BaseTool';
import { getPersistenceService } from '../services/PersistenceService';

export class ChatMessagesSearchTool extends BaseTool {
  override readonly name = 'chat_messages_search';
  override readonly aliases = ['chat_history_search', 'conversation_messages_search'];
  override readonly category = 'memory';

  override getPlanningInstructions(): string {
    return [
      '3) chat_messages_search (ChatMessages / Postgres)',
      '   - Purpose: Retrieve/search raw ChatMessages (full conversation messages) stored in Postgres table "conversations".',
      '   - Args:',
      '     - threadId (string, optional)  // default: current thread',
      '     - query (string, optional)     // if provided, only matching messages are returned',
      '     - limit (number, optional)     // default 20, max 200',
      '   - Output: Sets state.metadata.chatMessagesContext with relevant raw messages.',
      '   - Use when:',
      '     - You need exact phrasing, code snippets, or precise details from earlier in this chat.',
      '   - Do NOT use for:',
      '     - Durable reference docs (use knowledge_base_search)',
      '     - High-level recall (use chat_summaries_search)',
    ].join('\n');
  }

  override async execute(state: ThreadState, context: ToolContext): Promise<ToolResult> {
    const threadId = String(context.args?.threadId || state.threadId || '').trim();
    if (!threadId) {
      return { toolName: this.name, success: false, error: 'Missing threadId (and state.threadId is empty)' };
    }

    const query = String(context.args?.query || '').trim();
    const limitRaw = context.args?.limit;
    const limit = Number.isFinite(Number(limitRaw)) ? Math.max(1, Math.min(200, Number(limitRaw))) : 20;

    try {
      const persistence = getPersistenceService();
      await persistence.initialize();

      const messages = await persistence.loadConversation(threadId);
      const safeMessages = Array.isArray(messages) ? messages : [];

      const normalized = safeMessages
        .map(m => ({ role: String((m as any).role || ''), content: String((m as any).content || '') }))
        .filter(m => m.role && m.content);

      const filtered = query
        ? normalized.filter(m => m.content.toLowerCase().includes(query.toLowerCase()))
        : normalized;

      const top = filtered.slice(-limit);

      (state.metadata as any).chatMessagesResults = top;
      (state.metadata as any).chatMessagesContext = top
        .map((m, i) => `[ChatMessages ${i + 1}] ${m.role}: ${m.content}`)
        .join('\n');

      return {
        toolName: this.name,
        success: true,
        result: {
          threadId,
          query: query || null,
          returned: top.length,
          total: normalized.length,
          limit,
        },
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return { toolName: this.name, success: false, error: msg };
    }
  }
}
