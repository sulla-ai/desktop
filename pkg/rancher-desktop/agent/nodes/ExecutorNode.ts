// ExecutorNode - Executes the plan (LLM calls, tool execution)

import type { ThreadState, NodeResult, ToolResult } from '../types';
import { BaseNode } from './BaseNode';
import { getToolRegistry, registerDefaultTools } from '../tools';
import { getPlanService, type PlanTodoRecord, type TodoStatus } from '../services/PlanService';
import { getAwarenessService } from '../services/AwarenessService';

export class ExecutorNode extends BaseNode {
  constructor() {
    super('executor', 'Executor');
  }

  private appendExecutionNote(state: ThreadState, note: string): void {
    const text = String(note || '').trim();
    if (!text) {
      return;
    }

    const existing = Array.isArray((state.metadata as any).executionNotes)
      ? ((state.metadata as any).executionNotes as unknown[]).map(String)
      : [];

    const next = [...existing, text].slice(-12);
    (state.metadata as any).executionNotes = next;
  }

  private appendToolResult(state: ThreadState, action: string, result: ToolResult): void {
    const prior = (state.metadata as any).toolResults;
    const priorObj = (prior && typeof prior === 'object') ? (prior as Record<string, ToolResult>) : {};
    (state.metadata as any).toolResults = { ...priorObj, [action]: result };

    const historyExisting = Array.isArray((state.metadata as any).toolResultsHistory)
      ? ((state.metadata as any).toolResultsHistory as unknown[])
      : [];
    const entry = {
      at: Date.now(),
      toolName: action,
      success: !!result.success,
      error: result.error || null,
      result: result.result,
    };
    (state.metadata as any).toolResultsHistory = [...historyExisting, entry].slice(-12);
  }

  private hasBlockedPrerequisiteForRemainingWork(todos: PlanTodoRecord[]): boolean {
    const blocked = todos
      .filter(t => t.status === 'blocked')
      .sort((a, b) => (a.orderIndex - b.orderIndex) || (a.id - b.id));

    if (blocked.length === 0) {
      return false;
    }

    const earliestBlocked = blocked[0];
    return todos.some(t => (
      (t.status === 'pending' || t.status === 'in_progress')
      && t.orderIndex > earliestBlocked.orderIndex
    ));
  }

  private async emitChat(state: ThreadState, content: string): Promise<void> {
    const text = String(content || '').trim();
    if (!text) {
      return;
    }
    try {
      await this.executeSingleToolAction(state, 'emit_chat_message', { content: text });
      this.appendExecutionNote(state, text);
    } catch {
      // best effort
    }
  }

