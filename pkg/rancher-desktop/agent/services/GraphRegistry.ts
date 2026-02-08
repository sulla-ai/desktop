import { Graph, HierarchicalThreadState, createHierarchicalGraph } from '../nodes/Graph';
import type { SensoryInput } from '../types';
import { getCurrentModel, getCurrentMode } from '../languagemodels';

const registry = new Map<string, {
  graph: Graph<HierarchicalThreadState>;
  state: HierarchicalThreadState;
}>();

export const GraphRegistry = {
  /**
   * Get existing graph for thread, or create new if not found.
   * Use this when resuming a known threadId.
   */
  get(threadId: string): {
    graph: Graph<HierarchicalThreadState>;
    state: HierarchicalThreadState;
  } | null {
    return registry.get(threadId) ?? null;
  },

  /**
   * Create a brand new graph + state (always fresh threadId).
   * Use when user explicitly wants "New Conversation".
   */
  createNew(wsChannel: string): {
    graph: Graph<HierarchicalThreadState>;
    state: HierarchicalThreadState;
    threadId: string;
  } {
    const threadId = nextThreadId();
    const graph = createHierarchicalGraph();

    const state = buildInitialState(wsChannel, threadId);

    registry.set(threadId, { graph, state });
    return { graph, state, threadId };
  },

  /**
   * Get or create — resumes if threadId exists, creates new if not.
   * Use in normal message flow.
   */
  getOrCreate(wsChannel: string, threadId: string): {
    graph: Graph<HierarchicalThreadState>;
    state: HierarchicalThreadState;
  } {
    if (registry.has(threadId)) {
      return registry.get(threadId)!;
    }

    // No existing → create new under this threadId
    const graph = createHierarchicalGraph();

    const state = buildInitialState(wsChannel, threadId);

    registry.set(threadId, { graph, state });
    return { graph, state };
  },

  delete(threadId: string): void {
    registry.delete(threadId);
  },

  clearAll(): void {
    registry.clear();
  }
};

let threadCounter = 0;
let messageCounter = 0;

export function nextThreadId(): string {
  return `thread_${Date.now()}_${++threadCounter}`;
}

export function nextMessageId(): string {
  return `msg_${Date.now()}_${++messageCounter}`;
}

function buildInitialState(wsChannel: string, threadId?: string): HierarchicalThreadState {
  const id = threadId ?? nextThreadId();

  return {
    messages: [],
    metadata: {
      threadId: id,
      wsChannel: wsChannel,
      
      cycleComplete: false,
      waitingForUser: false,

      llmModel: getCurrentModel(),
      llmLocal: getCurrentMode() === 'local',
      options: { abort: undefined },
      currentNodeId: 'memory_recall',
      consecutiveSameNode: 0,
      iterations: 0,
      revisionCount: 0,
      maxIterationsReached: false,
      memory: {
        knowledgeBaseContext: '',
        chatSummariesContext: ''
      },
      subGraph: {
        state: 'completed',
        name: 'hierarchical',
        prompt: '',
        response: ''
      },
      finalSummary: '',
      finalState: 'running',
      returnTo: null,
      plan: {
        model: undefined,
        milestones: [],
        activeMilestoneIndex: 0,
        allMilestonesComplete: true
      },
      currentSteps: [],
      activeStepIndex: 0
    }
  };
}