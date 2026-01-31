import { computed, nextTick, ref } from 'vue';
import type { ComputedRef, Ref } from 'vue';

import type { ConversationThread } from '@pkg/agent/ConversationThread';
import type { AgentResponse, SensoryInput, ThreadContext } from '@pkg/agent/types';

import type { StartupProgressController } from './StartupProgressController';

export type ChatMessage = {
  id: string;
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

export class AgentChatController {
  readonly query = ref('');
  readonly loading = ref(false);
  readonly messages = ref<ChatMessage[]>([]);
  readonly transcriptEl = ref<HTMLElement | null>(null);
  readonly hasMessages: ComputedRef<boolean> = computed(() => this.messages.value.length > 0);

  private readonly showInternalProgress = false;
  // !!((import.meta as any)?.env?.DEV ?? (typeof process !== 'undefined' && (process as any)?.env?.NODE_ENV !== 'production'));

  private readonly pendingPrompts: string[] = [];
  private drainingQueue = false;

  private readonly toolCardsByRunId = new Map<string, string>();

  private autoScrollEnabled = true;
  private scrollListenerAttached = false;
  private readonly autoScrollThresholdPx = 140;

  constructor(private readonly deps: {
    systemReady: Ref<boolean>;
    currentThreadId: Ref<string | null>;

    sensory: { createTextInput: (text: string) => SensoryInput };
    contextDetector: { detect: (input: SensoryInput, threadId?: string) => Promise<ThreadContext> };
    getThread: (threadId: string) => ConversationThread;
    responseHandler: {
      hasErrors: (resp: AgentResponse) => boolean;
      getError: (resp: AgentResponse) => string | null | undefined;
      formatText: (resp: AgentResponse) => string | undefined;
    };

    onAgentResponse?: (resp: AgentResponse) => void;

    onAgentEvent?: (event: { type: string; threadId: string; data: any; timestamp: number }) => void;

    startupProgress: StartupProgressController;
  }) {
  }

  private subscribedThreadId: string | null = null;

  private ensureThreadEventSubscription(threadId: string): void {
    if (this.subscribedThreadId === threadId) {
      return;
    }
    this.subscribedThreadId = threadId;

    const thread = this.deps.getThread(threadId);
    thread.onEvent((event) => {
      this.deps.onAgentEvent?.(event as any);
      this.handleAgentEvent(event as any);
    });
  }

  private handleAgentEvent(event: { type: string; threadId: string; data: any; timestamp: number }) {
    if (event.type !== 'progress') {
      return;
    }

    const phase = event.data?.phase;
    if (!phase) {
      return;
    }

    if (!this.showInternalProgress && (phase === 'plan_created' || phase === 'plan_revised' || phase === 'todo_created' || phase === 'todo_updated' || phase === 'todo_deleted' || phase === 'todo_status')) {
      return;
    }

    if (phase === 'plan_created' || phase === 'plan_revised') {
      const planId = Number(event.data.planId);
      const revision = event.data.revision !== undefined ? Number(event.data.revision) : null;
      const goal = typeof event.data.goal === 'string' ? event.data.goal : '';
      const label = phase === 'plan_created' ? 'Plan created' : 'Plan revised';
      const lines = [
        `${label}${Number.isFinite(planId) ? ` (id=${planId}${revision !== null && Number.isFinite(revision) ? ` rev=${revision}` : ''})` : ''}`,
        goal ? `Goal: ${goal}` : null,
      ].filter(Boolean).join('\n');
      this.messages.value.push({ id: `${Date.now()}_${phase}`, role: 'system', kind: 'planner', content: lines });
      this.maybeAutoScroll();
      return;
    }

    if (phase === 'chat_image') {
      const role = String(event.data.role || 'assistant');
      const dataUrl = typeof event.data.dataUrl === 'string' ? String(event.data.dataUrl) : '';
      const alt = typeof event.data.alt === 'string' ? String(event.data.alt) : '';
      const contentType = typeof event.data.contentType === 'string' ? String(event.data.contentType) : '';
      const filePath = typeof event.data.path === 'string' ? String(event.data.path) : '';

      if (!dataUrl.trim()) {
        return;
      }

      if (role === 'assistant') {
        this.messages.value.push({
          id: `${Date.now()}_chat_image`,
          role: 'assistant',
          content: '',
          image: { dataUrl, alt, contentType, path: filePath },
        });
      } else {
        const kind = (typeof event.data.kind === 'string' ? (event.data.kind as any) : 'progress');
        this.messages.value.push({
          id: `${Date.now()}_chat_image`,
          role: 'system',
          kind,
          content: '',
          image: { dataUrl, alt, contentType, path: filePath },
        });
      }
      this.maybeAutoScroll();
      return;
    }

    if (phase === 'todo_created') {
      const planId = Number(event.data.planId);
      const todoId = Number(event.data.todoId);
      const title = typeof event.data.title === 'string' ? event.data.title : '';
      const orderIndex = event.data.orderIndex !== undefined ? Number(event.data.orderIndex) : null;
      this.messages.value.push({
        id: `${Date.now()}_todo_created_${todoId}`,
        role: 'system',
        kind: 'planner',
        content: `Todo created (plan=${planId} todo=${todoId}${orderIndex !== null && Number.isFinite(orderIndex) ? ` idx=${orderIndex}` : ''})\n${title}`,
      });
      this.maybeAutoScroll();
      return;
    }

    if (phase === 'todo_deleted') {
      const planId = Number(event.data.planId);
      const todoId = Number(event.data.todoId);
      this.messages.value.push({
        id: `${Date.now()}_todo_deleted_${todoId}`,
        role: 'system',
        kind: 'planner',
        content: `Todo deleted (plan=${planId} todo=${todoId})`,
      });
      this.maybeAutoScroll();
      return;
    }

    if (phase === 'todo_updated') {
      const planId = Number(event.data.planId);
      const todoId = Number(event.data.todoId);
      const title = typeof event.data.title === 'string' ? event.data.title : '';
      const orderIndex = event.data.orderIndex !== undefined ? Number(event.data.orderIndex) : null;
      const status = typeof event.data.status === 'string' ? event.data.status : '';
      this.messages.value.push({
        id: `${Date.now()}_todo_updated_${todoId}`,
        role: 'system',
        kind: 'planner',
        content: `Todo updated (plan=${planId} todo=${todoId}${orderIndex !== null && Number.isFinite(orderIndex) ? ` idx=${orderIndex}` : ''})\n${title}${title ? '\n' : ''}${status}`,
      });
      this.maybeAutoScroll();
      return;
    }

    if (phase === 'todo_status') {
      const planId = Number(event.data.planId);
      const todoId = Number(event.data.todoId);
      const title = typeof event.data.title === 'string' ? event.data.title : '';
      const status = typeof event.data.status === 'string' ? event.data.status : '';
      this.messages.value.push({
        id: `${Date.now()}_todo_status_${todoId}_${status}`,
        role: 'system',
        kind: 'progress',
        content: `Todo status (plan=${planId} todo=${todoId})\n${title}${title ? '\n' : ''}${status}`,
      });
      this.maybeAutoScroll();
      return;
    }

    if (phase === 'tool_call') {
      const toolName = String(event.data.toolName || 'tool');
      if (toolName === 'emit_chat_message' || toolName === 'emit_chat_image') {
        return;
      }
      const toolRunId = String(event.data.toolRunId || `${Date.now()}_${toolName}`);
      const args = (event.data.args && typeof event.data.args === 'object') ? (event.data.args as Record<string, unknown>) : {};
      const id = `tool_${toolRunId}`;
      this.toolCardsByRunId.set(toolRunId, id);

      this.messages.value.push({
        id,
        role: 'system',
        kind: 'tool',
        content: '',
        toolCard: {
          toolRunId,
          toolName,
          status: 'running',
          args,
        },
      });
      this.maybeAutoScroll();
      return;
    }

    if (phase === 'tool_result') {
      const toolName = String(event.data.toolName || 'tool');
      if (toolName === 'emit_chat_message' || toolName === 'emit_chat_image') {
        return;
      }
      const toolRunId = String(event.data.toolRunId || '');
      const success = !!event.data.success;
      const error = event.data.error ? String(event.data.error) : null;
      const result = (event.data && 'result' in event.data) ? event.data.result : undefined;

      const existingId = toolRunId ? this.toolCardsByRunId.get(toolRunId) : undefined;
      if (existingId) {
        const idx = this.messages.value.findIndex(m => m.id === existingId);
        if (idx >= 0) {
          const prior = this.messages.value[idx];
          this.messages.value[idx] = {
            ...prior,
            kind: 'tool',
            content: '',
            toolCard: {
              toolRunId,
              toolName,
              status: success ? 'success' : 'failed',
              args: prior.toolCard?.args,
              result,
              error,
            },
          };
          this.maybeAutoScroll();
          return;
        }
      }

      const id = `tool_${toolRunId || `${Date.now()}_${toolName}`}`;
      this.messages.value.push({
        id,
        role: 'system',
        kind: 'tool',
        content: '',
        toolCard: {
          toolRunId: toolRunId || id,
          toolName,
          status: success ? 'success' : 'failed',
          result,
          error,
        },
      });
      this.maybeAutoScroll();
      return;
    }

    if (phase === 'chat_message') {
      const role = String(event.data.role || 'assistant');
      const content = String(event.data.content || '').trim();
      if (!content) {
        return;
      }
      if (role === 'assistant') {
        this.messages.value.push({ id: `${Date.now()}_chat_message`, role: 'assistant', content });
      } else {
        const kind = (typeof event.data.kind === 'string' ? (event.data.kind as any) : 'progress');
        this.messages.value.push({ id: `${Date.now()}_chat_message`, role: 'system', kind, content });
      }
      this.maybeAutoScroll();
      return;
    }

    if (phase === 'critic_decision') {
      if (!this.showInternalProgress) {
        return;
      }
      const decision = String(event.data.decision || '');
      const reason = String(event.data.reason || '');
      this.messages.value.push({ id: `${Date.now()}_critic`, role: 'system', kind: 'critic', content: `Critic: ${decision}${reason ? `\n${reason}` : ''}` });
      this.maybeAutoScroll();
      return;
    }

    if (phase === 'node_start') {
      if (!this.showInternalProgress) {
        return;
      }
      const nodeName = String(event.data.nodeName || event.data.nodeId || 'node');
      this.messages.value.push({ id: `${Date.now()}_node_start`, role: 'system', kind: 'progress', content: `→ ${nodeName}` });
      this.maybeAutoScroll();
    }
  }

  private async processUserText(userText: string): Promise<void> {
    this.loading.value = true;

    try {
      const input = this.deps.sensory.createTextInput(userText);

      const threadContext = await this.deps.contextDetector.detect(
        input,
        this.deps.currentThreadId.value || undefined,
      );

      this.deps.currentThreadId.value = threadContext.threadId;

      this.ensureThreadEventSubscription(threadContext.threadId);

      const thread = this.deps.getThread(threadContext.threadId);
      await thread.initialize();

      const agentResponse = await thread.process(input);

      this.deps.onAgentResponse?.(agentResponse);

      if (this.deps.responseHandler.hasErrors(agentResponse)) {
        const err = this.deps.responseHandler.getError(agentResponse);
        throw new Error(err || 'Unknown error');
      }

      const formatted = this.deps.responseHandler.formatText(agentResponse) || 'No response from model';
      this.messages.value.push({ id: `${Date.now()}_assistant`, role: 'assistant', content: formatted });
      await this.maybeAutoScroll();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);

      const recovered = await this.deps.startupProgress.handleOllamaMemoryError(message);

      if (recovered) {
        this.messages.value.push({
          id:      `${Date.now()}_error`,
          role:    'error',
          content: 'Restarting AI service to free memory. Please try again in a moment.',
        });
      } else {
        this.messages.value.push({ id: `${Date.now()}_error`, role: 'error', content: `Error: ${message}` });
      }

      await this.maybeAutoScroll();
    } finally {
      this.loading.value = false;
    }
  }

  private async drainPromptQueue(): Promise<void> {
    if (this.drainingQueue) {
      return;
    }
    this.drainingQueue = true;
    try {
      while (!this.loading.value && this.pendingPrompts.length > 0) {
        const next = this.pendingPrompts.shift();
        if (!next) {
          continue;
        }
        await this.processUserText(next);
      }
    } finally {
      this.drainingQueue = false;
    }
  }

  async send(): Promise<void> {
    if (!this.query.value.trim() || !this.deps.systemReady.value) {
      return;
    }

    const userText = this.query.value;
    this.query.value = '';
    this.messages.value.push({ id: `${Date.now()}_user`, role: 'user', content: userText });
    await this.maybeAutoScroll();

    if (this.loading.value) {
      this.pendingPrompts.push(userText);
      return;
    }

    await this.processUserText(userText);
    await this.drainPromptQueue();
  }

  private attachScrollListenerIfNeeded(el: HTMLElement): void {
    if (this.scrollListenerAttached) {
      return;
    }
    this.scrollListenerAttached = true;
    el.addEventListener('scroll', () => {
      const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
      this.autoScrollEnabled = distanceFromBottom <= this.autoScrollThresholdPx;
    }, { passive: true });
  }

  private async maybeAutoScroll(): Promise<void> {
    await nextTick();
    const el = this.transcriptEl.value;
    if (!el) {
      return;
    }
    this.attachScrollListenerIfNeeded(el);
    if (!this.autoScrollEnabled) {
      return;
    }
    el.scrollTop = el.scrollHeight;
  }
}
