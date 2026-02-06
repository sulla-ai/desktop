// StrategicStateService.ts
// Updated: uses AgentPlan / AgentPlanTodo models
// Removed PlanService dependency — direct model usage
// Kept API surface identical so dependent nodes don't break

import type { ThreadState } from '../../types';
import { getWebSocketClientService } from '../../services/WebSocketClientService';
import { AgentPlan, type PlanStatus } from '../../database/models/AgentPlan';
import { AgentPlanTodo, type TodoStatus } from '../../database/models/AgentPlanTodo';

export interface StrategicMilestone {
  id: string;
  title: string;
  description?: string;
  successCriteria?: string;
  dependsOn?: string[];
  status?: 'pending' | 'in_progress' | 'completed' | 'failed';
  todoId?: number;
}

export interface StrategicPlanData {
  [key: string]: unknown;
  type: 'strategic';
  goal: string;
  goalDescription?: string;
  estimatedComplexity?: string;
  responseGuidance?: unknown;
}

export class StrategicStateService {
  private initialized = false;
  private wsConnectionId: string = 'chat-controller';

  private activePlanId: number | null = null;
  private plan: InstanceType<typeof AgentPlan> | null = null;
  private todos: InstanceType<typeof AgentPlanTodo>[] = [];

  constructor(private readonly threadId: string, wsConnectionId?: string) {
    if (wsConnectionId) {
      this.wsConnectionId = wsConnectionId;
    }
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;

    const plan = await AgentPlan.findActiveForThread(this.threadId);
    if (plan) {
      this.activePlanId = plan.id!;
      await this.refresh();
    }

    this.initialized = true;
  }

  getTodoStatus(todoId: number): TodoStatus | null {
    const todo = this.todos.find(t => t.id === todoId);
    return todo?.attributesSnapshot.status ?? null;
  }

  async completeTodo(todoId: number, title?: string): Promise<boolean> {
    return this.setTodoStatus({ todoId, status: 'done', title });
  }

  async inprogressTodo(todoId: number, title?: string): Promise<boolean> {
    return this.setTodoStatus({ todoId, status: 'in_progress', title });
  }

  async blockTodo(todoId: number, reason: string, title?: string): Promise<boolean> {
    return this.setTodoStatus({ todoId, status: 'blocked', title, reason });
  }

  
  async requestRevision(reason: string): Promise<boolean> {
    if (!this.activePlanId) return false;

    await this.refresh();

    return true;
  }

  private emitWebSocketPlanUpdate(event: { type: string; threadId: string; data: unknown }): void {
    getWebSocketClientService().send(this.wsConnectionId, event);
  }

  getActivePlanId(): number | null {
    return this.activePlanId;
  }

  getSnapshot(): {
    plan: InstanceType<typeof AgentPlan> | null;
    todos: InstanceType<typeof AgentPlanTodo>[];
  } {
    return { plan: this.plan, todos: [...this.todos] };
  }

  async refresh(): Promise<void> {
    if (!this.activePlanId) {
      this.plan = null;
      this.todos = [];
      return;
    }

    this.plan = await AgentPlan.find(this.activePlanId);
    if (!this.plan) {
      this.activePlanId = null;
      return;
    }

    this.todos = await AgentPlanTodo.findForPlan(this.activePlanId);
  }

  async createPlan(params: {
    data: StrategicPlanData;
    milestones: Array<{ title: string; description: string; orderIndex: number }>;
    eventData?: Record<string, unknown>;
  }): Promise<number | null> {
    const plan = await AgentPlan.create({
      thread_id: this.threadId,
      data: params.data,
      status: 'active',
      revision: 1,
    });

    if (!plan?.id) return null;

    this.activePlanId = plan.id;

    const createdTodos: Array<{ todoId: number; title: string; orderIndex: number }> = [];

    for (const m of params.milestones) {
      const todo = await AgentPlanTodo.create({
        plan_id: plan.id,
        title: m.title,
        description: m.description,
        order_index: m.orderIndex,
        status: 'pending',
        category_hints: [],
      });

      if (todo?.id) {
        createdTodos.push({
          todoId: todo.id,
          title: m.title,
          orderIndex: m.orderIndex,
        });
      }
    }

    await this.refresh();

    this.emitWebSocketPlanUpdate({
      type: 'progress',
      threadId: this.threadId,
      data: { phase: 'plan_created', planId: plan.id, goal: params.data.goal },
    });

    for (const t of createdTodos) {
      this.emitWebSocketPlanUpdate({
        type: 'progress',
        threadId: this.threadId,
        data: {
          phase: 'todo_created',
          planId: plan.id,
          todoId: t.todoId,
          title: t.title,
          orderIndex: t.orderIndex,
          status: 'pending',
        },
      });
    }

    return plan.id;
  }

