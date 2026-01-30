import type { ThreadState, ToolResult } from '../types';
import { getChromaService } from '../services/ChromaService';
import { getMemoryPedia } from '../services/MemoryPedia';
import { BaseTool } from './BaseTool';
import type { ToolContext } from './BaseTool';

export class MemorySearchTool extends BaseTool {
  override readonly name = 'memory_search';
  override readonly aliases = ['recall_memory'];

  override getPlanningInstructions(): string {
    return [
      '1) memory_search (ChromaDB/MemoryPedia)',
      '   - Purpose: Recall relevant long-term memory (past conversation summaries and entity pages).',
      '   - Input: One or more short, specific search queries (entity names, project names, error strings, feature names).',
      '   - Output: Relevant memory snippets will be provided to the assistant as additional context.',
      '   - Use when:',
      '     - User asks about what you "remember" or prior discussions.',
      '     - User references MemoryPedia, Chroma, long-term memory, or an entity/topic that may already exist.',
      '     - User asks follow-ups like "how did we do X last time" or "what was the previous decision".',
      '   - Planning guidance:',
      '     - Set requiresTools=true',
      '     - Provide context.needsMemoryRecall=true and context.memorySearchQueries with 1-5 specific queries',
      '     - Include a step with action "memory_search" before generating the final response.',
    ].join('\n');
  }

  override async execute(state: ThreadState, context: ToolContext): Promise<ToolResult> {
    const chroma = getChromaService();
    const results: string[] = [];

    const queries = (context.memorySearchQueries && context.memorySearchQueries.length > 0)
      ? context.memorySearchQueries
      : [state.messages.filter(m => m.role === 'user').pop()?.content || ''];

    try {
      try {
        await getMemoryPedia().initialize();
      } catch {
        // continue
      }

      const ok = await chroma.initialize();
      if (!ok || !chroma.isAvailable()) {
        return { toolName: this.name, success: true, result: { queries, count: 0 } };
      }

      await chroma.refreshCollections();

      for (const query of queries) {
        if (!query) {
          continue;
        }

        const summaryResults = await chroma.query('conversation_summaries', [query], 3);
        if (summaryResults?.documents?.[0]) {
          for (const doc of summaryResults.documents[0]) {
            if (doc && !results.includes(doc)) {
              results.push(doc);
            }
          }
        }

        const pageResults = await chroma.query('memorypedia_pages', [query], 3);
        if (pageResults?.documents?.[0]) {
          for (const doc of pageResults.documents[0]) {
            if (doc && !results.includes(doc)) {
              results.push(doc);
            }
          }
        }
      }

      const top = results.slice(0, 5);

      if (top.length > 0) {
        state.metadata.retrievedMemories = top;
        state.metadata.memoryContext = top
          .map((m: string, i: number) => `[Memory ${i + 1}]: ${m}`)
          .join('\n');
      }

      return {
        toolName: this.name,
        success:  true,
        result:   { queries, count: top.length },
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return { toolName: this.name, success: false, error: msg };
    }
  }
}
