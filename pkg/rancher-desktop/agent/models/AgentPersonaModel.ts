import { computed, reactive } from 'vue';

import { getWebSocketClientService, type WebSocketMessage } from '@pkg/agent/services/WebSocketClientService';
import type { AgentPersonaRegistry } from '@pkg/agent';
import type { ChatMessage } from '@pkg/agent/registry/AgentPersonaRegistry';

export type PersonaTemplateId =
  | 'terminal'
  | 'industrial'
  | 'biosynthetic'
  | 'glass-core';

export type PersonaStatus = 'online' | 'idle' | 'busy' | 'offline';

export type PersonaEmotion =
  | 'focus'
  | 'industrious'
  | 'curiosity'
  | 'calm'
  | 'mystery'
  | 'joy'
  | 'confidence'
  | 'love'
  | 'anger'
  | 'fear'
  | 'sadness'
  | 'mischief';

export type TodoStatus = 'pending' | 'in_progress' | 'done' | 'blocked';

export type Todo = {
  id: number;
  title: string;
  status: TodoStatus;
  orderIndex: number;
};

export type PlanState = {
  planId: number | null;
  goal: string | null;
  todos: Map<number, Todo>;
  todoOrder: number[];
};

export type AgentPersonaState = {
  agentId: string;
  agentName: string;

  templateId: PersonaTemplateId;
  emotion: PersonaEmotion;

  status: PersonaStatus;

  tokensPerSecond: number;
  temperature: number;
};

export class AgentPersonaService {
  private readonly registry: AgentPersonaRegistry;
  private readonly wsService = getWebSocketClientService();
  private readonly wsUnsubByAgentId = new Map<string, () => void>();

  private readonly showInternalProgress = false;

  // Messages stored locally - persona is source of truth (reactive array)
  readonly messages: ChatMessage[] = reactive([]);

  readonly state = reactive<AgentPersonaState>({
    agentId: 'unit-01',
    agentName: 'UNIT_01',

    templateId: 'glass-core',
    emotion: 'calm',

    status: 'online',

    tokensPerSecond: 847,
    temperature: 0.7,
  });

  // This service represents ONE agent - single plan state
  readonly planState = reactive<PlanState>({
    planId: null,
    goal: null,
    todos: new Map(),
    todoOrder: [],
  });

  readonly emotionClass = computed(() => `persona-profile-${this.state.emotion}`);

  constructor(registry: AgentPersonaRegistry) {
    this.registry = registry;
  }

  startListening(agentIds: string[]): void {
    // Only listen to WebSocket - no global event handler
    for (const agentId of agentIds) {
      if (!agentId || this.wsUnsubByAgentId.has(agentId)) {
        continue;
      }

      this.wsService.connect(agentId);
      const unsub = this.wsService.onMessage(agentId, (msg: WebSocketMessage) => {
        this.handleWebSocketMessage(agentId, msg);
      });

      if (unsub) {
        this.wsUnsubByAgentId.set(agentId, unsub);
      }
    }
  }

  addUserMessage(agentId: string, content: string): boolean {
    if (!content.trim()) {
      return false;
    }

    // Store message locally - persona is source of truth
    this.messages.push({ id: `${Date.now()}_user`, channelId: agentId, role: 'user', content });
    this.registry.setLoading(agentId, true);

    const sent = this.wsService.send(agentId, {
      type: 'user_message',
      payload: {
        role: 'user',
        content,
      },
      timestamp: Date.now(),
    });

    if (!sent) {
      console.warn(`[AgentPersonaService] Failed to send user message on ${agentId}`);
    }

    return sent;
  }

  emitStopSignal(agentId: string): boolean {
    const sent = this.wsService.send(agentId, {
      type: 'stop_run',
      timestamp: Date.now(),
    });

    if (!sent) {
      console.warn(`[AgentPersonaService] Failed to send stop signal on ${agentId}`);
    }

    return sent;
  }

