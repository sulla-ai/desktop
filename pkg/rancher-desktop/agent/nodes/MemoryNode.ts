// MemoryNode.ts - Updated / simplified version
// - Removed agentLog / agentWarn entirely
// - Uses built-in BaseNode chat() instead of custom prompt()
// - Enrich with only soul + awareness (no memory flag needed here)
// - Simplified parsing + error handling
// - Writes directly to state.metadata.memory (as per current BaseThreadState shape)
// - No next decision — always 'continue' (graph edges handle routing)

import type { BaseThreadState, NodeResult } from './Graph';
import { BaseNode, JSON_ONLY_RESPONSE_INSTRUCTIONS } from './BaseNode';
import { Summary } from '../database/models/Summary';

const MEMORY_QUERY_PROMPT = `
You are a memory retrieval assistant.

Given the current user message and recent context, generate 1–4 precise, short search phrases 
to find relevant past conversation summaries in the knowledge base.

You must include a "queries" array with 1–4 search phrases.
You must include a "reasoning" string explaining why these queries.
If nothing relevant exists, return empty array: {"queries": [], "reasoning": "..."}

${JSON_ONLY_RESPONSE_INSTRUCTIONS}
{
  "queries": ["exact phrase 1", "phrase 2", ...],
  "reasoning": "one short sentence explaining why these queries"
}`;

/**
 * Memory Recall Node
 *
 * Purpose:
 *   - Early graph entry point: retrieves relevant past conversation summaries
 *   - Generates 1–4 tight search queries via LLM
 *   - Performs semantic search against conversation_summaries Chroma collection
 *   - Attaches formatted context to state.metadata.memory
 *
 * Key Design Decisions (2025 refactor):
 *   - Removed all AgentLog / AgentWarn dependencies
 *   - Uses BaseNode.chat() with JSON format + enriched system prompt
 *   - Enrichment limited to soul + awareness only (memory circularity avoided)
 *   - Always returns { type: 'continue' } — routing lives exclusively in graph edges
 *   - Writes canonical context to state.metadata.memory.knowledgeBaseContext
 *   - Minimal WS feedback via wsChatMessage()
 *   - No custom prompt() method — unified BaseNode pattern
 *
 * Input expectations:
 *   - state.messages contains at least one recent user message
 *   - state.metadata.memory exists (BaseThreadState shape)
 *
 * Output mutations:
 *   - state.metadata.memory.knowledgeBaseContext ← formatted summary block
 *   - state.metadata.retrievedSummaryCount ← number of summaries attached
 *   - Optional lightweight WS progress message
 *
 * Failure modes handled:
 *   - No user message → silent continue
 *   - LLM returns no/empty queries → continue
 *   - Zero search results → continue
 *   - Parsing failure → continue (no context added)
 *
 * @extends BaseNode
 */
export class MemoryNode extends BaseNode {
  constructor() {
    super('memory_recall', 'Memory Recall');
  }

  async execute(state: BaseThreadState): Promise<NodeResult<BaseThreadState>> {

    // Build prompt — only soul + awareness (memory would be circular here)
    const enriched = await this.enrichPrompt(MEMORY_QUERY_PROMPT, state, {
      includeSoul: true,
      includeAwareness: true,
      includeMemory: false,
      includeTools: false,
      includeStrategicPlan: false,
      includeTacticalPlan: false,
      includeKnowledgebasePlan: false,
    });

    // Use unified chat() from BaseNode
    const responseJSON = await this.chat(
      state,
      enriched,
      { format: 'json' }
    );
    console.log('[MemoryNode] responseJSON', responseJSON);

    // Check if responseJSON exists and has content
    if (!responseJSON) {
      return { state, decision: { type: 'next' } };
    }

    // Direct object access — already parsed upstream
    const data = responseJSON as { queries: string[]; reasoning?: string };
    const queries = ((data?.queries ?? []).filter((q: any) => typeof q === 'string' && q.trim()));

    if (queries.length === 0) {
      return { state, decision: { type: 'next' } };
    }

    // Single combined search — Chroma handles OR semantics well
    const searchTerm = queries.join(' OR ');
    const results = await Summary.search(searchTerm, 10); // lowered from 12 → tighter relevance

    if (results.length === 0) {
      return { state, decision: { type: 'next' } };
    }

    // Format context exactly like previous enrichPrompt expects
    const memoryContext = results
      .map((s, i) => `[Summary ${i+1} - Thread ${s.attributes.threadId}]: ${s.summary}\nTopics: ${s.topics.join(', ')}\nEntities: ${s.entities.join(', ')}`)
      .join('\n\n');

    // Write to canonical location
    state.metadata.memory = {
      ...state.metadata.memory,
      chatSummariesContext: memoryContext,        // duplicate for backward compat if needed
    };

    return { state, decision: { type: 'next' } };
  }
}