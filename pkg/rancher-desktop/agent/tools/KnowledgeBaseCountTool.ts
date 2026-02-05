import type { ThreadState, ToolResult } from '../types';
import { getChromaService } from '../services/ChromaService';
import { getMemoryPedia } from '../services/MemoryPedia';
import { BaseTool } from './BaseTool';
import type { ToolContext } from './BaseTool';

export class KnowledgeBaseCountTool extends BaseTool {
  override readonly name = 'knowledge_base_count';
  override readonly aliases = ['kb_count', 'knowledgebase_count'];

  override getPlanningInstructions(): string {
    return [
      '4) knowledge_base_count (KnowledgeBase / Chroma articles)',
      '   - Purpose: Count how many KnowledgeBase articles exist in Chroma collection "knowledgebase_articles".',
      '   - Args: none',
      '   - Output: Count only.',
    ].join('\n');
  }

  override async execute(state: ThreadState, _context: ToolContext): Promise<ToolResult> {
    const helpResult = await this.handleHelpRequest(_context);
    if (helpResult) {
      return helpResult;
    }
    
    const chroma = getChromaService();

    try {
      try {
        await getMemoryPedia().initialize();
      } catch {
        // continue
      }

      await chroma.initialize();
      await chroma.refreshCollections();

      const articles = await chroma.count('knowledgebase_articles');
      (state.metadata as any).knowledgeBaseCounts = { articles };

      return { toolName: this.name, success: true, result: { articles } };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return { toolName: this.name, success: false, error: msg };
    }
  }
}
