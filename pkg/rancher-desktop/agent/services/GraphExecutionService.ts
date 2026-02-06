import type { SensoryInput, AgentResponse, ThreadState } from '../types';
import { createHierarchicalGraph } from '../nodes/Graph';
import { emitAgentEvent } from './AgentEventBus';
import { AbortService } from './AbortService';

let threadCounter = 0;
let messageCounter = 0;

function nextThreadId(): string {
  return `thread_${Date.now()}_${++threadCounter}`;
}

function nextMessageId(): string {
  return `msg_${Date.now()}_${++messageCounter}`;
}

function buildInitialState(input: SensoryInput, threadId?: string): ThreadState {
  const now = Date.now();
  const id = threadId ?? nextThreadId();

  return {
    threadId:       id,
    messages:       [{
      id:        nextMessageId(),
      role:      'user',
      content:   input.data,
      timestamp: now,
      metadata:  { ...input.metadata },
    }],
    shortTermMemory: [],
    metadata:        {},
    createdAt:       now,
    updatedAt:       now,
  };
}

export async function runHierarchicalGraph(params: {
  input: SensoryInput;
  threadId?: string;
  wsConnectionId: string;
  onAgentResponse?: (resp: AgentResponse) => void;
  abort?: AbortService;
}): Promise<AgentResponse | null> {
  const state = buildInitialState(params.input, params.threadId);
  state.metadata.wsConnectionId = params.wsConnectionId;

  state.metadata.__emitAgentEvent = (event: { type: 'progress' | 'complete' | 'error' | 'chunk'; data: any }) => {
    emitAgentEvent({
      type: event.type,
      threadId: state.threadId,
      data: event.data,
      timestamp: Date.now(),
    });
  };

  emitAgentEvent({ type: 'progress', threadId: state.threadId, data: { phase: 'start' }, timestamp: Date.now() });

  const graph = createHierarchicalGraph();

  try {
    if (params.abort) {
      (state.metadata as any).__abort = params.abort;
    }
    await graph.execute(state, undefined, { abort: params.abort });
  } catch (err) {
    emitAgentEvent({ type: 'error', threadId: state.threadId, data: { message: String(err) }, timestamp: Date.now() });
    return null;
  } finally {
    delete (state.metadata as any).__emitAgentEvent;
    delete (state.metadata as any).__abort;
  }

  const responseContent = typeof state.metadata.response === 'string' ? state.metadata.response.trim() : '';

  const response: AgentResponse = {
    id:        `resp_${Date.now()}`,
    threadId:  state.threadId,
    type:      'text',
    content:   responseContent,
    refined:   !!state.metadata.criticDecision,
    metadata:  { ...state.metadata },
    timestamp: Date.now(),
  };

  emitAgentEvent({ type: 'complete', threadId: state.threadId, data: response, timestamp: Date.now() });

  params.onAgentResponse?.(response);

  return response;
}
