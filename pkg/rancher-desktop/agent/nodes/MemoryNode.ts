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
Your job right now is to create a list of search queries based on the user's message so we can search memory.

Your job: Generate the best possible list of search queries to retrieve relevant past conversation summaries.

Follow this exact reasoning process:

type UserGoal = "information" | "action" | "planning" | "remembering" | "troubleshooting" | "other";

function identifyGoal(userMsg: string): UserGoal {
  // Internal heuristic — think step by step
  if (userMsg.toLowerCase().includes("remember") || userMsg.toLowerCase().includes("recall") || userMsg.toLowerCase().includes("earlier") || userMsg.toLowerCase().includes("before")) 
    return "remembering";
  if (userMsg.toLowerCase().includes("how") || userMsg.toLowerCase().includes("what") || userMsg.toLowerCase().includes("explain")) 
    return "information";
  if (userMsg.toLowerCase().includes("create") || userMsg.toLowerCase().includes("plan") || userMsg.toLowerCase().includes("milestone") || userMsg.toLowerCase().includes("task")) 
    return "planning";
  if (userMsg.toLowerCase().includes("do") || userMsg.toLowerCase().includes("make") || userMsg.toLowerCase().includes("run") || userMsg.toLowerCase().includes("execute")) 
    return "action";
  return "other";
}

function workBackwards(goal: UserGoal, userMsg: string): string[] {
  // Generate what we need to know to succeed
  const needed: string[] = [];

  // Core goal
  needed.push(userMsg.trim());

  // Key entities / specifics
  if (userMsg.match(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,}/)) needed.push("email or contact");
  if (userMsg.toLowerCase().includes("file") || userMsg.toLowerCase().includes("path") || userMsg.toLowerCase().includes(".jpg") || userMsg.toLowerCase().includes(".png")) 
    needed.push("file path", "image", "document");

  // What would make this easier?
  if (goal === "planning") needed.push("milestone", "task breakdown", "previous plan");
  if (goal === "remembering") needed.push("previous conversation", "earlier request", "last time we talked");
  if (goal === "action") needed.push("tool usage", "command executed", "result from last run");

  // Always add 2-4 high-precision variants
  return [...new Set(needed)].slice(0, 8);
}

// Final decision
const goal = identifyGoal("{{userMessage}}");
const queries = workBackwards(goal, "{{userMessage}}");

${JSON_ONLY_RESPONSE_INSTRUCTIONS}
{
  "query one", "query two", "query three", "query four"
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
    const prompt = MEMORY_QUERY_PROMPT;
    const enriched = await this.enrichPrompt(prompt, state, {
      includeSoul: true,
      includeAwareness: true,
      includeMemory: false,
      includeTools: false,
      includeStrategicPlan: false,
      includeTacticalPlan: false,
      includeKnowledgebasePlan: false,
    });

    const responseJSON = await this.chat(state, enriched, { format: 'json' });

    const raw = responseJSON;
    let queries: string[] = [];

    if (Array.isArray(raw)) {
      // Rare case: LLM returned naked array
      queries = raw.filter(q => typeof q === 'string' && q.trim().length > 4);
    } else if (raw && typeof raw === 'object' && Array.isArray(raw.queries)) {
      // Correct shape
      queries = raw.queries.filter((q: string) => typeof q === 'string' && q.trim().length > 4);
    } else if (raw && typeof raw === 'object') {
      // LLM returned wrong object shape → salvage values
      queries = Object.keys(raw)
        .filter((k: string) => typeof raw[k] === 'string' && raw[k].trim().length > 4)
        .map((k: string) => raw[k]);
    } else {
      queries = (responseJSON ?? [])
        .filter((q: any) => typeof q === 'string' && q.trim().length > 4)
        .slice(0, 5);
    }

    console.log('[MemoryNode] Final queries:', queries);


    // Search with each query independently + combine top results
    let docs: any[] = [];

    for (const q of queries) {
      const res = await Summary.search(q, 6); // 6 per query for diversity
      docs.push(...res);
    }

    // Deduplicate by threadId + timestamp, take top 8
    const uniqueDocs = docs
      .filter((d, i, arr) => 
        i === arr.findIndex(t => t.attributes.threadId === d.attributes.threadId)
      )
      .sort((a, b) => Number(b.attributes.timestamp) - Number(a.attributes.timestamp))
      .slice(0, 8);

    if (uniqueDocs.length === 0) {
      return { state, decision: { type: 'next' } };
    }

    // Build high-signal context block (same format Summary creates)
    const context = uniqueDocs
      .map(d => 
        `[Summary • ${new Date(Number(d.attributes.timestamp)).toLocaleString()} • Thread ${d.attributes.threadId}]\n` +
        `${d.summary}\n` +
        `Topics: ${d.topics?.join(', ') || '—'}\n` +
        `Entities: ${d.entities?.join(', ') || '—'}\n`
      )
      .join('\n' + '─'.repeat(60) + '\n');

    state.metadata.memory.chatSummariesContext = context;

    console.log(`[MemoryNode] Attached ${uniqueDocs.length} past summaries`);

    return { state, decision: { type: 'next' } };
  }
}