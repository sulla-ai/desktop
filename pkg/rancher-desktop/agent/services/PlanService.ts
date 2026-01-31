import pg from 'pg';
import { getPersistenceService } from './PersistenceService';

const POSTGRES_URL = 'postgresql://sulla:sulla_dev_password@127.0.0.1:30116/sulla';

export type PlanStatus = 'active' | 'completed' | 'abandoned';
export type TodoStatus = 'pending' | 'in_progress' | 'done' | 'blocked';

export interface PlanRecord {
  id: number;
  threadId: string;
  revision: number;
  status: PlanStatus;
  data: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface PlanTodoRecord {
  id: number;
  planId: number;
  status: TodoStatus;
  orderIndex: number;
  title: string;
  description: string;
  categoryHints: string[];
  createdAt: string;
  updatedAt: string;
}

export interface PlanEventRecord {
  id: number;
  planId: number;
  type: string;
  data: Record<string, unknown>;
  createdAt: string;
}

export class PlanService {
  private initialized = false;

  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    const persistence = getPersistenceService();
    await persistence.initialize();

    await this.ensureTables();
    this.initialized = true;
  }

  private async ensureTables(): Promise<void> {
    const client = new pg.Client({ connectionString: POSTGRES_URL });
    await client.connect();

    try {
      await client.query(`
        CREATE TABLE IF NOT EXISTS agent_plans (
          id SERIAL PRIMARY KEY,
          thread_id VARCHAR(255) NOT NULL,
          revision INTEGER NOT NULL DEFAULT 1,
          status VARCHAR(32) NOT NULL DEFAULT 'active',
          data JSONB NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);

      await client.query(`
        CREATE TABLE IF NOT EXISTS agent_plan_todos (
          id SERIAL PRIMARY KEY,
          plan_id INTEGER NOT NULL REFERENCES agent_plans(id) ON DELETE CASCADE,
          status VARCHAR(32) NOT NULL DEFAULT 'pending',
          order_index INTEGER NOT NULL DEFAULT 0,
          title TEXT NOT NULL,
          description TEXT NOT NULL,
          category_hints JSONB NOT NULL DEFAULT '[]'::jsonb,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);

      await client.query(`
        CREATE TABLE IF NOT EXISTS agent_plan_events (
          id SERIAL PRIMARY KEY,
          plan_id INTEGER NOT NULL REFERENCES agent_plans(id) ON DELETE CASCADE,
          type VARCHAR(64) NOT NULL,
          data JSONB NOT NULL DEFAULT '{}'::jsonb,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);

      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_agent_plans_thread_id ON agent_plans(thread_id)
      `);
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_agent_plan_todos_plan_id ON agent_plan_todos(plan_id)
      `);
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_agent_plan_events_plan_id ON agent_plan_events(plan_id)
      `);
    } finally {
      await client.end();
    }
  }

