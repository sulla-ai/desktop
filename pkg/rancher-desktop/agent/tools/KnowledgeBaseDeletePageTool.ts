import type { ThreadState, ToolResult } from '../types';
import { getChromaService } from '../services/ChromaService';
import { getMemoryPedia } from '../services/MemoryPedia';
import { BaseTool } from './BaseTool';
import type { ToolContext } from './BaseTool';

function normalizeSlug(name: string): string {
  return String(name || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

export class KnowledgeBaseDeletePageTool extends BaseTool {
  override readonly name = 'knowledge_base_delete_page';
  override readonly aliases = ['kb_delete_page', 'knowledgebase_delete_page'];

  override getPlanningInstructions(): string {
    return [
      '["knowledge_base_delete_page", "slug"] - Deletes memory/storage/articles/knowledgebase_articles from KnowledgeBase/Chroma',
      '',
      '   - Args:',
      '     - slug (string, required) // the article slug to delete',
      '   - Output: Deletes the article by slug.',
    ].join('\n');
  }

  override async execute(state: ThreadState, context: ToolContext): Promise<ToolResult> {
    const chroma = getChromaService();

    // Handle exec form: args is string array like ["knowledge_base_delete_page", "slug"]
    const argsArray = Array.isArray(context.args) ? context.args : context.args?.args;
    
    // Skip first element (tool name) and get slug from second element
    const slugRaw = String((argsArray as string[] | undefined)?.[1] || '').trim();
    const slug = normalizeSlug(slugRaw);
    if (!slug) {
      return { toolName: this.name, success: false, error: 'Missing args: slug' };
    }

    try {
      try {
        await getMemoryPedia().initialize();
      } catch {
        // continue
      }

      const ok = await chroma.initialize();
      if (!ok || !chroma.isAvailable()) {
        return { toolName: this.name, success: false, error: 'Chroma not available' };
      }

      await chroma.refreshCollections();

      const success = await chroma.delete('knowledgebase_articles', [slug]);
      if (!success) {
        return { toolName: this.name, success: false, error: 'Failed to delete KnowledgeBase article' };
      }

      (state.metadata as any).knowledgeBaseLastWrite = { op: 'delete', slug };

      return { toolName: this.name, success: true, result: { slug } };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return { toolName: this.name, success: false, error: msg };
    }
  }
}
