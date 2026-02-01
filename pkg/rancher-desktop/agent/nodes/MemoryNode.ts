// MemoryNode - Uses LLM to determine what to search for, then queries Chroma

import type { ThreadState, NodeResult } from '../types';
import { BaseNode, JSON_ONLY_RESPONSE_INSTRUCTIONS } from './BaseNode';
import { getChromaService } from '../services/ChromaService';

interface SearchPlan {
  needsMemory: boolean;
  searchQueries: string[];
  collection: string;
  whereClause?: Record<string, unknown>;
  reasoning: string;
  candidateLimit?: number;
}

export class MemoryNode extends BaseNode {
  private chroma = getChromaService();

  constructor() {
    super('memory_recall', 'Memory Recall');
  }

  async initialize(): Promise<void> {
    await super.initialize();
    await this.chroma.initialize();
    console.log(`[Agent:Memory] Collections: ${this.chroma.getCollectionNames().join(', ') || 'none'}`);
  }

  async execute(state: ThreadState): Promise<{ state: ThreadState; next: NodeResult }> {
    console.log(`[Agent:Memory] Executing...`);
    const lastUserMessage = state.messages.filter(m => m.role === 'user').pop();
    const emit = (state.metadata.__emitAgentEvent as ((event: { type: 'progress' | 'chunk' | 'complete' | 'error'; threadId: string; data: unknown }) => void) | undefined);

    if (!lastUserMessage) {
      console.log(`[Agent:Memory] No user message, skipping`);

      return { state, next: 'continue' };
    }

    try {
      await this.chroma.refreshCollections();

      if (this.chroma.getCollectionNames().length === 0) {
        console.log(`[Agent:Memory] No collections available, skipping`);

        return { state, next: 'continue' };
      }

      console.log(`[Agent:Memory] Planning search for: "${lastUserMessage.content.substring(0, 50)}..."`);
      const searchPlan = await this.planSearch(lastUserMessage.content, state);

      if (!searchPlan) {
        console.log(`[Agent:Memory] No search plan generated, skipping`);

        return { state, next: 'continue' };
      }

      if (!searchPlan.needsMemory || searchPlan.searchQueries.length === 0) {
        console.log(`[Agent:Memory] Memory not needed: ${searchPlan.reasoning}`);
        return { state, next: 'continue' };
      }

      console.log(`[Agent:Memory] Search plan: ${searchPlan.reasoning}`);
      state.metadata.memorySearchPlan = searchPlan;

      emit?.({
        type:     'progress',
        threadId: state.threadId,
        data:     { phase: 'memory_plan', needsMemory: true, queries: searchPlan.searchQueries, collection: searchPlan.collection },
      });

      // Query Chroma with the planned search (pull a larger candidate set)
      const candidateLimit = Number.isFinite(Number(searchPlan.candidateLimit)) ? Number(searchPlan.candidateLimit) : 18;
      const candidates = await this.queryChroma(searchPlan, candidateLimit);

      if (candidates.length === 0) {
        console.log(`[Agent:Memory] No memories found`);
        return { state, next: 'continue' };
      }

      const selected = await this.filterMemories(lastUserMessage.content, candidates);

      if (selected.length > 0) {
        console.log(`[Agent:Memory] Selected ${selected.length}/${candidates.length} memories`);
        state.metadata.retrievedMemories = selected;
        state.metadata.memories = selected;
        state.metadata.memoryContext = selected
          .map((m, i) => `[Memory ${ i + 1 }]: ${ m }`)
          .join('\n');

        emit?.({
          type:     'progress',
          threadId: state.threadId,
          data:     { phase: 'memory_selected', count: selected.length, candidates: candidates.length },
        });
      }
    } catch (err) {
      console.error('[Agent:Memory] Retrieval failed:', err);
    }

    return { state, next: 'continue' };
  }

