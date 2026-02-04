import type { ThreadState, ToolResult } from '../types';
import { getChromaService } from '../services/ChromaService';
import { getMemoryPedia } from '../services/MemoryPedia';
import { BaseTool } from './BaseTool';
import type { ToolContext } from './BaseTool';

export class ChatSummariesSearchTool extends BaseTool {
  override readonly name = 'chat_summaries_search';
  override readonly aliases = ['chat_summary_search', 'conversation_summaries_search'];
  override readonly category = 'memory';

  override getPlanningInstructions(): string {
    return [
      '2) chat_summaries_search (ChatSummaries / Chroma)',
      '   - Purpose: Search ChatSummaries stored in Chroma collection "conversation_summaries".',
      '   - Args:',
      '     - query (string, required)  // short, specific search text',
      '     - limit (number, optional)  // default 6, max 50',
      '   - Output: Sets state.metadata.chatSummariesContext with relevant summary snippets.',
      '   - Use when:',
      '     - You need recall of prior conversations (high-level summaries), not raw chat.',
      '     - The user references a prior discussion but details are fuzzy.',
      '   - Do NOT use for:',
      '     - Durable reference docs (use knowledge_base_search)',
      '     - Full raw messages (use chat_messages_search)',
    ].join('\n');
  }

  override async execute(state: ThreadState, context: ToolContext): Promise<ToolResult> {
    const chroma = getChromaService();

    const query = String(context.args?.query || '').trim();
    if (!query) {
      return { toolName: this.name, success: false, error: 'Missing args: query' };
    }

    const limitRaw = context.args?.limit;
    const limit = Number.isFinite(Number(limitRaw)) ? Math.max(1, Math.min(50, Number(limitRaw))) : 6;

    try {
      try {
        await getMemoryPedia().initialize();
      } catch {
        // continue
      }

      const ok = await chroma.initialize();
      if (!ok || !chroma.isAvailable()) {
        (state.metadata as any).chatSummariesContext = '';
        (state.metadata as any).chatSummariesResults = [];
        return { toolName: this.name, success: true, result: { query, count: 0, limit } };
      }

      await chroma.refreshCollections();

      const summaryResults = await chroma.query('conversation_summaries', [query], limit);
      const docs = summaryResults?.documents?.[0] || [];
      const top = docs.filter(Boolean).slice(0, limit);

      (state.metadata as any).chatSummariesResults = top;
      (state.metadata as any).chatSummariesContext = top
        .map((m: string, i: number) => `[ChatSummaries ${i + 1}]: ${m}`)
        .join('\n');

      return {
        toolName: this.name,
        success: true,
        result: { query, count: top.length, limit },
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return { toolName: this.name, success: false, error: msg };
    }
  }
}
