import { ref, computed } from 'vue';

import { getAgentPersonaRegistry, type ChatMessage as RegistryChatMessage } from '@pkg/agent';

export type ChatMessage = RegistryChatMessage;

type SidebarTodoStatus = 'pending' | 'in_progress' | 'done' | 'blocked';

type SidebarTodo = {
  key: string;
  title: string;
  status: SidebarTodoStatus;
  statusLabel: string;
};

function normalizeStatus(status: string): SidebarTodoStatus {
  if (status === 'in_progress' || status === 'done' || status === 'blocked') {
    return status;
  }
  return 'pending';
}

function makeStatusLabel(status: SidebarTodoStatus): string {
  switch (status) {
  case 'in_progress':
    return 'In progress';
  case 'done':
    return 'Completed';
  case 'blocked':
    return 'Blocked';
  default:
    return 'Pending';
  }
}

export class ChatInterface {
  private readonly frontendChannelId = 'chat-controller';
  private readonly backendChannelId = 'dreaming-protocol';

  readonly query = ref('');
  readonly transcriptEl = ref<HTMLElement | null>(null);

  private registry = getAgentPersonaRegistry();
  private activeAgentId = ref<string>(this.frontendChannelId);
  private unsubscribeActiveAgent: (() => void) | null = null;

  // Expose active agent ID for UI
  readonly currentAgentId = computed(() => this.activeAgentId.value);

  // Plan state - derived from active agent's persona service
  readonly activePlanId = computed(() => {
    const personaService = this.registry.getActivePersonaService();
    const planId = personaService?.planState.planId ?? null;
    console.log('[ChatInterface] Computing activePlanId:', planId, 'Agent:', personaService?.state.agentId);
    return planId;
  });
  
  readonly activePlanGoal = computed(() => {
    const personaService = this.registry.getActivePersonaService();
    const goal = personaService?.planState.goal ?? null;
    console.log('[ChatInterface] Computing activePlanGoal:', goal?.substring(0, 50), 'Agent:', personaService?.state.agentId);
    return goal;
  });

  readonly activePlanTodos = computed<SidebarTodo[]>(() => {
    const personaService = this.registry.getActivePersonaService();
    if (!personaService) {
      console.log('[ChatInterface] Computing activePlanTodos: no persona service');
      return [];
    }

    const order = personaService.planState.todoOrder;
    const todos = personaService.planState.todos;
    
    console.log('[ChatInterface] Computing activePlanTodos. Order:', order.length, 'Todos map size:', todos.size, 'Agent:', personaService.state.agentId);

    const result = order
      .map((id: number) => {
        const todo = todos.get(id);
        if (!todo) {
          return null;
        }

        return {
          key: String(id),
          title: todo.title,
          status: normalizeStatus(todo.status),
          statusLabel: makeStatusLabel(normalizeStatus(todo.status)),
        };
      })
      .filter((x: SidebarTodo | null): x is SidebarTodo => !!x);
    
    console.log('[ChatInterface] activePlanTodos result:', result.map(t => ({ key: t.key, title: t.title.substring(0, 30), status: t.status })));
    return result;
  });

  // Messages from active agent's persona service
  readonly messages = computed<ChatMessage[]>(() => {
    const personaService = this.registry.getActivePersonaService();
    if (!personaService) {
      console.log('[ChatInterface] No active persona service, returning empty messages');
      return [];
    }
    const msgs = personaService.messages;
    console.log('[ChatInterface] Computing messages from persona. Count:', msgs.length, 'Agent:', personaService.state.agentId);
    return msgs;
  });

  // Graph running state from active agent's persona service
  readonly graphRunning = computed(() => {
    const personaService = this.registry.getActivePersonaService();
    if (!personaService) {
      console.log('[ChatInterface] No active persona service, returning false for graphRunning');
      return false;
    }
    console.log('[ChatInterface] graphRunning value:', personaService.graphRunning.value);
    return personaService.graphRunning.value;
  });

  // Track if user has ever sent a message (persisted in localStorage)
  private readonly hasSentMessageKey = 'chat_has_sent_message';
  private hasSentMessage = ref(localStorage.getItem(this.hasSentMessageKey) === 'true');

  readonly hasMessages = computed(() => {
    // True if user has ever sent a message OR if current session has messages
    return this.hasSentMessage.value || this.messages.value.length > 0;
  });


  constructor() {
    this.unsubscribeActiveAgent = this.registry.onActiveAgentChange((agent) => {
      const newAgentId = agent?.agentId || this.frontendChannelId;
      this.activeAgentId.value = newAgentId;
    });
  }

  private subscribedThreadId: string | null = null;

  /**
   * Clean up event subscriptions
   */
  dispose(): void {
    if (this.unsubscribeActiveAgent) {
      this.unsubscribeActiveAgent();
      this.unsubscribeActiveAgent = null;
    }
  }

  stop(): void {
    const personaService = this.registry.getActivePersonaService();
    if (personaService) {
      personaService.emitStopSignal(personaService.state.agentId);
      this.registry.setLoading(personaService.state.agentId, false);
    }
  }

  async send(): Promise<void> {
    if (!this.query.value.trim()) {
      return;
    }

    const channelId = this.activeAgentId.value;
    const userText = this.query.value;
    this.query.value = '';

    // Mark that user has sent a message (persisted across sessions)
    if (!this.hasSentMessage.value) {
      this.hasSentMessage.value = true;
      localStorage.setItem(this.hasSentMessageKey, 'true');
    }

    const personaService = this.registry.getActivePersonaService();
    if (personaService) {
      personaService.addUserMessage(this.activeAgentId.value, userText);
    }
  }

}
