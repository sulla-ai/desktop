import { computed, reactive } from 'vue';

import type { PersonaEmotion, PersonaStatus, PersonaTemplateId } from '@pkg/agent';
import { AgentPersonaService } from '@pkg/agent';
import { getAgentConfig } from '@pkg/agent/services/ConfigService';

export type ChatMessage = {
  id: string;
  channelId: string;
  role: 'user' | 'assistant' | 'error' | 'system';
  content: string;
  kind?: 'text' | 'tool' | 'planner' | 'critic' | 'progress';
  image?: {
    dataUrl: string;
    alt?: string;
    contentType?: string;
    path?: string;
  };
  toolCard?: {
    toolRunId: string;
    toolName: string;
    status: 'running' | 'success' | 'failed';
    args?: Record<string, unknown>;
    result?: unknown;
    error?: string | null;
  };
};

export type AgentRegistryEntry = {
  isRunning: boolean;

  agentId: string;
  agentName: string;

  templateId: PersonaTemplateId;
  emotion: PersonaEmotion;

  status: PersonaStatus;
  tokensPerSecond: number;
  temperature: number;

  messages: ChatMessage[];
  loading: boolean;
};

// Registry of AgentPersonaService instances - manages multiple AI personas
export class AgentPersonaRegistry {
  private readonly backgroundAgentId = 'chat-controller-backend';
  private readonly activeAgentListeners = new Set<(agent: AgentRegistryEntry | undefined) => void>();

  // Per-agent persona services - each service represents ONE agent
  private readonly personaServices = new Map<string, AgentPersonaService>();

  readonly state = reactive<{ agents: AgentRegistryEntry[]; activeAgentId: string }>({
    agents: [
      {
        isRunning: true,
        agentId: 'chat-controller',
        agentName: 'Sulla',
        templateId: 'glass-core',
        emotion: 'calm',
        status: 'online',
        tokensPerSecond: 847,
        temperature: 0.7,
        messages: [],
        loading: false,
      },
      {
        isRunning: getAgentConfig().heartbeatEnabled,
        agentId: 'chat-controller-backend',
        agentName: 'Sysop',
        templateId: 'terminal',
        emotion: 'focus',
        status: 'idle',
        tokensPerSecond: 120,
        temperature: 0.2,
        messages: [],
        loading: false,
      },
    ],
    activeAgentId: 'chat-controller',
  });

  constructor() {
    // Initialize persona services for each agent
    this.state.agents.forEach(agent => {
      this.getOrCreatePersonaService(agent.agentId);
    });
  }

  // Get or create persona service for an agent
  getOrCreatePersonaService(agentId: string): AgentPersonaService {
    if (!this.personaServices.has(agentId)) {
      this.personaServices.set(agentId, new AgentPersonaService(this));
    }
    return this.personaServices.get(agentId)!;
  }

  // Get persona service for active agent
  getActivePersonaService(): AgentPersonaService | undefined {
    const activeAgent = this.activeAgent.value;
    if (!activeAgent) return undefined;
    return this.getOrCreatePersonaService(activeAgent.agentId);
  }

  readonly visibleAgents = computed(() => this.state.agents.filter(a => a.isRunning));

  readonly activeAgent = computed(() => this.state.agents.find(a => a.agentId === this.state.activeAgentId) || this.state.agents[0]);

  // Registry knows which persona is active - personas themselves don't care
  setActiveAgent(agentId: string): void {
    this.state.activeAgentId = agentId;
    this.notifyActiveAgentListeners();
  }

  onActiveAgentChange(listener: (agent: AgentRegistryEntry | undefined) => void): () => void {
    this.activeAgentListeners.add(listener);
    listener(this.activeAgent.value);
    return () => {
      this.activeAgentListeners.delete(listener);
    };
  }

  private notifyActiveAgentListeners(): void {
    const agent = this.activeAgent.value;
    this.activeAgentListeners.forEach(listener => {
      try {
        listener(agent);
      } catch {
        // ignore listener errors
      }
    });
  }

  setAgentRunning(agentId: string, isRunning: boolean): void {
    const agent = this.state.agents.find(a => a.agentId === agentId);
    if (!agent) {
      return;
    }
    agent.isRunning = isRunning;

    if (!isRunning && this.state.activeAgentId === agentId) {
      const next = this.visibleAgents.value[0];
      this.state.activeAgentId = next?.agentId || '';
      this.notifyActiveAgentListeners();
      return;
    }

    if (isRunning && this.state.activeAgentId === '') {
      this.state.activeAgentId = agentId;
      this.notifyActiveAgentListeners();
    }
  }

  pushMessage(agentId: string, message: ChatMessage): void {
    const agent = this.state.agents.find(a => a.agentId === agentId);
    if (agent) {
      agent.messages.push(message);
    }
  }

  setLoading(agentId: string, loading: boolean): void {
    const agent = this.state.agents.find(a => a.agentId === agentId);
    if (agent) {
      agent.loading = loading;
    }
  }

  updateMessage(agentId: string, messageId: string, update: Partial<ChatMessage>): boolean {
    const agent = this.state.agents.find(a => a.agentId === agentId);
    if (!agent) return false;
    const idx = agent.messages.findIndex(m => m.id === messageId);
    if (idx < 0) return false;
    agent.messages[idx] = { ...agent.messages[idx], ...update };
    return true;
  }

  findMessageIndex(agentId: string, messageId: string): number {
    const agent = this.state.agents.find(a => a.agentId === agentId);
    return agent?.messages.findIndex(m => m.id === messageId) ?? -1;
  }

  getMessage(agentId: string, index: number): ChatMessage | undefined {
    const agent = this.state.agents.find(a => a.agentId === agentId);
    return agent?.messages[index];
  }

  setMessage(agentId: string, index: number, message: ChatMessage): void {
    const agent = this.state.agents.find(a => a.agentId === agentId);
    if (agent && index >= 0 && index < agent.messages.length) {
      agent.messages[index] = message;
    }
  }

  isLoading(agentId: string): boolean {
    const agent = this.state.agents.find(a => a.agentId === agentId);
    return agent?.loading ?? false;
  }

  setHeartbeatEnabled(enabled: boolean): void {
    this.setAgentRunning(this.backgroundAgentId, enabled);
  }

  upsertAgent(agent: AgentRegistryEntry): void {
    const idx = this.state.agents.findIndex(a => a.agentId === agent.agentId);
    if (idx >= 0) {
      this.state.agents[idx] = agent;
      return;
    }
    this.state.agents.push(agent);
  }

  removeAgent(agentId: string): void {
    const idx = this.state.agents.findIndex(a => a.agentId === agentId);
    if (idx < 0) {
      return;
    }
    this.state.agents.splice(idx, 1);
    if (this.state.activeAgentId === agentId) {
      this.state.activeAgentId = this.state.agents[0]?.agentId || '';
      this.notifyActiveAgentListeners();
    }
  }
}

let instance: AgentPersonaRegistry | null = null;

export function getAgentPersonaRegistry(): AgentPersonaRegistry {
  if (!instance) {
    instance = new AgentPersonaRegistry();
  }
  return instance;
}
