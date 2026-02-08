import type { SensoryInput, AgentResponse, ThreadState } from '../types';
import { BaseThreadState, HierarchicalThreadState, createHierarchicalGraph } from '../nodes/Graph';
import { AbortService } from './AbortService';
import { getCurrentModel, getCurrentMode } from '../languagemodels';
import { saveThreadState, loadThreadState } from '../nodes/ThreadStateStore';

let threadCounter = 0;
let messageCounter = 0;

function nextThreadId(): string {
  return `thread_${Date.now()}_${++threadCounter}`;
}

function nextMessageId(): string {
  return `msg_${Date.now()}_${++messageCounter}`;
}

function buildInitialState(input: SensoryInput, wsChannel: string, threadId?: string): HierarchicalThreadState {
  const now = Date.now();
  const id = threadId ?? nextThreadId();

  return {
    messages: [{
      id:        nextMessageId(),
      role:      'user',
      content:   input.data,
      timestamp: now,
      metadata:  { ...input.metadata },
    } as any],
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
      // Hierarchical-specific fields
      plan: {
        model:  undefined,
        milestones: [],
        activeMilestoneIndex: 0,
        allMilestonesComplete: true
      },
      currentSteps: [],
      activeStepIndex: 0
    }
  };
}

export async function runHierarchicalGraph(params: {
  input: SensoryInput;
  threadId?: string;
  wsChannel: string;
  onAgentResponse?: (resp: AgentResponse) => void;
  abort?: AbortService;
}): Promise<AgentResponse | null> {
  let state: HierarchicalThreadState;

  // Resume existing thread if threadId provided and state exists
  if (params.threadId) {
    const saved = await loadThreadState(params.threadId);
    if (saved) {
      // For new user messages, reset to start node instead of resuming from last node
      // This ensures each new message starts the graph from the beginning
      state = saved;
    } else {
      state = buildInitialState(params.input, params.wsChannel, params.threadId);
    }
  } else {
    state = buildInitialState(params.input, params.wsChannel);
  }

  state.metadata.wsChannel = params.wsChannel;

  // Append new user message (always add to messages array)
  const newUserMsg = {
    id: nextMessageId(),
    role: 'user',
    content: params.input.data,
    timestamp: Date.now(),
    metadata: { ...params.input.metadata },
  };
  state.messages.push(newUserMsg as any);

  // Reset iteration counters only on new thread
  if (!params.threadId || !await loadThreadState(params.threadId)) {
    state.metadata.iterations = 0;
    state.metadata.consecutiveSameNode = 0;
  }

  const graph = createHierarchicalGraph();

  try {
    if (params.abort) {
      (state.metadata as any).__abort = params.abort;
    }
    await graph.execute(state);
  } catch (err) {
    return null;
  } finally {
    delete (state.metadata as any).__abort;
    saveThreadState(state); // persist after every run
  }

  const responseContent = typeof (state.metadata as any).response === 'string' ? (state.metadata as any).response.trim() : '';

  const response: AgentResponse = {
    id: `resp_${Date.now()}`,
    threadId: state.metadata.threadId,
    type: 'text',
    content: responseContent,
    refined: !!(state.metadata as any).criticDecision,
    metadata: { ...state.metadata },
    timestamp: Date.now(),
  };

  params.onAgentResponse?.(response);

  return response;
}
