// KnowledgeGraph - Orchestrates KnowledgeBase page generation
// Flow: KnowledgePlannerNode → KnowledgeExecutorNode → KnowledgeCriticNode → KnowledgeWriterNode
// Supports sync and async dispatch modes

import { Graph } from '../Graph';
import { KnowledgePlannerNode } from '../nodes/KnowledgePlannerNode';
import { KnowledgeExecutorNode } from '../nodes/KnowledgeExecutorNode';
import { KnowledgeCriticNode } from '../nodes/KnowledgeCriticNode';
import { KnowledgeWriterNode } from '../nodes/KnowledgeWriterNode';
import { getPersistenceService } from './PersistenceService';
import type { ThreadState } from '../types';

export interface KnowledgeGraphRequest {
  threadId: string;
  mode: 'sync' | 'async';
  messages?: Array<{ role: string; content: string }>;
}

export interface KnowledgeGraphResponse {
  success: boolean;
  slug?: string;
  title?: string;
  error?: string;
}

type QueueItem = {
  request: KnowledgeGraphRequest;
  resolve?: (response: KnowledgeGraphResponse) => void;
};

class KnowledgeGraphClass {
  private graph: Graph | null = null;
  private queue: QueueItem[] = [];
  private processing = false;
  private initialized = false;

  private buildGraph(): Graph {
    const graph = new Graph();

    graph.addNode(new KnowledgePlannerNode());
    graph.addNode(new KnowledgeExecutorNode());
    graph.addNode(new KnowledgeCriticNode());
    graph.addNode(new KnowledgeWriterNode());

    // Flow: Planner → Executor → Critic → Writer
    // Critic returns 'knowledge_executor' directly for refinement, or 'continue' to proceed
    graph.addEdge('knowledge_planner', 'knowledge_executor');
    graph.addEdge('knowledge_executor', 'knowledge_critic');
    graph.addEdge('knowledge_critic', 'knowledge_writer');
    graph.addEdge('knowledge_writer', 'end');

    graph.setEntryPoint('knowledge_planner');
    graph.setEndPoints('knowledge_writer');

    return graph;
  }

  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    this.graph = this.buildGraph();
    await this.graph.initialize();
    this.initialized = true;
  }

  /**
   * Run the KnowledgeGraph synchronously - blocks until complete
   */
  async runSync(request: KnowledgeGraphRequest): Promise<KnowledgeGraphResponse> {
    await this.initialize();

    const state = await this.buildInitialState(request);
    if (!state) {
      return { success: false, error: 'Failed to load messages for thread' };
    }

    try {
      const finalState = await this.graph!.execute(state);
      return this.extractResponse(finalState);
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }

  /**
   * Enqueue a request for async processing - returns immediately
   */
  enqueueAsync(request: KnowledgeGraphRequest): void {
    this.queue.push({ request });
    this.processQueue();
  }

  /**
   * Run the KnowledgeGraph - auto-selects sync or async based on request.mode
   */
  async run(request: KnowledgeGraphRequest): Promise<KnowledgeGraphResponse> {
    if (request.mode === 'async') {
      this.enqueueAsync(request);
      return { success: true, slug: undefined, title: undefined };
    }
    return this.runSync(request);
  }

  private async processQueue(): Promise<void> {
    if (this.processing || this.queue.length === 0) {
      return;
    }

    this.processing = true;

    while (this.queue.length > 0) {
      const item = this.queue.shift();
      if (!item) {
        continue;
      }

      try {
        const response = await this.runSync(item.request);
        if (item.resolve) {
          item.resolve(response);
        }
        console.log(`[KnowledgeGraph] Async processing complete: ${response.slug || 'error'}`);
      } catch (err) {
        console.error(`[KnowledgeGraph] Async processing failed:`, err);
        if (item.resolve) {
          item.resolve({
            success: false,
            error: err instanceof Error ? err.message : String(err),
          });
        }
      }
    }

    this.processing = false;
  }

  private async buildInitialState(request: KnowledgeGraphRequest): Promise<ThreadState | null> {
    let messages = request.messages;

    // Load messages from persistence if not provided
    if (!messages || messages.length === 0) {
      const persistence = getPersistenceService();
      await persistence.initialize();
      const loaded = await persistence.loadConversation(request.threadId);
      if (!loaded || loaded.length === 0) {
        return null;
      }
      messages = loaded;
    }

    const now = Date.now();

    const state: ThreadState = {
      threadId: request.threadId,
      messages: messages.map((m, i) => ({
        id: `msg_kg_${i}`,
        role: m.role as 'user' | 'assistant' | 'system',
        content: m.content,
        timestamp: now,
      })),
      shortTermMemory: [],
      metadata: {},
      createdAt: now,
      updatedAt: now,
    };

    return state;
  }

  private extractResponse(state: ThreadState): KnowledgeGraphResponse {
    const writerResult = (state.metadata as any).knowledgeWriterResult as { slug: string; title: string } | undefined;
    const writerError = (state.metadata as any).knowledgeWriterError as string | undefined;

    if (writerResult) {
      return {
        success: true,
        slug: writerResult.slug,
        title: writerResult.title,
      };
    }

    // Check for errors from any node
    const plannerError = (state.metadata as any).knowledgePlannerError;
    const executorError = (state.metadata as any).knowledgeExecutorError;
    const criticError = (state.metadata as any).knowledgeCriticError;

    const error = writerError || criticError || executorError || plannerError || 'Unknown error';

    return {
      success: false,
      error,
    };
  }
}

// Singleton instance
let instance: KnowledgeGraphClass | null = null;

export function getKnowledgeGraph(): KnowledgeGraphClass {
  if (!instance) {
    instance = new KnowledgeGraphClass();
  }
  return instance;
}

export { KnowledgeGraphClass };
