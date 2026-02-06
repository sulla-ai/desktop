import { computed, reactive, ref } from 'vue';

import { getWebSocketClientService, type WebSocketMessage } from '@pkg/agent/services/WebSocketClientService';
import { AgentPersonaRegistry } from '../registry/AgentPersonaRegistry';
import type { ChatMessage, AgentRegistryEntry } from '../registry/AgentPersonaRegistry';

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

  // Track tool run ID to message ID mapping for updating tool cards
  private readonly toolRunIdToMessageId = new Map<string, string>();

  // Track if graph is currently running
  graphRunning = ref(false);

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

  constructor(registry: AgentPersonaRegistry, agentData?: AgentRegistryEntry) {
    this.registry = registry;
    
    if (agentData) {
      // Populate state from agent data from registry
      this.state.agentId = agentData.agentId;
      this.state.agentName = agentData.agentName;
      this.state.templateId = agentData.templateId;
      this.state.emotion = agentData.emotion;
      this.state.status = agentData.status;
      this.state.tokensPerSecond = agentData.tokensPerSecond;
      this.state.temperature = agentData.temperature;
    }
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
      data: {
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
    const dataPreview = msg.data
      ? (typeof msg.data === 'string'
        ? msg.data.substring(0, 50)
        : JSON.stringify(msg.data).substring(0, 50))
      : 'undefined';

    console.log('[AgentPersonaModel] WebSocket message received:', msg.type, 'for agent:', agentId, 'data:', dataPreview);
    
    switch (msg.type) {
      case 'chat_message':
      case 'assistant_message':
      case 'user_message':
      case 'system_message': {
        this.graphRunning.value = true;
        // Store message locally - persona is source of truth
        if (msg.type === 'user_message') {
          console.log('[AgentPersonaModel] Skipping user_message (already stored locally)');
          return;
        }

        if (typeof msg.data === 'string') {
          const message: ChatMessage = {
            id: `${Date.now()}_ws_${msg.type}`,
            channelId: agentId,
            role: msg.type === 'system_message' ? 'system' : 'assistant',
            content: msg.data,
          };
          this.messages.push(message);
          console.log('[AgentPersonaModel] Message stored (string data). Total messages:', this.messages.length, 'Message:', message);
          return;
        }

        const data = (msg.data && typeof msg.data === 'object') ? (msg.data as any) : null;
        const content = data?.content !== undefined ? String(data.content) : '';
        if (!content.trim()) {
          console.log('[AgentPersonaModel] Skipping message - empty content');
          return;
        }

        const roleRaw = data?.role !== undefined ? String(data.role) : (msg.type === 'system_message' ? 'system' : 'assistant');
        const role = (roleRaw === 'user' || roleRaw === 'assistant' || roleRaw === 'system' || roleRaw === 'error') ? roleRaw : 'assistant';
        const kind = (typeof data?.kind === 'string') ? data.kind : undefined;

        const message: ChatMessage = {
          id: `${Date.now()}_ws_${msg.type}`,
          channelId: agentId,
          role,
          kind,
          content,
        };
        this.messages.push(message);
        console.log('[AgentPersonaModel] Message stored (object data). Total messages:', this.messages.length, 'Message:', message);
        // Turn off loading when assistant responds
        if (role === 'assistant') {
          this.registry.setLoading(agentId, false);
        }
        return;
      }
      case 'progress':
      case 'plan_update': {
        // Progress and plan_update messages contain plan updates, tool calls, etc.
        // StrategicStateService sends: { type: 'progress', threadId, data: { phase, ... } }
        const data = (msg.data && typeof msg.data === 'object') ? (msg.data as any) : null;
        const phase = data?.phase;
        console.log('[AgentPersonaModel] Progress/plan event:', phase, 'for agent:', agentId, 'type:', msg.type);
        
        // Handle plan-related progress events
        if (phase === 'plan_created' || phase === 'plan_revised' || phase === 'strategic_plan_created') {
          const planId = data?.planId ? Number(data.planId) : null;
          const goal = typeof data?.goal === 'string' ? data.goal : null;
          if (planId) {
            this.resetPlan(planId, goal);
            console.log('[AgentPersonaModel] Plan reset. planId:', planId, 'goal:', goal?.substring(0, 50), 'todos count:', this.planState.todos.size);
          }
        }
        
        // Handle todo-related progress events
        if (phase === 'todo_created' || phase === 'todo_updated') {
          const todoId = data?.todoId ? Number(data.todoId) : null;
          const title = typeof data?.title === 'string' ? data.title : '';
          const orderIndex = data?.orderIndex !== undefined ? Number(data.orderIndex) : 0;
          const status = typeof data?.status === 'string' ? data.status as TodoStatus : 'pending';
          if (todoId) {
            this.upsertTodo(todoId, title, orderIndex, status);
          }
        }
        
        if (phase === 'todo_status') {
          const todoId = data?.todoId ? Number(data.todoId) : null;
          const stepId = data?.stepId ? String(data.stepId) : null;
          const status = typeof data?.status === 'string' ? data.status as TodoStatus : undefined;
          if (todoId && status) {
            this.updateTodoStatus(todoId, status);
          }
          // Log step status updates for debugging
          if (stepId) {
            console.log('[AgentPersonaModel] Step status update:', stepId, status);
          }
        }

        // Handle tool_call progress events - create tool card message
        if (phase === 'tool_call') {
          const toolRunId = typeof data?.toolRunId === 'string' ? data.toolRunId : null;
          const toolName = typeof data?.toolName === 'string' ? data.toolName : 'unknown';
          const args = data?.args && typeof data.args === 'object' ? data.args : {};
          
          // Skip tool cards for chat message tools - they emit directly as chat messages
          if (toolName === 'emit_chat_message' || toolName === 'emit_chat_image') {
            return;
          }
          
          if (toolRunId) {
            const messageId = `${Date.now()}_tool_${toolRunId}`;
            const message: ChatMessage = {
              id: messageId,
              channelId: agentId,
              role: 'assistant',
              kind: 'tool',
              content: '',
              toolCard: {
                toolRunId,
                toolName,
                status: 'running',
                args,
              },
            };
            this.messages.push(message);
            this.toolRunIdToMessageId.set(toolRunId, messageId);
            console.log('[AgentPersonaModel] Tool call message created:', toolName, 'messageId:', messageId);
          }
        }

        // Handle tool_result progress events - update tool card status
        if (phase === 'tool_result') {
          const toolRunId = typeof data?.toolRunId === 'string' ? data.toolRunId : null;
          const success = data?.success === true;
          const error = typeof data?.error === 'string' ? data.error : null;
          const result = data?.result;
          
          if (toolRunId) {
            const messageId = this.toolRunIdToMessageId.get(toolRunId);
            if (messageId) {
              const message = this.messages.find(m => m.id === messageId);
              if (message && message.toolCard) {
                message.toolCard.status = success ? 'success' : 'failed';
                message.toolCard.error = error;
                message.toolCard.result = result;
                console.log('[AgentPersonaModel] Tool result updated:', message.toolCard.toolName, 'status:', message.toolCard.status);
              }
              // Clean up the mapping
              this.toolRunIdToMessageId.delete(toolRunId);
            }
          }
        }
        
        return;
      }
      case 'chat_image': {
        const data = (msg.data && typeof msg.data === 'object') ? (msg.data as any) : null;
        
        const src      = typeof data?.src === 'string' ? data.src : '';
        const alt      = typeof data?.alt === 'string' ? data.alt : '';
        const path     = typeof data?.path === 'string' ? data.path : '';
        const isLocal  = data?.isLocal === true;

        if (!src) {
          console.log('[AgentPersonaModel] Skipping chat_image - empty src');
          return;
        }

        const roleRaw = data?.role !== undefined ? String(data.role) : 'assistant';
        const role = (roleRaw === 'user' || roleRaw === 'assistant' || roleRaw === 'system' || roleRaw === 'error') 
          ? roleRaw 
          : 'assistant';

        const message: ChatMessage = {
          id: `${Date.now()}_ws_chat_image`,
          channelId: agentId,
          role,
          content: '',
          image: {
            dataUrl: src,    // Map src to expected dataUrl property
            alt,
            path,
          },
        };

        this.messages.push(message);
        console.log('[AgentPersonaModel] Chat image stored (path/URL mode). src:', src.substring(0, 80));

        if (role === 'assistant') {
          this.registry.setLoading(agentId, false);
        }
        return;
      }
      case 'transfer_data': {
        const data = (msg.data && typeof msg.data === 'object') ? (msg.data as any) : null;
        if (data === 'graph_execution_complete' || data?.content === 'graph_execution_complete') {
          console.log('[AgentPersonaModel] Graph execution complete, setting graphRunning = false');
          this.graphRunning.value = false;
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
