// CalendarTool.ts
// Exec-form tool for calendar operations via CalendarClient

import type { ThreadState, ToolResult } from '../types';
import { BaseTool } from './BaseTool';
import type { ToolContext } from './BaseTool';
import { calendarClient } from '../services/CalendarClient'; // adjust path

export class CalendarTool extends BaseTool {
  override readonly name = 'calendar';
  override readonly aliases = ['cal', 'schedule', 'events', 'reminder'];

  /**
   * Parse time strings, handling both ISO dates and relative expressions
   * like "60 seconds from now", "5 minutes from now", "1 hour from now"
   */
  private parseTime(timeStr?: string): string | undefined {
    if (!timeStr) return undefined;
    
    // If it's already an ISO date, return as-is
    if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z?$/.test(timeStr)) {
      return timeStr;
    }
    
    // Parse relative time expressions
    const relativeMatch = timeStr.match(/^(\d+)\s+(second|seconds|minute|minutes|hour|hours|day|days)s?\s+from\s+now$/i);
    if (relativeMatch) {
      const amount = parseInt(relativeMatch[1], 10);
      const unit = relativeMatch[2].toLowerCase();
      
      // Use current time in user's local timezone
      const now = new Date();
      let futureTime: Date;
      
      switch (unit) {
        case 'second':
        case 'seconds':
          futureTime = new Date(now.getTime() + amount * 1000);
          break;
        case 'minute':
        case 'minutes':
          futureTime = new Date(now.getTime() + amount * 60 * 1000);
          break;
        case 'hour':
        case 'hours':
          futureTime = new Date(now.getTime() + amount * 60 * 60 * 1000);
          break;
        case 'day':
        case 'days':
          futureTime = new Date(now.getTime() + amount * 24 * 60 * 60 * 1000);
          break;
        default:
          return timeStr; // Return original if can't parse
      }
      
      // Return as UTC ISO string for database storage
      console.log(`[CalendarTool] Parsed "${timeStr}" to local time: ${futureTime.toLocaleString()} → UTC: ${futureTime.toISOString()}`);
      return futureTime.toISOString();
    }
    
    // Return original if no pattern matches
    // But still ensure it's converted to UTC if it's a valid date string
    try {
      const parsedDate = new Date(timeStr);
      if (!isNaN(parsedDate.getTime())) {
        // Convert any valid date string to UTC zero
        const utcTime = parsedDate.toISOString();
        console.log(`[CalendarTool] Converted "${timeStr}" to UTC: ${utcTime}`);
        return utcTime;
      }
    } catch (error) {
      console.warn(`[CalendarTool] Failed to parse time: "${timeStr}"`);
    }
    
    return timeStr;
  }

  override getPlanningInstructions(): string {
    return `["calendar","create","--title","Reminder: 60s from request","--startTime","2026-02-05T08:02:00Z","--endTime","2026-02-05T08:02:01Z","--description","Auto-triggered 60s after 'Set me up a reminder 60 seconds from now'"] - Manage calendar events, reminders, and schedules

Examples:
["calendar", "create", "--title", "Sales call", "--start", "2026-02-10T14:00:00Z", "--end", "2026-02-10T15:00:00Z", "--people", "john@client.com", "jane@agency.com"]
["calendar", "list", "--startAfter", "2026-02-01T00:00:00Z", "--endBefore", "2026-03-01T00:00:00Z"]
["calendar", "get", "42"]
["calendar", "update", "42", "--title", "Updated: High-ticket close", "--end", "2026-02-10T16:00:00Z"]
["calendar", "delete", "42"]
["calendar", "listUpcoming", "7"]   // days from now

Subcommands:
- create  --title "..." --start ISO (or --startTime) --end ISO (or --endTime) [--description] [--location] [--people "email1" "email2"] [--calendarId] [--allDay]
- list     [--startAfter ISO] [--endBefore ISO] [--calendarId]
- get      <eventId>
- update   <eventId> [--title] [--start] [--end] [--description] [--location] [--people] [--calendarId] [--allDay]
- delete   <eventId>
- listUpcoming <daysFromNow>

Args:
--title "Event title" (required)
--start ISO datetime or --startTime ISO datetime (required, one of them)
--end ISO datetime or --endTime ISO datetime (required, one of them)
--description "Details or notes"
--location "Physical or virtual location"
--people "email1@example.com" "email2@example.com" (multiple allowed)
--calendarId "specific-calendar-id"
--allDay true/false (for full-day events)
`.trim();
  }

  override async execute(state: ThreadState, context: ToolContext): Promise<ToolResult> {
    const helpResult = await this.handleHelpRequest(context);
    if (helpResult) {
      return helpResult;
    }
    
    const args = this.getArgsArray(context);
    if (!args.length) {
      return { toolName: this.name, success: false, error: 'Missing subcommand' };
    }

    const subcommand = args[0].toLowerCase();
    const rest = args.slice(1);

    try {
      switch (subcommand) {
        case 'create': {
          const params = this.argsToObject(rest);
          
          // Parse relative time expressions
          const startTime = this.parseTime(params.start || params.startTime) || new Date().toISOString();
          const endTime = this.parseTime(params.end || params.endTime) || new Date(Date.now() + 60 * 1000).toISOString(); // Default 1 minute later
          
          console.log(`[CalendarTool] Creating event with UTC times: start=${startTime}, end=${endTime}`);
          
          const event = {
            title: params.title,
            start: startTime,
            end: endTime,
            description: params.description,
            location: params.location,
            people: params.people,
            calendarId: params.calendarId,
            allDay: params.allDay,
          };

          const missing = [];
          if (!event.title) missing.push('title');
          if (!event.start) missing.push('start (or startTime)');
          if (!event.end) missing.push('end (or endTime)');

          if (missing.length) {
            throw new Error(`Missing required: ${missing.join(', ')}`);
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
            start: params.start || params.startTime,
            end: params.end || params.endTime,
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