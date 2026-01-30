import { getPersistenceService } from './PersistenceService';
import fs from 'fs';
import path from 'path';

export interface AgentAwarenessData {
  agent_identity: string;
  primary_user_identity: string;
  other_user_identities: string;
  long_term_context: string;
  mid_term_context: string;
  short_term_context: string;
  memory_search_hints: string;
  active_plan_ids: string[];
}

export class AwarenessService {
  private initialized = false;
  private data: AgentAwarenessData | null = null;

  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    const persistence = getPersistenceService();
    await persistence.initialize();

    const loaded = await persistence.loadAwareness();

    if (loaded) {
      this.data = this.coerce(loaded);
    } else {
      this.data = this.getDefaultAwareness();
    }

    if (!this.data.agent_identity || this.data.agent_identity.trim().length === 0) {
      this.data.agent_identity = this.readFirstAwarenessPrompt();
    }

    if (!loaded || this.isEffectivelyEmpty(this.data)) {
      await persistence.saveAwareness(this.data as unknown as Record<string, unknown>);
    }

    this.initialized = true;
  }

  isInitialized(): boolean {
    return this.initialized;
  }

  getData(): AgentAwarenessData {
    return this.data || this.getDefaultAwareness();
  }

  get identityPrompt(): string {
    const data = this.getData();
    const lines: string[] = [];

    if (data.agent_identity) {
      lines.push(data.agent_identity.trim());
    }

    if (data.primary_user_identity) {
      lines.push(`Primary user identity: ${data.primary_user_identity.trim()}`);
    }

    if (data.other_user_identities) {
      lines.push(`Other user identities: ${data.other_user_identities.trim()}`);
    }

    if (data.long_term_context) {
      lines.push(`Long-term context: ${data.long_term_context.trim()}`);
    }

    if (data.mid_term_context) {
      lines.push(`Mid-term context: ${data.mid_term_context.trim()}`);
    }

    if (data.short_term_context) {
      lines.push(`Short-term context: ${data.short_term_context.trim()}`);
    }

    if (data.memory_search_hints) {
      lines.push(`Memory search hints: ${data.memory_search_hints.trim()}`);
    }

    return lines.join('\n');
  }

  async save(data: AgentAwarenessData): Promise<void> {
    this.data = data;
    const persistence = getPersistenceService();
    await persistence.saveAwareness(data as unknown as Record<string, unknown>);
  }

  async update(patch: Partial<AgentAwarenessData>): Promise<void> {
    const next = { ...this.getData(), ...patch };
    await this.save(next);
  }

  private getDefaultAwareness(): AgentAwarenessData {
    return {
      agent_identity: '',
      primary_user_identity: '',
      other_user_identities: '',
      long_term_context: '',
      mid_term_context: '',
      short_term_context: '',
      memory_search_hints: '',
      active_plan_ids: [],
    };
  }

  private isEffectivelyEmpty(data: AgentAwarenessData): boolean {
    return [
      data.agent_identity,
      data.primary_user_identity,
      data.other_user_identities,
      data.long_term_context,
      data.mid_term_context,
      data.short_term_context,
      data.memory_search_hints,
      (data.active_plan_ids || []).join(','),
    ].every(v => !v || String(v).trim().length === 0);
  }

  private readFirstAwarenessPrompt(): string {
    try {
      const p = path.join(__dirname, '..', 'prompts', 'soul.md');
      const content = fs.readFileSync(p, 'utf-8');

      return content.trim();
    } catch {
      return 'You are Sulla Desktop. You are Sulla, a desktop assistant that runs as a desktop application using a Kubernetes cluster as your neural network of capabilities and skills.';
    }
  }

  private coerce(raw: Record<string, unknown>): AgentAwarenessData {
    const d = raw as Partial<AgentAwarenessData>;

    const activeRaw = (d as any).active_plan_ids;
    const active = Array.isArray(activeRaw)
      ? activeRaw.map(String).filter(Boolean)
      : [];

    return {
      agent_identity: String(d.agent_identity || this.getDefaultAwareness().agent_identity),
      primary_user_identity: String(d.primary_user_identity || ''),
      other_user_identities: String(d.other_user_identities || ''),
      long_term_context: String(d.long_term_context || ''),
      mid_term_context: String(d.mid_term_context || ''),
      short_term_context: String(d.short_term_context || ''),
      memory_search_hints: String(d.memory_search_hints || ''),
      active_plan_ids: active,
    };
  }
}

let instance: AwarenessService | null = null;

export function getAwarenessService(): AwarenessService {
  if (!instance) {
    instance = new AwarenessService();
  }

  return instance;
}
