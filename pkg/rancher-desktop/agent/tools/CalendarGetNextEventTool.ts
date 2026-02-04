import type { ThreadState, ToolResult } from '../types';
import { getCalendarService } from '../services/CalendarService';
import { BaseTool } from './BaseTool';
import type { ToolContext } from './BaseTool';

export class CalendarGetNextEventTool extends BaseTool {
  override readonly name = 'calendar_get_next_event';
  override readonly aliases = ['next_event', 'upcoming_event'];
  override readonly category = 'calendar';

  override getPlanningInstructions(): string {
    return [
      '38) calendar_get_next_event',
      '   - Purpose: Get the next upcoming calendar event.',
      '   - Args: none',
      '   - Output: The next calendar event with id, title, start, end, location, description, or null if none.',
      '   - Use when:',
      '     - User asks "what\'s my next event" or "what\'s coming up"',
      '     - User asks "when is my next meeting"',
      '   - Planning guidance:',
      '     - Set requiresTools=true',
      '     - Include a step with action "calendar_get_next_event"',
    ].join('\n');
  }

  override async execute(state: ThreadState, context: ToolContext): Promise<ToolResult> {
    try {
      const calendarService = getCalendarService();
      await calendarService.initialize();

      const now = new Date().toISOString();
      const events = await calendarService.getEvents({ startAfter: now });

      if (events.length === 0) {
        return {
          toolName: this.name,
          success: true,
          result: { event: null, message: 'No upcoming events found.' },
        };
      }

      const next = events[0];
      const formatted = {
        id: next.id,
        title: next.title,
        start: next.start,
        end: next.end,
        location: next.location || null,
        description: next.description || null,
      };

      (state.metadata as any).nextCalendarEvent = formatted;

      return {
        toolName: this.name,
        success: true,
        result: { event: formatted },
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return { toolName: this.name, success: false, error: msg };
    }
  }
}
