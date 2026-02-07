// KnowledgeExecutorNode.ts
// Compiles full KB article draft (sections + metadata) from goals + thread
// Writes structured JSON to state.metadata.kbFinalContent / kbArticleSchema
// Advances to critic/writer

import type { KnowledgeThreadState, NodeResult } from './Graph';
import { BaseNode, JSON_ONLY_RESPONSE_INSTRUCTIONS, TOOLS_RESPONSE_JSON } from './BaseNode';

const KB_EXECUTOR_PROMPT = `
You are writing a high-value KnowledgeBase article.

Title: {{title}}
Slug: {{slug}}

Goals/Sections (execute in order):
{{goalsText}}

Source conversation:
{{conversation}}

Rules:
- Write clean, professional Markdown per section
- Use headings, lists, code blocks where appropriate
- Keep factual — base content only on conversation
- section_id: kebab-case from goal id or title
- tags: 4–8 precise keywords
- order: incremental (10, 20, 30…)
- related_slugs: optional relevant KB paths
- author: "Jonathon Byrdziak" or null

Output ONLY valid JSON.

${JSON_ONLY_RESPONSE_INSTRUCTIONS}
{
  "section": "Major Section",
  "category": "Minor Category",
  "slug": "kebab-case-slug",
  "title": "Clear Article Title",
  "tags": ["tag1", "tag2"],
  "order": 100,
  "related_slugs": ["other/article"],
  ${TOOLS_RESPONSE_JSON}
  "kbFinalContent": "full markdown content, properly escaped for safe json"
}
`.trim();

/**
 * Knowledge Executor Node
 *
 * Purpose:
 *   - Generates complete article sections from planned goals
 *   - Builds final draft JSON (metadata + markdown content)
 *   - Stores in state.metadata.kbFinalContent & kbArticleSchema
 *
 * Key Design Decisions (2025 refactor):
 *   - Removed AgentLog / console.log / retry counters
 *   - Unified BaseNode.chat() + direct parsed .content
 *   - Enrichment: soul + awareness + memory only
 *   - Neutral decision — always 'next' (to critic/writer)
 *   - Uses KnowledgeThreadState shape
 *   - No external services — pure LLM → state
 *
 * Input expectations:
 *   - state.metadata.kbArticleSchema {slug, title}
 *   - state.metadata.kbCurrentGoals array
 *   - state.messages has thread content
 *
 * Output mutations:
 *   - state.metadata.kbFinalContent ← full JSON draft
 *   - state.metadata.kbStatus = 'draft'
 *
 * @extends BaseNode
 */
export class KnowledgeExecutorNode extends BaseNode {
  constructor() {
    super('knowledge_executor', 'Knowledge Executor');
  }

  async execute(state: KnowledgeThreadState): Promise<NodeResult<KnowledgeThreadState>> {
    const schema = state.metadata.kbArticleSchema;
    
    const enriched = await this.enrichPrompt(KB_EXECUTOR_PROMPT, state, {
      includeSoul: true,
      includeAwareness: true,
      includeMemory: false,
      includeTools: false,
      includeStrategicPlan: false,
      includeTacticalPlan: false,
      includeKnowledgebasePlan: false,
    });

    const llmResponse = await this.chat(
      state,
      enriched,
      { format: 'json' }
    );

    if (!llmResponse) {
      return { state, decision: { type: 'end' } };
    }
    
    const data = llmResponse as {
      section: string;
      category: string;
      slug: string;
      title: string;
      tags: string[];
      tools: any[];
      order: number;
      author?: string;
      kbFinalContent: string;
      related_slugs?: string[];
    };

    state.metadata.kbArticleSchema = {
      section: data.section.trim(),
      category: data.category.trim(),
      slug: data.slug.trim().toLowerCase().replace(/[^a-z0-9-]/g, '-') || data.title.trim().toLowerCase().replace(/[^a-z0-9-]/g, '-'),
      title: data.title.trim(),
      tags: data.tags || [],
      order: data.order || 100,
      author: data.author,
    };
    if (!state.metadata.kbArticleSchema.related_slugs) {
      state.metadata.kbArticleSchema.related_slugs = [];
    }
    state.metadata.kbArticleSchema.related_slugs.push(...(data.related_slugs?.filter(Boolean) ?? []));

    state.metadata.kbFinalContent = data.kbFinalContent?.trim() || state.metadata.kbFinalContent;
    state.metadata.kbStatus = 'draft';

    const tools = Array.isArray(data.tools) ? data.tools : [];
    // Run tools if any
    if (tools.length > 0) {
      await this.executeToolCalls(state, tools);
    }

    return { state, decision: { type: 'next' } };
  }
}