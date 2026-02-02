// KnowledgeWriterNode - Persists the final KnowledgeBase page JSON to Chroma

import type { NodeResult, ThreadState } from '../types';
import { BaseNode } from './BaseNode';
import { getChromaService } from '../services/ChromaService';

function asObject(input: unknown): Record<string, unknown> | null {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return null;
  }
  return input as Record<string, unknown>;
}

function asStringArray(input: unknown): string[] {
  if (!Array.isArray(input)) {
    return [];
  }
  return input.map(String).map(s => s.trim()).filter(Boolean);
}

export class KnowledgeWriterNode extends BaseNode {
  constructor() {
    super('knowledge_writer', 'Knowledge Writer');
  }

  async execute(state: ThreadState): Promise<{ state: ThreadState; next: NodeResult }> {
    const chroma = getChromaService();

    const raw = (state.metadata as any).knowledgeFinalPage;
    const page = typeof raw === 'string' ? asObject(JSON.parse(raw)) : asObject(raw);

    if (!page) {
      (state.metadata as any).knowledgeWriterError = 'Missing state.metadata.knowledgeFinalPage';
      return { state, next: 'end' };
    }

    const slug = String(page.slug || '').trim();
    if (!slug) {
      (state.metadata as any).knowledgeWriterError = 'Invalid knowledgeFinalPage: missing slug';
      return { state, next: 'end' };
    }

    const schemaVersion = Number(page.schemaversion);
    if (!Number.isFinite(schemaVersion) || schemaVersion !== 1) {
      (state.metadata as any).knowledgeWriterError = 'Invalid knowledgeFinalPage: schemaversion must be 1';
      return { state, next: 'end' };
    }

    const title = String(page.title || '').trim();
    const tags = asStringArray(page.tags);

    const metadata: Record<string, unknown> = {
      schemaversion: schemaVersion,
      slug,
      title: title || slug,
      tags: tags.join(','),
      order: typeof page.order === 'number' ? page.order : Number(page.order),
      locked: typeof page.locked === 'boolean' ? page.locked : undefined,
      author: typeof page.author === 'string' ? page.author : undefined,
      created_at: typeof page.created_at === 'string' ? page.created_at : undefined,
      updated_at: typeof page.updated_at === 'string' ? page.updated_at : undefined,
    };

    // Best-effort cleanup of NaN/undefined that may come from optional fields
    for (const [k, v] of Object.entries(metadata)) {
      if (v === undefined || (typeof v === 'number' && !Number.isFinite(v))) {
        delete metadata[k];
      }
    }

    try {
      const ok = await chroma.initialize();
      if (!ok || !chroma.isAvailable()) {
        (state.metadata as any).knowledgeWriterError = 'Chroma not available';
        return { state, next: 'end' };
      }

      await chroma.ensureCollection('knowledgebase_articles');
      await chroma.refreshCollections();

      const document = JSON.stringify(page);
      const success = await chroma.upsert('knowledgebase_articles', [slug], [document], [metadata]);

      if (!success) {
        (state.metadata as any).knowledgeWriterError = 'Failed to upsert KnowledgeBase article';
        return { state, next: 'end' };
      }

      (state.metadata as any).knowledgeWriterResult = { slug, title: title || slug };
      return { state, next: 'end' };
    } catch (err) {
      (state.metadata as any).knowledgeWriterError = err instanceof Error ? err.message : String(err);
      return { state, next: 'end' };
    }
  }
}
