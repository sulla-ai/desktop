// KnowledgeGraph.ts
// Orchestrates KnowledgeBase page generation
// Updated: uses Summary model instead of PersistenceService.loadConversation

import { Graph } from '../nodes/Graph';
import { KnowledgePlannerNode } from '../nodes/KnowledgePlannerNode';
import { KnowledgeExecutorNode } from '../nodes/KnowledgeExecutorNode';
import { KnowledgeCriticNode } from '../nodes/KnowledgeCriticNode';
import { KnowledgeWriterNode } from '../nodes/KnowledgeWriterNode';
import { Summary } from '../database/models/Summary'; 
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

    graph.addEdge('knowledge_planner', 'knowledge_executor');
    graph.addEdge('knowledge_executor', 'knowledge_critic');
    graph.addEdge('knowledge_critic', 'knowledge_writer');
    graph.addEdge('knowledge_writer', 'end');

    graph.setEntryPoint('knowledge_planner');
    graph.setEndPoints('knowledge_writer');

    return graph;
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;

    this.graph = this.buildGraph();
    await this.graph.initialize();
    this.initialized = true;
  }

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

  enqueueAsync(request: KnowledgeGraphRequest): void {
    this.queue.push({ request });
    this.processQueue();
  }

  async run(request: KnowledgeGraphRequest): Promise<KnowledgeGraphResponse> {
    if (request.mode === 'async') {
      this.enqueueAsync(request);
      return { success: true, slug: undefined, title: undefined };
    }
    return this.runSync(request);
  }

  private async processQueue(): Promise<void> {
    if (this.processing || this.queue.length === 0) return;

    this.processing = true;

    while (this.queue.length > 0) {
      const item = this.queue.shift();
      if (!item) continue;

      try {
        const response = await this.runSync(item.request);
        item.resolve?.(response);
        console.log(`[KnowledgeGraph] Async complete: ${response.slug || 'error'}`);
      } catch (err) {
        console.error(`[KnowledgeGraph] Async failed:`, err);
        item.resolve?.({
          success: false,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    this.processing = false;
  }

  private async buildInitialState(request: KnowledgeGraphRequest): Promise<ThreadState | null> {
    let messages = request.messages;

    // Load messages from Summary model (last relevant summary for thread)
    if (!messages || messages.length === 0) {
      const summary = await Summary.findByThread(request.threadId);
      if (!summary?.summary) {
        return null;
      }

      // Reconstruct minimal messages from summary
      messages = [
        { role: 'system', content: `Summary of previous conversation in thread ${request.threadId}:\n${summary.summary}` },
        { role: 'user', content: 'Continue from previous context.' },
      ];
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

    const error = writerError || 'Unknown error';
    return { success: false, error };
  }
}

// Singleton
let instance: KnowledgeGraphClass | null = null;

export function getKnowledgeGraph(): KnowledgeGraphClass {
  if (!instance) instance = new KnowledgeGraphClass();
  return instance;
}

export { KnowledgeGraphClass };