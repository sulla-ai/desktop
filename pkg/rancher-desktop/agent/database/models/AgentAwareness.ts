// src/models/AgentAwareness.ts

import { BaseModel } from '../BaseModel';

export class AgentAwareness extends BaseModel<{
  id: number;           // always 1
  data: Record<string, any>;
  updated_at?: string;
}> {
  protected tableName = 'agent_awareness';
  protected primaryKey = 'id';
  protected fillable = ['data']; // only data is mutable

  constructor(attributes: Partial<{ id: number; data: Record<string, any>; updated_at?: string }> = {}) {
    super({ ...attributes, id: 1 });
  }

  static async load(): Promise<AgentAwareness | null> {
    return this.find(1);
  }

  get data(): Record<string, any> {
    return this.attributes.data ?? {};
  }

  async updateData(patch: Partial<Record<string, any>>): Promise<this> {
    const current = this.data;
    this.attributes.data = { ...current, ...patch };
    return this.save();
  }

  async replaceData(data: Record<string, any>): Promise<this> {
    this.attributes.data = { ...data };
    return this.save();
  }

  // Convenience setters
  async setEmotionalState(state: string): Promise<this> {
    return this.updateData({ emotional_state: state.trim() });
  }

  async setActiveProjects(projects: string[]): Promise<this> {
    return this.updateData({ active_projects: projects });
  }

  async setGoals(goals: string[]): Promise<this> {
    return this.updateData({ goals });
  }
}