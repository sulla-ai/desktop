// TacticalCriticNode - Reviews output and decides approve/reject/revise
// Uses LLM to intelligently evaluate whether the task was completed successfully

import type { ThreadState, NodeResult } from '../types';
import { BaseNode, JSON_ONLY_RESPONSE_INSTRUCTIONS } from './BaseNode';
import { parseJson } from '../services/JsonParseService';
import { agentError, agentLog, agentWarn } from '../services/AgentLogService';
import { StrategicStateService } from '../services/StrategicStateService';

export type CriticDecision = 'approve' | 'revise' | 'reject';

interface CriticLLMResponse {
  successScore: number;
  decision: CriticDecision;
  reason: string;
  suggestedFix?: string;
}

export class TacticalCriticNode extends BaseNode {
  private maxRevisions = 2;

  constructor() {
    super('tactical_critic', 'Tactical Critic');
  }

  async execute(state: ThreadState): Promise<{ state: ThreadState; next: NodeResult }> {
    agentLog(this.name, 'Executing...', {
      activePlanId: state.metadata.activePlanId,
      activeTodo: state.metadata.activeTodo,
      todoExecution: state.metadata.todoExecution,
    });

    // Check for LLM failure count to prevent infinite loops
    const llmFailureCount = ((state.metadata.llmFailureCount as number) || 0);
    if (llmFailureCount >= 3) {
      console.error(`[Agent:TacticalCritic] LLM has failed ${llmFailureCount} times, ending graph`);
      state.metadata.criticDecision = 'approve';
      state.metadata.criticReason = 'LLM service unavailable, ending gracefully';
      return { state, next: 'end' };
    }

    const activePlanId = (state.metadata.activePlanId !== undefined && state.metadata.activePlanId !== null && Number.isFinite(Number(state.metadata.activePlanId)))
      ? Number(state.metadata.activePlanId)
      : null;
    const activeTodo = (state.metadata.activeTodo && typeof state.metadata.activeTodo === 'object')
      ? (state.metadata.activeTodo as any)
      : null;
    const todoExecution = (state.metadata.todoExecution && typeof state.metadata.todoExecution === 'object')
      ? (state.metadata.todoExecution as any)
      : null;

    const strategicState = StrategicStateService.fromThreadState(state);
    await strategicState.initialize();

    const requestedRevision = state.metadata.requestPlanRevision as { reason?: string } | boolean | undefined;
    if (requestedRevision) {
      const reason = (typeof requestedRevision === 'object' && requestedRevision)
        ? String((requestedRevision as any).reason || 'Executor requested plan revision')
        : 'Executor requested plan revision';

      // Attach full todo state to the revision feedback so the planner has authoritative context.
      try {
        const snapshot = strategicState.getSnapshot();
        const todos = snapshot.todos.map(t => ({ id: t.id, title: t.title, status: t.status, orderIndex: t.orderIndex }));
        state.metadata.revisionFeedback = `${reason}\n\nCurrent todos (all statuses):\n${JSON.stringify(todos, null, 2)}`;
      } catch {
        state.metadata.revisionFeedback = reason;
      }

      agentLog(this.name, 'Executor reported issues (not auto-revising)', {
        reason,
        activePlanId: state.metadata.activePlanId,
        activeTodo: state.metadata.activeTodo,
        todoExecution: state.metadata.todoExecution,
        toolResultsHistory: (state.metadata as any).toolResultsHistory,
        revisionFeedback: state.metadata.revisionFeedback,
      });

      // Continue: the critic must decide based on whether the milestone was sufficiently completed.
    }

    const revisionCount = (state.metadata.revisionCount as number) || 0;

    if (revisionCount >= this.maxRevisions) {
      agentWarn(this.name, `Max revisions (${this.maxRevisions}) reached, auto-approving`);

      // Mark the todo as done in the database before auto-approving
      if (activePlanId && activeTodo) {
        try {
          const todoId = Number(activeTodo.id);
          agentWarn(this.name, `Auto-approving todo ${todoId} due to max revisions`);
          await strategicState.completeTodo(todoId, typeof activeTodo.title === 'string' ? activeTodo.title : undefined);
        } catch (err) {
          agentError(this.name, 'Failed to mark todo as done on max revisions', err);
        }
      }

      state.metadata.criticDecision = 'approve';
      state.metadata.criticReason = 'Max revisions reached';

      this.emitProgress(state, 'critic_decision', { decision: 'approve', reason: 'Max revisions reached' });

      return { state, next: 'continue' };
    }

    // If there is no active plan/todo context, allow the graph to continue.
    if (!activePlanId || !activeTodo) {
      state.metadata.criticDecision = 'approve';
      state.metadata.criticReason = 'No active plan/todo to critique';

      this.emitProgress(state, 'critic_decision', { decision: 'approve', reason: 'No active plan/todo to critique' });

      return { state, next: 'continue' };
    }

    const todoId = Number(activeTodo.id);
    const todoTitle = typeof activeTodo.title === 'string' ? activeTodo.title : '';
    const todoDescription = typeof activeTodo.description === 'string' ? activeTodo.description : '';
    const execStatus = todoExecution && typeof todoExecution.status === 'string' ? String(todoExecution.status) : '';
    const execSummary = todoExecution && typeof todoExecution.summary === 'string' ? String(todoExecution.summary) : '';
    const toolResults = state.metadata.toolResults as Record<string, any> | undefined;

    const activeMilestone = state.metadata.activeMilestone as { id?: string; title?: string; description?: string; successCriteria?: string } | undefined;
    const strategicPlan = state.metadata.strategicPlan as { goal?: string } | undefined;
    const milestoneTitle = String(activeMilestone?.title || todoTitle || '');
    const milestoneDescription = String(activeMilestone?.description || todoDescription || '');
    const milestoneSuccessCriteria = String(activeMilestone?.successCriteria || '');
    const milestoneGoal = String(strategicPlan?.goal || planGoalFromState(state) || '');

    // Use LLM to evaluate the execution
    const llmDecision = await this.evaluateWithLLM(state, {
      todoId,
      todoTitle,
      todoDescription,
      execStatus,
      execSummary,
      toolResults,
      activePlanId,
      milestoneTitle,
      milestoneDescription,
      milestoneSuccessCriteria,
      milestoneGoal,
      executorIssues: typeof state.metadata.revisionFeedback === 'string' ? String(state.metadata.revisionFeedback) : undefined,
    });

    if (llmDecision.decision === 'approve') {
      try {
        agentLog(this.name, `Marking todo ${todoId} as done in database...`);
        await strategicState.completeTodo(todoId, todoTitle);
        agentLog(this.name, `Todo ${todoId} marked as done successfully`);
      } catch (err) {
        agentError(this.name, `Failed to mark todo ${todoId} as done`, err);
      }

      // Clear any executor issue flags once we accept success.
      delete state.metadata.requestPlanRevision;
      delete state.metadata.revisionFeedback;

      // Check if all todos are now complete - if so, mark plan as completed
      try {
        await strategicState.refresh();
        const remaining = strategicState.hasRemainingTodos();
        state.metadata.planHasRemainingTodos = remaining;

        if (!remaining) {
          agentLog(this.name, `All todos complete, marking plan ${activePlanId} as completed`);
          await strategicState.markPlanCompleted('All todos complete');

          // Clear the active plan pointer so the next user prompt starts a new plan.
          delete (state.metadata as any).activePlanId;
          delete (state.metadata as any).activeTodo;
        }
      } catch (err) {
        agentWarn(this.name, 'Failed to check plan completion', err);
        state.metadata.planHasRemainingTodos = true;
      }

      state.metadata.criticDecision = 'approve';
      state.metadata.criticReason = llmDecision.reason;

      this.emitProgress(state, 'critic_decision', { decision: 'approve', reason: llmDecision.reason });

      return { state, next: 'continue' };
    }

    // LLM decided to revise - persist blocked status and request revision
    const reason = llmDecision.suggestedFix
      ? `${llmDecision.reason} | Suggested fix: ${llmDecision.suggestedFix}`
      : llmDecision.reason;

    try {
      await strategicState.blockTodo(todoId, reason, todoTitle);
    } catch {
      // best effort
    }

    await strategicState.requestRevision(reason);

    state.metadata.criticDecision = 'revise';
    state.metadata.criticReason = reason;
    state.metadata.revisionFeedback = reason;
    state.metadata.requestPlanRevision = { reason };
    state.metadata.revisionCount = revisionCount + 1;

    agentError(this.name, `Requesting plan revision ${revisionCount + 1}/${this.maxRevisions}`, {
      reason,
      todoId,
      todoTitle,
      execStatus,
      execSummary,
      toolResultsHistory: (state.metadata as any).toolResultsHistory,
      toolResults: state.metadata.toolResults,
    });

    this.emitProgress(state, 'critic_decision', { decision: 'revise', reason });

    return { state, next: 'tactical_planner' };
  }

