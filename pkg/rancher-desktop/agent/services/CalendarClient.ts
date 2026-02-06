// CalendarClient.ts
// PostgreSQL-backed calendar events via postgresClient singleton
// Mirrors ChromaClient/PostgresClient pattern: singleton, init test, methods throw on error

import { postgresClient } from '../services/PostgresClient'; // adjust path
import type { QueryResult } from 'pg';
import { getWebSocketClientService } from '../services/WebSocketClientService';

export interface CalendarEvent {
  id: number;
  title: string;
  start: string;          // ISO string
  end: string;            // ISO string
  description?: string;
  location?: string;
  people?: string[];
  calendarId?: string;
  allDay?: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface CalendarEventInput {
  title: string;
  start: string;          // ISO or parsable
  end: string;
  description?: string;
  location?: string;
  people?: string[];
  calendarId?: string;
  allDay?: boolean;
}

type CalendarEventCallback = (event: CalendarEvent, action: 'created' | 'updated' | 'deleted') => void;

export class CalendarClient {
  private initialized = false;
  private eventCallbacks: CalendarEventCallback[] = [];

  /**
   * Get underlying postgresClient
   */
  getClient() {
    return postgresClient;
  }

  /**
   * Initialize: ensure tables + connection
   */
  async initialize(): Promise<boolean> {
    if (this.initialized) return true;

    try {
      await postgresClient.initialize();
      await this.ensureTables();
      this.initialized = true;
      console.log('[CalendarClient] Initialized');
      return true;
    } catch (error) {
      console.error('[CalendarClient] Init failed:', error);
      return false;
    }
  }

  onEventChange(callback: CalendarEventCallback): void {
    this.eventCallbacks.push(callback);
  }

  private notifyEventChange(event: CalendarEvent, action: 'created' | 'updated' | 'deleted'): void {
    for (const cb of this.eventCallbacks) {
      try {
        cb(event, action);
      } catch (err) {
        console.warn('[CalendarClient] Callback error:', err);
      }
    }
  }

  private async ensureTables(): Promise<void> {
    await postgresClient.query(`
      CREATE TABLE IF NOT EXISTS calendar_events (
        id SERIAL PRIMARY KEY,
        title VARCHAR(500) NOT NULL,
        start_time TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT (NOW() AT TIME ZONE 'UTC'),
        end_time TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT (NOW() AT TIME ZONE 'UTC'),
        description TEXT,
        location VARCHAR(500),
        people JSONB DEFAULT '[]'::jsonb,
        calendar_id VARCHAR(100),
        all_day BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT (NOW() AT TIME ZONE 'UTC'),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT (NOW() AT TIME ZONE 'UTC')
      )
    `);

    await postgresClient.query(`CREATE INDEX IF NOT EXISTS idx_calendar_events_start ON calendar_events(start_time)`);
    await postgresClient.query(`CREATE INDEX IF NOT EXISTS idx_calendar_events_end ON calendar_events(end_time)`);
    await postgresClient.query(`CREATE INDEX IF NOT EXISTS idx_calendar_events_calendar_id ON calendar_events(calendar_id)`);
  }

  async createEvent(input: CalendarEventInput): Promise<CalendarEvent> {
    const res = await postgresClient.query(`
      INSERT INTO calendar_events (title, start_time, end_time, description, location, people, calendar_id, all_day)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
    `, [
      input.title,
      input.start,
      input.end,
      input.description ?? null,
      input.location ?? null,
      JSON.stringify(input.people ?? []),
      input.calendarId ?? null,
      input.allDay ?? false,
    ]);

    const row = res.rows[0];
    const event = this.rowToEvent(row);
    this.notifyEventChange(event, 'created');
    
    // Send WebSocket notification for scheduled event
    try {
      const wsService = getWebSocketClientService();
      wsService.connect('calendar_event');
      wsService.send('calendar_event', {
        type: 'scheduled',
        event: event
      });
      console.log('[CalendarClient] Sent scheduled event notification via WebSocket:', event.id);
    } catch (err) {
      console.error('[CalendarClient] Failed to send WebSocket notification:', err);
    }
    
    return event;
  }

