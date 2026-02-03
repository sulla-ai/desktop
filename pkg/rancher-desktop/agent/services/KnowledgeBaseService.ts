import { getChromaService } from './ChromaService';

export interface KnowledgeBaseSection {
  section_id: string;
  title: string;
  content: string;
  order: number;
}

export interface KnowledgeBaseArticle {
  slug: string;
  title: string;
  tags: string[];
  order: number;
  locked?: boolean;
  author?: string;
  created_at?: string;
  updated_at?: string;
  sections: KnowledgeBaseSection[];
  related_slugs?: string[];
}

export type KnowledgeBasePageSummary = {
  slug: string;
  title: string;
  tags: string[];
  order: number;
  locked: boolean;
  updated_at: string | null;
};

export type KnowledgeBasePage = KnowledgeBasePageSummary & {
  article: KnowledgeBaseArticle;
  rawDocument: string;
  rawMetadata: Record<string, unknown>;
};

export type KnowledgeBaseNav = Array<{
  tag: string;
  pages: KnowledgeBasePageSummary[];
}>;

const COLLECTION_NAME = 'knowledgebase_articles';

export class KnowledgeBaseService {
  private chroma = getChromaService();

  async listPages(limit = 500): Promise<KnowledgeBasePageSummary[]> {
    const ok = await this.chroma.initialize();
    if (!ok || !this.chroma.isAvailable()) {
      return [];
    }

    await this.chroma.ensureCollection(COLLECTION_NAME);
    await this.chroma.refreshCollections();

    const data = await this.chroma.get(COLLECTION_NAME, undefined, { limit, include: ['metadatas', 'documents'] });

    const ids = data?.ids || [];
    const metadatas = data?.metadatas || [];
    const documents = data?.documents || [];

    return ids.map((id, i) => {
      const md = (metadatas[i] || {}) as Record<string, unknown>;
      const rawDocument = documents[i] ? String(documents[i]) : '';
      let parsedTitle = '';
      if (rawDocument) {
        try {
          const parsed = JSON.parse(rawDocument) as { title?: unknown };
          if (parsed && typeof parsed.title === 'string') {
            parsedTitle = parsed.title;
          }
        } catch {
          // ignore
        }
      }

      const tagsRaw = md.tags;
      let tags: string[] = [];
      if (typeof tagsRaw === 'string') {
        tags = tagsRaw.split(',').map(t => t.trim()).filter(Boolean);
      } else if (Array.isArray(tagsRaw)) {
        tags = tagsRaw.map(String);
      }

      return {
        slug: String(md.slug || id),
        title: String(md.title || parsedTitle || id),
        tags,
        order: Number(md.order) || 0,
        locked: md.locked === true || md.locked === 'true',
        updated_at: md.updated_at ? String(md.updated_at) : null,
      };
    });
  }

  async getPage(slug: string): Promise<KnowledgeBasePage | null> {
    const id = String(slug || '').trim();
    if (!id) {
      return null;
    }

    const ok = await this.chroma.initialize();
    if (!ok || !this.chroma.isAvailable()) {
      return null;
    }

    await this.chroma.ensureCollection(COLLECTION_NAME);
    await this.chroma.refreshCollections();

    const data = await this.chroma.get(COLLECTION_NAME, [id], { include: ['documents', 'metadatas'] });

    const ids = data?.ids || [];
    if (!ids.length) {
      return null;
    }

    const md = ((data?.metadatas && data.metadatas[0]) || {}) as Record<string, unknown>;
    const rawDocument = (data?.documents && data.documents[0]) ? String(data.documents[0]) : '{}';

    let article: KnowledgeBaseArticle;
    try {
      article = JSON.parse(rawDocument);
    } catch {
      article = {
        slug: id,
        title: String(md.title || id),
        tags: [],
        order: 0,
        sections: [],
      };
    }

    const tagsRaw = md.tags;
    let tags: string[] = [];
    if (typeof tagsRaw === 'string') {
      tags = tagsRaw.split(',').map(t => t.trim()).filter(Boolean);
    } else if (Array.isArray(tagsRaw)) {
      tags = tagsRaw.map(String);
    }

    return {
      slug: String(md.slug || id),
      title: String(md.title || article.title || id),
      tags,
      order: Number(md.order) || article.order || 0,
      locked: md.locked === true || md.locked === 'true',
      updated_at: md.updated_at ? String(md.updated_at) : null,
      article,
      rawDocument,
      rawMetadata: md,
    };
  }

  buildNav(pages: KnowledgeBasePageSummary[]): KnowledgeBaseNav {
    // Group pages by their first tag (primary category)
    const byTag = new Map<string, KnowledgeBasePageSummary[]>();

    for (const p of pages) {
      const primaryTag = p.tags[0] || 'Uncategorized';
      const list = byTag.get(primaryTag) || [];
      list.push(p);
      byTag.set(primaryTag, list);
    }

    const nav: KnowledgeBaseNav = [...byTag.entries()]
      .map(([tag, tagPages]) => ({
        tag,
        pages: tagPages.sort((a, b) => a.order - b.order || a.title.localeCompare(b.title)),
      }))
      .sort((a, b) => a.tag.localeCompare(b.tag));

    return nav;
  }
}

let instance: KnowledgeBaseService | null = null;

export function getKnowledgeBaseService(): KnowledgeBaseService {
  if (!instance) {
    instance = new KnowledgeBaseService();
  }
  return instance;
}
