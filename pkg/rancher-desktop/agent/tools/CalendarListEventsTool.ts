import type { ThreadState, ToolResult } from '../types';
import { getCalendarService } from '../services/CalendarService';
import { BaseTool } from './BaseTool';
import type { ToolContext } from './BaseTool';

export class CalendarListEventsTool extends BaseTool {
  override readonly name = 'calendar_list_events';
  override readonly aliases = ['list_events', 'get_events'];
  override readonly category = 'calendar';

  override getPlanningInstructions(): string {
    return [
      '37) calendar_list_events',
      '   - Purpose: List calendar events within a date range.',
      '   - Args:',
      '     - startAfter (string, optional): ISO date string, only return events starting after this time',
      '     - endBefore (string, optional): ISO date string, only return events ending before this time',
      '     - limit (number, optional): Maximum number of events to return (default 20)',
      '   - Output: Array of calendar events with id, title, start, end, location, description.',
      '   - Use when:',
      '     - User asks "what events do I have" or "show my calendar"',
      '     - User asks about events on a specific day or date range',
      '   - Planning guidance:',
      '     - Set requiresTools=true',
      '     - Include a step with action "calendar_list_events"',
    ].join('\n');
  }

  override async execute(state: ThreadState, context: ToolContext): Promise<ToolResult> {
    try {
      const calendarService = getCalendarService();
      await calendarService.initialize();

      const startAfter = context.args?.startAfter as string | undefined;
      const endBefore = context.args?.endBefore as string | undefined;
      const limit = Number(context.args?.limit) || 20;

      const events = await calendarService.getEvents({ startAfter, endBefore });
      const limited = events.slice(0, limit);

      const formatted = limited.map(e => ({
        id: e.id,
        title: e.title,
        start: e.start,
        end: e.end,
        location: e.location || null,
        description: e.description || null,
      }));

      (state.metadata as any).calendarEvents = formatted;

      return {
        toolName: this.name,
        success: true,
        result: {
          count: formatted.length,
          events: formatted,
        },
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return { toolName: this.name, success: false, error: msg };
    }
  }
}
