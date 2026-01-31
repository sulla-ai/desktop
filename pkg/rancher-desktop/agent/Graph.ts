// Graph - LangGraph-style workflow orchestrator

import type { GraphNode, GraphEdge, ThreadState, NodeResult } from './types';

type AgentRuntimeEmitter = (event: { type: 'progress' | 'chunk' | 'complete' | 'error'; threadId: string; data: unknown }) => void;

export class Graph {
  private nodes: Map<string, GraphNode> = new Map();
  private edges: Map<string, GraphEdge[]> = new Map();
  private entryPoint: string | null = null;
  private endPoints: Set<string> = new Set();
  private initialized = false;

  /**
   * Add a node to the graph
   */
  addNode(node: GraphNode): this {
    this.nodes.set(node.id, node);

    return this;
  }

  /**
   * Add an edge between nodes
   */
  addEdge(from: string, to: string): this {
    const edges = this.edges.get(from) || [];

    edges.push({ from, to });
    this.edges.set(from, edges);

    return this;
  }

  /**
   * Add a conditional edge
   */
  addConditionalEdge(from: string, condition: (state: ThreadState) => string): this {
    const edges = this.edges.get(from) || [];

    edges.push({ from, to: condition });
    this.edges.set(from, edges);

    return this;
  }

  /**
   * Set the entry point node
   */
  setEntryPoint(nodeId: string): this {
    this.entryPoint = nodeId;

    return this;
  }

  /**
   * Set end point nodes
   */
  setEndPoints(...nodeIds: string[]): this {
    nodeIds.forEach(id => this.endPoints.add(id));

    return this;
  }

  /**
   * Initialize all nodes
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    for (const node of this.nodes.values()) {
      if (node.initialize) {
        await node.initialize();
      }
    }

    this.initialized = true;
  }

  /**
   * Execute the graph with given state
   */
  async execute(initialState: ThreadState, maxIterations = 1_000_000): Promise<ThreadState> {
    if (!this.entryPoint) {
      throw new Error('No entry point set');
    }

    console.log(`[Agent:Graph] Starting execution from: ${this.entryPoint}`);
    await this.initialize();

    let state = initialState;
    let currentNodeId = this.entryPoint;
    let iterations = 0;

    while (iterations < maxIterations) {
      iterations++;

      const node = this.nodes.get(currentNodeId);

      if (!node) {
        throw new Error(`Node not found: ${ currentNodeId }`);
      }

      const emit = (state.metadata.__emitAgentEvent as AgentRuntimeEmitter | undefined);
      emit?.({
        type:     'progress',
        threadId: state.threadId,
        data:     { phase: 'node_start', nodeId: currentNodeId, nodeName: node.name },
      });

      console.log(`[Agent:Graph] Executing node: ${node.name} (${currentNodeId})`);
      const result = await node.execute(state);

      state = result.state;

      const emitAfter = (state.metadata.__emitAgentEvent as AgentRuntimeEmitter | undefined);
      emitAfter?.({
        type:     'progress',
        threadId: state.threadId,
        data:     { phase: 'node_end', nodeId: currentNodeId, nodeName: node.name, next: result.next },
      });

      const nextNodeId = this.resolveNext(currentNodeId, result.next, state);
      console.log(`[Agent:Graph] Node ${node.name} returned: ${result.next} → next: ${nextNodeId}`);

      // Check if we should end
      if (nextNodeId === 'end' || this.endPoints.has(currentNodeId) && result.next === 'end') {
        console.log(`[Agent:Graph] Execution complete after ${iterations} iterations`);
        break;
      }

      // Handle loop back
      if (nextNodeId === currentNodeId) {
        // Prevent infinite loops on same node
        console.warn(`Loop detected on node ${ currentNodeId }, forcing end`);
        break;
      }

      currentNodeId = nextNodeId;
    }

    if (iterations >= maxIterations) {
      console.warn('Max iterations reached in graph execution');
      state.metadata.maxIterationsReached = true;
    }

    return state;
  }

  /**
   * Resolve the next node based on edges and result
   */
  private resolveNext(currentNodeId: string, result: NodeResult, state: ThreadState): string {
    // If result is 'end', we're done
    if (result === 'end') {
      return 'end';
    }

    // If result is a specific node name, go there
    if (result !== 'continue' && result !== 'loop' && this.nodes.has(result)) {
      return result;
    }

    // If result is 'loop', go back to entry point
    if (result === 'loop') {
      return this.entryPoint as string;
    }

    // Otherwise, follow edges
    const edges = this.edges.get(currentNodeId) || [];

    for (const edge of edges) {
      if (typeof edge.to === 'function') {
        // Conditional edge
        const nextId = edge.to(state);

        if (nextId && this.nodes.has(nextId)) {
          return nextId;
        }
      } else if (this.nodes.has(edge.to)) {
        // Static edge
        return edge.to;
      }
    }

    // No valid edge found, end
    return 'end';
  }

  /**
   * Destroy all nodes
   */
  async destroy(): Promise<void> {
    for (const node of this.nodes.values()) {
      if (node.destroy) {
        await node.destroy();
      }
    }

    this.nodes.clear();
    this.edges.clear();
    this.initialized = false;
  }
}

/**
 * Create the default agent graph
 * Flow: Memory → Planner → Executor → Critic → (loop to Planner or END)
 */
export function createDefaultGraph(): Graph {
  // Import nodes dynamically to avoid circular deps
  const { MemoryNode, PlannerNode, ExecutorNode, CriticNode, FinalCriticNode } = require('./nodes');
  const { registerDefaultTools } = require('./tools');

  const graph = new Graph();

  registerDefaultTools();

  // Add nodes
  graph.addNode(new MemoryNode());
  graph.addNode(new PlannerNode());
  graph.addNode(new ExecutorNode());
  graph.addNode(new CriticNode());
  graph.addNode(new FinalCriticNode());

  // Add edges: Memory → Planner → Executor → Critic
  graph.addEdge('memory_recall', 'planner');
  graph.addEdge('planner', 'executor');
  graph.addEdge('executor', 'critic');

  // Conditional edge from Critic: loop back to Planner, continue executing todos, or run final critic
  graph.addConditionalEdge('critic', (state: ThreadState) => {
    const decision = state.metadata.criticDecision;

    if (decision === 'revise') {
      return 'planner';
    }

    if (state.metadata.planHasRemainingTodos) {
      return 'executor';
    }

    return 'final_critic';
  });

  graph.addConditionalEdge('final_critic', (state: ThreadState) => {
    if (state.metadata.finalCriticDecision === 'revise') {
      return 'planner';
    }
    return 'end';
  });

  // Set entry and end points
  graph.setEntryPoint('memory_recall');
  graph.setEndPoints('final_critic');

  return graph;
}