  async execute(state: ThreadState): Promise<{ state: ThreadState; next: NodeResult }> {
    console.log(`[Agent:Executor] Executing...`);
    const executed = await this.executeNextTodoFromActivePlan(state);
    if (!executed) {
      console.log('[Agent:Executor] No active todo to execute, generating response...');
    }

    console.log(`[Agent:Executor] Generating LLM response...`);
    const response = await this.generateIncrementalResponse(state);

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

  private async executeNextTodoFromActivePlan(state: ThreadState): Promise<boolean> {
    const planId = await this.getActivePlanId(state);
    if (!planId) {
      state.metadata.planHasRemainingTodos = false;
      return false;
    }

    const emit = (state.metadata.__emitAgentEvent as ((event: { type: 'progress' | 'chunk' | 'complete' | 'error'; threadId: string; data: unknown }) => void) | undefined);

    const planService = getPlanService();
    await planService.initialize();

    const loaded = await planService.getPlan(planId);
    if (!loaded) {
      state.metadata.planHasRemainingTodos = false;
      return false;
    }

    if (this.hasBlockedPrerequisiteForRemainingWork(loaded.todos)) {
      await this.emitChat(state, 'A prerequisite todo is blocked and later todos depend on it. Requesting a plan revision.');
      state.metadata.requestPlanRevision = { reason: 'Blocked prerequisite todo prevents remaining work' };
      state.metadata.planHasRemainingTodos = true;
      return false;
    }

    const nextTodo = this.pickNextTodo(loaded.todos);
    if (!nextTodo) {
      const remaining = loaded.todos.some(t => t.status === 'pending' || t.status === 'in_progress' || t.status === 'blocked');
      state.metadata.planHasRemainingTodos = remaining;
      if (!remaining) {
        await planService.addPlanEvent(planId, 'final_review', { reason: 'No remaining todos' });
        await planService.updatePlanStatus(planId, 'completed');

        // Clear the active plan pointer so the next user prompt starts a new plan.
        delete (state.metadata as any).activePlanId;
        delete (state.metadata as any).activeTodo;

        try {
          const awareness = getAwarenessService();
          await awareness.initialize();
          await awareness.update({ active_plan_ids: [] });
        } catch {
          // best effort
        }
      }
      return false;
    }

    state.metadata.activePlanId = planId;
    state.metadata.activeTodo = {
      id: nextTodo.id,
      title: nextTodo.title,
      description: nextTodo.description,
      status: nextTodo.status,
      categoryHints: nextTodo.categoryHints,
    };

    await planService.updateTodoStatus({
      todoId: nextTodo.id,
      status: 'in_progress',
      eventType: 'todo_status',
      eventData: { status: 'in_progress' },
    });

    emit?.({
      type:     'progress',
      threadId: state.threadId,
      data:     { phase: 'todo_status', planId, todoId: nextTodo.id, title: nextTodo.title, status: 'in_progress' },
    });

    await this.emitChat(state, `Working on: ${nextTodo.title}`);

    const decision = await this.planSingleTodoStep(state, nextTodo);
    if (!decision) {
      await this.emitChat(state, 'I could not determine a safe next action for this todo. Requesting a plan revision.');
      await planService.updateTodoStatus({
        todoId: nextTodo.id,
        status: 'blocked',
        eventType: 'todo_status',
        eventData: { status: 'blocked', reason: 'No execution decision produced' },
      });
      state.metadata.todoExecution = { todoId: nextTodo.id, status: 'blocked' };
      state.metadata.requestPlanRevision = { reason: 'Todo blocked: no execution decision produced' };
      return true;
    }

    if (!decision.action || decision.action === 'none') {
      await this.emitChat(state, decision.summary ? `No tool action selected. ${decision.summary}` : 'No tool action selected for this todo.');
    }

    let toolResult: ToolResult | null = null;
    if (decision.action && decision.action !== 'none') {
      toolResult = await this.executeSingleToolAction(state, decision.action, decision.args);
      if (toolResult) {
        this.appendToolResult(state, decision.action, toolResult);
      }

      if (toolResult && !toolResult.success) {
        await this.emitChat(state, `Tool failed (${decision.action}): ${toolResult.error || 'unknown error'}. Requesting plan revision.`);
        await planService.updateTodoStatus({
          todoId: nextTodo.id,
          status: 'blocked',
          eventType: 'todo_status',
          eventData: { status: 'blocked', reason: `Tool failed (${decision.action}): ${toolResult.error || 'unknown error'}` },
        });
        state.metadata.requestPlanRevision = { reason: `Tool failed (${decision.action}): ${toolResult.error || 'unknown error'}` };
      }
    }

    const markDone = decision.markDone || (toolResult ? toolResult.success : false);
    const shouldBlock = !!state.metadata.requestPlanRevision && !markDone;
    const nextStatus: TodoStatus = markDone ? 'done' : (shouldBlock ? 'blocked' : 'in_progress');

    await planService.updateTodoStatus({
      todoId: nextTodo.id,
      status: nextStatus,
      eventType: 'todo_status',
      eventData: { status: nextStatus },
    });

    if (markDone) {
      await this.emitChat(state, decision.summary ? `Todo complete. ${decision.summary}` : 'Todo complete.');
    } else if (decision.summary) {
      await this.emitChat(state, decision.summary);
    }

    try {
      const refreshed = await planService.getPlan(planId);
      const remaining = refreshed
        ? refreshed.todos.some(t => t.status === 'pending' || t.status === 'in_progress' || t.status === 'blocked')
        : true;
      state.metadata.planHasRemainingTodos = remaining;
      if (!remaining) {
        await planService.addPlanEvent(planId, 'final_review', { reason: 'All todos complete' });
        await planService.updatePlanStatus(planId, 'completed');

        // Clear the active plan pointer so the next user prompt starts a new plan.
        delete (state.metadata as any).activePlanId;
        delete (state.metadata as any).activeTodo;

        try {
          const awareness = getAwarenessService();
          await awareness.initialize();
          await awareness.update({ active_plan_ids: [] });
        } catch {
          // best effort
        }
      }
    } catch {
      state.metadata.planHasRemainingTodos = true;
    }

    state.metadata.todoExecution = {
      todoId: nextTodo.id,
      action: decision.action || null,
      markDone,
      status: nextStatus,
      summary: decision.summary || '',
    };

    // If this todo was blocked and it gates later todos, request revision immediately.
    try {
      const refreshedAfterStatus = await planService.getPlan(planId);
      if (refreshedAfterStatus && this.hasBlockedPrerequisiteForRemainingWork(refreshedAfterStatus.todos)) {
        state.metadata.requestPlanRevision = { reason: 'Blocked prerequisite todo prevents remaining work' };
      }
    } catch {
      // best effort
    }

    return true;
  }

  private async getActivePlanId(state: ThreadState): Promise<number | null> {
    const fromMetadata = state.metadata.activePlanId;
    if (fromMetadata !== undefined && fromMetadata !== null && Number.isFinite(Number(fromMetadata))) {
      return Number(fromMetadata);
    }

    const awareness = getAwarenessService();
    await awareness.initialize();
    const ids = awareness.getData().active_plan_ids || [];
    const first = ids[0];
    if (first && Number.isFinite(Number(first))) {
      return Number(first);
    }

    return null;
  }

  private pickNextTodo(todos: PlanTodoRecord[]): PlanTodoRecord | null {
    const order = (a: PlanTodoRecord, b: PlanTodoRecord) => (a.orderIndex - b.orderIndex) || (a.id - b.id);
    const pending = todos.filter(t => t.status === 'pending').sort(order);
    if (pending.length > 0) {
      return pending[0];
    }
    const inProgress = todos.filter(t => t.status === 'in_progress').sort(order);
    if (inProgress.length > 0) {
      return inProgress[0];
    }
    return null;
  }

  private async planSingleTodoStep(
    state: ThreadState,
    todo: PlanTodoRecord,
  ): Promise<{ action: string; args?: Record<string, unknown>; markDone: boolean; summary: string } | null> {
    registerDefaultTools();
    const registry = getToolRegistry();

    const hintedCategories = (todo.categoryHints || []).map(String).filter(Boolean);
    const selectedCategories = hintedCategories.length > 0
      ? hintedCategories
      : this.selectRelevantCategories(`${todo.title}\n${todo.description}`);

    const categoryIndex = registry.getCompactCategoryIndexBlock({ includeToolNames: false });
    const toolsBlock = registry.getCompactPlanningInstructionsBlock({ includeCategories: selectedCategories });

    const toolHistory = Array.isArray((state.metadata as any).toolResultsHistory)
      ? ((state.metadata as any).toolResultsHistory as unknown[])
      : [];
    const executionNotes = Array.isArray((state.metadata as any).executionNotes)
      ? ((state.metadata as any).executionNotes as unknown[]).map(String)
      : [];
    const recentFindingsBlock = (toolHistory.length > 0 || executionNotes.length > 0)
      ? `\n\nRecent findings (carry forward between todos):\n${JSON.stringify({ toolResults: toolHistory, notes: executionNotes }, null, 2)}`
      : '';

    const prompt = `You are executing exactly ONE todo from a larger plan.

Todo:
${JSON.stringify({ id: todo.id, title: todo.title, description: todo.description, categoryHints: todo.categoryHints, status: todo.status })}

Constraints:
- You may execute AT MOST ONE tool action.
- If you cannot make progress without more info, set action="none" and markDone=false.

Communication:
- If you want to explain what you're doing or surface a problem to the user during execution, you may choose action="emit_chat_message" with args={"content":"..."}.
- Only choose emit_chat_message when you have nothing else to do safely or you need to narrate/clarify; it counts as your one tool action.

Use the recent findings to complete this todo.

${recentFindingsBlock}

${categoryIndex}

${toolsBlock}

Return JSON only:
{
  "action": "tool_name" | "none",
  "args": { },
  "markDone": true|false,
  "summary": "short summary of what you did or what is needed next"
}`;

    const response = await this.prompt(prompt);
    if (!response?.content) {
      return null;
    }

    const jsonMatch = response.content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return null;
    }

    let parsed: any;
    try {
      parsed = JSON.parse(jsonMatch[0]);
    } catch {
      return null;
    }

    const action = String(parsed?.action || 'none');
    const args = (parsed?.args && typeof parsed.args === 'object') ? (parsed.args as Record<string, unknown>) : undefined;
    const markDone = !!parsed?.markDone;
    const summary = String(parsed?.summary || '');

    return { action, args, markDone, summary };
  }

