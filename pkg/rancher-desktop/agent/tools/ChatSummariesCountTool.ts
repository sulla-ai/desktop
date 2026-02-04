import type { ThreadState, ToolResult } from '../types';
import { getChromaService } from '../services/ChromaService';
import { getMemoryPedia } from '../services/MemoryPedia';
import { BaseTool } from './BaseTool';
import type { ToolContext } from './BaseTool';

export class ChatSummariesCountTool extends BaseTool {
  override readonly name = 'chat_summaries_count';
  override readonly aliases = ['chat_summary_count', 'conversation_summaries_count'];
  override readonly category = 'memory';

  override getPlanningInstructions(): string {
    return [
      '5) chat_summaries_count (ChatSummaries / Chroma)',
      '   - Purpose: Count how many ChatSummaries exist in Chroma collection "conversation_summaries".',
      '   - Args: none',
      '   - Output: Count only.',
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
      (state.metadata as any).chatSummariesCounts = { summaries };

      return { toolName: this.name, success: true, result: { summaries } };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return { toolName: this.name, success: false, error: msg };
    }
  }
}
