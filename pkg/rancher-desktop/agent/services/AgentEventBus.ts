import type { AgentEvent } from '../types';

type Handler = (event: AgentEvent) => void;

const handlers = new Set<Handler>();

export function onAgentEvent(handler: Handler): void {
  handlers.add(handler);
}

export function offAgentEvent(handler: Handler): void {
  handlers.delete(handler);
}

export function emitAgentEvent(event: AgentEvent): void {
  handlers.forEach((handler) => {
    try {
      handler(event);
    } catch (err) {
      console.error('[AgentEventBus] handler error', err);
    }
  });
}