  private selectRelevantCategories(text: string): string[] {
    const lower = text.toLowerCase();
    const selected = new Set<string>();

    if (/\b(chroma|chromadb|memorypedia|remember|recall|previously)\b/i.test(text)) {
      selected.add('memory');
    }

    if (/\b(kubernetes|k8s|kubectl|pod|pods|node|nodes|deployment|deployments|service|services|ingress|namespace|namespaces)\b/.test(lower)) {
      selected.add('kubernetes_read');
    }

    if (/\b(logs?|describe|events?|rollout|restart|top)\b/.test(lower)) {
      selected.add('kubernetes_debug');
    }

    if (/\b(apply|manifest|yaml)\b/.test(lower)) {
      selected.add('kubernetes_write');
    }

    if (/\b(exec|shell|bash|sh|kubectl exec)\b/.test(lower)) {
      selected.add('kubernetes_exec');
    }

    if (/\b(lima|limactl)\b/.test(lower)) {
      selected.add('lima');
    }

    if (/\b(host|filesystem|file system|files|folder|directory|path|grep|find files|tail|read file)\b/.test(lower)) {
      selected.add('host_fs');
    }

    if (/\b(run command|command|shell out)\b/.test(lower)) {
      selected.add('host_exec');
    }

    if (/\b(settings?|config|configuration|preferences?)\b/.test(lower)) {
      selected.add('agent_settings');
    }

    if (selected.size === 0) {
      selected.add('memory');
    }

    return Array.from(selected);
  }

