// KnowledgeCriticNode - Validates metadata/structure and passes final JSON to state.metadata.knowledgeFinalPage

import type { ThreadState, NodeResult } from '../types';
import { BaseNode } from './BaseNode';
import type { KnowledgeFinalPage, KnowledgePageSection } from '../services/KnowledgeState';

export class KnowledgeCriticNode extends BaseNode {
  constructor() {
    super('knowledge_critic', 'Knowledge Critic');
  }

  async execute(state: ThreadState): Promise<{ state: ThreadState; next: NodeResult }> {
    console.log(`[KnowledgeCriticNode] Executing for thread: ${state.threadId}`);

    const draftPage = (state.metadata as any).knowledgeDraftPage as Partial<KnowledgeFinalPage> | undefined;

    if (!draftPage) {
      (state.metadata as any).knowledgeCriticError = 'No draft page from executor';
      return { state, next: 'end' };
    }

    const issues: string[] = [];

    // Validate required fields
    if (draftPage.schemaversion !== 1) {
      issues.push('schemaversion must be 1');
    }

    if (!draftPage.slug || typeof draftPage.slug !== 'string' || draftPage.slug.trim().length === 0) {
      issues.push('slug is required and must be a non-empty string');
    } else {
      // Validate slug format (kebab-case)
      const slugPattern = /^[a-z0-9]+(-[a-z0-9]+)*$/;
      if (!slugPattern.test(draftPage.slug)) {
        issues.push('slug must be lowercase kebab-case');
      }
    }

    if (!draftPage.title || typeof draftPage.title !== 'string' || draftPage.title.trim().length === 0) {
      issues.push('title is required and must be a non-empty string');
    }

    if (!Array.isArray(draftPage.tags)) {
      issues.push('tags must be an array');
    }

    if (typeof draftPage.order !== 'number' || !Number.isFinite(draftPage.order)) {
      issues.push('order must be a finite number');
    }

    if (!Array.isArray(draftPage.sections) || draftPage.sections.length === 0) {
      issues.push('sections must be a non-empty array');
    } else {
      // Validate each section
      for (let i = 0; i < draftPage.sections.length; i++) {
        const section = draftPage.sections[i];
        if (!section.section_id || typeof section.section_id !== 'string') {
          issues.push(`sections[${i}].section_id is required`);
        }
        if (!section.title || typeof section.title !== 'string') {
          issues.push(`sections[${i}].title is required`);
        }
        if (!section.content || typeof section.content !== 'string') {
          issues.push(`sections[${i}].content is required`);
        }
        if (typeof section.order !== 'number') {
          issues.push(`sections[${i}].order must be a number`);
        }
      }
    }

    // Check for refinement loop
    const iterations = ((state.metadata as any).knowledgeCriticIterations as number) || 0;
    const maxIterations = 2;

    if (issues.length > 0 && iterations < maxIterations) {
      console.log(`[KnowledgeCriticNode] Found ${issues.length} issues, requesting refinement`);
      (state.metadata as any).knowledgeCriticIssues = issues;
      (state.metadata as any).knowledgeCriticIterations = iterations + 1;
      // Go back to executor for refinement
      return { state, next: 'knowledge_executor' };
    }

    // If still issues after max iterations, try to fix what we can
    if (issues.length > 0) {
      console.log(`[KnowledgeCriticNode] Max iterations reached, proceeding with fixes`);
    }

    // Build final page with defaults for missing optional fields
    const finalPage: KnowledgeFinalPage = {
      schemaversion: 1,
      slug: String(draftPage.slug || 'untitled').toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, ''),
      title: String(draftPage.title || 'Untitled'),
      tags: Array.isArray(draftPage.tags) ? draftPage.tags.map(String).filter(Boolean) : [],
      order: typeof draftPage.order === 'number' && Number.isFinite(draftPage.order) ? draftPage.order : 10,
      locked: draftPage.locked === true,
      author: typeof draftPage.author === 'string' ? draftPage.author : undefined,
      created_at: typeof draftPage.created_at === 'string' ? draftPage.created_at : new Date().toISOString(),
      updated_at: new Date().toISOString(),
      sections: this.normalizeSections(draftPage.sections),
      related_slugs: Array.isArray(draftPage.related_slugs) ? draftPage.related_slugs.map(String).filter(Boolean) : [],
    };

    // Clean up undefined fields
    if (finalPage.author === undefined) {
      delete (finalPage as any).author;
    }
    if (finalPage.related_slugs && finalPage.related_slugs.length === 0) {
      delete (finalPage as any).related_slugs;
    }

    // Set the final page for KnowledgeWriterNode
    (state.metadata as any).knowledgeFinalPage = finalPage;

    console.log(`[KnowledgeCriticNode] Validated and finalized page: ${finalPage.title} (${finalPage.sections.length} sections)`);

    return { state, next: 'continue' };
  }

  private normalizeSections(sections: KnowledgePageSection[] | undefined): KnowledgePageSection[] {
    if (!Array.isArray(sections)) {
      return [{
        section_id: 'content',
        title: 'Content',
        content: 'No content available.',
        order: 1,
      }];
    }

    return sections.map((s, i) => ({
      section_id: String(s.section_id || `section_${i + 1}`),
      title: String(s.title || `Section ${i + 1}`),
      content: String(s.content || ''),
      order: typeof s.order === 'number' ? s.order : (i + 1) * 10,
    }));
  }
}