  async updateEvent(id: number, updates: Partial<CalendarEventInput>): Promise<CalendarEvent | null> {
    const fields: string[] = [];
    const values: any[] = [];
    let idx = 1;

    if (updates.title !== undefined)       { fields.push(`title = $${idx++}`);       values.push(updates.title); }
    if (updates.start !== undefined)       { fields.push(`start_time = $${idx++}`);  values.push(updates.start); }
    if (updates.end !== undefined)         { fields.push(`end_time = $${idx++}`);    values.push(updates.end); }
    if (updates.description !== undefined) { fields.push(`description = $${idx++}`); values.push(updates.description); }
    if (updates.location !== undefined)    { fields.push(`location = $${idx++}`);    values.push(updates.location); }
    if (updates.people !== undefined)      { fields.push(`people = $${idx++}`);      values.push(JSON.stringify(updates.people)); }
    if (updates.calendarId !== undefined)  { fields.push(`calendar_id = $${idx++}`); values.push(updates.calendarId); }
    if (updates.allDay !== undefined)      { fields.push(`all_day = $${idx++}`);     values.push(updates.allDay); }

    if (!fields.length) return this.getEvent(id);

    fields.push(`updated_at = (NOW() AT TIME ZONE 'UTC')`);
    values.push(id);

    const res = await postgresClient.query(`
      UPDATE calendar_events
      SET ${fields.join(', ')}
      WHERE id = $${idx}
      RETURNING *
    `, values);

    if (!res.rowCount) return null;

    const event = this.rowToEvent(res.rows[0]);
    this.notifyEventChange(event, 'updated');
    return event;
  }

  async deleteEvent(id: number): Promise<boolean> {
    const event = await this.getEvent(id);
    if (!event) return false;

    const res = await postgresClient.query('DELETE FROM calendar_events WHERE id = $1', [id]);
    const deleted = (res.rowCount ?? 0) > 0;
    if (deleted) this.notifyEventChange(event, 'deleted');
    return deleted;
  }

  async getEvent(id: number): Promise<CalendarEvent | null> {
    const row = await postgresClient.queryOne(`
      SELECT * FROM calendar_events WHERE id = $1
    `, [id]);

    return row ? this.rowToEvent(row) : null;
  }

  async getEvents(options?: {
    startAfter?: string;
    endBefore?: string;
    calendarId?: string;
  }): Promise<CalendarEvent[]> {
    const conditions: string[] = [];
    const values: any[] = [];
    let idx = 1;

    if (options?.startAfter) { conditions.push(`end_time >= $${idx++}`);   values.push(options.startAfter); }
    if (options?.endBefore)  { conditions.push(`start_time <= $${idx++}`); values.push(options.endBefore); }
    if (options?.calendarId) { conditions.push(`calendar_id = $${idx++}`); values.push(options.calendarId); }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const rows = await postgresClient.queryAll(`
      SELECT * FROM calendar_events ${where}
      ORDER BY start_time ASC
    `, values);

    return rows.map(r => this.rowToEvent(r));
  }

  async getAllEvents(): Promise<CalendarEvent[]> {
    return this.getEvents();
  }

  private rowToEvent(row: any): CalendarEvent {
    return {
      id: row.id,
      title: row.title,
      start: new Date(row.start_time).toISOString(),
      end: new Date(row.end_time).toISOString(),
      description: row.description ?? undefined,
      location: row.location ?? undefined,
      people: row.people ?? undefined,
      calendarId: row.calendar_id ?? undefined,
      allDay: row.all_day ?? undefined,
      createdAt: row.created_at ?? undefined,
      updatedAt: row.updated_at ?? undefined,
    };
  }
}

// Singleton
export const calendarClient = new CalendarClient();