  private async executeSingleToolAction(
    state: ThreadState,
    action: string,
    args?: Record<string, unknown>,
  ): Promise<ToolResult> {
    registerDefaultTools();
    const registry = getToolRegistry();

    const emit = (state.metadata.__emitAgentEvent as ((event: { type: 'progress' | 'chunk' | 'complete' | 'error'; threadId: string; data: unknown }) => void) | undefined);

    const tool = registry.get(action);
    if (!tool) {
      return { toolName: action, success: false, error: `Unknown tool action: ${action}` };
    }

    const toolRunId = `${Date.now()}_${action}_${Math.floor(Math.random() * 1_000_000)}`;

    emit?.({
      type:     'progress',
      threadId: state.threadId,
      data:     { phase: 'tool_call', toolRunId, toolName: action, args: args || {} },
    });

    const memorySearchQueries = Array.isArray(state.metadata?.plan && (state.metadata.plan as any)?.fullPlan?.context?.memorySearchQueries)
      ? ((state.metadata.plan as any).fullPlan.context.memorySearchQueries as unknown[]).map(String)
      : [];

    const result = await tool.execute(state, {
      threadId: state.threadId,
      plannedAction: action,
      memorySearchQueries,
      args,
    });

    emit?.({
      type:     'progress',
      threadId: state.threadId,
      data:     { phase: 'tool_result', toolRunId, toolName: action, success: result.success, error: result.error || null, result: result.result },
    });

    return result;
  }

  private async executePlannedTools(
    state: ThreadState,
    plan: {
      requiresTools: boolean;
      steps: string[];
      fullPlan?: { steps?: Array<{ action: string; args?: Record<string, unknown> }>; context?: { memorySearchQueries?: string[] } };
    },
  ): Promise<void> {
    const actions = (plan.fullPlan?.steps?.length)
      ? plan.fullPlan.steps.map(s => s.action)
      : (plan.steps || []);

    registerDefaultTools();
    const registry = getToolRegistry();
    const toolResults: Record<string, ToolResult> = {};
    const memorySearchQueries = plan.fullPlan?.context?.memorySearchQueries || [];

    const stepArgsByAction: Record<string, Record<string, unknown>> = {};
    if (plan.fullPlan?.steps) {
      for (const step of plan.fullPlan.steps) {
        if (step?.action && step?.args && !stepArgsByAction[step.action]) {
          stepArgsByAction[step.action] = step.args;
        }
      }
    }

    for (const action of actions) {
      if (action === 'generate_response') {
        continue;
      }

      const tool = registry.get(action);
      if (!tool) {
        console.warn(`[Agent:Executor] Unknown tool action: ${action}`);
        continue;
      }

      const result = await tool.execute(state, {
        threadId: state.threadId,
        plannedAction: action,
        memorySearchQueries,
        args: stepArgsByAction[action],
      });

      toolResults[action] = result;
    }

    if (Object.keys(toolResults).length > 0) {
      state.metadata.toolResults = toolResults;
    }
  }

  private async generateIncrementalResponse(state: ThreadState) {
    // Get the current user message
    const lastUserMessage = state.messages.filter(m => m.role === 'user').pop();

    if (!lastUserMessage) {
      return null;
    }

    const todoExecution = state.metadata.todoExecution as any;
    const activeTodo = state.metadata.activeTodo as any;

    let instruction = 'Respond to the user\'s latest message based on the conversation above.';

    if (activeTodo) {
      instruction = `You are executing a multi-step plan. Provide an incremental update for the current todo only.

Current todo:
${JSON.stringify(activeTodo)}

Execution result:
${JSON.stringify(todoExecution || {})}

Now write the next user-facing update. Keep it concise and specific about what was done and what remains.

Output requirements:
- Output plain text only.
- Do NOT output JSON.
- Do NOT wrap the response in an object.
- Do NOT include code fences.`;
    }

    if (state.metadata.memoryContext) {
      instruction = `${instruction}\n\nYou have access to internal long-term memory from ChromaDB/MemoryPedia provided above as "Relevant context from memory". Use it when answering. Do not claim you have no memory or no access to prior information if that context is present.`;
    }

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