  async revisePlan(params: {
    planId: number;
    data: StrategicPlanData;
    milestones: Array<{ title: string; description: string; orderIndex: number }>;
    eventData?: Record<string, unknown>;
  }): Promise<{
    planId: number;
    revision: number;
    todosCreated: Array<{ todoId: number; title: string; orderIndex: number; status: TodoStatus }>;
    todosUpdated: Array<{ todoId: number; title: string; orderIndex: number; status: TodoStatus }>;
    todosDeleted: number[];
  } | null> {
    const plan = await AgentPlan.find(params.planId);
    if (!plan) return null;

    // Load prior todos
    const priorTodos = await AgentPlanTodo.findForPlan(params.planId);

    const normalizeTitle = (t: string) => t.trim();
    const matchKey = (idx: number, title: string) => `${idx}::${normalizeTitle(title)}`;

    const priorByKey = new Map<string, InstanceType<typeof AgentPlanTodo>>();
    const priorByTitle = new Map<string, InstanceType<typeof AgentPlanTodo>[]>();

    for (const t of priorTodos) {
      priorByKey.set(matchKey(t.attributesSnapshot.order_index!, t.attributesSnapshot.title!), t);
      const key = normalizeTitle(t.attributesSnapshot.title!);
      const list = priorByTitle.get(key) || [];
      list.push(t);
      priorByTitle.set(key, list);
    }

    // Increment revision
    plan.setRevision((plan.attributesSnapshot.revision || 1) + 1);
    plan.setData(params.data);
    await plan.save();

    const usedIds = new Set<number>();
    const todosCreated: Array<{ todoId: number; title: string; orderIndex: number; status: TodoStatus }> = [];
    const todosUpdated: Array<{ todoId: number; title: string; orderIndex: number; status: TodoStatus }> = [];

    for (const m of params.milestones) {
      const key = matchKey(m.orderIndex, m.title);
      const byTitle = (priorByTitle.get(normalizeTitle(m.title)) || []).filter(t => !usedIds.has(t.id!));
      const match = byTitle.length === 1 ? byTitle[0] : priorByKey.get(key);

      if (match) {
        usedIds.add(match.id!);
        match.setOrderIndex(m.orderIndex);
        match.setTitle(m.title);
        match.setDescription(m.description);
        match.setCategoryHints([]);
        await match.save();
        todosUpdated.push({
          todoId: match.id!,
          title: m.title,
          orderIndex: m.orderIndex,
          status: match.attributesSnapshot.status!,
        });
        continue;
      }

      const newTodo = await AgentPlanTodo.create({
        plan_id: params.planId,
        title: m.title,
        description: m.description,
        order_index: m.orderIndex,
        status: 'pending',
        category_hints: [],
      });

      if (newTodo?.id) {
        todosCreated.push({
          todoId: newTodo.id,
          title: m.title,
          orderIndex: m.orderIndex,
          status: newTodo.attributesSnapshot.status!,
        });
      }
    }

    // Delete non-completed unmatched todos
    const todosDeleted = priorTodos
      .filter(t => !usedIds.has(t.id!) && t.attributesSnapshot.status !== 'done')
      .map(t => t.id!);

    for (const id of todosDeleted) {
      const todo = await AgentPlanTodo.find(id);
      await todo?.delete();
    }

    await this.refresh();

    this.emitWebSocketPlanUpdate({
      type: 'progress',
      threadId: this.threadId,
      data: {
        phase: 'plan_revised',
        planId: params.planId,
        revision: plan.attributesSnapshot.revision!,
        goal: params.data.goal,
      },
    });

    // Emit todo events...
    for (const t of todosCreated) {
      this.emitWebSocketPlanUpdate({
        type: 'progress',
        threadId: this.threadId,
        data: {
          phase: 'todo_created',
          planId: params.planId,
          todoId: t.todoId,
          title: t.title,
          orderIndex: t.orderIndex,
          status: t.status,
        },
      });
    }

    for (const t of todosUpdated) {
      this.emitWebSocketPlanUpdate({
        type: 'progress',
        threadId: this.threadId,
        data: {
          phase: 'todo_updated',
          planId: params.planId,
          todoId: t.todoId,
          title: t.title,
          orderIndex: t.orderIndex,
          status: t.status,
        },
      });
    }

    for (const todoId of todosDeleted) {
      this.emitWebSocketPlanUpdate({
        type: 'progress',
        threadId: this.threadId,
        data: { phase: 'todo_deleted', planId: params.planId, todoId },
      });
    }

    return {
      planId: params.planId,
      revision: plan.attributesSnapshot.revision!,
      todosCreated,
      todosUpdated,
      todosDeleted,
    };
  }

  getTodoIdByOrderIndex(orderIndex: number): number | undefined {
    return this.todos.find(t => t.attributesSnapshot.order_index === orderIndex)?.id;
  }

  async setTodoStatus(params: {
    todoId: number;
    status: TodoStatus;
    title?: string;
    reason?: string;
  }): Promise<boolean> {
    if (!this.activePlanId) return false;

    const todo = await AgentPlanTodo.find(params.todoId);
    if (!todo) return false;

    todo.markStatus(params.status);
    await todo.save();

    await this.refresh();

    this.emitWebSocketPlanUpdate({
      type: 'progress',
      threadId: this.threadId,
      data: {
        phase: 'todo_status',
        planId: this.activePlanId,
        todoId: params.todoId,
        title: params.title,
        status: params.status,
      },
    });

    return true;
  }

  async markPlanCompleted(reason: string): Promise<boolean> {
    if (!this.activePlanId) return false;

    const plan = await AgentPlan.find(this.activePlanId);
    if (!plan) return false;

    plan.setStatus('completed');
    await plan.save();

    this.emitWebSocketPlanUpdate({
      type: 'progress',
      threadId: this.threadId,
      data: { phase: 'plan_completed', planId: this.activePlanId },
    });

    this.activePlanId = null;
    await this.refresh();

    return true;
  }

  hasRemainingTodos(): boolean {
    return this.todos.some(t => ['pending', 'in_progress', 'blocked'].includes(t.attributesSnapshot.status!));
  }

  static fromThreadState(state: ThreadState): StrategicStateService {
    const wsConnectionId = (state.metadata.wsConnectionId as string) || 'chat-controller';
    return new StrategicStateService(state.threadId, wsConnectionId);
  }
}