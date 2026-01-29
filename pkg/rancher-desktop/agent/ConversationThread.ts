// ConversationThread - Per-thread state and conscious processing loop
// Uses LangGraph-style workflow with nodes: Memory → Planner → Executor → Critic

import type {
  ThreadState,
  Message,
  SensoryInput,
  AgentResponse,
  AgentEvent,
  AgentEventHandler,
  GraphNode,
} from './types';
import { Graph, createDefaultGraph } from './Graph';
import { getPersistenceService } from './services/PersistenceService';

const SHORT_TERM_MEMORY_SIZE = 5; // Recent 5 exchanges

let messageCounter = 0;

function generateMessageId(): string {
  return `msg_${ Date.now() }_${ ++messageCounter }`;
}

function generateResponseId(): string {
  return `resp_${ Date.now() }`;
}

export class ConversationThread {
  private state: ThreadState;
  private graph: Graph;
  private eventHandlers: AgentEventHandler[] = [];
  private initialized = false;

  constructor(threadId: string, graph?: Graph) {
    this.state = {
      threadId,
      messages:           [],
      shortTermMemory:    [],
      metadata:           {},
      subconsciousStatus: {
        deepMemory:   { state: 'idle' },
        toolExecutor: { state: 'idle' },
        integrator:   { state: 'idle' },
      },
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    // Use provided graph or create default
    this.graph = graph || createDefaultGraph();
  }

  get threadId(): string {
    return this.state.threadId;
  }

  /**
   * Add a custom node to the graph
   */
  addNode(node: GraphNode): void {
    this.graph.addNode(node);
  }

  /**
   * Add an edge between nodes
   */
  addEdge(from: string, to: string): void {
    this.graph.addEdge(from, to);
  }

  /**
   * Add a conditional edge
   */
  addConditionalEdge(from: string, condition: (state: ThreadState) => string): void {
    this.graph.addConditionalEdge(from, condition);
  }

  /**
   * Subscribe to events (for streaming updates)
   */
  onEvent(handler: AgentEventHandler): void {
    this.eventHandlers.push(handler);
  }

  /**
   * Emit an event to all handlers
   */
  private emit(event: Omit<AgentEvent, 'timestamp'>): void {
    const fullEvent: AgentEvent = { ...event, timestamp: Date.now() };

    for (const handler of this.eventHandlers) {
      try {
        handler(fullEvent);
      } catch (err) {
        console.error('Event handler error:', err);
      }
    }
  }

  /**
   * Initialize the thread and graph
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    // Initialize persistence service
    const persistence = getPersistenceService();

    await persistence.initialize();

    // Try to load existing conversation
    const saved = await persistence.loadConversation(this.threadId);

    if (saved && saved.length > 0) {
      console.log(`[Agent:Thread:${this.threadId}] Restored ${saved.length} messages from PostgreSQL`);
      this.state.messages = saved.map((m, i) => ({
        id:        `msg_restored_${i}`,
        role:      m.role as 'user' | 'assistant' | 'system',
        content:   m.content,
        timestamp: Date.now(),
      }));
      this.state.shortTermMemory = this.state.messages.slice(-SHORT_TERM_MEMORY_SIZE * 2);
    }

    await this.graph.initialize();
    this.initialized = true;
  }

  /**
   * Process input through the graph workflow
   * Flow: Memory → Planner → Executor → Critic → (loop or END)
   */
  async process(input: SensoryInput): Promise<AgentResponse> {
    console.log(`[Agent:Thread:${this.threadId}] Processing input: "${input.data.substring(0, 50)}..."`);
    this.emit({ type: 'progress', threadId: this.threadId, data: { phase: 'start' } });

    const userMessage: Message = {
      id:        generateMessageId(),
      role:      'user',
      content:   input.data,
      timestamp: Date.now(),
      metadata:  { sensoryId: input.id, source: input.metadata.source },
    };

    this.addMessage(userMessage);
    this.state.updatedAt = Date.now();

    console.log(`[Agent:Thread:${this.threadId}] Starting graph execution...`);
    this.emit({ type: 'progress', threadId: this.threadId, data: { phase: 'graph_execution' } });

    try {
      this.state = await this.graph.execute(this.state);
      console.log(`[Agent:Thread:${this.threadId}] Graph execution complete`);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);

      console.error(`[Agent:Thread:${this.threadId}] Graph execution failed:`, message);
      this.state.metadata.error = `Graph execution failed: ${ message }`;
    }

    // Extract response from state
    const responseContent = this.extractResponse();

    // Record assistant message
    const assistantMessage: Message = {
      id:        generateMessageId(),
      role:      'assistant',
      content:   responseContent,
      timestamp: Date.now(),
    };

    this.addMessage(assistantMessage);

    // Persist conversation (async, don't block)
    this.persistConversation();

    // Build response
    const response: AgentResponse = {
      id:        generateResponseId(),
      threadId:  this.threadId,
      type:      'text',
      content:   responseContent,
      refined:   !!this.state.metadata.criticDecision,
      metadata:  { ...this.state.metadata },
      timestamp: Date.now(),
    };

    this.emit({ type: 'complete', threadId: this.threadId, data: response });

    return response;
  }

  /**
   * Add a message and update short-term memory
   */
  private addMessage(message: Message): void {
    this.state.messages.push(message);

    // Update short-term memory (recent exchanges)
    this.state.shortTermMemory = this.state.messages.slice(-SHORT_TERM_MEMORY_SIZE * 2);
  }

  /**
   * Persist conversation to PostgreSQL (fire and forget)
   */
  private persistConversation(): void {
    const persistence = getPersistenceService();
    const messages = this.state.messages.map(m => ({
      role:    m.role,
      content: m.content,
    }));

    persistence.storeConversation(this.threadId, messages).catch(err => {
      console.warn(`[Agent:Thread:${this.threadId}] Persist failed:`, err);
    });
  }

  /**
   * Extract response content from state metadata
   */
  private extractResponse(): string {
    if (this.state.metadata.error) {
      return `Error: ${ this.state.metadata.error }`;
    }

    return (this.state.metadata.response as string) || 'No response generated';
  }

  /**
   * Get current thread state
   */
  getState(): ThreadState {
    return { ...this.state };
  }

  /**
   * Get short-term memory for context
   */
  getShortTermMemory(): Message[] {
    return [...this.state.shortTermMemory];
  }

  /**
   * Format short-term memory as context string
   */
  formatMemoryContext(): string {
    if (this.state.shortTermMemory.length === 0) {
      return '';
    }

    return this.state.shortTermMemory
      .map(m => `${ m.role === 'user' ? 'User' : 'Assistant' }: ${ m.content }`)
      .join('\n');
  }

  /**
   * Destroy the thread and cleanup
   */
  async destroy(): Promise<void> {
    await this.graph.destroy();
    this.initialized = false;
  }
}

// Thread manager - maintains active threads
const activeThreads: Map<string, ConversationThread> = new Map();

export function getThread(threadId: string): ConversationThread {
  let thread = activeThreads.get(threadId);

  if (!thread) {
    thread = new ConversationThread(threadId);
    activeThreads.set(threadId, thread);
  }

  return thread;
}

export function getAllThreads(): ConversationThread[] {
  return Array.from(activeThreads.values());
}

export function removeThread(threadId: string): void {
  activeThreads.delete(threadId);
}
