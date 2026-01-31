// SchedulerService - Schedules calendar events using node-schedule
// Triggers SensoryInput when events start, processed as background agent tasks

import schedule from 'node-schedule';
import { getCalendarService, CalendarEvent } from './CalendarService';
import { getSensory } from '../SensoryInput';
import { getContextDetector } from '../ContextDetector';
import { getThread } from '../ConversationThread';

const SCHEDULER_THREAD_ID = 'scheduler-background';

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

  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    console.log('[SchedulerService] Initializing...');

    try {
      const calendarService = getCalendarService();
      await calendarService.initialize();

      // Register for event changes
      calendarService.onEventChange((event, action) => {
        if (action === 'created') {
          this.scheduleEvent(event);
        } else if (action === 'updated') {
          this.rescheduleEvent(event);
        } else if (action === 'deleted') {
          this.cancelEvent(event.id);
        }
      });

      // Load all future events and schedule them
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
    // Cancel existing job for this event if any
    this.cancelEvent(event.id);

    const startTime = new Date(event.start);
    const now = new Date();

    // Don't schedule past events
    if (startTime <= now) {
      console.log(`[SchedulerService] Skipping past event: ${event.id} - ${event.title}`);
      return;
    }

    const job = schedule.scheduleJob(startTime, async () => {
      console.log(`[SchedulerService] ⏰ CRON JOB FIRED for event: ${event.id} - "${event.title}"`);
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
      console.log(`[SchedulerService] 📤 Sending event to SensoryInput: ${event.id} - "${event.title}"`);
      
      const sensory = getSensory();
      const contextDetector = getContextDetector();

      // Create a calendar-triggered sensory input
      const prompt = this.buildEventPrompt(event);
      console.log(`[SchedulerService]   Built prompt (${prompt.length} chars)`);
      
      const input = sensory.createCalendarInput(prompt, {
        eventId: event.id,
        eventTitle: event.title,
      });
      console.log(`[SchedulerService]   Created SensoryInput: type=${input.type}`);

      // Detect context (will use scheduler thread)
      const threadContext = await contextDetector.detect(input, SCHEDULER_THREAD_ID);
      console.log(`[SchedulerService]   Context detected: threadId=${threadContext.threadId}`);

      // Get or create the scheduler thread
      const thread = getThread(threadContext.threadId);
      await thread.initialize();
      console.log(`[SchedulerService]   Thread initialized, processing input...`);

      // Process the event notification
      const response = await thread.process(input);

      console.log(`[SchedulerService] ✅ Event processed successfully: ${event.id}`);
      console.log(`[SchedulerService]   Response (first 200 chars): ${response.content.substring(0, 200)}...`);
    } catch (err) {
      console.error(`[SchedulerService] ❌ Failed to trigger event ${event.id}:`, err);
    }
  }

  private buildEventPrompt(event: CalendarEvent): string {
    // Format times in user's timezone
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
