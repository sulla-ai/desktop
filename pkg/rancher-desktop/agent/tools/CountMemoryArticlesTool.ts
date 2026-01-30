import type { ThreadState, ToolResult } from '../types';
import { getChromaService } from '../services/ChromaService';
import { getMemoryPedia } from '../services/MemoryPedia';
import { BaseTool } from './BaseTool';
import type { ToolContext } from './BaseTool';

export class CountMemoryArticlesTool extends BaseTool {
  override readonly name = 'count_memory_articles';
  override readonly aliases = ['count_memory', 'count_memorypedia'];

  override getPlanningInstructions(): string {
    return [
      '2) count_memory_articles (ChromaDB/MemoryPedia)',
      '   - Purpose: Count how many memory items exist in long-term memory.',
      '   - Output: Counts for conversation summaries and memorypedia pages (and a total).',
      '   - Use when:',
      '     - User asks: "how many articles/memories/pages are stored" or any question requiring counts.',
      '   - Planning guidance:',
      '     - Set requiresTools=true',
      '     - Include a step with action "count_memory_articles" before generating the final response.',
    ].join('\n');
  }

  override async execute(state: ThreadState, _context: ToolContext): Promise<ToolResult> {
    const chroma = getChromaService();

    try {
      try {
        await getMemoryPedia().initialize();
      } catch {
        // continue
      }

      await chroma.initialize();
      await chroma.refreshCollections();

      const summaries = await chroma.count('conversation_summaries');
      const pages = await chroma.count('memorypedia_pages');
      const total = summaries + pages;
      const summary = `Memory counts (ChromaDB): conversation_summaries=${summaries}, memorypedia_pages=${pages}, total=${total}`;

      state.metadata.memoryArticleCounts = { summaries, pages, total, summary };
      state.metadata.memoryContext = state.metadata.memoryContext
        ? `${state.metadata.memoryContext as string}\n\n${summary}`
        : summary;

      return { toolName: this.name, success: true, result: { summaries, pages, total, summary } };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return { toolName: this.name, success: false, error: msg };
    }
  }
}
