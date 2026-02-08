import { getWebSocketClientService, type WebSocketMessage } from './WebSocketClientService';
import { runHierarchicalGraph } from './GraphExecutionService';
import { getSensory } from '../SensoryInput';
import { getSchedulerService } from './SchedulerService';
import type { CalendarEvent } from './CalendarClient';

interface CalendarWebSocketMessage {
  type: 'scheduled' | 'cancel' | 'reschedule';
  event?: CalendarEvent;
  id: string;
  timestamp: number;
  channel: string;
}

const BACKEND_CHANNEL_ID = 'dreaming-protocol';
const CALENDAR_CHANNEL_ID = 'calendar_event';

let backendGraphWebSocketServiceInstance: BackendGraphWebSocketService | null = null;

export function getBackendGraphWebSocketService(): BackendGraphWebSocketService {
  if (!backendGraphWebSocketServiceInstance) {
    backendGraphWebSocketServiceInstance = new BackendGraphWebSocketService();
  }
  return backendGraphWebSocketServiceInstance;
}

export class BackendGraphWebSocketService {
  private readonly wsService = getWebSocketClientService();
  private readonly schedulerService = getSchedulerService();
  private unsubscribes: (() => void)[] = [];

  constructor() {
    this.initialize();
  }

  dispose(): void {
    this.unsubscribes.forEach(unsub => unsub());
    this.unsubscribes = [];
  }

  private initialize(): void {
    // Initialize chat controller backend channel
    this.wsService.connect(BACKEND_CHANNEL_ID);
    console.log('[Background] BackendGraphWebSocketService initialized');
    
    const chatUnsubscribe = this.wsService.onMessage(BACKEND_CHANNEL_ID, (msg) => {
      this.handleWebSocketMessage(msg);
    });
    if (chatUnsubscribe) {
      this.unsubscribes.push(chatUnsubscribe);
    }

    // Initialize calendar event channel
    this.wsService.connect(CALENDAR_CHANNEL_ID);
    console.log('[Background] BackendGraphWebSocketService calendar channel initialized');
    
    const calendarUnsubscribe = this.wsService.onMessage(CALENDAR_CHANNEL_ID, (msg) => {
      this.handleCalendarMessage(msg);
    });
    if (calendarUnsubscribe) {
      this.unsubscribes.push(calendarUnsubscribe);
    }
  }

  private async handleWebSocketMessage(msg: WebSocketMessage): Promise<void> {
    if (msg.type !== 'user_message') {
      return;
    }

    console.warn('[BackendGraphWebSocketService] Captured chat message:', msg);

    const data = typeof msg.data === 'string' ? { content: msg.data } : (msg.data as any);
    const content = typeof data?.content === 'string' ? data.content : '';

    if (!content.trim()) {
      return;
    }

    await this.processMessage(content.trim());
  }

  private async processMessage(content: string): Promise<void> {
    try {
      const sensory = getSensory();
      const input = sensory.createTextInput(content);

      await runHierarchicalGraph({
        input,
        wsChannel: BACKEND_CHANNEL_ID,
      });
    } catch (err) {
      console.error('[BackendGraphWebSocketService] Failed to process message:', err);
    }
  }

  private async handleCalendarMessage(msg: WebSocketMessage): Promise<void> {
    console.log('[BackendGraphWebSocketService] Received calendar message:', msg);

    // The calendar message data is directly on the message object, not in msg.data
    const calendarMsg = msg as CalendarWebSocketMessage;
    
    if (!calendarMsg || typeof calendarMsg.type !== 'string') {
      console.warn('[BackendGraphWebSocketService] Invalid calendar message format:', calendarMsg);
      return;
    }

    const { type, event } = calendarMsg;

    if (type === 'scheduled' && event) {
      try {
        console.log('[BackendGraphWebSocketService] Scheduling calendar event:', event);
        this.schedulerService.scheduleEvent(event);
      } catch (err) {
        console.error('[BackendGraphWebSocketService] Failed to schedule calendar event:', err);
      }
    } else if (type === 'cancel' && event?.id) {
      try {
        console.log('[BackendGraphWebSocketService] Canceling calendar event:', event.id);
        this.schedulerService.cancelEvent(event.id);
      } catch (err) {
        console.error('[BackendGraphWebSocketService] Failed to cancel calendar event:', err);
      }
    } else if (type === 'reschedule' && event) {
      try {
        console.log('[BackendGraphWebSocketService] Rescheduling calendar event:', event);
        this.schedulerService.rescheduleEvent(event);
      } catch (err) {
        console.error('[BackendGraphWebSocketService] Failed to reschedule calendar event:', err);
      }
    } else {
      console.log('[BackendGraphWebSocketService] Unknown calendar message type:', type);
    }
  }
}