  async createPlan(params: {
    threadId: string;
    data: Record<string, unknown>;
    todos: Array<{ title: string; description: string; orderIndex: number; categoryHints?: string[] }>;
    eventData?: Record<string, unknown>;
  }): Promise<{ planId: number; todos: Array<{ todoId: number; title: string; orderIndex: number }> } | null> {
    await this.initialize();

    const client = new pg.Client({ connectionString: POSTGRES_URL });
    await client.connect();

    try {
      await client.query('BEGIN');

      const planRes = await client.query(
        `INSERT INTO agent_plans (thread_id, revision, status, data, updated_at)
         VALUES ($1, 1, 'active', $2, CURRENT_TIMESTAMP)
         RETURNING id`,
        [params.threadId, JSON.stringify(params.data)],
      );

      const planId = Number(planRes.rows[0].id);

      const createdTodos: Array<{ todoId: number; title: string; orderIndex: number }> = [];

      for (const todo of params.todos) {
        const todoRes = await client.query(
          `INSERT INTO agent_plan_todos (plan_id, status, order_index, title, description, category_hints, updated_at)
           VALUES ($1, 'pending', $2, $3, $4, $5, CURRENT_TIMESTAMP)
           RETURNING id`,
          [planId, todo.orderIndex, todo.title, todo.description, JSON.stringify(todo.categoryHints || [])],
        );

        const todoId = Number(todoRes.rows[0].id);
        createdTodos.push({ todoId, title: todo.title, orderIndex: todo.orderIndex });

        console.log(`[PlanService] createPlan inserted todo: planId=${planId} orderIndex=${todo.orderIndex} title=${JSON.stringify(todo.title)}`);
      }

      console.log(`[PlanService] createPlan inserted ${params.todos.length} todos for planId=${planId}`);

      await client.query(
        `INSERT INTO agent_plan_events (plan_id, type, data)
         VALUES ($1, 'created', $2)`,
        [planId, JSON.stringify(params.eventData || {})],
      );

      await client.query('COMMIT');
      return { planId, todos: createdTodos };
    } catch (err) {
      await client.query('ROLLBACK');
      console.warn('[PlanService] createPlan failed:', err);
      return null;
    } finally {
      await client.end();
    }
  }

  async revisePlan(params: {
    planId: number;
    data: Record<string, unknown>;
    todos: Array<{ title: string; description: string; orderIndex: number; categoryHints?: string[] }>;
    eventData?: Record<string, unknown>;
  }): Promise<{ planId: number; revision: number; todosCreated: Array<{ todoId: number; title: string; orderIndex: number; status: TodoStatus }>; todosUpdated: Array<{ todoId: number; title: string; orderIndex: number; status: TodoStatus }>; todosDeleted: number[] } | null> {
    await this.initialize();

    const client = new pg.Client({ connectionString: POSTGRES_URL });
    await client.connect();

    try {
      await client.query('BEGIN');

      const priorTodosRes = await client.query(
        `SELECT id, status, order_index, title
         FROM agent_plan_todos
         WHERE plan_id = $1`,
        [params.planId],
      );
      const priorTodos: Array<{ id: number; status: TodoStatus; orderIndex: number; title: string }> = priorTodosRes.rows.map((r: any) => ({
        id: Number(r.id),
        status: r.status as TodoStatus,
        orderIndex: Number(r.order_index),
        title: String(r.title),
      }));

      // Match rule for status/ID preservation:
      // 1) Prefer matching by exact title (stable across revisions)
      // 2) Fallback to order_index + title when titles are duplicated
      const normalizeTitle = (title: string) => String(title || '').trim();
      const matchKey = (orderIndex: number, title: string) => `${orderIndex}::${normalizeTitle(title)}`;

      const priorByKey = new Map<string, { id: number; status: TodoStatus; orderIndex: number; title: string }>();
      const priorByTitle = new Map<string, Array<{ id: number; status: TodoStatus; orderIndex: number; title: string }>>();

      for (const t of priorTodos) {
        priorByKey.set(matchKey(t.orderIndex, t.title), t);
        const key = normalizeTitle(t.title);
        const list = priorByTitle.get(key) || [];
        list.push(t);
        priorByTitle.set(key, list);
      }

      const updateRes = await client.query(
        `UPDATE agent_plans
         SET revision = revision + 1, data = $2, updated_at = CURRENT_TIMESTAMP
         WHERE id = $1
         RETURNING revision`,
        [params.planId, JSON.stringify(params.data)],
      );

      if (updateRes.rows.length === 0) {
        await client.query('ROLLBACK');
        return null;
      }

      const revision = Number(updateRes.rows[0].revision);

      const usedPriorIds = new Set<number>();
      const todosCreated: Array<{ todoId: number; title: string; orderIndex: number; status: TodoStatus }> = [];
      const todosUpdated: Array<{ todoId: number; title: string; orderIndex: number; status: TodoStatus }> = [];

      for (const todo of params.todos) {
        const titleKey = normalizeTitle(todo.title);
        const key = matchKey(todo.orderIndex, todo.title);
        const byTitle = (priorByTitle.get(titleKey) || []).filter(t => !usedPriorIds.has(t.id));
        const match = byTitle.length === 1
          ? byTitle[0]
          : (priorByKey.get(key) && !usedPriorIds.has(priorByKey.get(key)!.id) ? priorByKey.get(key)! : undefined);

        if (match) {
          usedPriorIds.add(match.id);
          await client.query(
            `UPDATE agent_plan_todos
             SET order_index = $2, title = $3, description = $4, category_hints = $5, updated_at = CURRENT_TIMESTAMP
             WHERE id = $1`,
            [match.id, todo.orderIndex, todo.title, todo.description, JSON.stringify(todo.categoryHints || [])],
          );
          todosUpdated.push({ todoId: match.id, title: todo.title, orderIndex: todo.orderIndex, status: match.status });
          continue;
        }

        const todoRes = await client.query(
          `INSERT INTO agent_plan_todos (plan_id, status, order_index, title, description, category_hints, updated_at)
           VALUES ($1, 'pending', $2, $3, $4, $5, CURRENT_TIMESTAMP)
           RETURNING id, status`,
          [params.planId, todo.orderIndex, todo.title, todo.description, JSON.stringify(todo.categoryHints || [])],
        );
        const todoId = Number(todoRes.rows[0].id);
        const status = todoRes.rows[0].status as TodoStatus;
        todosCreated.push({ todoId, title: todo.title, orderIndex: todo.orderIndex, status });
      }

      // Never delete completed todos; final-critic revisions are allowed to add new todos without resetting history.
      const todosDeleted = priorTodos
        .filter(t => !usedPriorIds.has(t.id) && t.status !== 'done')
        .map(t => t.id);
      if (todosDeleted.length > 0) {
        await client.query(
          `DELETE FROM agent_plan_todos
           WHERE id = ANY($1::int[])`,
          [todosDeleted],
        );
      }

      await client.query(
        `INSERT INTO agent_plan_events (plan_id, type, data)
         VALUES ($1, 'revised', $2)`,
        [params.planId, JSON.stringify(params.eventData || {})],
      );

      await client.query('COMMIT');
      return { planId: params.planId, revision, todosCreated, todosUpdated, todosDeleted };
    } catch (err) {
      await client.query('ROLLBACK');
      console.warn('[PlanService] revisePlan failed:', err);
      return null;
    } finally {
      await client.end();
    }
  }

