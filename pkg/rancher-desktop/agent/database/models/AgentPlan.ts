// src/models/AgentPlan.ts

import { BaseModel } from '../BaseModel';
import { getWebSocketClientService } from '../../services/WebSocketClientService';

export type PlanStatus = 'active' | 'completed' | 'abandoned';

export interface PlanAttributes {
  id?: number;
  thread_id: string;
  revision?: number;
  status?: PlanStatus;
  data: Record<string, unknown>;
  created_at?: string;
  updated_at?: string;
}

export class AgentPlan extends BaseModel<PlanAttributes> {
  protected tableName = 'agent_plans';
  protected primaryKey = 'id';

  // Explicit fillable – required for mass assignment
  public fillable = ['thread_id', 'revision', 'status', 'data'];
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

  setData(data: Record<string, unknown>): void {
    this.attributes.data = data;
  }

  setStatus(status: PlanStatus): void {
    this.attributes.status = status;
  }

  async save(): Promise<this> {
    const result = await super.save();

    const threadId = this.attributes.thread_id;
    const planId = this.id;

    if (!this.exists && this.attributes.status === 'active') {
      getWebSocketClientService().send('chat-controller-backend', {
        type: 'progress',
        threadId,
        data: { phase: 'plan_created', planId, goal: (this.attributes.data as any)?.goal },
        timestamp: Date.now()
      });
    } else if (this.exists && this.attributes.status === 'completed') {
      getWebSocketClientService().send('chat-controller-backend', {
        type: 'progress',
        threadId,
        data: { phase: 'plan_completed', planId },
        timestamp: Date.now()
      });
    } else if (this.exists && Number(this.attributes.revision) > 1) {
      getWebSocketClientService().send('chat-controller-backend', {
        type: 'progress',
        threadId,
        data: { phase: 'plan_revised', planId, revision: this.attributes.revision, goal: (this.attributes.data as any)?.goal },
        timestamp: Date.now()
      });
    }

    return result;
  }

  async delete(): Promise<boolean> {
    const planId = this.id;
    const threadId = this.attributes.thread_id;

    getWebSocketClientService().send('chat-controller-backend', {
      type: 'progress',
      threadId,
      data: { phase: 'plan_deleted', planId },
      timestamp: Date.now()
    });

    return super.delete();
  }
}