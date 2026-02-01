// CriticNode - Reviews output and decides approve/reject/revise
// Uses LLM to intelligently evaluate whether the task was completed successfully

import type { ThreadState, NodeResult } from '../types';
import { BaseNode, JSON_ONLY_RESPONSE_INSTRUCTIONS } from './BaseNode';
import { getPlanService, type TodoStatus } from '../services/PlanService';

export type CriticDecision = 'approve' | 'revise' | 'reject';

interface CriticLLMResponse {
  decision: CriticDecision;
  reason: string;
  suggestedFix?: string;
}

export class CriticNode extends BaseNode {
  private maxRevisions = 2;

  constructor() {
    super('critic', 'Critic');
  }

  async execute(state: ThreadState): Promise<{ state: ThreadState; next: NodeResult }> {
    console.log(`[Agent:Critic] Executing...`);
    console.log(`[Agent:Critic] activePlanId=${state.metadata.activePlanId}, activeTodo=${JSON.stringify(state.metadata.activeTodo)}`);
    console.log(`[Agent:Critic] todoExecution=${JSON.stringify(state.metadata.todoExecution)}`);
    const emit = (state.metadata.__emitAgentEvent as ((event: { type: 'progress' | 'chunk' | 'complete' | 'error'; threadId: string; data: unknown }) => void) | undefined);
    
    // Check for LLM failure count to prevent infinite loops
    const llmFailureCount = ((state.metadata.llmFailureCount as number) || 0);
    if (llmFailureCount >= 3) {
      console.error(`[Agent:Critic] LLM has failed ${llmFailureCount} times, ending graph`);
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

    const requestedRevision = state.metadata.requestPlanRevision as { reason?: string } | boolean | undefined;
    if (requestedRevision) {
      const reason = (typeof requestedRevision === 'object' && requestedRevision)
        ? String((requestedRevision as any).reason || 'Executor requested plan revision')
        : 'Executor requested plan revision';

      // Attach full todo state to the revision feedback so the planner has authoritative context.
      try {
        if (activePlanId) {
          const planService = getPlanService();
          await planService.initialize();
          const loaded = await planService.getPlan(activePlanId);
          if (loaded) {
            const todos = loaded.todos.map(t => ({ id: t.id, title: t.title, status: t.status, orderIndex: t.orderIndex }));
            state.metadata.revisionFeedback = `${reason}\n\nCurrent todos (all statuses):\n${JSON.stringify(todos, null, 2)}`;
          } else {
            state.metadata.revisionFeedback = reason;
          }
        } else {
          state.metadata.revisionFeedback = reason;
        }
      } catch {
        state.metadata.revisionFeedback = reason;
      }

      // Critic owns status transitions: mark current todo blocked in DB (if we have one)
      if (activeTodo && Number.isFinite(Number(activeTodo.id))) {
        try {
          const planService = getPlanService();
          await planService.initialize();
          const todoId = Number(activeTodo.id);
          const title = typeof activeTodo.title === 'string' ? activeTodo.title : '';
          await planService.updateTodoStatus({
            todoId,
            status: 'blocked',
            eventType: 'todo_status',
            eventData: { status: 'blocked', reason },
          });
          emit?.({
            type:     'progress',
            threadId: state.threadId,
            data:     { phase: 'todo_status', planId: activePlanId, todoId, title, status: 'blocked' },
          });
        } catch {
          // best effort
        }
      }

      state.metadata.criticDecision = 'revise';
      state.metadata.criticReason = reason;
      state.metadata.revisionCount = ((state.metadata.revisionCount as number) || 0) + 1;
      console.log(`[Agent:Critic] Forcing revision due to executor request: ${reason}`);

      emit?.({
        type:     'progress',
        threadId: state.threadId,
        data:     { phase: 'critic_decision', decision: 'revise', reason },
      });
      return { state, next: 'tactical_planner' };
    }

    const revisionCount = (state.metadata.revisionCount as number) || 0;

    if (revisionCount >= this.maxRevisions) {
      console.log(`[Agent:Critic] Max revisions (${this.maxRevisions}) reached, auto-approving`);
      
      // Mark the todo as done in the database before auto-approving
      if (activePlanId && activeTodo) {
        const planService = getPlanService();
        try {
          await planService.initialize();
          const todoId = Number(activeTodo.id);
          console.log(`[Agent:Critic] Auto-approving todo ${todoId} due to max revisions`);
          await planService.updateTodoStatus({
            todoId,
            status: 'done',
            eventType: 'todo_completed',
            eventData: { status: 'done', reason: 'Max revisions reached' },
          });
          emit?.({
            type:     'progress',
            threadId: state.threadId,
            data:     { phase: 'todo_status', planId: activePlanId, todoId, title: activeTodo.title, status: 'done' },
          });
        } catch (err) {
          console.error(`[Agent:Critic] Failed to mark todo as done on max revisions:`, err);
        }
      }
      
      state.metadata.criticDecision = 'approve';
      state.metadata.criticReason = 'Max revisions reached';

      emit?.({
        type:     'progress',
        threadId: state.threadId,
        data:     { phase: 'critic_decision', decision: 'approve', reason: 'Max revisions reached' },
      });

      return { state, next: 'continue' };
    }

    // If there is no active plan/todo context, allow the graph to continue.
    if (!activePlanId || !activeTodo) {
      state.metadata.criticDecision = 'approve';
      state.metadata.criticReason = 'No active plan/todo to critique';

      emit?.({
        type:     'progress',
        threadId: state.threadId,
        data:     { phase: 'critic_decision', decision: 'approve', reason: 'No active plan/todo to critique' },
      });

      return { state, next: 'continue' };
    }

    const todoId = Number(activeTodo.id);
    const todoTitle = typeof activeTodo.title === 'string' ? activeTodo.title : '';
    const todoDescription = typeof activeTodo.description === 'string' ? activeTodo.description : '';
    const execStatus = todoExecution && typeof todoExecution.status === 'string' ? String(todoExecution.status) : '';
    const execSummary = todoExecution && typeof todoExecution.summary === 'string' ? String(todoExecution.summary) : '';
    const toolResults = state.metadata.toolResults as Record<string, any> | undefined;

    // Use LLM to evaluate the execution
    const llmDecision = await this.evaluateWithLLM(state, {
      todoId,
      todoTitle,
      todoDescription,
      execStatus,
      execSummary,
      toolResults,
      activePlanId,
    });

    if (llmDecision.decision === 'approve') {
      // Critic owns status transitions: persist done to DB.
      const planService = getPlanService();
      try {
        await planService.initialize();
        console.log(`[Agent:Critic] Marking todo ${todoId} as done in database...`);
        await planService.updateTodoStatus({
          todoId,
          status: 'done',
          eventType: 'todo_completed',
          eventData: { status: 'done' },
        });
        console.log(`[Agent:Critic] Todo ${todoId} marked as done successfully`);
        emit?.({
          type:     'progress',
          threadId: state.threadId,
          data:     { phase: 'todo_status', planId: activePlanId, todoId, title: todoTitle, status: 'done' },
        });
      } catch (err) {
        console.error(`[Agent:Critic] Failed to mark todo ${todoId} as done:`, err);
      }

      // Check if all todos are now complete - if so, mark plan as completed
      try {
        const refreshed = await planService.getPlan(activePlanId);
        const remaining = refreshed
          ? refreshed.todos.some(t => t.status === 'pending' || t.status === 'in_progress' || t.status === 'blocked')
          : true;
        state.metadata.planHasRemainingTodos = remaining;
        
        if (!remaining) {
          console.log(`[Agent:Critic] All todos complete, marking plan ${activePlanId} as completed`);
          await planService.addPlanEvent(activePlanId, 'plan_completed', { reason: 'All todos complete' });
          await planService.updatePlanStatus(activePlanId, 'completed');

          // Clear the active plan pointer so the next user prompt starts a new plan.
          delete (state.metadata as any).activePlanId;
          delete (state.metadata as any).activeTodo;

          emit?.({
            type:     'progress',
            threadId: state.threadId,
            data:     { phase: 'plan_completed', planId: activePlanId },
          });

          try {
            const { getAwarenessService } = await import('../services/AwarenessService');
            const awareness = getAwarenessService();
            await awareness.initialize();
            await awareness.update({ active_plan_ids: [] });
          } catch {
            // best effort
          }
        }
      } catch (err) {
        console.warn('[Agent:Critic] Failed to check plan completion:', err);
        state.metadata.planHasRemainingTodos = true;
      }

      state.metadata.criticDecision = 'approve';
      state.metadata.criticReason = llmDecision.reason;

      emit?.({
        type:     'progress',
        threadId: state.threadId,
        data:     { phase: 'critic_decision', decision: 'approve', reason: llmDecision.reason },
      });

      return { state, next: 'continue' };
    }

    // LLM decided to revise - persist blocked status and request revision
    const reason = llmDecision.suggestedFix
      ? `${llmDecision.reason} | Suggested fix: ${llmDecision.suggestedFix}`
      : llmDecision.reason;

    try {
      const planService = getPlanService();
      await planService.initialize();
      await planService.updateTodoStatus({
        todoId,
        status: 'blocked',
        eventType: 'todo_status',
        eventData: { status: 'blocked', reason },
      });
      emit?.({
        type:     'progress',
        threadId: state.threadId,
        data:     { phase: 'todo_status', planId: activePlanId, todoId, title: todoTitle, status: 'blocked' },
      });
    } catch {
      // best effort
    }

    state.metadata.criticDecision = 'revise';
    state.metadata.criticReason = reason;
    state.metadata.revisionFeedback = reason;
    state.metadata.requestPlanRevision = { reason };
    state.metadata.revisionCount = revisionCount + 1;
    console.log(`[Agent:Critic] Requesting plan revision ${revisionCount + 1}/${this.maxRevisions}: ${reason}`);

    emit?.({
      type:     'progress',
      threadId: state.threadId,
      data:     { phase: 'critic_decision', decision: 'revise', reason },
    });

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
    },
  ): Promise<CriticLLMResponse> {
    // Get the plan goal if available
    const plan = state.metadata.plan as { fullPlan?: { goal?: string } } | undefined;
    const planGoal = plan?.fullPlan?.goal || 'No explicit goal set';

    const basePrompt = `Based on the conversation above, evaluate whether the milestone was completed successfully.
    
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
  "decision": "approve" | "revise" | "fail",    // fail = catastrophic, abort chain
  "reason": "One-sentence verdict + key evidence",
  "confidence": 0-100,                           // how certain you are of the verdict
  "suggestedFix": "Precise next action if revise/fail (optional)",
  "missingEvidence": ["list", "of", "gaps"]      // only if revise/fail
}`;

    const prompt = await this.enrichPrompt(basePrompt, state, {
      includeSoul: true,
      includeAwareness: true,
      includeMemory: true,
      includeTools: true,
      toolDetail: 'names',
      includeSkills: true,
      includeStrategicPlan: true,
      includeTacticalPlan: true,
    });

    try {
      const response = await this.prompt(prompt, state);
      if (!response?.content) {
        console.warn('[Agent:Critic] No LLM response, defaulting to heuristic');
        return this.fallbackHeuristic(context);
      }

      const parsed = this.parseFirstJSONObject<Partial<CriticLLMResponse>>(response.content);
      if (!parsed) {
        console.warn('[Agent:Critic] Could not parse LLM response, defaulting to heuristic');
        return this.fallbackHeuristic(context);
      }
      
      if (parsed.decision !== 'approve' && parsed.decision !== 'revise') {
        console.warn('[Agent:Critic] Invalid decision from LLM, defaulting to heuristic');
        return this.fallbackHeuristic(context);
      }

      console.log(`[Agent:Critic] LLM decision: ${parsed.decision} - ${parsed.reason}`);
      return {
        decision: parsed.decision,
        reason: parsed.reason || 'No reason provided',
        suggestedFix: parsed.suggestedFix,
      };
    } catch (err) {
      console.error('[Agent:Critic] LLM evaluation failed:', err);
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
    const anyToolFailed = !!context.toolResults && 
      Object.values(context.toolResults).some((r: any) => r && r.success === false);

    if (context.execStatus === 'done' && !anyToolFailed) {
      return {
        decision: 'approve',
        reason: `Todo complete: ${context.todoTitle || String(context.todoId)}`,
      };
    }

    const reasonParts: string[] = [];
    reasonParts.push(`Todo not complete: ${context.todoTitle || String(context.todoId)}`);
    if (context.execStatus) {
      reasonParts.push(`status=${context.execStatus}`);
    }
    if (anyToolFailed) {
      reasonParts.push('one or more tool calls failed');
    }
    if (context.execSummary) {
      reasonParts.push(context.execSummary);
    }

    return {
      decision: 'revise',
      reason: reasonParts.join(' | '),
    };
  }
}
