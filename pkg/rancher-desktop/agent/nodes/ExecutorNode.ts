// ExecutorNode - Executes the plan (LLM calls, tool execution)

import type { ThreadState, NodeResult, ToolResult } from '../types';
import { BaseNode, JSON_ONLY_RESPONSE_INSTRUCTIONS } from './BaseNode';
import { getToolRegistry, registerDefaultTools } from '../tools';
import { getAwarenessService } from '../services/AwarenessService';
import { getSkillService } from '../services/SkillService';

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
    
    // Only execute hierarchical tactical steps.
    let executed = false;
    if (state.metadata.activeTacticalStep) {
      executed = await this.executeTacticalStep(state);
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
          emit?.({
            type: 'progress',
            threadId: state.threadId,
            data: { phase: 'tactical_step_status', stepId: step.id, action: step.action, status: 'done' },
          });
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
        const newStatus = markDone ? 'done' : (anyToolFailed ? 'failed' : 'in_progress');
        step.status = newStatus;
        emit?.({
          type: 'progress',
          threadId: state.threadId,
          data: { phase: 'tactical_step_status', stepId: step.id, action: step.action, status: newStatus },
        });
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
    const basePrompt = `Based on the conversation above, execute this tactical step: ${step.action} — ${step.description}

You are the executor: a 25-year senior DevOps & security engineer running on the Primary User's primary machine.

Your sole job: complete this exact step without deviation, delay, or chit-chat. Be ruthless about success, paranoid about safety.

## Core Directives (non-negotiable)
- PROTECT THE PRIMARY MACHINE AT ALL COSTS
- NO PII ever leaves this system
- Use ephemeral /tmp dirs only — clean up immediately after
- Every shell command must be dry-run checked first when possible
- If risk > low → abort and report exact reason
- If unsure → stop and return error instead of guessing

## Execution Rules
1. Think once — very briefly: "What is the minimal, safest path to done?"
2. List ONLY the tool calls needed — in exact execution order
3. Use shell for anything local (git, docker, file ops, custom scripts)
4. If gap exists → write + chmod + exec a tiny shell/python helper in /tmp, then clean it
5. Retry logic: max 3 attempts with exponential backoff, then fail fast
6. Validate every output against step success before proceeding
7. Final output: only tool calls or { "done": true, "result": "short summary" }


${JSON_ONLY_RESPONSE_INSTRUCTIONS}
{
  "actions": [
    { "action": "tool_name", "args": { "arg1": "value1" } }
  ],
  "markDone": true,
  "summary": "Brief description of what was done"
}`;

    const prompt = await this.enrichPrompt(basePrompt, state, {
      includeSoul: true,
      includeAwareness: true,
      includeMemory: true,
      includeTools: true,
      toolDetail: 'tactical',
      includeSkills: true,
      includeStrategicPlan: true,
      includeTacticalPlan: true,
    });

    console.log(`[Agent:Executor] planTacticalStepExecution prompt:\n${prompt}`);

    try {
      const response = await this.prompt(prompt, state);
      if (!response?.content) {
        return null;
      }

      const parsed = this.parseFirstJSONObject<any>(response.content);
      if (!parsed) {
        console.warn('[Agent:Executor] Could not parse JSON from LLM response:', response.content.substring(0, 500));
        return null;
      }

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
    const activeTacticalStep = (state.metadata.activeTacticalStep && typeof state.metadata.activeTacticalStep === 'object')
      ? (state.metadata.activeTacticalStep as any)
      : null;
    const activeMilestone = (state.metadata.activeMilestone && typeof state.metadata.activeMilestone === 'object')
      ? (state.metadata.activeMilestone as any)
      : null;

    const executionContext = activeTacticalStep
      ? `\n\nCurrent execution context:\nMilestone: ${activeMilestone ? `${String(activeMilestone.title || '')}: ${String(activeMilestone.description || '')}` : 'none'}\nTactical step: ${String(activeTacticalStep.action || '')} — ${String(activeTacticalStep.description || '')}\nExecution result: ${JSON.stringify(todoExecution || {})}`
      : '';

    const baseInstruction = `${executionContext}

Accomplish this tactical step.

Output requirements:
- Output plain text only.
- Do NOT output JSON.
- Do NOT wrap the response in an object.
- Do NOT include code fences.`;

    let instruction = await this.enrichPrompt(baseInstruction, state, {
      includeSoul: true,
      includeAwareness: true,
      includeMemory: true,
      includeTools: true,
      toolDetail: 'tactical',
      includeSkills: true,
      includeStrategicPlan: true,
      includeTacticalPlan: true,
    });

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

    console.log(`[Agent:Executor] Response prompt (plain text):\n${instruction}`);

    return this.prompt(instruction, state);
  }
}