  async getPlan(planId: number): Promise<{ plan: PlanRecord; todos: PlanTodoRecord[]; events: PlanEventRecord[] } | null> {
    await this.initialize();

    const client = new pg.Client({ connectionString: POSTGRES_URL });
    await client.connect();

    try {
      const planRes = await client.query(
        `SELECT id, thread_id, revision, status, data, created_at, updated_at
         FROM agent_plans
         WHERE id = $1`,
        [planId],
      );

      if (planRes.rows.length === 0) {
        return null;
      }

      const planRow = planRes.rows[0];
      const plan: PlanRecord = {
        id: Number(planRow.id),
        threadId: String(planRow.thread_id),
        revision: Number(planRow.revision),
        status: planRow.status as PlanStatus,
        data: (planRow.data || {}) as Record<string, unknown>,
        createdAt: String(planRow.created_at),
        updatedAt: String(planRow.updated_at),
      };

      const todosRes = await client.query(
        `SELECT id, plan_id, status, order_index, title, description, category_hints, created_at, updated_at
         FROM agent_plan_todos
         WHERE plan_id = $1
         ORDER BY order_index ASC, id ASC`,
        [planId],
      );

      const todos: PlanTodoRecord[] = todosRes.rows.map((r: any) => ({
        id: Number(r.id),
        planId: Number(r.plan_id),
        status: r.status as TodoStatus,
        orderIndex: Number(r.order_index),
        title: String(r.title),
        description: String(r.description),
        categoryHints: Array.isArray(r.category_hints) ? r.category_hints.map(String) : [],
        createdAt: String(r.created_at),
        updatedAt: String(r.updated_at),
      }));

      const eventsRes = await client.query(
        `SELECT id, plan_id, type, data, created_at
         FROM agent_plan_events
         WHERE plan_id = $1
         ORDER BY id ASC`,
        [planId],
      );

      const events: PlanEventRecord[] = eventsRes.rows.map((r: any) => ({
        id: Number(r.id),
        planId: Number(r.plan_id),
        type: String(r.type),
        data: (r.data || {}) as Record<string, unknown>,
        createdAt: String(r.created_at),
      }));

      return { plan, todos, events };
    } catch (err) {
      console.warn('[PlanService] getPlan failed:', err);
      return null;
    } finally {
      await client.end();
    }
  }

