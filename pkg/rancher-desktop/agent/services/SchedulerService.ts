// SchedulerService.ts
// Updated: uses CalendarEvent model instead of old CalendarService
// API unchanged for backward compatibility

import schedule from 'node-schedule';
import { getWebSocketClientService, type WebSocketMessage } from './WebSocketClientService';
import { CalendarEvent } from '../database/models/CalendarEvent'; // new model
import { eventPrompt } from '../prompts/event';

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
    if (this.initialized) return;

    console.log('[SchedulerService] Initializing...');

    try {
      // Listen for model-level changes (via static events or pub/sub if added later)
      // For now: load upcoming events directly
      const now = new Date().toISOString();
      const events = await CalendarEvent.findUpcoming(100, now);

      for (const event of events) {
        this.scheduleEvent(event.attributesSnapshot as any);
      }

      console.log(`[SchedulerService] Scheduled ${events.length} upcoming events`);
    } catch (err) {
      console.error('[SchedulerService] Initialization failed:', err);
    }

    this.initialized = true;
  }

  scheduleEvent(event: any): void { // any to match old CalendarEvent shape
    this.cancelEvent(event.id);

    const startTime = new Date(event.start_time || event.start);
    const now = new Date();

    if (startTime <= now) {
      console.log(`[SchedulerService] Skipping past event: ${event.id} - ${event.title}`);
      return;
    }

    const job = schedule.scheduleJob(startTime, async () => {
      console.log(`[SchedulerService] CRON JOB FIRED for event: ${event.id} - "${event.title}"`);
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

  rescheduleEvent(event: any): void {
    this.scheduleEvent(event);
  }

  async triggerEvent(event: any): Promise<void> {
    try {
      console.log(`[SchedulerService] Sending event prompt via WS: ${event.id} - "${event.title}"`);
      const prompt = this.buildEventPrompt(event);
      console.log(`[SchedulerService] Built prompt (${prompt.length} chars)`);

      const acknowledged = await this.sendToFrontend(event, prompt);
      if (acknowledged) {
        console.log(`[SchedulerService] Frontend acknowledged event ${event.id}`);
        return;
      }

      console.warn(`[SchedulerService] Frontend did not ACK event ${event.id} - using backend`);
      this.sendToBackend(event, prompt);
    } catch (err) {
      console.error(`[SchedulerService] Failed to trigger event ${event.id}:`, err);
    }
  }

  private ensureFrontendListener(): void {
    if (this.wsInitialized) return;

    this.wsService.connect(FRONTEND_CHANNEL_ID);
    this.unsubscribeFrontend = this.wsService.onMessage(FRONTEND_CHANNEL_ID, (msg: WebSocketMessage) => {
      if (msg.type !== 'scheduler_ack') return;

      const data = (msg.data && typeof msg.data === 'object') ? (msg.data as any) : null;
      const eventId = Number(data?.eventId);
      if (!Number.isFinite(eventId)) return;

      const pending = this.pendingAcks.get(eventId);
      if (!pending) return;

      clearTimeout(pending.timer);
      pending.resolve(true);
      this.pendingAcks.delete(eventId);
    }) ?? null;

    this.wsInitialized = true;
  }

  private buildEventPayload(event: any, prompt: string) {
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

  private async sendToFrontend(event: any, prompt: string): Promise<boolean> {
    this.ensureFrontendListener();
    const message = this.buildEventPayload(event, prompt);

    const sent = this.wsService.send(FRONTEND_CHANNEL_ID, message);
    if (!sent) {
      console.warn(`[SchedulerService] Failed to send event ${event.id} to frontend`);
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

  private sendToBackend(event: any, prompt: string): void {
    const message = this.buildEventPayload(event, prompt);

    this.wsService.connect(BACKEND_CHANNEL_ID);
    const sent = this.wsService.send(BACKEND_CHANNEL_ID, message);
    if (!sent) {
      console.error(`[SchedulerService] Failed to send event ${event.id} to backend`);
    }
  }

  private buildEventPrompt(event: any): string {
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const startDate = new Date(event.start_time || event.start);
    const endDate = new Date(event.end_time || event.end);
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
      `${eventPrompt}`,
      `## Event Details`,
      ``,
      `Title: ${event.title}`,
      `Description: ${event.description ?? 'None'}`,
      `Invitees: ${event.people?.join(', ') ?? 'None'}`,
      `Start datetime: ${startFormatted}`,
      `End datetime: ${endFormatted}`,
      `All day: ${event.all_day ?? event.allDay ?? false}`,
      `Created: ${event.created_at ?? event.createdAt ?? 'N/A'}`,
    ];

    if (event.location) parts.push(`Location: ${event.location}`);

    return parts.join('\n');
  }

  getScheduledCount(): number {
    return this.scheduledJobs.size;
  }

  getScheduledEventIds(): number[] {
    return Array.from(this.scheduledJobs.keys());
  }
}