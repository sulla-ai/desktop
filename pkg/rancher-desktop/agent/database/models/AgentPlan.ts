// src/models/AgentPlan.ts

import { BaseModel } from '../BaseModel';
import { AgentPlanTodo, AgentPlanTodoInterface } from './AgentPlanTodo';
import { getWebSocketClientService } from '../../services/WebSocketClientService';

export type PlanStatus = 'active' | 'completed' | 'abandoned';

export interface PlanAttributes {
  id?: number;
  thread_id: string;
  revision?: number;
  status?: PlanStatus;
  goal: string;
  goaldescription: string;
  complexity: 'simple' | 'moderate' | 'complex';
  requirestools: boolean;
  wschannel: string;
  created_at?: string;
  updated_at?: string;
}

export interface AgentPlanInterface {
  attributes: Partial<PlanAttributes>;

  setStatus(status: PlanStatus): void;
  setRevision(revision: number): void;
  incrementRevision(): Promise<this>;
  save(): Promise<this>;
  delete(): Promise<boolean>;
  deleteAllTodos(): Promise<number>;
  fill(attributes: Partial<PlanAttributes>): void;
}

export class AgentPlan extends BaseModel<PlanAttributes> {
  protected tableName = 'agent_plans';
  protected primaryKey = 'id';

  // Explicit fillable – required for mass assignment
  public fillable = ['thread_id', 'revision', 'status', 'goal', 'goaldescription', 'complexity', 'requirestools', 'wschannel'];
  public attributes: Partial<PlanAttributes> = {};

  // Guard everything else
  protected guarded = ['id', 'created_at', 'updated_at'];

  static async findActiveForThread(threadId: string): Promise<AgentPlan | null> {
    const results = await this.where({ thread_id: threadId, status: 'active' });
    return results[0] ?? null;
  }

  async incrementRevision(): Promise<this> {
    this.attributes.revision = (this.attributes.revision || 1) + 1;
    return this.save();
  }

  setRevision(revision: number): void {
    this.attributes.revision = revision;
  }

  setStatus(status: PlanStatus): void {
    this.attributes.status = status;
  }

  async save(): Promise<this> {
    const result = await super.save();

    const threadId = this.attributes.thread_id;
    const planId = this.id;

    if (this.attributes.wschannel){
      if (this.attributes.status === 'active') {
        getWebSocketClientService().send(this.attributes.wschannel, {
          type: 'progress',
          threadId,
          data: { phase: 'plan_created', planId, goal: (this.attributes as any)?.goal },
          timestamp: Date.now()
        });
      } else if (this.attributes.status === 'completed') {
        getWebSocketClientService().send(this.attributes.wschannel, {
          type: 'progress',
          threadId,
          data: { phase: 'plan_completed', planId },
          timestamp: Date.now()
        });
      } else if (Number(this.attributes.revision) > 1) {
        getWebSocketClientService().send(this.attributes.wschannel, {
          type: 'progress',
          threadId,
          data: { phase: 'plan_revised', planId, revision: this.attributes.revision, goal: (this.attributes as any)?.goal },
          timestamp: Date.now()
        });
      }
    }

    return result;
  }

  async delete(): Promise<boolean> {
    const planId = this.id;
    const threadId = this.attributes.thread_id;

    if (this.attributes.wschannel){
      getWebSocketClientService().send(this.attributes.wschannel, {
        type: 'progress',
        threadId,
        data: { phase: 'plan_deleted', planId },
        timestamp: Date.now()
      });
    }

    return super.delete();
  }

  /**
   * Load all AgentPlanTodo records for this plan and delete them all
   * @returns Promise<number> - Number of todos deleted
   */
  async deleteAllTodos(): Promise<number> {
    if (!this.attributes.id) {
      return 0;
    }
    
    const todos = await AgentPlanTodo.findForPlan(this.attributes.id);
    let deletedCount = 0;
    
    for (const todo of todos) {
      await todo.delete();
      deletedCount++;
    }
    
    return deletedCount;
  }
}