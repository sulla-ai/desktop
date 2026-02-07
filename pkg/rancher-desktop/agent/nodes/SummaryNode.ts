// SummaryNode.ts
// Terminal node: extracts ruthless facts-only summary from thread
// Persists to Chroma conversation_summaries collection
// No routing — always ends graph

import type { BaseThreadState, NodeResult } from './Graph';
import { BaseNode, JSON_ONLY_RESPONSE_INSTRUCTIONS } from './BaseNode';
import { Summary } from '../database/models/Summary';
import type { ChatMessage } from '../languagemodels/BaseLanguageModel';

const SUMMARY_PROMPT = `
You are a ruthless, high-signal summarizer.

Task:
- Read entire conversation thread
- Extract ONLY core facts, decisions, outcomes, commitments, key entities, actionable items
- Eliminate all reasoning, chit-chat, meta, jokes, filler, low-value content
- Output strict structure — nothing else

Format:
- One tight paragraph (150–300 tokens max)
- Bullet list: Main topics
- Bullet list: Key entities (people, tools, companies, concepts, URLs)

${JSON_ONLY_RESPONSE_INSTRUCTIONS}
{
  "summary": "concise paragraph...",
  "topics": ["topic1", "topic2", ...],
  "entities": ["entity1", "entity2", ...]
}
`.trim();

/**
 * Summary Node
 *
 * Purpose:
 *   - Final node in any graph
 *   - Generates concise, facts-only thread summary
 *   - Stores in Chroma conversation_summaries collection
 *   - Emits formatted summary to UI via WS
 *
 * Key Design Decisions (2025 refactor):
 *   - Removed AgentLog / console.log / agentWarn
 *   - Unified BaseNode.chat() + direct parsed .content access
 *   - Enrichment: minimal (soul + awareness only, no memory/tools/plans)
 *   - Neutral terminal decision — always 'end'
 *   - Direct Summary model create (no service layer)
 *   - WS feedback only on success
 *
 * Input expectations:
 *   - state.messages contains conversation history
 *   - state.threadId valid
 *
 * Output mutations:
 *   - New Summary record in Chroma
 *   - WS message with formatted summary
 *
 * @extends BaseNode
 */
export class SummaryNode extends BaseNode {
  constructor() {
    super('summary', 'Conversation Summary');
  }

  async execute(state: BaseThreadState): Promise<NodeResult<BaseThreadState>> {
    const messages = state.messages
      .filter((m: ChatMessage) => m.role === 'user' || m.role === 'assistant')
      .map(m => `${m.role.toUpperCase()}: ${m.content}`)
      .join('\n\n');

    if (!messages.trim()) {
      return { state, decision: { type: 'end' } };
    }

    const prompt = SUMMARY_PROMPT;

    const enriched = await this.enrichPrompt(prompt, state, {
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
      summary: string;
      topics: string[];
      entities: string[];
    };

    if (!data.summary?.trim()) {
      return { state, decision: { type: 'end' } };
    }

    await Summary.createFromConversation(
      state.metadata.threadId,
      data.summary,
      data.topics ?? [],
      data.entities ?? []
    );

    return { state, decision: { type: 'end' } };
  }
}