  stopListening(agentIds?: string[]): void {
    // Only disconnect WebSockets - no global event handler to unsubscribe
    const ids = agentIds?.length ? agentIds : [...this.wsUnsubByAgentId.keys()];
    for (const agentId of ids) {
      const unsub = this.wsUnsubByAgentId.get(agentId);
      if (unsub) {
        try {
          unsub();
        } catch {
          // ignore
        }
        this.wsUnsubByAgentId.delete(agentId);
      }
      this.wsService.disconnect(agentId);
    }
  }

  // Plan State Management - this service represents ONE agent
  resetPlan(planId: number, goal: string | null): void {
    this.planState.planId = planId;
    this.planState.goal = goal;
    this.planState.todos.clear();
    this.planState.todoOrder = [];
  }

  upsertTodo(todoId: number, title: string, orderIndex: number, status: TodoStatus): void {
    this.planState.todos.set(todoId, { id: todoId, title, status, orderIndex });
    if (!this.planState.todoOrder.includes(todoId)) {
      this.planState.todoOrder.push(todoId);
    }
    this.sortTodoOrder();
  }

  deleteTodo(todoId: number): void {
    this.planState.todos.delete(todoId);
    this.planState.todoOrder = this.planState.todoOrder.filter(id => id !== todoId);
  }

  updateTodoStatus(todoId: number, status: TodoStatus): void {
    const todo = this.planState.todos.get(todoId);
    if (todo) {
      todo.status = status;
    }
  }

  private sortTodoOrder(): void {
    this.planState.todoOrder.sort((a: number, b: number) => {
      const ta = this.planState.todos.get(a);
      const tb = this.planState.todos.get(b);
      return (ta?.orderIndex ?? 0) - (tb?.orderIndex ?? 0);
    });
  }