  async getActivePlanIdForThread(threadId: string): Promise<number | null> {
    await this.initialize();

    const client = new pg.Client({ connectionString: POSTGRES_URL });
    await client.connect();

    try {
      const res = await client.query(
        `SELECT id
         FROM agent_plans
         WHERE thread_id = $1 AND status = 'active'
         ORDER BY id DESC
         LIMIT 1`,
        [threadId],
      );

      if (res.rows.length === 0) {
        return null;
      }

      return Number(res.rows[0].id);
    } catch (err) {
      console.warn('[PlanService] getActivePlanIdForThread failed:', err);
      return null;
    } finally {
      await client.end();
    }
  }

  async updatePlanStatus(planId: number, status: PlanStatus): Promise<boolean> {
    await this.initialize();

    const client = new pg.Client({ connectionString: POSTGRES_URL });
    await client.connect();

    try {
      await client.query(
        `UPDATE agent_plans
         SET status = $2, updated_at = CURRENT_TIMESTAMP
         WHERE id = $1`,
        [planId, status],
      );

      return true;
    } catch (err) {
      console.warn('[PlanService] updatePlanStatus failed:', err);
      return false;
    } finally {
      await client.end();
    }
  }

  async updateTodoStatus(params: {
    todoId: number;
    status: TodoStatus;
    eventType?: string;
    eventData?: Record<string, unknown>;
  }): Promise<boolean> {
    await this.initialize();

    const client = new pg.Client({ connectionString: POSTGRES_URL });
    await client.connect();

    try {
      await client.query('BEGIN');

      const todoRes = await client.query(
        `UPDATE agent_plan_todos
         SET status = $2, updated_at = CURRENT_TIMESTAMP
         WHERE id = $1
         RETURNING plan_id`,
        [params.todoId, params.status],
      );

      if (todoRes.rows.length === 0) {
        await client.query('ROLLBACK');
        return false;
      }

      const planId = Number(todoRes.rows[0].plan_id);

      if (params.eventType) {
        await client.query(
          `INSERT INTO agent_plan_events (plan_id, type, data)
           VALUES ($1, $2, $3)`,
          [planId, params.eventType, JSON.stringify(params.eventData || {})],
        );
      }

      await client.query('COMMIT');
      return true;
    } catch (err) {
      await client.query('ROLLBACK');
      console.warn('[PlanService] updateTodoStatus failed:', err);
      return false;
    } finally {
      await client.end();
    }
  }

  async addPlanEvent(planId: number, type: string, data: Record<string, unknown> = {}): Promise<boolean> {
    await this.initialize();

    const client = new pg.Client({ connectionString: POSTGRES_URL });
    await client.connect();

    try {
      await client.query(
        `INSERT INTO agent_plan_events (plan_id, type, data)
         VALUES ($1, $2, $3)`,
        [planId, type, JSON.stringify(data)],
      );

      return true;
    } catch (err) {
      console.warn('[PlanService] addPlanEvent failed:', err);
      return false;
    } finally {
      await client.end();
    }
  }
}

let service: PlanService | null = null;

export function getPlanService(): PlanService {
  if (!service) {
    service = new PlanService();
  }
  return service;
}
