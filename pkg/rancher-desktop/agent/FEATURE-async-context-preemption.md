# Feature Spec: Async Context Detection + Preemption + Multi-Thread UI

## Goal
Enable the user to send a new message while a LangGraph run is in progress and have the system decide (asynchronously) whether to:
- Continue the current thread (queue)
- Start a new/secondary thread (spawn)
- Interrupt the current run and handle the new message next (interrupt)
- Terminate the current run immediately (kill)

Additionally, update the Agent UI to display messages/events from multiple threads (not constrained to a single `threadId`).

## Current Behavior (as of now)
- A single `ConversationThread.process()` call runs a `Graph.execute()` loop synchronously.
- The UI typically serializes user inputs; concurrent messages are queued in the UI.
- `ContextDetector.detect()` returns a `ThreadContext` (threadId/isNew/summary/confidence) and is used to pick a single thread.
- There is no standard cancellation token propagated into node execution or LLM calls.

## Proposed Architecture

### A) Introduce a Control Plane Result Type
Replace “ContextDetector returns only a threadId” with an explicit decision object:

```ts
export type ContextAction = 'queue' | 'spawn' | 'interrupt' | 'kill';

export interface ContextDecision {
  action: ContextAction;

  // Thread routing
  targetThreadId: string;           // The thread that should receive the message
  newThread?: boolean;             // Whether the targetThreadId is new

  // Optional handling details
  reason?: string;                 // Debug-only explanation
  searchTerms?: string[];          // For old-topic match; used with MemoryPedia

  // Interrupt semantics
  interruptMode?: 'boundary' | 'immediate';
}
```

### B) Run Context Detection Async to the Current Graph Run
When a new user message arrives:
1. Immediately enqueue an “input event” into a thread runtime inbox.
2. In parallel, run `ContextDetector.decide(...)` asynchronously.
3. The decision is applied to the runtime:
   - `queue`: store message for current thread; process after run completes
   - `spawn`: route message to another/new thread and start processing concurrently
   - `interrupt`: request interruption of current run; schedule TacticalPlanner next
   - `kill`: terminate current run (boundary or immediate)

### C) Interrupt & “Send message from TacticalPlanner” Requirement
When `action === 'interrupt'`:
- The system should cause the next LLM request to happen from `TacticalPlannerNode`.
- The interrupting user message becomes the “primary” input to TacticalPlanner.

Implementation idea:
- Add `state.metadata.pendingUserInterrupt` or similar field that TacticalPlanner reads.
- Force `Graph.execute()` next node to be TacticalPlanner (or restart a short run with TacticalPlanner entrypoint).

### D) Kill Semantics
Two supported kill modes:

1) Boundary kill (safer, smaller change)
- Set `state.metadata.cancelRequested = true`
- `Graph.execute()` checks between nodes and stops.

2) Immediate kill (more invasive)
- Thread runtime owns an `AbortController` for the active run.
- `BaseNode.prompt()` and `ILLMService.chat()` accept an `AbortSignal`.
- `OllamaService` / `RemoteModelService` fetch calls use the `signal`.
- On kill, call `abortController.abort()`.

### E) ConversationThread Runtime Inbox
Add a per-thread runtime object:

- `running: boolean`
- `pendingInputs: SensoryInput[]`
- `interruptRequested?: { input: SensoryInput; mode: 'boundary' | 'immediate' }`
- `killRequested?: { mode: 'boundary' | 'immediate' }`

Processing policy:
- If `running === true` and new input arrives, run ContextDetector async and apply decision.
- If `running === false`, process immediately.

### F) UI: Multi-Thread Message Display
The UI should not be constrained to one `threadId`. Options:

- Combined feed
  - Show events/messages from all threads in a single transcript
  - Add a visible `threadId` label per message

- Thread list + filter
  - Sidebar lists active threadIds
  - Transcript filters by selected thread

- Combined + filter (recommended)

Current code already uses `onGlobalEvent(...)` which can receive events from all threads; the UI needs to display them rather than assuming a single active thread.

## ContextDetector Decision Inputs
The decision model should consider:
- The new user message
- The current thread id (if any)
- Recent messages from the current thread
- Optional: active plan pinning rules
- Optional: MemoryPedia summary searches when “old topic” is indicated

The LLM prompt should produce JSON:

```json
{
  "action": "queue" | "spawn" | "interrupt" | "kill",
  "oldtopic": true/false,
  "newtopic": true/false,
  "searchTerms": ["..."]
}
```

Mapping rules:
- `newtopic=true` => typically `spawn` (new thread)
- `oldtopic=true` => `spawn` (existing thread via MemoryPedia search)
- user explicitly says stop/cancel => `kill`
- user asks to change direction mid-run => `interrupt`
- otherwise => `queue`

## Safety / Consistency Considerations
- Ensure partial state updates from an interrupted node don’t corrupt the thread.
- Prefer boundary-interrupt first; immediate-abort only if required.
- Ensure the interrupting user message is not dropped.
- Ensure event streaming remains coherent (tag events with threadId).

## Milestones
1. Define `ContextDecision` and `ContextAction` and update `ContextDetector` to produce decisions.
2. Add a thread runtime inbox + scheduling layer.
3. Implement boundary interrupt and TacticalPlanner-first routing.
4. Implement UI multi-thread transcript.
5. (Optional) Add immediate abort via AbortSignal across LLM services.

## Open Questions
- Should interrupt kill the current run entirely or resume later?
- For multi-thread UI, should messages from background threads (scheduler/heartbeat) show by default?
- How should active-plan pinning interact with “fresh window” behavior?
