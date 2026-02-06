import { BaseModel } from '../BaseModel';
import { getWebSocketClientService } from '../../services/WebSocketClientService';

export type TodoStatus = 'pending' | 'in_progress' | 'done' | 'blocked';

export interface PlanTodoAttributes {
  id?: number;
  plan_id: number;
  status?: TodoStatus;
  order_index?: number;
  title: string;
  description: string;
  category_hints?: string[];
  created_at?: string;
  updated_at?: string;
}

export class AgentPlanTodo extends BaseModel<PlanTodoAttributes> {
  protected tableName = 'agent_plan_todos';
  protected primaryKey = 'id';
  protected fillable = ['plan_id', 'status', 'order_index', 'title', 'description', 'category_hints'];

  static async findForPlan(planId: number): Promise<AgentPlanTodo[]> {
    return this.where({ plan_id: planId });
  }

  async delete(): Promise<boolean> {
    if (!this.exists) return false;

    const planId = this.attributes.plan_id;
    const todoId = this.attributes.id;
    
    // Emit todo deleted event before actual deletion
    getWebSocketClientService().send('chat-controller-backend', {
      type: 'progress',
      threadId: 'unknown', // Will be set by service layer
      data: {
        phase: 'todo_deleted',
        planId: planId,
        todoId: todoId,
      },
      timestamp: Date.now()
    });

    const result = await super.delete();
    
    return result;
  }

  async save(): Promise<this> {
    const result = await super.save();
    
    // Emit WebSocket events for todo changes
    if (!this.exists && this.attributes.status === 'pending') {
      // Todo was created
      getWebSocketClientService().send('chat-controller-backend', {
        type: 'progress',
        threadId: 'unknown', // Will be set by service layer
        data: {
          phase: 'todo_created',
          planId: this.attributes.plan_id,
          todoId: this.attributes.id,
          title: this.attributes.title,
          orderIndex: this.attributes.order_index,
          status: 'pending',
        },
        timestamp: Date.now()
      });
    } else if (this.exists && this.attributes.status === 'done') {
      // Todo was completed
      getWebSocketClientService().send('chat-controller-backend', {
        type: 'progress',
        threadId: 'unknown', // Will be set by service layer
        data: {
          phase: 'todo_completed',
          planId: this.attributes.plan_id,
          todoId: this.attributes.id,
          title: this.attributes.title,
          orderIndex: this.attributes.order_index,
          status: 'done',
        },
        timestamp: Date.now()
      });
    } else if (this.exists) {
      // Todo was updated
      getWebSocketClientService().send('chat-controller-backend', {
        type: 'progress',
        threadId: 'unknown', // Will be set by service layer
        data: {
          phase: 'todo_updated',
          planId: this.attributes.plan_id,
          todoId: this.attributes.id,
          title: this.attributes.title,
          orderIndex: this.attributes.order_index,
          status: this.attributes.status,
        },
        timestamp: Date.now()
      });
    }
    
    return result;
  }

  async markStatus(status: TodoStatus): Promise<this> {
    this.attributes.status = status;
    return this.save();
  }

  setOrderIndex(orderIndex: number): void {
    this.attributes.order_index = orderIndex;
  }

  setTitle(title: string): void {
    this.attributes.title = title;
  }

  setDescription(description: string): void {
    this.attributes.description = description;
  }

  setCategoryHints(hints: string[]): void {
    this.attributes.category_hints = hints;
  }
}