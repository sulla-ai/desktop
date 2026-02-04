import schedule from 'node-schedule';
import { getCalendarService, CalendarEvent } from './CalendarService';
import { getWebSocketClientService, type WebSocketMessage } from './WebSocketClientService';

const FRONTEND_CHANNEL_ID = 'chat-controller';
const BACKEND_CHANNEL_ID = 'chat-controller-backend';
const ACK_TIMEOUT_MS = 3_000;

interface ScheduledJob {
  eventId: number;
  job: schedule.Job;
}

let schedulerServiceInstance: SchedulerService | null = null;

export function getSchedulerService(): SchedulerService {
  if (!schedulerServiceInstance) {
    schedulerServiceInstance = new SchedulerService();
  }

  return schedulerServiceInstance;
}

export class SchedulerService {
  private initialized = false;
  private scheduledJobs: Map<number, ScheduledJob> = new Map();
  private readonly wsService = getWebSocketClientService();
  private wsInitialized = false;
  private unsubscribeFrontend: (() => void) | null = null;
  private pendingAcks = new Map<number, { resolve: (value: boolean) => void; timer: ReturnType<typeof setTimeout> }>();

  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    console.log('[SchedulerService] Initializing...');

    try {
      const calendarService = getCalendarService();
      await calendarService.initialize();

      calendarService.onEventChange((event, action) => {
        if (action === 'created') {
          this.scheduleEvent(event);
        } else if (action === 'updated') {
          this.rescheduleEvent(event);
        } else if (action === 'deleted') {
          this.cancelEvent(event.id);
        }
      });

      const now = new Date().toISOString();
      const events = await calendarService.getEvents({ startAfter: now });

      for (const event of events) {
        this.scheduleEvent(event);
      }

      console.log(`[SchedulerService] Scheduled ${events.length} upcoming events`);
    } catch (err) {
      console.error('[SchedulerService] Initialization failed:', err);
    }

    this.initialized = true;
  }

  scheduleEvent(event: CalendarEvent): void {
    this.cancelEvent(event.id);

    const startTime = new Date(event.start);
    const now = new Date();

    if (startTime <= now) {
      console.log(`[SchedulerService] Skipping past event: ${event.id} - ${event.title}`);
      return;
    }

    const job = schedule.scheduleJob(startTime, async () => {
      console.log(`[SchedulerService] CRON JOB FIRED for event: ${event.id} - "${event.title}"`);
      console.log(`[SchedulerService]   Scheduled time: ${startTime.toISOString()}`);
      console.log(`[SchedulerService]   Actual fire time: ${new Date().toISOString()}`);
      await this.triggerEvent(event);
      this.scheduledJobs.delete(event.id);
    });

    if (job) {
      this.scheduledJobs.set(event.id, { eventId: event.id, job });
      console.log(`[SchedulerService] Scheduled event: ${event.id} - ${event.title} at ${startTime.toISOString()}`);
    }
  }

  cancelEvent(eventId: number): void {
    const scheduled = this.scheduledJobs.get(eventId);
    if (scheduled) {
      scheduled.job.cancel();
      this.scheduledJobs.delete(eventId);
      console.log(`[SchedulerService] Cancelled scheduled event: ${eventId}`);
    }
  }

  rescheduleEvent(event: CalendarEvent): void {
    this.scheduleEvent(event);
  }

  private async triggerEvent(event: CalendarEvent): Promise<void> {
    try {
      console.log(`[SchedulerService] Sending event prompt via WS: ${event.id} - "${event.title}"`);
      const prompt = this.buildEventPrompt(event);
      console.log(`[SchedulerService]   Built prompt (${prompt.length} chars)`);

      const acknowledged = await this.sendToFrontend(event, prompt);
      if (acknowledged) {
        console.log(`[SchedulerService] Frontend acknowledged event ${event.id}`);
        return;
      }

      console.warn(`[SchedulerService] Frontend did not ACK event ${event.id} - using backend channel`);
      this.sendToBackend(event, prompt);
    } catch (err) {
      console.error(`[SchedulerService] Failed to trigger event ${event.id}:`, err);
    }
  }

  private ensureFrontendListener(): void {
    if (this.wsInitialized) {
      return;
    }

    this.wsService.connect(FRONTEND_CHANNEL_ID);
    this.unsubscribeFrontend = this.wsService.onMessage(FRONTEND_CHANNEL_ID, (msg: WebSocketMessage) => {
      if (msg.type !== 'scheduler_ack') {
        return;
      }

      const data = (msg.data && typeof msg.data === 'object') ? (msg.data as any) : null;
      const eventId = Number(data?.eventId);
      if (!Number.isFinite(eventId)) {
        return;
      }

      const pending = this.pendingAcks.get(eventId);
      if (!pending) {
        return;
      }

      clearTimeout(pending.timer);
      pending.resolve(true);
      this.pendingAcks.delete(eventId);
    }) ?? null;

    this.wsInitialized = true;
  }

  private buildEventPayload(event: CalendarEvent, prompt: string) {
    return {
      type: 'user_message',
      data: {
        role: 'user',
        content: prompt,
        metadata: {
          origin: 'scheduler',
          eventId: event.id,
          eventTitle: event.title,
        },
      },
      timestamp: Date.now(),
    };
  }

  private async sendToFrontend(event: CalendarEvent, prompt: string): Promise<boolean> {
    this.ensureFrontendListener();
    const message = this.buildEventPayload(event, prompt);

    const sent = this.wsService.send(FRONTEND_CHANNEL_ID, message);
    if (!sent) {
      console.warn(`[SchedulerService] Failed to send event ${event.id} to frontend channel`);
      return false;
    }

    return await new Promise<boolean>((resolve) => {
      const timer = setTimeout(() => {
        this.pendingAcks.delete(event.id);
        resolve(false);
      }, ACK_TIMEOUT_MS);

      this.pendingAcks.set(event.id, { resolve, timer });
    });
  }

  private sendToBackend(event: CalendarEvent, prompt: string): void {
    const message = this.buildEventPayload(event, prompt);

    this.wsService.connect(BACKEND_CHANNEL_ID);
    const sent = this.wsService.send(BACKEND_CHANNEL_ID, message);
    if (!sent) {
      console.error(`[SchedulerService] Failed to send event ${event.id} to backend channel`);
    }
  }

  private buildEventPrompt(event: CalendarEvent): string {
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const startDate = new Date(event.start);
    const endDate = new Date(event.end);
    const startFormatted = startDate.toLocaleString('en-US', {
      timeZone: timezone,
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
    const endFormatted = endDate.toLocaleTimeString('en-US', {
      timeZone: timezone,
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });

    const parts = [
      `[CALENDAR EVENT NOTIFICATION]`,
      ``,
      `A scheduled event is starting now:`,
      ``,
      `**Event ID:** ${event.id}`,
      `**Title:** ${event.title}`,
      `**Start:** ${startFormatted}`,
      `**End:** ${endFormatted}`,
    ];

    if (event.location) {
      parts.push(`**Location:** ${event.location}`);
    }

    if (event.description) {
      parts.push(`**Description:** ${event.description}`);
    }

    parts.push(``);
    parts.push(`This is an automated background notification. You may take any appropriate action based on this event, such as preparing relevant information, sending reminders, or noting the event in your awareness.`);

    return parts.join('\n');
  }

  getScheduledCount(): number {
    return this.scheduledJobs.size;
  }

  getScheduledEventIds(): number[] {
    return Array.from(this.scheduledJobs.keys());
  }
}