  private async evaluateWithLLM(
    state: ThreadState,
    context: {
      todoId: number;
      todoTitle: string;
      todoDescription: string;
      execStatus: string;
      execSummary: string;
      toolResults: Record<string, any> | undefined;
      activePlanId: number | null;
      milestoneTitle: string;
      milestoneDescription: string;
      milestoneSuccessCriteria: string;
      milestoneGoal: string;
      executorIssues?: string;
    },
  ): Promise<CriticLLMResponse> {
    const basePrompt = `You are the Tactical Critic. Your ONLY job is to determine whether the current milestone was sufficiently completed.

Milestone being critiqued (in-progress): "${context.milestoneTitle}".
Milestone description: ${context.milestoneDescription}
Milestone success criteria: ${context.milestoneSuccessCriteria || '(not explicitly provided)'}

This milestone is one step toward the overall goal: "${context.milestoneGoal || '(not explicitly provided)'}".

If the milestone success criteria is missing, you must infer what "done" means by reviewing the conversation and the execution summary/tool results.

IMPORTANT:
- Errors, tool failures, or messy execution are NOT by themselves a reason to revise.
- Focus only on whether the milestone outcome exists / is true.
- Assign a successScore from 0-10.
- If successScore >= 8: approve (mark milestone complete), even if there were errors.
- If successScore < 8: revise, and explain what is missing to reach >=8.

Execution context:
- executorStatus: ${context.execStatus}
- executorSummary: ${context.execSummary}
${context.executorIssues ? `- executorIssues: ${context.executorIssues}` : ''}
${context.toolResults ? `- toolResults: ${JSON.stringify(context.toolResults)}` : ''}
    
You are the Critic: a 25-year senior DevOps & QA engineer who has audited 1000+ mission-critical pipelines (e.g., Body Glove zero-downtime deploys, ClientBasis lead-scoring accuracy at 98%+). Ruthless precision: approve only when milestone success criteria are verifiably 100% met. Partial completion = revision — especially batch ops, data integrity, or security-sensitive tasks.

## Your Task
1. Compare EVERY success criterion line-by-line against tool results + summary.
2. Verify full scope: batch tasks (e.g., "delete all", "process 50 leads") must show ALL items handled — partial = revise.
3. Check side effects: no unintended writes, leaks, or security holes.
4. Confirm progress: did this step actually deliver the exact artifact/state the milestone requires for downstream success?

## Guidelines:
- approve → 100% criteria met, clean execution, no red flags
- revise → partial success, wrong approach, missing verification
- fail → data corruption, security breach, or milestone impossible now
- Be brutal: downstream milestones collapse on weak foundations
- Quote exact tool output or criteria when justifying
- Pragmatic only on cosmetic issues; core outcome is non-negotiable


${JSON_ONLY_RESPONSE_INSTRUCTIONS}
{
  "successScore": 0,                              // integer 0-10
  "decision": "approve" | "revise",              // if successScore >= 8 then approve
  "reason": "One-sentence verdict with evidence",
  "suggestedFix": "Precise next action if revise (optional)",
  "emit_chat_message": "Inform the user about your review and what you need to do next"
}`;

    const prompt = await this.enrichPrompt(basePrompt, state, {
      includeSoul: true,
      includeAwareness: true,
      includeMemory: true,
      includeTools: true,
      toolDetail: 'names',
      includeSkills: false,
      includeStrategicPlan: true,
      includeTacticalPlan: true,
    });

    try {
      const response = await this.prompt(prompt, state);
      if (!response?.content) {
        console.warn('[Agent:TacticalCritic] No LLM response, defaulting to heuristic');
        return this.fallbackHeuristic(context);
      }

      const parsed = parseJson<Partial<CriticLLMResponse>>(response.content);
      if (!parsed) {
        console.warn('[Agent:TacticalCritic] Could not parse LLM response, defaulting to heuristic');
        return this.fallbackHeuristic(context);
      }

      const emit_chat_message = (parsed as any).emit_chat_message || '';
      if (emit_chat_message){
        await this.emitChatMessage(state, emit_chat_message);
      }

      const scoreRaw = (parsed as any).successScore;
      const score = Number.isFinite(Number(scoreRaw)) ? Number(scoreRaw) : NaN;
      if (!Number.isFinite(score)) {
        console.warn('[Agent:TacticalCritic] Missing/invalid successScore from LLM, defaulting to heuristic');
        return this.fallbackHeuristic(context);
      }

      const normalizedScore = Math.max(0, Math.min(10, Math.round(score)));
      const decision: CriticDecision = normalizedScore >= 8 ? 'approve' : 'revise';
      console.log(`[Agent:TacticalCritic] LLM score: ${normalizedScore}/10 => ${decision} - ${parsed.reason}`);

      return {
        successScore: normalizedScore,
        decision,
        reason: parsed.reason || `Success score: ${normalizedScore}/10`,
        suggestedFix: parsed.suggestedFix,
      };
    } catch (err) {
      console.error('[Agent:TacticalCritic] LLM evaluation failed:', err);
      return this.fallbackHeuristic(context);
    }
  }

  private fallbackHeuristic(context: {
    execStatus: string;
    execSummary: string;
    toolResults: Record<string, any> | undefined;
    todoTitle: string;
    todoId: number;
  }): CriticLLMResponse {
    if (context.execStatus === 'done') {
      return {
        successScore: 8,
        decision: 'approve',
        reason: `Todo complete: ${context.todoTitle || String(context.todoId)}`,
      };
    }

    const reasonParts: string[] = [];
    reasonParts.push(`Todo not complete: ${context.todoTitle || String(context.todoId)}`);
    if (context.execStatus) {
      reasonParts.push(`status=${context.execStatus}`);
    }
    if (context.execSummary) {
      reasonParts.push(context.execSummary);
    }

    return {
      successScore: 4,
      decision: 'revise',
      reason: reasonParts.join(' | '),
    };
  }
}

function planGoalFromState(state: ThreadState): string {
  const plan = state.metadata.plan as { fullPlan?: { goal?: string } } | undefined;
  return String(plan?.fullPlan?.goal || '');
}
