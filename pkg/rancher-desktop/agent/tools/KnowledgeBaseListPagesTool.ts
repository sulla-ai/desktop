import type { ThreadState, ToolResult } from '../types';
import { getChromaService } from '../services/ChromaService';
import { getMemoryPedia } from '../services/MemoryPedia';
import { BaseTool } from './BaseTool';
import type { ToolContext } from './BaseTool';

export class KnowledgeBaseListPagesTool extends BaseTool {
  override readonly name = 'knowledge_base_list_pages';
  override readonly aliases = ['kb_list_pages', 'knowledgebase_list_pages'];

  override getPlanningInstructions(): string {
    return [
      '["knowledge_base_list_pages", "limit", "includeContent"] List articles/memory/storage from KnowledgeBase',
      '',
      '   - Args:',
      '     - limit (number, optional)          // default 50, max 500',
      '     - includeContent (boolean, optional) // default false; if true includes full article JSON',
      '   - Output: Returns articles with slug, title, tags, order, locked, updated_at.',
    ].join('\n');
  }

  override async execute(state: ThreadState, context: ToolContext): Promise<ToolResult> {
    const helpResult = await this.handleHelpRequest(context);
    if (helpResult) {
      return helpResult;
    }
    
    const chroma = getChromaService();

    // Handle exec form: args is string array like ["knowledge_base_list_pages", "limit", "includeContent"]
    const argsArray = Array.isArray(context.args) ? context.args : context.args?.args;
    
    // Skip first element (tool name) and get actual arguments
    const limitRaw = (argsArray as string[] | undefined)?.[1];
    const limit = Number.isFinite(Number(limitRaw)) ? Math.max(1, Math.min(500, Number(limitRaw))) : 50;

    const includeContent = (argsArray as string[] | undefined)?.[2] === 'true';

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

      await chroma.ensureCollection('knowledgebase_articles');
      await chroma.refreshCollections();

      const include = includeContent ? ['documents', 'metadatas'] : ['metadatas'];
      const data = await chroma.get('knowledgebase_articles', undefined, { limit, include });

      const ids = data?.ids || [];
      const metadatas = data?.metadatas || [];
      const documents = data?.documents || [];

      const articles = ids.map((id, i) => {
        const md = (metadatas[i] || {}) as Record<string, unknown>;
        const tagsRaw = md.tags;
        let tags: string[] = [];
        if (typeof tagsRaw === 'string') {
          tags = tagsRaw.split(',').map(t => t.trim()).filter(Boolean);
        } else if (Array.isArray(tagsRaw)) {
          tags = tagsRaw.map(String);
        }

        const article: Record<string, unknown> = {
          slug: String(md.slug || id),
          title: String(md.title || id),
          tags,
          order: Number(md.order) || 0,
          locked: md.locked === true || md.locked === 'true',
          updated_at: md.updated_at ? String(md.updated_at) : null,
        };

        if (includeContent) {
          article.document = documents[i] || '';
        }

        return article;
      });

      (state.metadata as any).knowledgeBaseList = articles;

      return {
        toolName: this.name,
        success: true,
        result: { count: articles.length, limit, includeContent, articles },
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return { toolName: this.name, success: false, error: msg };
    }
  }
}
