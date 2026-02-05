// CalendarTool.ts
// Exec-form tool for calendar operations via CalendarClient

import type { ThreadState, ToolResult } from '../types';
import { BaseTool } from './BaseTool';
import type { ToolContext } from './BaseTool';
import { calendarClient } from '../services/CalendarClient'; // adjust path

export class CalendarTool extends BaseTool {
  override readonly name = 'calendar';
  override readonly aliases = ['cal', 'schedule', 'events'];

  override getPlanningInstructions(): string {
    return `["calendar", "list", "--startAfter", "2026-02-01"] - Manage calendar events

Examples:
["calendar", "create", "--title", "Sales call", "--start", "2026-02-10T14:00:00Z", "--end", "2026-02-10T15:00:00Z", "--people", "john@client.com", "jane@agency.com"]
["calendar", "list", "--startAfter", "2026-02-01T00:00:00Z", "--endBefore", "2026-03-01T00:00:00Z"]
["calendar", "get", "42"]
["calendar", "update", "42", "--title", "Updated: High-ticket close", "--end", "2026-02-10T16:00:00Z"]
["calendar", "delete", "42"]
["calendar", "listUpcoming", "7"]   // days from now

Subcommands:
- create  --title "..." --start ISO --end ISO [--description] [--location] [--people "email1" "email2"] [--calendarId] [--allDay]
- list     [--startAfter ISO] [--endBefore ISO] [--calendarId]
- get      <eventId>
- update   <eventId> [--title] [--start] [--end] [--description] [--location] [--people] [--calendarId] [--allDay]
- delete   <eventId>
- listUpcoming <daysFromNow>
`.trim();
  }

  override async execute(state: ThreadState, context: ToolContext): Promise<ToolResult> {
    const args = this.getArgsArray(context, 1);
    if (!args.length) {
      return { toolName: this.name, success: false, error: 'Missing subcommand' };
    }

    const subcommand = args[0].toLowerCase();
    const rest = args.slice(1);

    try {
      switch (subcommand) {
        case 'create': {
          const params = this.argsToObject(rest);
          const event = {
            title: params.title,
            start: params.start,
            end: params.end,
            description: params.description,
            location: params.location,
            people: params.people,
            calendarId: params.calendarId,
            allDay: params.allDay,
          };

          if (!event.title || !event.start || !event.end) {
            throw new Error('Missing required: title, start, end');
          }

          const created = await calendarClient.createEvent(event);
          return { toolName: this.name, success: true, result: created };
        }

        case 'list':
        case 'listupcoming': {
          let options: any = {};

          const params = this.argsToObject(rest);
          if (subcommand === 'listupcoming') {
            const days = parseInt(rest[0] || '7', 10);
            const now = new Date();
            const future = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
            options.startAfter = now.toISOString();
            options.endBefore = future.toISOString();
          } else {
            if (params.startAfter) options.startAfter = params.startAfter;
            if (params.endBefore)  options.endBefore  = params.endBefore;
            if (params.calendarId) options.calendarId = params.calendarId;
          }

          const events = await calendarClient.getEvents(options);
          return { toolName: this.name, success: true, result: events };
        }

        case 'get': {
          const id = parseInt(rest[0], 10);
          if (isNaN(id)) throw new Error('Invalid event ID');
          const event = await calendarClient.getEvent(id);
          return { toolName: this.name, success: !!event, result: event || 'Not found' };
        }

        case 'update': {
          const id = parseInt(rest[0], 10);
          if (isNaN(id)) throw new Error('Invalid event ID');

          const params = this.argsToObject(rest.slice(1));
          const updates = {
            title: params.title,
            start: params.start,
            end: params.end,
            description: params.description,
            location: params.location,
            people: params.people,
            calendarId: params.calendarId,
            allDay: params.allDay,
          };

          const updated = await calendarClient.updateEvent(id, updates);
          return { toolName: this.name, success: !!updated, result: updated || 'Not found' };
        }

        case 'delete': {
          const id = parseInt(rest[0], 10);
          if (isNaN(id)) throw new Error('Invalid event ID');
          const deleted = await calendarClient.deleteEvent(id);
          return { toolName: this.name, success: deleted, result: deleted ? 'Deleted' : 'Not found' };
        }

        default:
          return { toolName: this.name, success: false, error: `Unknown subcommand: ${subcommand}` };
      }
    } catch (err: any) {
      return { toolName: this.name, success: false, error: err.message || String(err) };
    }
  }
}