  private handleWebSocketMessage(agentId: string, msg: WebSocketMessage): void {
    const payloadPreview = msg.payload
      ? (typeof msg.payload === 'string'
        ? msg.payload.substring(0, 50)
        : JSON.stringify(msg.payload).substring(0, 50))
      : 'undefined';
    console.log('[AgentPersonaModel] WebSocket message received:', msg.type, 'for agent:', agentId, 'payload:', payloadPreview);
    switch (msg.type) {
      case 'chat_message':
      case 'assistant_message':
      case 'user_message':
      case 'system_message': {
        // Store message locally - persona is source of truth
        if (msg.type === 'user_message') {
          console.log('[AgentPersonaModel] Skipping user_message (already stored locally)');
          return;
        }

        if (typeof msg.payload === 'string') {
          const message: ChatMessage = {
            id: `${Date.now()}_ws_${msg.type}`,
            channelId: agentId,
            role: msg.type === 'system_message' ? 'system' : 'assistant',
            content: msg.payload,
          };
          this.messages.push(message);
          console.log('[AgentPersonaModel] Message stored (string payload). Total messages:', this.messages.length, 'Message:', message);
          return;
        }

        const payload = (msg.payload && typeof msg.payload === 'object') ? (msg.payload as any) : null;
        const content = payload?.content !== undefined ? String(payload.content) : '';
        if (!content.trim()) {
          console.log('[AgentPersonaModel] Skipping message - empty content');
          return;
        }

        const roleRaw = payload?.role !== undefined ? String(payload.role) : (msg.type === 'system_message' ? 'system' : 'assistant');
        const role = (roleRaw === 'user' || roleRaw === 'assistant' || roleRaw === 'system' || roleRaw === 'error') ? roleRaw : 'assistant';
        const kind = (typeof payload?.kind === 'string') ? payload.kind : undefined;

        const message: ChatMessage = {
          id: `${Date.now()}_ws_${msg.type}`,
          channelId: agentId,
          role,
          kind,
          content,
        };
        this.messages.push(message);
        console.log('[AgentPersonaModel] Message stored (object payload). Total messages:', this.messages.length, 'Message:', message);
        // Turn off loading when assistant responds
        if (role === 'assistant') {
          this.registry.setLoading(agentId, false);
        }
        return;
      }
      case 'progress':
      case 'plan_update': {
        // Progress and plan_update messages contain plan updates, tool calls, etc.
        const payload = (msg.payload && typeof msg.payload === 'object') ? (msg.payload as any) : null;
        const phase = payload?.phase;
        console.log('[AgentPersonaModel] Progress/plan event:', phase, 'for agent:', agentId, 'type:', msg.type);
        
        // Handle plan-related progress events
        if (phase === 'plan_created' || phase === 'plan_revised' || phase === 'strategic_plan_created') {
          const planId = payload?.planId ? Number(payload.planId) : null;
          const goal = typeof payload?.goal === 'string' ? payload.goal : null;
          if (planId) {
            this.resetPlan(planId, goal);
          }
        }
        
        // Handle todo-related progress events
        if (phase === 'todo_created' || phase === 'todo_updated') {
          const todoId = payload?.todoId ? Number(payload.todoId) : null;
          const title = typeof payload?.title === 'string' ? payload.title : '';
          const orderIndex = payload?.orderIndex !== undefined ? Number(payload.orderIndex) : 0;
          const status = typeof payload?.status === 'string' ? payload.status as TodoStatus : 'pending';
          if (todoId) {
            this.upsertTodo(todoId, title, orderIndex, status);
          }
        }
        
        if (phase === 'todo_status' || phase === 'tactical_step_status') {
          const todoId = payload?.todoId ? Number(payload.todoId) : null;
          const stepId = payload?.stepId ? String(payload.stepId) : null;
          const status = typeof payload?.status === 'string' ? payload.status as TodoStatus : undefined;
          if (todoId && status) {
            this.updateTodoStatus(todoId, status);
          }
          // Log step status updates for debugging
          if (stepId) {
            console.log('[AgentPersonaModel] Step status update:', stepId, status);
          }
        }
        
        return;
      }
      case 'chat_image': {
        // Handle chat image messages from EmitChatImageTool
        const payload = (msg.payload && typeof msg.payload === 'object') ? (msg.payload as any) : null;
        const dataUrl = typeof payload?.dataUrl === 'string' ? payload.dataUrl : '';
        const alt = typeof payload?.alt === 'string' ? payload.alt : '';
        const contentType = typeof payload?.contentType === 'string' ? payload.contentType : '';
        const filePath = typeof payload?.path === 'string' ? payload.path : '';
        
        if (!dataUrl) {
          console.log('[AgentPersonaModel] Skipping chat_image - empty dataUrl');
          return;
        }
        
        const roleRaw = payload?.role !== undefined ? String(payload.role) : 'assistant';
        const role = (roleRaw === 'user' || roleRaw === 'assistant' || roleRaw === 'system' || roleRaw === 'error') ? roleRaw : 'assistant';
        
        const message: ChatMessage = {
          id: `${Date.now()}_ws_chat_image`,
          channelId: agentId,
          role,
          content: '',
          image: {
            dataUrl,
            alt,
            contentType,
            path: filePath,
          },
        };
        this.messages.push(message);
        console.log('[AgentPersonaModel] Chat image stored. Total messages:', this.messages.length);
        
        // Turn off loading when assistant sends image
        if (role === 'assistant') {
          this.registry.setLoading(agentId, false);
        }
        return;
      }
      default:
        console.log('[AgentPersonaModel] Unhandled message type:', msg.type);
    }
  }

  set emotion(value: PersonaEmotion) {
    this.state.emotion = value;
  }

  get emotion(): PersonaEmotion {
    return this.state.emotion;
  }

  set templateId(value: PersonaTemplateId) {
    this.state.templateId = value;
  }

  get templateId(): PersonaTemplateId {
    return this.state.templateId;
  }

  set agentId(value: string) {
    this.state.agentId = value;
  }

  get agentId(): string {
    return this.state.agentId;
  }

  set agentName(value: string) {
    this.state.agentName = value;
  }

  get agentName(): string {
    return this.state.agentName;
  }

  set status(value: PersonaStatus) {
    this.state.status = value;
  }

  get status(): PersonaStatus {
    return this.state.status;
  }

  set tokensPerSecond(value: number) {
    this.state.tokensPerSecond = value;
  }

  get tokensPerSecond(): number {
    return this.state.tokensPerSecond;
  }

  set temperature(value: number) {
    this.state.temperature = value;
  }

  get temperature(): number {
    return this.state.temperature;
  }
}
