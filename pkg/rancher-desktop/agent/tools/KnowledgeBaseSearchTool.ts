import type { ThreadState, ToolResult } from '../types';
import { getChromaService } from '../services/ChromaService';
import { getMemoryPedia } from '../services/MemoryPedia';
import { BaseTool } from './BaseTool';
import type { ToolContext } from './BaseTool';

export class KnowledgeBaseSearchTool extends BaseTool {
  override readonly name = 'knowledge_base_search';
  override readonly aliases = ['kb_search', 'knowledgebase_search'];

  override getPlanningInstructions(): string {
    return [
      '1) knowledge_base_search (KnowledgeBase / Chroma articles)',
      '   - Purpose: Search the KnowledgeBase articles stored in Chroma collection "knowledgebase_articles".',
      '   - Args:',
      '     - query (string, required)  // short, specific search text',
      '     - limit (number, optional)  // default 6, max 50',
      '   - Output: Sets state.metadata.knowledgeBaseContext with the top matching article content.',
      '   - Use when:',
      '     - You need durable facts, entity pages, project docs, architecture notes, or seeded documentation.',
      '     - The user references "KnowledgeBase" or asks for stored reference material.',
      '   - Do NOT use for:',
      '     - Recent conversation context (use chat_messages_search)',
      '     - Past conversation summaries (use chat_summaries_search)',
    ].join('\n');
  }

  override async execute(state: ThreadState, context: ToolContext): Promise<ToolResult> {
    const helpResult = await this.handleHelpRequest(context);
    if (helpResult) {
      return helpResult;
    }
    
    const chroma = getChromaService();

    const args = this.getArgsArray(context, 1);
    const query = String(args[0] || '').trim();
    if (!query) {
      return { toolName: this.name, success: false, error: 'Missing args: query' };
    }

    const limitRaw = args[1];
    const limit = Number.isFinite(Number(limitRaw)) ? Math.max(1, Math.min(50, Number(limitRaw))) : 6;

    try {
      try {
        await getMemoryPedia().initialize();
      } catch {
        // continue
      }

      const ok = await chroma.initialize();
      if (!ok || !chroma.isAvailable()) {
        (state.metadata as any).knowledgeBaseContext = '';
        (state.metadata as any).knowledgeBaseResults = [];
        return { toolName: this.name, success: true, result: { query, count: 0, limit } };
      }

      await chroma.refreshCollections();

      const pageResults = await chroma.query('knowledgebase_articles', [query], limit);
      const docs = pageResults?.documents?.[0] || [];
      const top = docs.filter(Boolean).slice(0, limit);

      (state.metadata as any).knowledgeBaseResults = top;
      (state.metadata as any).knowledgeBaseContext = top
        .map((m: string, i: number) => `[KnowledgeBase ${i + 1}]: ${m}`)
        .join('\n');

      return {
        toolName: this.name,
        success: true,
        result: { query, count: top.length, limit, documents: top },
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return { toolName: this.name, success: false, error: msg };
    }
  }
}
