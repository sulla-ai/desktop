// CalendarTool.ts
// Exec-form tool for calendar operations — now delegates to CalendarClient

import type { ThreadState, ToolResult } from '../types';
import { BaseTool } from './BaseTool';
import type { ToolContext } from './BaseTool';
import { calendarClient } from '../services/CalendarClient';

export class CalendarTool extends BaseTool {
  override readonly name = 'calendar';
  override readonly aliases = ['cal', 'schedule', 'events', 'reminder'];

  override getPlanningInstructions(): string {
    return `["calendar","create","--title","Reminder: 60s from request","--startTime","2026-02-05T08:02:00Z","--endTime","2026-02-05T08:02:01Z","--description","Auto-triggered 60s after 'Set me up a reminder 60 seconds from now'"] - Manage calendar events, reminders, and schedules

Examples:
["calendar", "create", "--title", "Sales call", "--start", "2026-02-10T14:00:00Z", "--end", "2026-02-10T15:00:00Z", "--people", "john@client.com", "jane@agency.com"]
["calendar", "list", "--startAfter", "2026-02-01T00:00:00Z", "--endBefore", "2026-03-01T00:00:00Z"]
["calendar", "get", "42"]
["calendar", "update", "42", "--title", "Updated: High-ticket close", "--end", "2026-02-10T16:00:00Z"]
["calendar", "delete", "42"]
["calendar", "listUpcoming", "7"]   // days from now
["calendar", "cancel", "42"]

Subcommands:
- create  --title "..." --start ISO --end ISO [--description] [--location] [--people "email1" "email2"] [--calendarId] [--allDay]
- list     [--startAfter ISO] [--endBefore ISO] [--calendarId]
- get      <eventId>
- update   <eventId> [--title] [--start] [--end] [--description] [--location] [--people] [--calendarId] [--allDay]
- delete   <eventId>
- cancel   <eventId>     // mark as cancelled
- listUpcoming <daysFromNow>

Args:
--title "Event title" (required for create)
--start ISO datetime (required for create)
--end ISO datetime (required for create)
--description "Details or notes"
--location "Physical or virtual location"
--people "email1@example.com" "email2@example.com" (multiple allowed)
--calendarId "specific-calendar-id"
--allDay true/false (for full-day events)
`.trim();
  }

  override async execute(state: ThreadState, context: ToolContext): Promise<ToolResult> {
    const helpResult = await this.handleHelpRequest(context);
    if (helpResult) return helpResult;

    const args = this.getArgsArray(context);
    if (!args.length) return { toolName: this.name, success: false, error: 'Missing subcommand' };

    const subcommand = args[0].toLowerCase();
    const rest = args.slice(1);

    try {
      switch (subcommand) {
        case 'create': {
          const params = this.argsToObject(rest);

          const event = await calendarClient.create({
            title: params.title,
            start: params.start || params.startTime,
            end: params.end || params.endTime,
            description: params.description,
            location: params.location,
            people: params.people ? (Array.isArray(params.people) ? params.people : [params.people]) : undefined,
            calendarId: params.calendarId,
            allDay: params.allDay === 'true' || params.allDay === true,
          });

          return { toolName: this.name, success: true, result: event };
        }

        case 'list':
        case 'listupcoming': {
          let options: any = {};

          const params = this.argsToObject(rest);
          if (subcommand === 'listupcoming') {
            const days = parseInt(rest[0] || '7', 10);
            const now = new Date();
            options.startAfter = now.toISOString();
          } else {
            if (params.startAfter) options.startAfter = params.startAfter;
            if (params.endBefore) options.endBefore = params.endBefore;
            if (params.calendarId) options.calendarId = params.calendarId;
          }

          const events = await calendarClient.getEvents(options);
          return { toolName: this.name, success: true, result: events };
        }

        case 'get': {
          const id = parseInt(rest[0], 10);
          if (isNaN(id)) throw new Error('Invalid event ID');
          const event = await calendarClient.get(id);
          return { toolName: this.name, success: !!event, result: event || 'Not found' };
        }

        case 'update': {
          const id = parseInt(rest[0], 10);
          if (isNaN(id)) throw new Error('Invalid event ID');

          const params = this.argsToObject(rest.slice(1));

          const updated = await calendarClient.update(id, {
            title: params.title,
            start: params.start || params.startTime,
            end: params.end || params.endTime,
            description: params.description,
            location: params.location,
            people: params.people,
            calendarId: params.calendarId,
            allDay: params.allDay === 'true' || params.allDay === true,
          });

          return { toolName: this.name, success: !!updated, result: updated || 'Not found' };
        }

        case 'delete': {
          const id = parseInt(rest[0], 10);
          if (isNaN(id)) throw new Error('Invalid event ID');
          const success = await calendarClient.delete(id);
          return { toolName: this.name, success, result: success ? 'Deleted' : 'Not found' };
        }

        case 'cancel': {
          const id = parseInt(rest[0], 10);
          if (isNaN(id)) throw new Error('Invalid event ID');
          const updated = await calendarClient.cancel(id);
          return { toolName: this.name, success: !!updated, result: updated || 'Not found' };
        }

        default:
          return { toolName: this.name, success: false, error: `Unknown subcommand: ${subcommand}` };
      }
    } catch (err: any) {
      console.error('[CalendarTool] Execution error:', err);
      return { toolName: this.name, success: false, error: err.message || String(err) };
    }
  }
}