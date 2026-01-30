// ExecutorNode - Executes the plan (LLM calls, tool execution)

import type { ThreadState, NodeResult } from '../types';
import { BaseNode } from './BaseNode';
import { getChromaService } from '../services/ChromaService';
import { getMemoryPedia } from '../services/MemoryPedia';

export class ExecutorNode extends BaseNode {
  constructor() {
    super('executor', 'Executor');
  }

  async execute(state: ThreadState): Promise<{ state: ThreadState; next: NodeResult }> {
    console.log(`[Agent:Executor] Executing...`);
    const plan = state.metadata.plan as {
      requiresTools: boolean;
      steps: string[];
      fullPlan?: { steps?: Array<{ action: string }>; context?: { memorySearchQueries?: string[] } };
    } | undefined;

    // Execute tools if needed
    if (plan?.requiresTools) {
      await this.executePlannedTools(state, plan);
    }

    // Generate LLM response using BaseNode helpers
    console.log(`[Agent:Executor] Generating LLM response...`);
    const response = await this.generateResponse(state);

    if (response) {
      console.log(`[Agent:Executor] Response generated (${response.content.length} chars)`);
      state.metadata.response = response.content;
      state.metadata.ollamaModel = response.model;
      state.metadata.ollamaEvalCount = response.evalCount;
      state.metadata.executorCompleted = true;
    } else {
      console.error(`[Agent:Executor] Failed to generate response`);
      state.metadata.error = 'Failed to generate response';
    }

    return { state, next: 'continue' };
  }

  private async executePlannedTools(
    state: ThreadState,
    plan: {
      requiresTools: boolean;
      steps: string[];
      fullPlan?: { steps?: Array<{ action: string }>; context?: { memorySearchQueries?: string[] } };
    },
  ): Promise<void> {
    const actions = (plan.fullPlan?.steps?.length)
      ? plan.fullPlan.steps.map(s => s.action)
      : (plan.steps || []);

    const toolResults: Record<string, unknown> = {};

    for (const action of actions) {
      if (action === 'recall_memory' || action === 'memory_search') {
        const queries = plan.fullPlan?.context?.memorySearchQueries || [];
        const memories = await this.searchMemory(queries, state);

        toolResults.recall_memory = {
          queries,
          count:   memories.length,
        };

        if (memories.length > 0) {
          state.metadata.retrievedMemories = memories;
          state.metadata.memoryContext = memories
            .map((m: string, i: number) => `[Memory ${i + 1}]: ${m}`)
            .join('\n');
        }
      }

      if (action === 'count_memory_articles' || action === 'count_memory' || action === 'count_memorypedia') {
        const counts = await this.countMemoryArticles();
        toolResults.count_memory_articles = counts;
        state.metadata.memoryArticleCounts = counts;
        state.metadata.memoryContext = state.metadata.memoryContext
          ? `${state.metadata.memoryContext as string}\n\n${counts.summary}`
          : counts.summary;
      }
    }

    if (Object.keys(toolResults).length > 0) {
      state.metadata.toolResults = toolResults;
    }
  }

  private async countMemoryArticles(): Promise<{ summaries: number; pages: number; total: number; summary: string }> {
    const chroma = getChromaService();

    try {
      try {
        await getMemoryPedia().initialize();
      } catch {
        // continue
      }

      await chroma.initialize();
      await chroma.refreshCollections();

      const summaries = await chroma.count('conversation_summaries');
      const pages = await chroma.count('memorypedia_pages');
      const total = summaries + pages;
      const summary = `Memory counts (ChromaDB): conversation_summaries=${summaries}, memorypedia_pages=${pages}, total=${total}`;

      return { summaries, pages, total, summary };
    } catch (err) {
      console.error('[Agent:Executor] countMemoryArticles failed:', err);

      return {
        summaries: 0,
        pages:     0,
        total:     0,
        summary:   'Memory counts unavailable (ChromaDB error).',
      };
    }
  }

  private async searchMemory(queries: string[], state: ThreadState): Promise<string[]> {
    const chroma = getChromaService();
    const results: string[] = [];
    const effectiveQueries = (queries && queries.length > 0)
      ? queries
      : [state.messages.filter(m => m.role === 'user').pop()?.content || ''];

    try {
      try {
        await getMemoryPedia().initialize();
      } catch {
        // continue
      }

      const ok = await chroma.initialize();
      if (!ok || !chroma.isAvailable()) {
        return [];
      }
      await chroma.refreshCollections();

      for (const query of effectiveQueries) {
        if (!query) {
          continue;
        }
        const summaryResults = await chroma.query('conversation_summaries', [query], 3);
        if (summaryResults?.documents?.[0]) {
          for (const doc of summaryResults.documents[0]) {
            if (doc && !results.includes(doc)) {
              results.push(doc);
            }
          }
        }

        const pageResults = await chroma.query('memorypedia_pages', [query], 3);
        if (pageResults?.documents?.[0]) {
          for (const doc of pageResults.documents[0]) {
            if (doc && !results.includes(doc)) {
              results.push(doc);
            }
          }
        }
      }

      return results.slice(0, 5);
    } catch (err) {
      console.error('[Agent:Executor] searchMemory failed:', err);

      return [];
    }
  }

  private async generateResponse(state: ThreadState) {
    // Get the current user message
    const lastUserMessage = state.messages.filter(m => m.role === 'user').pop();

    if (!lastUserMessage) {
      return null;
    }

    // Build instruction - don't include user message here since it's in shortTermMemory
    let instruction = 'Respond to the user\'s latest message based on the conversation above.';

    if (state.metadata.memoryContext) {
      instruction = `${instruction}\n\nYou have access to internal long-term memory from ChromaDB/MemoryPedia provided above as "Relevant context from memory". Use it when answering. Do not claim you have no memory or no access to prior information if that context is present.`;
    }

    // Add tool results if any
    if (state.metadata.toolResults) {
      instruction = `Tool results:\n${ JSON.stringify(state.metadata.toolResults) }\n\n${ instruction }`;
    }

    // Add prompt prefix/suffix if set by other nodes
    if (state.metadata.promptPrefix) {
      instruction = `${ state.metadata.promptPrefix }\n\n${ instruction }`;
    }

    if (state.metadata.promptSuffix) {
      instruction = `${ instruction }\n\n${ state.metadata.promptSuffix }`;
    }

    // Add plan guidance if available
    const plan = state.metadata.plan as { fullPlan?: { responseGuidance?: { tone?: string; format?: string } } } | undefined;

    if (plan?.fullPlan?.responseGuidance) {
      const guidance = plan.fullPlan.responseGuidance;

      instruction += `\n\nResponse guidance: Use a ${guidance.tone || 'friendly'} tone and ${guidance.format || 'conversational'} format.`;
    }

    // Use BaseNode's buildContextualPrompt - history already includes the user message
    const fullPrompt = this.buildContextualPrompt(instruction, state, {
      includeMemory:  true,
      includeHistory: true,
    });

    console.log(`[Agent:Executor] Full prompt length: ${fullPrompt.length} chars`);

    return this.prompt(fullPrompt);
  }
}
