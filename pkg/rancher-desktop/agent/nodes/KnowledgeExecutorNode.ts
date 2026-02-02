// KnowledgeExecutorNode - Compiles the KnowledgeBase page JSON from goals + thread context

import type { ThreadState, NodeResult } from '../types';
import { BaseNode, JSON_ONLY_RESPONSE_INSTRUCTIONS } from './BaseNode';
import type { KnowledgeGoal, KnowledgePageSection, KnowledgeFinalPage } from '../services/KnowledgeState';
import { getLLMService } from '../services/LLMServiceFactory';

interface ExecutorLLMResponse {
  tags: string[];
  order: number;
  author?: string;
  sections: Array<{
    section_id: string;
    title: string;
    content: string;
    order: number;
  }>;
  related_slugs?: string[];
}

export class KnowledgeExecutorNode extends BaseNode {
  constructor() {
    super('knowledge_executor', 'Knowledge Executor');
  }

  async execute(state: ThreadState): Promise<{ state: ThreadState; next: NodeResult }> {
    console.log(`[KnowledgeExecutorNode] Executing for thread: ${state.threadId}`);

    const retryCount = Number((state.metadata as any).knowledgeExecutorRetryCount || 0);
    const lastError = typeof (state.metadata as any).knowledgeExecutorLastError === 'string'
      ? String((state.metadata as any).knowledgeExecutorLastError)
      : '';

    const goals = (state.metadata as any).knowledgeGoals as KnowledgeGoal[] | undefined;
    const slug = (state.metadata as any).knowledgePlannedSlug as string | undefined;
    const title = (state.metadata as any).knowledgePlannedTitle as string | undefined;

    if (!goals || goals.length === 0) {
      (state.metadata as any).knowledgeExecutorError = 'No goals from planner';
      return { state, next: 'end' };
    }

    if (!slug || !title) {
      (state.metadata as any).knowledgeExecutorError = 'Missing slug or title from planner';
      return { state, next: 'end' };
    }

    // Build conversation text for LLM
    const conversationText = state.messages
      .filter(m => m.role === 'user' || m.role === 'assistant')
      .map(m => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`)
      .join('\n')
      .substring(0, 8000);

    const goalsText = goals.map((g, i) => `${i + 1}. ${g.title}: ${g.description}`).join('\n');

    const prompt = `You are writing a KnowledgeBase article.

Title: ${title}
Slug: ${slug}

Goals/Sections to cover:
${goalsText}

Source conversation:
${conversationText}

Write the article content for each section based on the goals and conversation.

${lastError ? `\n## Fix Required\nYour previous JSON output could not be parsed. Error: ${lastError}\nYou MUST return a single valid JSON object. Ensure all quotes are escaped and do not include raw control characters.` : ''}

${JSON_ONLY_RESPONSE_INSTRUCTIONS}
{
  "tags": ["tag1", "tag2"],
  "order": 10,
  "author": "Author Name or null",
  "sections": [
    {
      "section_id": "intro",
      "title": "Introduction",
      "content": "Full markdown content for this section...",
      "order": 1
    }
  ],
  "related_slugs": ["optional-related-article-slug"]
}

Rules:
- Each goal becomes a section
- section_id should be kebab-case
- content should be well-written markdown
- tags should be relevant keywords (3-6 tags)
- order is the display order (10, 20, 30, etc.)
- Include all information from the conversation that's relevant`;

    try {
      const response = await this.promptLLM(state, prompt);
      if (!response) {
        (state.metadata as any).knowledgeExecutorLastError = 'LLM returned empty response';
        (state.metadata as any).knowledgeExecutorRetryCount = retryCount + 1;
        (state.metadata as any).knowledgeExecutorError = (state.metadata as any).knowledgeExecutorLastError;
        if (retryCount + 1 < 2) {
          return { state, next: 'knowledge_executor' };
        }
        return { state, next: 'end' };
      }

      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        (state.metadata as any).knowledgeExecutorLastError = 'Failed to locate JSON object in LLM response';
        (state.metadata as any).knowledgeExecutorRetryCount = retryCount + 1;
        (state.metadata as any).knowledgeExecutorError = (state.metadata as any).knowledgeExecutorLastError;
        if (retryCount + 1 < 2) {
          return { state, next: 'knowledge_executor' };
        }
        return { state, next: 'end' };
      }

      let parsed: ExecutorLLMResponse;
      try {
        parsed = JSON.parse(jsonMatch[0]);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        (state.metadata as any).knowledgeExecutorLastError = msg;
        (state.metadata as any).knowledgeExecutorRetryCount = retryCount + 1;
        (state.metadata as any).knowledgeExecutorError = msg;
        if (retryCount + 1 < 2) {
          return { state, next: 'knowledge_executor' };
        }
        return { state, next: 'end' };
      }

      const sections: KnowledgePageSection[] = (parsed.sections || []).map((s, i) => ({
        section_id: s.section_id || `section_${i + 1}`,
        title: s.title,
        content: s.content,
        order: typeof s.order === 'number' ? s.order : (i + 1) * 10,
      }));

      const now = new Date().toISOString();

      const draftPage: Partial<KnowledgeFinalPage> = {
        schemaversion: 1,
        slug,
        title,
        tags: Array.isArray(parsed.tags) ? parsed.tags.map(String) : [],
        order: typeof parsed.order === 'number' ? parsed.order : 10,
        author: parsed.author || undefined,
        created_at: now,
        updated_at: now,
        sections,
        related_slugs: Array.isArray(parsed.related_slugs) ? parsed.related_slugs.map(String) : [],
      };

      (state.metadata as any).knowledgeDraftPage = draftPage;

      console.log(`[KnowledgeExecutorNode] Compiled ${sections.length} sections for: ${title}`);

      delete (state.metadata as any).knowledgeExecutorLastError;
      (state.metadata as any).knowledgeExecutorRetryCount = 0;

      return { state, next: 'continue' };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      (state.metadata as any).knowledgeExecutorLastError = msg;
      (state.metadata as any).knowledgeExecutorRetryCount = retryCount + 1;
      (state.metadata as any).knowledgeExecutorError = msg;
      if (retryCount + 1 < 2) {
        return { state, next: 'knowledge_executor' };
      }
      return { state, next: 'end' };
    }
  }

  private async promptLLM(state: ThreadState, prompt: string): Promise<string | null> {
    try {
      const enriched = await this.enrichPrompt(prompt, state, {
        includeSoul: false,
        includeAwareness: false,
        includeMemory: false,
      });

      const llm = getLLMService();
      await llm.initialize();
      if (!llm.isAvailable()) {
        return null;
      }

      return await llm.generate(enriched);
    } catch {
      return null;
    }
  }
}
