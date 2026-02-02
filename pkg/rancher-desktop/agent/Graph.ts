// Graph - LangGraph-style workflow orchestrator

import type { GraphNode, GraphEdge, ThreadState, NodeResult } from './types';
import type { AbortService } from './services/AbortService';

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
  async execute(
    initialState: ThreadState,
    maxIterations = 1_000_000,
    options?: { abort?: AbortService },
  ): Promise<ThreadState> {
    if (!this.entryPoint) {
      throw new Error('No entry point set');
    }

    console.log(`[Agent:Graph] Starting execution from: ${this.entryPoint}`);
    await this.initialize();

    let state = initialState;
    let currentNodeId = this.entryPoint;
    let iterations = 0;

    const abort = options?.abort;
    const throwIfAborted = () => {
      if (abort?.signal.aborted) {
        const err = new Error('Aborted');
        (err as any).name = 'AbortError';
        throw err;
      }
    };

    throwIfAborted();

    while (iterations < maxIterations) {
      iterations++;

      throwIfAborted();

      const node = this.nodes.get(currentNodeId);

      if (!node) {
        throw new Error(`Node not found: ${ currentNodeId }`);
      }

      throwIfAborted();

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
 * Create the hierarchical planning graph
 * Flow: Memory → StrategicPlanner → [TacticalPlanner → Executor → Critic] → FinalCritic
 * 
 * Strategic Planner: Creates high-level goals and milestones (persisted to DB)
 * Tactical Planner: Creates micro-plans for each milestone (state-only)
 * Executor: Executes tactical steps with tools
 * Critic: Reviews tactical step execution, can request revision or advance
 */
export function createHierarchicalGraph(): Graph {
  const { 
    MemoryNode, 
    StrategicPlannerNode, 
    TacticalPlannerNode, 
    TacticalExecutorNode, 
    TacticalCriticNode, 
    StrategicCriticNode 
  } = require('./nodes');
  const { registerDefaultTools } = require('./tools');

  const graph = new Graph();

  registerDefaultTools();

  // Add nodes
  graph.addNode(new MemoryNode());
  graph.addNode(new StrategicPlannerNode());
  graph.addNode(new TacticalPlannerNode());
  graph.addNode(new TacticalExecutorNode());
  graph.addNode(new TacticalCriticNode());
  graph.addNode(new StrategicCriticNode());

  // Flow: Memory → StrategicPlanner → TacticalPlanner → Executor → Critic
  graph.addEdge('memory_recall', 'strategic_planner');
  graph.addEdge('strategic_planner', 'tactical_planner');
  graph.addEdge('tactical_planner', 'tactical_executor');
  graph.addEdge('tactical_executor', 'tactical_critic');

  // Conditional edge from Critic
  graph.addConditionalEdge('tactical_critic', (state: ThreadState) => {
    const decision = state.metadata.criticDecision;

    // If revision requested, go back to tactical planner to re-plan the current milestone
    if (decision === 'revise') {
      return 'tactical_planner';
    }

    // Check if there are more tactical steps or milestones
    if (state.metadata.planHasRemainingTodos) {
      // Go back to tactical planner to get next step or next milestone
      return 'tactical_planner';
    }

    // All done - final review
    return 'strategic_critic';
  });

  graph.addConditionalEdge('strategic_critic', (state: ThreadState) => {
    if (state.metadata.finalCriticDecision === 'revise') {
      // Major revision needed - go back to strategic planner
      return 'strategic_planner';
    }
    return 'end';
  });

  // Set entry and end points
  graph.setEntryPoint('memory_recall');
  graph.setEndPoints('strategic_critic');

  return graph;
}
