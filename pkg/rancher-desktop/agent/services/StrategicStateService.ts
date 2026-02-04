import type { ThreadState } from '../types';
import { getAwarenessService } from './AwarenessService';
import { getPlanService, type PlanRecord, type PlanTodoRecord, type PlanEventRecord, type TodoStatus } from './PlanService';
import { getWebSocketClientService } from './WebSocketClientService';

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
  private plan: PlanRecord | null = null;
  private todos: PlanTodoRecord[] = [];
  private events: PlanEventRecord[] = [];

  constructor(private readonly threadId: string, wsConnectionId?: string) {
    if (wsConnectionId) {
      this.wsConnectionId = wsConnectionId;
    }
  }

  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    const planService = getPlanService();
    await planService.initialize();

    this.activePlanId = await planService.getActivePlanIdForThread(this.threadId);
    if (this.activePlanId) {
      await this.refresh();
    }

    this.initialized = true;
  }

  getTodoStatus(todoId: number): TodoStatus | null {
    const todo = this.todos.find(t => t.id === todoId);
    return todo ? todo.status : null;
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
    const planId = this.activePlanId;
    if (!planId) {
      return false;
    }

    const planService = getPlanService();
    await planService.initialize();

    const ok = await planService.addPlanEvent(planId, 'revision_requested', { reason });
    if (!ok) {
      return false;
    }

    await this.refresh();

    this.emitWebSocketPlanUpdate({
      type: 'progress',
      threadId: this.threadId,
      data: { phase: 'revision_requested', planId, reason },
    });

    return true;
  }

  private emitWebSocketPlanUpdate(event: { type: string; threadId: string; data: unknown }): void {
    const wsService = getWebSocketClientService();
    wsService.send(this.wsConnectionId, event);
  }

  getActivePlanId(): number | null {
    return this.activePlanId;
  }

  getSnapshot(): { plan: PlanRecord | null; todos: PlanTodoRecord[]; events: PlanEventRecord[] } {
    return { plan: this.plan, todos: [...this.todos], events: [...this.events] };
  }

  async refresh(): Promise<void> {
    const planId = this.activePlanId;
    if (!planId) {
      this.plan = null;
      this.todos = [];
      this.events = [];
      return;
    }

    const planService = getPlanService();
    const loaded = await planService.getPlan(planId);
    if (!loaded) {
      this.plan = null;
      this.todos = [];
      this.events = [];
      this.activePlanId = null;
      return;
    }

    this.plan = loaded.plan;
    this.todos = loaded.todos;
    this.events = loaded.events;
  }

  async createPlan(params: {
    data: StrategicPlanData;
    milestones: Array<{ title: string; description: string; orderIndex: number }>;
    eventData?: Record<string, unknown>;
  }): Promise<number | null> {
    const planService = getPlanService();
    await planService.initialize();

    const created = await planService.createPlan({
      threadId: this.threadId,
      data: params.data,
      todos: params.milestones.map(m => ({
        title: m.title,
        description: m.description,
        orderIndex: m.orderIndex,
        categoryHints: [],
      })),
      eventData: params.eventData,
    });

    if (!created) {
      return null;
    }

    this.activePlanId = created.planId;
    await this.refresh();

    // Internal event for backward compatibility
    this.emitWebSocketPlanUpdate({
      type: 'progress',
      threadId: this.threadId,
      data: { phase: 'plan_created', planId: created.planId, goal: params.data.goal },
    });

    // Emit todo_created events AFTER plan_created
    for (const t of created.todos) {
      this.emitWebSocketPlanUpdate({
        type: 'progress',
        threadId: this.threadId,
        data: {
          phase: 'todo_created',
          planId: created.planId,
          todoId: t.todoId,
          title: t.title,
          orderIndex: t.orderIndex,
          status: 'pending',
        },
      });
    }

    const awareness = getAwarenessService();
    await awareness.initialize();
    await awareness.update({ active_plan_ids: [String(created.planId)] });

    return created.planId;
  }

  async revisePlan(params: {
    planId: number;
    data: StrategicPlanData;
    milestones: Array<{ title: string; description: string; orderIndex: number }>;
    eventData?: Record<string, unknown>;
  }): Promise<{ planId: number; revision: number; todosCreated: Array<{ todoId: number; title: string; orderIndex: number; status: TodoStatus }>; todosUpdated: Array<{ todoId: number; title: string; orderIndex: number; status: TodoStatus }>; todosDeleted: number[] } | null> {
    const planService = getPlanService();
    await planService.initialize();

    const revised = await planService.revisePlan({
      planId: params.planId,
      data: params.data,
      todos: params.milestones.map(m => ({
        title: m.title,
        description: m.description,
        orderIndex: m.orderIndex,
        categoryHints: [],
      })),
      eventData: params.eventData,
    });

    if (!revised) {
      return null;
    }

    this.activePlanId = revised.planId;
    await this.refresh();

    this.emitWebSocketPlanUpdate({
      type: 'progress',
      threadId: this.threadId,
      data: {
        phase: 'plan_revised',
        planId: revised.planId,
        revision: revised.revision,
        goal: params.data.goal,
      },
    });

    for (const t of revised.todosCreated) {
      this.emitWebSocketPlanUpdate({
        type: 'progress',
        threadId: this.threadId,
        data: {
          phase: 'todo_created',
          planId: revised.planId,
          todoId: t.todoId,
          title: t.title,
          orderIndex: t.orderIndex,
          status: t.status,
        },
      });
    }

    for (const t of revised.todosUpdated) {
      this.emitWebSocketPlanUpdate({
        type: 'progress',
        threadId: this.threadId,
        data: {
          phase: 'todo_updated',
          planId: revised.planId,
          todoId: t.todoId,
          title: t.title,
          orderIndex: t.orderIndex,
          status: t.status,
        },
      });
    }

    for (const todoId of revised.todosDeleted) {
      this.emitWebSocketPlanUpdate({
        type: 'progress',
        threadId: this.threadId,
        data: { phase: 'todo_deleted', planId: revised.planId, todoId },
      });
    }

    return { planId: revised.planId, revision: revised.revision, todosCreated: revised.todosCreated, todosUpdated: revised.todosUpdated, todosDeleted: revised.todosDeleted };
  }

  getTodoIdByOrderIndex(orderIndex: number): number | undefined {
    const todo = this.todos.find(t => t.orderIndex === orderIndex);
    return todo?.id;
  }

  async setTodoStatus(params: {
    todoId: number;
    status: TodoStatus;
    title?: string;
    reason?: string;
  }): Promise<boolean> {
    const planId = this.activePlanId;
    if (!planId) {
      return false;
    }

    const planService = getPlanService();
    await planService.initialize();

    const ok = await planService.updateTodoStatus({
      todoId: params.todoId,
      status: params.status,
      eventType: 'todo_status',
      eventData: params.reason ? { status: params.status, reason: params.reason } : { status: params.status },
    });

    if (!ok) {
      return false;
    }

    await this.refresh();

    this.emitWebSocketPlanUpdate({
      type: 'progress',
      threadId: this.threadId,
      data: { phase: 'todo_status', planId, todoId: params.todoId, title: params.title, status: params.status },
    });

    return true;
  }

  async markPlanCompleted(reason: string): Promise<boolean> {
    const planId = this.activePlanId;
    if (!planId) {
      return false;
    }

    const planService = getPlanService();
    await planService.initialize();

    await planService.addPlanEvent(planId, 'plan_completed', { reason });
    await planService.updatePlanStatus(planId, 'completed');

    this.emitWebSocketPlanUpdate({
      type: 'progress',
      threadId: this.threadId,
      data: { phase: 'plan_completed', planId },
    });

    try {
      const awareness = getAwarenessService();
      await awareness.initialize();
      await awareness.update({ active_plan_ids: [] });
    } catch {
      // best effort
    }

    this.activePlanId = null;
    await this.refresh();

    return true;
  }

  hasRemainingTodos(): boolean {
    return this.todos.some(t => t.status === 'pending' || t.status === 'in_progress' || t.status === 'blocked');
  }

  static fromThreadState(state: ThreadState): StrategicStateService {
    const wsConnectionId = (state.metadata.wsConnectionId as string) || 'chat-controller';
    return new StrategicStateService(state.threadId, wsConnectionId);
  }
}
