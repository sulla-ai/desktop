import type { ThreadState, ToolResult } from '../types';
import { getChromaService } from '../services/ChromaService';
import { getMemoryPedia } from '../services/MemoryPedia';
import { BaseTool } from './BaseTool';
import type { ToolContext } from './BaseTool';

function normalizeSlug(name: string): string {
  return String(name || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

export class KnowledgeBaseGetPageTool extends BaseTool {
  override readonly name = 'knowledge_base_get_page';
  override readonly aliases = ['kb_get_page', 'knowledgebase_get_page'];
  override readonly category = 'memory';

  override getPlanningInstructions(): string {
    return [
      '10) knowledge_base_get_page (KnowledgeBase / Chroma articles)',
      '   - Purpose: Get a specific KnowledgeBase article from Chroma collection "knowledgebase_articles".',
      '   - Args:',
      '     - slug (string, required) // the article slug',
      '   - Output: Returns the full article JSON with slug, title, tags, order, sections, etc.',
    ].join('\n');
  }

  override async execute(state: ThreadState, context: ToolContext): Promise<ToolResult> {
    const chroma = getChromaService();

    const slugRaw = String(context.args?.slug || context.args?.pageId || '').trim();
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

      await chroma.ensureCollection('knowledgebase_articles');
      await chroma.refreshCollections();

      const data = await chroma.get('knowledgebase_articles', [slug], { include: ['documents', 'metadatas'] });

      const ids = data?.ids || [];
      if (!ids.length) {
        return { toolName: this.name, success: false, error: `KnowledgeBase article not found: ${slug}` };
      }

      const md = (data?.metadatas && data.metadatas[0]) || {} as Record<string, unknown>;
      const rawDocument = (data?.documents && data.documents[0]) || '{}';

      let article: Record<string, unknown>;
      try {
        article = JSON.parse(rawDocument);
      } catch {
        article = { slug, title: md.title || slug };
      }

      const tagsRaw = md.tags;
      let tags: string[] = [];
      if (typeof tagsRaw === 'string') {
        tags = tagsRaw.split(',').map(t => t.trim()).filter(Boolean);
      } else if (Array.isArray(tagsRaw)) {
        tags = tagsRaw.map(String);
      }

      const result = {
        slug,
        title: String(md.title || article.title || slug),
        tags,
        order: Number(md.order) || 0,
        locked: md.locked === true || md.locked === 'true',
        updated_at: md.updated_at ? String(md.updated_at) : null,
        article,
      };

      (state.metadata as any).knowledgeBasePage = result;

      return { toolName: this.name, success: true, result };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return { toolName: this.name, success: false, error: msg };
    }
  }
}
