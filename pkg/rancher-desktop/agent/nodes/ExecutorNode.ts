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
    
    // Clear previous iteration's revision request - each execution starts fresh
    delete state.metadata.requestPlanRevision;
    
    // Track consecutive LLM failures to prevent infinite loops
    const llmFailureCount = ((state.metadata.llmFailureCount as number) || 0);
    
    // Check for tactical step first (hierarchical planning), then fall back to DB todos (legacy)
    let executed = false;
    if (state.metadata.activeTacticalStep) {
      executed = await this.executeTacticalStep(state);
    } else {
      executed = await this.executeNextTodoFromActivePlan(state);
    }
    
    if (!executed) {
      console.log('[Agent:Executor] No active task to execute, generating response...');
    }

    console.log(`[Agent:Executor] Generating LLM response...`);
    const response = await this.generateIncrementalResponse(state);

    if (response) {
      console.log(`[Agent:Executor] Response generated (${response.content.length} chars)`);
      state.metadata.response = response.content;
      state.metadata.ollamaModel = response.model;
      state.metadata.ollamaEvalCount = response.evalCount;
      state.metadata.executorCompleted = true;
      state.metadata.llmFailureCount = 0; // Reset on success
    } else {
      console.error(`[Agent:Executor] Failed to generate response`);
      state.metadata.error = 'Failed to generate response';
      state.metadata.llmFailureCount = llmFailureCount + 1;
      
      // If LLM has failed multiple times, break the loop
      if (llmFailureCount + 1 >= 3) {
        console.error(`[Agent:Executor] LLM failed ${llmFailureCount + 1} times, breaking loop`);
        state.metadata.response = 'I apologize, but I\'m having trouble connecting to the language model service. Please check that the model is running and try again.';
        state.metadata.executorCompleted = true;
        return { state, next: 'end' };
      }
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
      // Get details about the blocked todo(s) for better revision context
      const blockedTodos = loaded.todos.filter(t => t.status === 'blocked');
      const blockedDetails = blockedTodos.map(t => ({
        id: t.id,
        title: t.title,
        description: t.description,
      }));
      
      // Track blocked revision attempts to prevent infinite loops
      const blockedRevisionCount = ((state.metadata.blockedRevisionCount as number) || 0) + 1;
      state.metadata.blockedRevisionCount = blockedRevisionCount;
      
      if (blockedRevisionCount > 3) {
        // Too many failed attempts - abort gracefully
        await this.emitChat(state, `I've tried ${blockedRevisionCount - 1} times to work around blocked tasks but haven't been able to make progress. The blocked tasks are: ${blockedTodos.map(t => t.title).join(', ')}. I'll need to stop here and report what happened.`);
        
        // Mark plan as abandoned and clear it
        try {
          await planService.updatePlanStatus(planId, 'abandoned');
          delete (state.metadata as any).activePlanId;
          delete (state.metadata as any).activeTodo;
          const awareness = getAwarenessService();
          await awareness.initialize();
          await awareness.update({ active_plan_ids: [] });
        } catch {
          // best effort
        }
        
        state.metadata.planHasRemainingTodos = false;
        state.metadata.error = `Plan failed after ${blockedRevisionCount - 1} revision attempts. Blocked todos: ${blockedTodos.map(t => t.title).join(', ')}`;
        return false;
      }
      
      const detailedReason = `Blocked prerequisite todo prevents remaining work.

BLOCKED TODOS (need alternative approach or removal):
${JSON.stringify(blockedDetails, null, 2)}

IMPORTANT: You must either:
1. Replace the blocked todo(s) with a different approach that can succeed
2. Remove the blocked todo(s) if they are not essential
3. Add new prerequisite todos that can unblock the situation

Do NOT simply recreate the same todos - that will cause an infinite loop.
Revision attempt: ${blockedRevisionCount}/3`;

      await this.emitChat(state, `A prerequisite todo is blocked (attempt ${blockedRevisionCount}/3). Requesting a plan revision with a different approach.`);
      state.metadata.requestPlanRevision = { reason: detailedReason };
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

    const decision = await this.planTodoStep(state, nextTodo);
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

    if (decision.actions.length === 0) {
      // No actions selected - this todo cannot be completed without actions
      // Request plan revision instead of marking as done
      await this.emitChat(state, decision.summary 
        ? `No tool actions available for this todo. ${decision.summary}` 
        : 'No tool actions available for this todo. Requesting plan revision.');
      
      await planService.updateTodoStatus({
        todoId: nextTodo.id,
        status: 'blocked',
        eventType: 'todo_status',
        eventData: { status: 'blocked', reason: 'No tool actions available' },
      });
      
      state.metadata.todoExecution = { todoId: nextTodo.id, status: 'blocked', summary: decision.summary || 'No actions available' };
      state.metadata.requestPlanRevision = { reason: `Todo "${nextTodo.title}" has no available tool actions. The todo may need to be broken down differently or removed.` };
      return true;
    }

    // Execute all tool actions
    let anyToolFailed = false;
    let lastFailedAction = '';
    let lastFailedError = '';
    
    for (const actionItem of decision.actions) {
      const toolResult = await this.executeSingleToolAction(state, actionItem.action, actionItem.args);
      if (toolResult) {
        this.appendToolResult(state, actionItem.action, toolResult);
      }

      if (toolResult && !toolResult.success) {
        anyToolFailed = true;
        lastFailedAction = actionItem.action;
        lastFailedError = toolResult.error || 'unknown error';
        // Continue executing other actions even if one fails
      }
    }
    
    if (anyToolFailed) {
      await this.emitChat(state, `Tool failed (${lastFailedAction}): ${lastFailedError}. Requesting plan revision.`);
      await planService.updateTodoStatus({
        todoId: nextTodo.id,
        status: 'blocked',
        eventType: 'todo_status',
        eventData: { status: 'blocked', reason: `Tool failed (${lastFailedAction}): ${lastFailedError}` },
      });
      state.metadata.requestPlanRevision = { reason: `Tool failed (${lastFailedAction}): ${lastFailedError}` };
    }

    const allActionsSucceeded = decision.actions.length > 0 && !anyToolFailed;
    const markDone = decision.markDone || allActionsSucceeded;
    const shouldBlock = !!state.metadata.requestPlanRevision && !markDone;
    // Executor keeps todo in_progress - Critic will mark it done after review
    const nextStatus: TodoStatus = shouldBlock ? 'blocked' : 'in_progress';

    // Only update status if blocked, otherwise leave in_progress for Critic to review
    if (shouldBlock) {
      await planService.updateTodoStatus({
        todoId: nextTodo.id,
        status: nextStatus,
        eventType: 'todo_status',
        eventData: { status: nextStatus },
      });
    }

    if (markDone) {
      await this.emitChat(state, decision.summary ? `Completed: ${decision.summary}` : 'Task executed, awaiting review.');
    } else if (decision.summary) {
      await this.emitChat(state, decision.summary);
    }

    // Don't check for plan completion here - let Critic handle it after marking todo done
    state.metadata.planHasRemainingTodos = true;

    state.metadata.todoExecution = {
      todoId: nextTodo.id,
      actions: decision.actions.map(a => a.action),
      actionsCount: decision.actions.length,
      markDone,
      status: markDone ? 'done' : nextStatus,
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

  /**
   * Execute a tactical step from hierarchical planning (state-only, not DB)
   */
  private async executeTacticalStep(state: ThreadState): Promise<boolean> {
    const tacticalStep = state.metadata.activeTacticalStep;
    if (!tacticalStep) {
      return false;
    }

    const emit = state.metadata.__emitAgentEvent as ((event: { type: 'progress' | 'chunk' | 'complete' | 'error'; threadId: string; data: unknown }) => void) | undefined;
    const milestone = state.metadata.activeMilestone;

    console.log(`[Agent:Executor] Executing tactical step: ${tacticalStep.action}`);
    if (milestone) {
      console.log(`[Agent:Executor] For milestone: ${milestone.title}`);
    }

    emit?.({
      type: 'progress',
      threadId: state.threadId,
      data: { phase: 'tactical_step_start', step: tacticalStep.action, milestone: milestone?.title },
    });

    await this.emitChat(state, `Working on: ${tacticalStep.action}`);

    // Use LLM to decide what tools to call for this step
    const decision = await this.planTacticalStepExecution(state, tacticalStep);

    if (!decision) {
      await this.emitChat(state, 'Could not determine actions for this step. Requesting revision.');
      state.metadata.todoExecution = { 
        todoId: 0, 
        status: 'failed', 
        summary: 'No execution decision produced' 
      };
      state.metadata.requestPlanRevision = { reason: 'Tactical step failed: no execution decision' };
      
      // Mark step as failed in tactical plan
      if (state.metadata.tacticalPlan) {
        const step = state.metadata.tacticalPlan.steps.find(s => s.id === tacticalStep.id);
        if (step) {
          step.status = 'failed';
        }
      }
      
      return true;
    }

    if (decision.actions.length === 0) {
      await this.emitChat(state, decision.summary || 'No tool actions needed for this step.');
      
      // Mark step as done even without tool calls
      state.metadata.todoExecution = {
        todoId: 0,
        status: 'done',
        summary: decision.summary || 'Step completed without tool actions',
        actions: [],
        actionsCount: 0,
        markDone: true,
      };
      
      // Mark step as done in tactical plan
      if (state.metadata.tacticalPlan) {
        const step = state.metadata.tacticalPlan.steps.find(s => s.id === tacticalStep.id);
        if (step) {
          step.status = 'done';
        }
      }
      
      state.metadata.planHasRemainingTodos = this.hasRemainingTacticalWork(state);
      return true;
    }

    // Execute tool actions
    let anyToolFailed = false;
    let lastFailedAction = '';
    let lastFailedError = '';

    for (const actionItem of decision.actions) {
      const actionName = actionItem.action;
      const actionArgs = actionItem.args || {};

      console.log(`[Agent:Executor] Executing tool: ${actionName}`);
      emit?.({
        type: 'progress',
        threadId: state.threadId,
        data: { phase: 'tool_call', tool: actionName, args: actionArgs },
      });

      const result = await this.executeSingleToolAction(state, actionName, actionArgs);

      if (result && result.success === false) {
        anyToolFailed = true;
        lastFailedAction = actionName;
        lastFailedError = result.error || 'Unknown error';
        console.warn(`[Agent:Executor] Tool ${actionName} failed: ${lastFailedError}`);
      }
    }

    const allActionsSucceeded = decision.actions.length > 0 && !anyToolFailed;
    const markDone = decision.markDone || allActionsSucceeded;

    state.metadata.todoExecution = {
      todoId: 0,
      actions: decision.actions.map(a => a.action),
      actionsCount: decision.actions.length,
      markDone,
      status: markDone ? 'done' : (anyToolFailed ? 'failed' : 'in_progress'),
      summary: decision.summary || '',
    };

    // Update step status in tactical plan
    if (state.metadata.tacticalPlan) {
      const step = state.metadata.tacticalPlan.steps.find(s => s.id === tacticalStep.id);
      if (step) {
        step.status = markDone ? 'done' : (anyToolFailed ? 'failed' : 'in_progress');
      }
    }

    if (anyToolFailed) {
      await this.emitChat(state, `Tool failed (${lastFailedAction}): ${lastFailedError}`);
      state.metadata.requestPlanRevision = { reason: `Tool failed: ${lastFailedAction} - ${lastFailedError}` };
    } else if (markDone) {
      await this.emitChat(state, decision.summary ? `Completed: ${decision.summary}` : 'Step completed.');
    }

    state.metadata.planHasRemainingTodos = this.hasRemainingTacticalWork(state);

    return true;
  }

  /**
   * Check if there's remaining tactical work (steps or milestones)
   */
  private hasRemainingTacticalWork(state: ThreadState): boolean {
    // Check tactical plan for remaining steps
    const tacticalPlan = state.metadata.tacticalPlan;
    if (tacticalPlan) {
      const pendingSteps = tacticalPlan.steps.filter(s => s.status === 'pending' || s.status === 'in_progress');
      if (pendingSteps.length > 0) {
        return true;
      }
    }

    // Check strategic plan for remaining milestones
    const strategicPlan = state.metadata.strategicPlan;
    if (strategicPlan?.milestones) {
      const pendingMilestones = strategicPlan.milestones.filter(m => m.status === 'pending' || m.status === 'in_progress');
      if (pendingMilestones.length > 0) {
        return true;
      }
    }

    return false;
  }

  /**
   * Plan execution for a tactical step using LLM
   */
  private async planTacticalStepExecution(
    state: ThreadState,
    step: { id: string; action: string; description: string; toolHints?: string[] },
  ): Promise<{ actions: Array<{ action: string; args?: Record<string, unknown> }>; markDone: boolean; summary: string } | null> {
    registerDefaultTools();
    const registry = getToolRegistry();

    // Get tools, prioritizing hints if available
    const hintedCategories = (step.toolHints || []).map(String).filter(Boolean);
    const selectedCategories = hintedCategories.length > 0
      ? hintedCategories
      : this.selectRelevantCategories(`${step.action}\n${step.description}`);

    const categoryIndex = registry.getCompactCategoryIndexBlock({ includeToolNames: false });
    const toolsBlock = registry.getCompactPlanningInstructionsBlock({ includeCategories: selectedCategories });

    const milestone = state.metadata.activeMilestone;
    const strategicPlan = state.metadata.strategicPlan;

    const prompt = `You are the executor: a 25-year senior DevOps & security engineer running on the Primary User's primary machine.

Your sole job: complete this exact step without deviation, delay, or chit-chat. Be ruthless about success, paranoid about safety.

## Core Directives (non-negotiable)
- PROTECT THE PRIMARY MACHINE AT ALL COSTS
- NO PII ever leaves this system
- Use ephemeral /tmp dirs only — clean up immediately after
- Every shell command must be dry-run checked first when possible
- If risk > low → abort and report exact reason
- If unsure → stop and return error instead of guessing

## Context
Overall Goal: ${strategicPlan?.goal || 'Complete the user request'}
Milestone: ${milestone ? `${milestone.title}: ${milestone.description}` : 'No specific milestone'}
Step: ${step.action} — ${step.description}

## Available Tools
${toolsBlock || 'No tools available'}

## Execution Rules
1. Think once — very briefly: "What is the minimal, safest path to done?"
2. List ONLY the tool calls needed — in exact execution order
3. Use shell for anything local (git, docker, file ops, custom scripts)
4. If gap exists → write + chmod + exec a tiny shell/python helper in /tmp, then clean it
5. Retry logic: max 3 attempts with exponential backoff, then fail fast
6. Validate every output against step success before proceeding
7. Final output: only tool calls or { "done": true, "result": "short summary" }

## Output JSON
{
  "actions": [
    { "action": "tool_name", "args": { "arg1": "value1" } }
  ],
  "markDone": true,
  "summary": "Brief description of what was done"
}

Respond with JSON only.`;

    try {
      const response = await this.prompt(prompt, state);
      if (!response?.content) {
        return null;
      }

      const jsonMatch = response.content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        return null;
      }

      const parsed = JSON.parse(jsonMatch[0]);
      return {
        actions: Array.isArray(parsed.actions) ? parsed.actions : [],
        markDone: parsed.markDone !== false,
        summary: parsed.summary || '',
      };
    } catch (err) {
      console.error('[Agent:Executor] Failed to plan tactical step:', err);
      return null;
    }
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

  private async planTodoStep(
    state: ThreadState,
    todo: PlanTodoRecord,
  ): Promise<{ actions: Array<{ action: string; args?: Record<string, unknown> }>; markDone: boolean; summary: string } | null> {
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

    // Get current date/time info for the LLM
    const now = new Date();
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const currentDateTime = now.toLocaleString('en-US', {
      timeZone: timezone,
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
    const isoDate = now.toISOString();

    // Build conversation history for context continuity
    // Filter out system messages to avoid confusing the LLM with prior prompt context
    const userAssistantMessages = state.messages.filter(m => m.role === 'user' || m.role === 'assistant');
    const recentMessages = userAssistantMessages.slice(-10);
    const conversationHistory = recentMessages.length > 0
      ? `\n\nConversation history:\n${recentMessages.map(m => `${m.role}: ${m.content}`).join('\n\n')}`
      : '';

    const prompt = `You are executing a todo from a larger plan.

Current date/time: ${currentDateTime}
Timezone: ${timezone}
ISO timestamp: ${isoDate}
${conversationHistory}

Todo:
${JSON.stringify({ id: todo.id, title: todo.title, description: todo.description, categoryHints: todo.categoryHints, status: todo.status })}

Constraints:
- You may execute MULTIPLE tool actions in a single response.
- If you cannot make progress without more info, return an empty actions array and markDone=false.
- Set markDone=true ONLY when the ENTIRE todo is complete.

**For batch tasks (e.g., "delete all events", "process all items"):**
- Include ALL necessary tool calls in the actions array.
- Check the recent findings to see what has already been done.

Communication:
- Include emit_chat_message in actions if you want to explain what you're doing.

Use the recent findings to complete this todo.

${recentFindingsBlock}

${categoryIndex}

${toolsBlock}

Return JSON only:
{
  "actions": [
    { "action": "tool_name", "args": { } },
    { "action": "another_tool", "args": { } }
  ],
  "markDone": true|false,
  "summary": "short summary of what you did or what is needed next"
}`;

    const response = await this.prompt(prompt, state);
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

    // Parse actions array - support both new format (actions array) and legacy format (single action)
    let actions: Array<{ action: string; args?: Record<string, unknown> }> = [];
    
    if (Array.isArray(parsed?.actions)) {
      actions = parsed.actions
        .filter((a: any) => a && typeof a.action === 'string' && a.action !== 'none')
        .map((a: any) => ({
          action: String(a.action),
          args: (a.args && typeof a.args === 'object') ? (a.args as Record<string, unknown>) : undefined,
        }));
    } else if (parsed?.action && parsed.action !== 'none') {
      // Legacy single action format
      actions = [{
        action: String(parsed.action),
        args: (parsed.args && typeof parsed.args === 'object') ? (parsed.args as Record<string, unknown>) : undefined,
      }];
    }
    
    const markDone = !!parsed?.markDone;
    const summary = String(parsed?.summary || '');

    return { actions, markDone, summary };
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

    console.log(`[Agent:Executor] Final response prompt (plain text):\n${fullPrompt}`);

    return this.prompt(fullPrompt, state);
  }
}