  /**
   * Use LLM to determine what to search for and which collection to query
   */
  private async planSearch(userQuery: string, state: ThreadState): Promise<SearchPlan | null> {
    // Build context about available collections
    const collections = this.chroma.getCollectionNames();
    const collectionsInfo = collections.length > 0
      ? `Available collections: ${ collections.join(', ') }`
      : 'No collections available';

    const basePrompt = `Based on the conversation above, determine if long-term memory search is needed.

Before searching memory, outline 3-5 key elements of a potential strategic plan (e.g., goals, steps, risks, resources, metrics) to accomplish the user's request.

From that outline, derive what info from long-term memory would make the plan feasible—focus on gaps in knowledge, precedents, or assets.

If search needed, produce 1-6 short, specific queries targeting those gaps.
    

${JSON_ONLY_RESPONSE_INSTRUCTIONS}
{
  "needsMemory": boolean,
  "searchQueries": string[],
  "collection": "choose one or both ${ collectionsInfo }",
  "whereClause": { "optional": "metadata filters" },
  "candidateLimit": number,
  "reasoning": "brief explanation of search strategy"
}
`;

    const prompt = await this.enrichPrompt(basePrompt, state, {
      includeSoul: true,
      includeAwareness: true,
      includeTools: true,
      toolDetail: 'names',
      includeSkills: true,
      includeStrategicPlan: true,
    });

    console.log(`[Agent:Memory] Prompt (plain text):\n${prompt}`);

    // Use BaseNode's promptJSON helper (don't store in messages - this is internal planning)
    const parsed = await this.promptJSON<{
      needsMemory?: boolean;
      searchQueries?: unknown;
      collection?: string;
      whereClause?: Record<string, unknown>;
      candidateLimit?: number;
      reasoning?: string;
    }>(prompt, state, false);

    if (!parsed) {
      return this.fallbackSearchPlan(userQuery);
    }

    const needsMemory = !!parsed.needsMemory;
    const searchQueries = Array.isArray(parsed.searchQueries)
      ? (parsed.searchQueries as unknown[]).map(String).map(s => s.trim()).filter(Boolean)
      : [];

    // Validate collection exists
    let collection = parsed.collection || 'conversations';

    if (!collections.includes(collection)) {
      collection = collections[0] || 'conversations';
    }

    return {
      needsMemory,
      searchQueries,
      collection,
      whereClause: parsed.whereClause,
      candidateLimit: parsed.candidateLimit,
      reasoning: parsed.reasoning || 'LLM planned search',
    };
  }

  /**
   * Fallback search plan when LLM is unavailable
   */
  private fallbackSearchPlan(userQuery: string): SearchPlan {
    const collections = this.chroma.getCollectionNames();

    return {
      needsMemory: true,
      searchQueries: [userQuery],
      collection:  collections[0] || 'conversations',
      reasoning:   'Fallback: direct query search',
      candidateLimit: 12,
    };
  }

  /**
   * Query Chroma with the search plan
   */
  private async queryChroma(plan: SearchPlan, limit = 18): Promise<string[]> {
    try {
      const out: string[] = [];
      const queries = plan.searchQueries.length > 0 ? plan.searchQueries : [];

      for (const q of queries) {
        const data = await this.chroma.query(
          plan.collection,
          [q],
          Math.max(1, Math.floor(limit / Math.max(1, queries.length))),
          plan.whereClause,
        );

        const docs = data?.documents?.[0] || [];
        for (const d of docs) {
          if (d && !out.includes(d)) {
            out.push(d);
          }
        }
      }

      return out.slice(0, limit);
    } catch {
      return [];
    }
  }

  private async filterMemories(userQuery: string, candidates: string[]): Promise<string[]> {
    const capped = candidates.slice(0, 24);
    const prompt = `You are selecting relevant memories for a user request.

Candidate memories (each item is a standalone snippet):
${capped.map((m, i) => `${i + 1}. ${m}`).join('\n')}



## Rules:
- Select ONLY items that are clearly relevant.
- It's valid to select none.
- Prefer fewer, higher-signal items.


${JSON_ONLY_RESPONSE_INSTRUCTIONS}
{
  "selected": number[],
  "reasoning": "brief"
}`;

    const parsed = await this.promptJSON<{ selected?: unknown; reasoning?: string }>(prompt, undefined, false);
    if (!parsed || !Array.isArray(parsed.selected)) {
      return capped.slice(0, 10);
    }

    const selectedIdx = (parsed.selected as unknown[])
      .map(n => Number(n))
      .filter(n => Number.isFinite(n) && n >= 1 && n <= capped.length);

    const out: string[] = [];
    for (const idx of selectedIdx) {
      const m = capped[idx - 1];
      if (m && !out.includes(m)) {
        out.push(m);
      }
    }
    return out;
  }
}
