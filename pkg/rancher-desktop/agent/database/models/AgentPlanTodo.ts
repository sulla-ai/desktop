import { BaseModel } from '../BaseModel';
import { AgentPlan } from './AgentPlan';
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

export interface AgentPlanTodoInterface {
  // Properties from getters
  id: string;
  title: string;
  description: string;
  orderIndex: number;
  status: TodoStatus;
  done: boolean;
  
  // Methods from AgentPlanTodo class
  save(): Promise<this>;
  delete(): Promise<boolean>;
  markStatus(status: TodoStatus): Promise<this>;
  setOrderIndex(orderIndex: number): void;
  setTitle(title: string): void;
  setDescription(description: string): void;
  setCategoryHints(hints: string[]): void;
  
  // Instance method (delegates to static)
  findForPlan(planId: number): Promise<AgentPlanTodoInterface[]>;
  
  // Method to get the parent plan
  getParentPlan(): Promise<AgentPlan | null>;
}

export class AgentPlanTodo extends BaseModel<PlanTodoAttributes> implements AgentPlanTodoInterface {
  protected tableName = 'agent_plan_todos';
  protected primaryKey = 'id';
  protected fillable = ['plan_id', 'status', 'order_index', 'title', 'description', 'category_hints'];

  // Interface properties
  get id(): string {
    return this.attributes.id?.toString() || '';
  }

  get title(): string {
    return this.attributes.title || '';
  }

  get description(): string {
    return this.attributes.description || '';
  }

  get orderIndex(): number {
    return this.attributes.order_index || 0;
  }

  get status(): TodoStatus {
    return this.attributes.status || 'pending';
  }

  get done(): boolean {
    return this.attributes.status === 'done';
  }

  // Static method (as instance method for interface)
  async findForPlan(planId: number): Promise<AgentPlanTodoInterface[]> {
    return AgentPlanTodo.findForPlan(planId);
  }

  static async findForPlan(planId: number): Promise<AgentPlanTodo[]> {
    return this.where({ plan_id: planId });
  }

  async getParentPlan(): Promise<AgentPlan | null> {
    if (!this.attributes.plan_id) {
      return null;
    }
    
    const plans = await AgentPlan.where({ id: this.attributes.plan_id });
    return plans[0] ?? null;
  }

  async getwschannel(): Promise<string | false> {
    const plan = await this.getParentPlan();
    if (plan) {
      if (plan.attributes.wschannel) {
        return plan.attributes.wschannel;
      }
    }
    return false;
  }

  async delete(): Promise<boolean> {
    if (!this.exists) return false;

    const planId = this.attributes.plan_id;
    const todoId = this.attributes.id;
    const wschannel = await this.getwschannel();
    
    if (wschannel) {
      // Emit todo deleted event before actual deletion
      getWebSocketClientService().send(wschannel, {
        type: 'progress',
        threadId: 'unknown', // Will be set by service layer
        data: {
          phase: 'todo_deleted',
          planId: planId,
          todoId: todoId,
        },
        timestamp: Date.now()
      });
    }

    const result = await super.delete();
    
    return result;
  }

  async save(): Promise<this> {
    const result = await super.save();
    const wschannel = await this.getwschannel();
    
    if (wschannel) {
      // Emit WebSocket events for todo changes
      if (!this.exists && this.attributes.status === 'pending') {
        // Todo was created
        getWebSocketClientService().send(wschannel, {
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
        getWebSocketClientService().send(wschannel, {
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
        getWebSocketClientService().send(wschannel, {
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