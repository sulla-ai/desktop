// KnowledgePlannerNode.ts
// Plans KnowledgeBase article structure from thread summary
// Outputs slug, title + ordered goals (sections) to state
// Terminal planning node — next is always executor

import type { KnowledgeThreadState, NodeResult } from './Graph';
import { BaseNode, JSON_ONLY_RESPONSE_INSTRUCTIONS } from './BaseNode';
import { Summary } from '../database/models/Summary';

const KNOWLEDGE_PLAN_PROMPT = `
You are the Knowledge Planner: expert at turning raw conversations into structured, high-value KB articles.

Input: full conversation thread or summary.

Task:
- Extract core topic, purpose, and value to document
- Create clean, SEO-friendly slug (lowercase kebab-case, 40–60 chars)
- Craft precise, benefit-driven title
- Break article into 4–7 logical goals/sections
  - Always include: intro, core explanation, key takeaways, validation/examples
  - Add 1–2 high-ROI extras (troubleshooting, comparisons, gotchas) if relevant
- Goals become sequential execution steps for KnowledgeExecutor

Rules:
- slug: unique, readable, no stop words
- title: clear, searchable, 50–70 chars
- goals: atomic, outcome-focused, ordered
- 4–7 goals max — never pad

${JSON_ONLY_RESPONSE_INSTRUCTIONS}
{
  "section": "Major Section",
  "category": "Minor Category",
  "slug": "kebab-case-slug",
  "title": "Clear Article Title",
  "tags": ["tag1", "tag2"],
  "order": 100,
  "goals": [
    {
      "id": "g1",
      "title": "Section Title",
      "description": "What this section must cover + success check"
    }
  ]
}
`.trim();

/**
 * Knowledge Planner Node
 *
 * Purpose:
 *   - Analyzes thread/summary → plans KB article structure
 *   - Outputs slug, title + ordered goals to state.metadata.kbCurrentGoals
 *   - Sets first goal active
 *
 * Key Design Decisions (2025 refactor):
 *   - Removed AgentLog / console.log / agentWarn
 *   - Unified BaseNode.chat() + direct parsed .content access
 *   - Enrichment: soul + awareness + memory only
 *   - Neutral decision — always 'next' (to executor)
 *   - Uses Summary model for thread fallback
 *   - State shape matches KnowledgeThreadState
 *
 * Input expectations:
 *   - state.threadId valid
 *   - state.messages or fallback summary exists
 *
 * Output mutations:
 *   - state.metadata.kbArticleSchema = { slug, title }
 *   - state.metadata.kbCurrentGoals = goals array
 *   - state.metadata.kbActiveGoalIndex = 0
 *
 * @extends BaseNode
 */
export class KnowledgePlannerNode extends BaseNode {
  constructor() {
    super('knowledge_planner', 'Knowledge Planner');
  }

  async execute(state: KnowledgeThreadState): Promise<NodeResult<KnowledgeThreadState>> {
    let content = state.messages
      .filter(m => m.role === 'user' || m.role === 'assistant')
      .map(m => m.content)
      .join('\n\n');

    // If no message was ever sent or received then end... okay..
    if (!content.trim()) {
      return { state, decision: { type: 'end' } };
    }

    const enriched = await this.enrichPrompt(KNOWLEDGE_PLAN_PROMPT, state, {
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
      order: number;
      goals: Array<{ id: string; title: string; description: string }>;
    };

    if (!data.slug?.trim() || !data.title?.trim() || !Array.isArray(data.goals) || data.goals.length === 0) {
      return { state, decision: { type: 'end' } };
    }

    state.metadata.kbArticleSchema = {
      section: data.section.trim(),
      category: data.category.trim(),
      slug: data.slug.trim().toLowerCase().replace(/[^a-z0-9-]/g, '-') || data.title.trim().toLowerCase().replace(/[^a-z0-9-]/g, '-'),
      title: data.title.trim(),
      tags: data.tags || [],
      order: data.order || 100,
    };

    state.metadata.kbCurrentSteps = data.goals.map((g, i) => ({
      description: g.title.trim(),
      done: false,
      resultSummary: '',
      completedAt: '',
    }));

    state.metadata.kbActiveStepIndex = 0;
    state.metadata.kbStatus = 'draft';

    return { state, decision: { type: 'next' } };
  }
}