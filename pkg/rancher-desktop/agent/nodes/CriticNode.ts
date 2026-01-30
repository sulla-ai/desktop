// CriticNode - Reviews output and decides approve/reject/revise

import type { ThreadState, NodeResult } from '../types';
import { BaseNode } from './BaseNode';
import { getPlanService, type TodoStatus } from '../services/PlanService';

export type CriticDecision = 'approve' | 'revise' | 'reject';

export class CriticNode extends BaseNode {
  private maxRevisions = 2;

  constructor() {
    super('critic', 'Critic');
  }

  async execute(state: ThreadState): Promise<{ state: ThreadState; next: NodeResult }> {
    console.log(`[Agent:Critic] Executing...`);
    const emit = (state.metadata.__emitAgentEvent as ((event: { type: 'progress' | 'chunk' | 'complete' | 'error'; threadId: string; data: unknown }) => void) | undefined);
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
      state.metadata.revisionFeedback = reason;
      state.metadata.revisionCount = ((state.metadata.revisionCount as number) || 0) + 1;
      console.log(`[Agent:Critic] Forcing revision due to executor request: ${reason}`);

      emit?.({
        type:     'progress',
        threadId: state.threadId,
        data:     { phase: 'critic_decision', decision: 'revise', reason },
      });
      return { state, next: 'planner' };
    }

    const revisionCount = (state.metadata.revisionCount as number) || 0;

    if (revisionCount >= this.maxRevisions) {
      console.log(`[Agent:Critic] Max revisions (${this.maxRevisions}) reached, auto-approving`);
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
    const execStatus = todoExecution && typeof todoExecution.status === 'string' ? String(todoExecution.status) : '';
    const execSummary = todoExecution && typeof todoExecution.summary === 'string' ? String(todoExecution.summary) : '';
    const toolResults = state.metadata.toolResults as Record<string, any> | undefined;

    const anyToolFailed = !!toolResults && Object.values(toolResults).some((r: any) => r && r.success === false);

    // Approve when the todo is marked done.
    if (execStatus === 'done') {
      // Critic owns status transitions: persist done to DB.
      try {
        const planService = getPlanService();
        await planService.initialize();
        await planService.updateTodoStatus({
          todoId,
          status: 'done',
          eventType: 'todo_completed',
          eventData: { status: 'done' },
        });
        emit?.({
          type:     'progress',
          threadId: state.threadId,
          data:     { phase: 'todo_status', planId: activePlanId, todoId, title: todoTitle, status: 'done' },
        });
      } catch {
        // best effort
      }

      state.metadata.criticDecision = 'approve';
      state.metadata.criticReason = `Todo complete: ${todoTitle || String(todoId)}`;

      emit?.({
        type:     'progress',
        threadId: state.threadId,
        data:     { phase: 'critic_decision', decision: 'approve', reason: state.metadata.criticReason },
      });

      return { state, next: 'continue' };
    }

    // Otherwise, request a plan revision to address the todo failure/incompleteness.
    const reasonParts: string[] = [];
    reasonParts.push(`Todo not complete: ${todoTitle || String(todoId)}`);
    if (execStatus) {
      reasonParts.push(`status=${execStatus}`);
    }
    if (anyToolFailed) {
      reasonParts.push('one or more tool calls failed');
    }
    if (execSummary) {
      reasonParts.push(execSummary);
    }

    const reason = reasonParts.join(' | ');

    // Critic owns status transitions: persist blocked to DB.
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

    return { state, next: 'planner' };
  }
}
