import type { ThreadState, ToolResult } from '../types';
import { getChromaService } from '../services/ChromaService';
import { getMemoryPedia } from '../services/MemoryPedia';
import { BaseTool } from './BaseTool';
import type { ToolContext } from './BaseTool';

function normalizeSlug(name: string): string {
  return String(name || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

export class KnowledgeBaseUpdatePageTool extends BaseTool {
  override readonly name = 'knowledge_base_update_page';
  override readonly aliases = ['kb_update_page', 'knowledgebase_update_page', 'knowledge_base_edit_page', 'kb_edit_page'];
  override readonly category = 'memory';

  override getPlanningInstructions(): string {
    return [
      '7) knowledge_base_update_page (KnowledgeBase / Chroma pages)',
      '   - Purpose: Update an existing KnowledgeBase article. Fetches existing page first, merges updates.',
      '   - Args:',
      '     - slug (string, required) // the article slug to update',
      '     - title (string, optional) // new title',
      '     - content (string, optional) // full new content (replaces existing)',
      '     - appendContent (string, optional) // content to append to existing',
      '     - tags (string[], optional) // new tags array',
      '     - addTags (string[], optional) // tags to add to existing',
      '     - removeTags (string[], optional) // tags to remove',
      '     - sections (object[], optional) // replace sections array',
      '     - updateSection (object, optional) // { section_id, title?, content?, order? } update one section',
      '     - addSection (object, optional) // { section_id, title, content, order } add new section',
      '     - removeSection (string, optional) // section_id to remove',
      '     - order (number, optional) // new display order',
      '     - locked (boolean, optional) // lock/unlock',
      '     - related_slugs (string[], optional) // replace related slugs',
      '   - Output: Returns updated article slug and title.',
      '   - Note: Only slug is required. All other fields are optional partial updates.',
    ].join('\n');
  }

  override async execute(state: ThreadState, context: ToolContext): Promise<ToolResult> {
    const chroma = getChromaService();

    const slug = normalizeSlug(String(context.args?.slug || ''));
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

      // Fetch existing page
      const existing = await chroma.get('knowledgebase_articles', [slug]);
      if (!existing || !existing.ids || existing.ids.length === 0) {
        return { toolName: this.name, success: false, error: `Page not found: ${slug}` };
      }

      // Parse existing document
      let page: Record<string, unknown>;
      try {
        const doc = existing.documents?.[0] || '{}';
        page = JSON.parse(doc);
      } catch {
        page = { schemaversion: 1, slug };
      }

      const existingMeta = existing.metadatas?.[0] || {};

      // Apply updates
      const args = context.args || {};

      // Title
      if (args.title !== undefined) {
        page.title = String(args.title);
      }

      // Content (full replace or append)
      if (args.content !== undefined) {
        page.content = String(args.content);
      } else if (args.appendContent !== undefined) {
        const existingContent = String(page.content || '');
        page.content = existingContent + '\n\n' + String(args.appendContent);
      }

      // Tags
      let tags: string[] = Array.isArray(page.tags) ? page.tags.map(String) : [];
      if (Array.isArray(args.tags)) {
        tags = args.tags.map(String);
      }
      if (Array.isArray(args.addTags)) {
        for (const t of args.addTags) {
          const tag = String(t).trim();
          if (tag && !tags.includes(tag)) {
            tags.push(tag);
          }
        }
      }
      if (Array.isArray(args.removeTags)) {
        const toRemove = new Set(args.removeTags.map(String));
        tags = tags.filter(t => !toRemove.has(t));
      }
      page.tags = tags;

      // Sections
      let sections: Array<{ section_id: string; title: string; content: string; order: number }> =
        Array.isArray(page.sections) ? page.sections as any : [];

      if (Array.isArray(args.sections)) {
        sections = args.sections as any;
      }

      if (args.updateSection && typeof args.updateSection === 'object') {
        const upd = args.updateSection as Record<string, unknown>;
        const sectionId = String(upd.section_id || '');
        const idx = sections.findIndex(s => s.section_id === sectionId);
        if (idx >= 0) {
          if (upd.title !== undefined) sections[idx].title = String(upd.title);
          if (upd.content !== undefined) sections[idx].content = String(upd.content);
          if (upd.order !== undefined) sections[idx].order = Number(upd.order);
        }
      }

      if (args.addSection && typeof args.addSection === 'object') {
        const add = args.addSection as Record<string, unknown>;
        sections.push({
          section_id: String(add.section_id || `section_${Date.now()}`),
          title: String(add.title || 'New Section'),
          content: String(add.content || ''),
          order: typeof add.order === 'number' ? add.order : sections.length * 10,
        });
      }

      if (args.removeSection !== undefined) {
        const removeId = String(args.removeSection);
        sections = sections.filter(s => s.section_id !== removeId);
      }

      page.sections = sections;

      // Order
      if (args.order !== undefined) {
        page.order = Number(args.order);
      }

      // Locked
      if (args.locked !== undefined) {
        page.locked = Boolean(args.locked);
      }

      // Related slugs
      if (Array.isArray(args.related_slugs)) {
        page.related_slugs = args.related_slugs.map(String);
      }

      // Update timestamp
      page.updated_at = new Date().toISOString();

      // Build metadata for Chroma
      const metadata: Record<string, unknown> = {
        schemaversion: 1,
        slug,
        title: page.title || existingMeta.title || slug,
        tags: tags.join(','),
        order: typeof page.order === 'number' ? page.order : (existingMeta.order || 10),
        updated_at: page.updated_at,
      };

      if (page.locked !== undefined) {
        metadata.locked = page.locked;
      }
      if (page.author !== undefined) {
        metadata.author = page.author;
      }

      const document = JSON.stringify(page);
      const success = await chroma.upsert('knowledgebase_articles', [slug], [document], [metadata]);

      if (!success) {
        return { toolName: this.name, success: false, error: 'Failed to update KnowledgeBase page' };
      }

      (state.metadata as any).knowledgeBaseLastWrite = { op: 'update', slug, title: page.title || null };

      return { toolName: this.name, success: true, result: { slug, title: page.title || null } };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return { toolName: this.name, success: false, error: msg };
    }
  }
}
