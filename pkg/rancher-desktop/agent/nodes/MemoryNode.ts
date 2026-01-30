// MemoryNode - Uses LLM to determine what to search for, then queries Chroma

import type { ThreadState, NodeResult } from '../types';
import { BaseNode } from './BaseNode';
import { getChromaService } from '../services/ChromaService';

interface SearchPlan {
  searchQuery: string;
  collection: string;
  whereClause?: Record<string, unknown>;
  reasoning: string;
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

      console.log(`[Agent:Memory] Search plan: ${searchPlan.reasoning}`);
      state.metadata.memorySearchPlan = searchPlan;

      // Query Chroma with the planned search
      const memories = await this.queryChroma(searchPlan);

      if (memories.length > 0) {
        console.log(`[Agent:Memory] Found ${memories.length} memories`);
        state.metadata.retrievedMemories = memories;
        state.metadata.memoryContext = memories
          .map((m, i) => `[Memory ${ i + 1 }]: ${ m }`)
          .join('\n');
      } else {
        console.log(`[Agent:Memory] No memories found`);
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

    const prompt = `You are a memory retrieval planner. Given a user query, determine what to search for in the vector database.

${ collectionsInfo }

Current user query: "${ userQuery }"

Respond in JSON format only:
{
  "searchQuery": "the semantic search query to find relevant memories",
  "collection": "which collection to search (use one from available, or 'conversations' as default)",
  "whereClause": { "optional": "metadata filters" },
  "reasoning": "brief explanation of search strategy"
}

If no memory search is needed (simple greeting, etc), respond with:
{ "skip": true, "reasoning": "why no search needed" }`;

    // Use BaseNode's promptJSON helper
    const parsed = await this.promptJSON<{
      skip?: boolean;
      searchQuery?: string;
      collection?: string;
      whereClause?: Record<string, unknown>;
      reasoning?: string;
    }>(prompt);

    if (!parsed) {
      return this.fallbackSearchPlan(userQuery);
    }

    if (parsed.skip) {
      return null;
    }

    // Validate collection exists
    let collection = parsed.collection || 'conversations';

    if (!collections.includes(collection)) {
      collection = collections[0] || 'conversations';
    }

    return {
      searchQuery:  parsed.searchQuery || userQuery,
      collection,
      whereClause:  parsed.whereClause,
      reasoning:    parsed.reasoning || 'LLM planned search',
    };
  }

  /**
   * Fallback search plan when LLM is unavailable
   */
  private fallbackSearchPlan(userQuery: string): SearchPlan {
    const collections = this.chroma.getCollectionNames();

    return {
      searchQuery: userQuery,
      collection:  collections[0] || 'conversations',
      reasoning:   'Fallback: direct query search',
    };
  }

  /**
   * Query Chroma with the search plan
   */
  private async queryChroma(plan: SearchPlan, limit = 5): Promise<string[]> {
    try {
      const data = await this.chroma.query(
        plan.collection,
        [plan.searchQuery],
        limit,
        plan.whereClause,
      );

      if (!data) {
        return [];
      }

      return data.documents?.[0] || [];
    } catch {
      return [];
    }
  }
}
