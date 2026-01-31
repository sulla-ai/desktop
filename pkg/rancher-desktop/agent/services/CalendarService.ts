// CalendarService - PostgreSQL-backed calendar events management
// Provides CRUD operations for calendar events compatible with Schedule-X

import pg from 'pg';

const POSTGRES_URL = 'postgresql://sulla:sulla_dev_password@127.0.0.1:30116/sulla';

export interface CalendarEvent {
  id: number;
  title: string;
  start: string;
  end: string;
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
  start: string;
  end: string;
  description?: string;
  location?: string;
  people?: string[];
  calendarId?: string;
  allDay?: boolean;
}

let calendarServiceInstance: CalendarService | null = null;

export function getCalendarService(): CalendarService {
  if (!calendarServiceInstance) {
    calendarServiceInstance = new CalendarService();
  }
  return calendarServiceInstance;
}

export class CalendarService {
  private initialized = false;

  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    console.log('[CalendarService] Initializing...');
    await this.ensureTables();
    this.initialized = true;
    console.log('[CalendarService] Initialized');
  }

  private async ensureTables(): Promise<void> {
    const client = new pg.Client({ connectionString: POSTGRES_URL });
    await client.connect();

    try {
      await client.query(`
        CREATE TABLE IF NOT EXISTS calendar_events (
          id SERIAL PRIMARY KEY,
          title VARCHAR(500) NOT NULL,
          start_time TIMESTAMP WITH TIME ZONE NOT NULL,
          end_time TIMESTAMP WITH TIME ZONE NOT NULL,
          description TEXT,
          location VARCHAR(500),
          people JSONB DEFAULT '[]'::jsonb,
          calendar_id VARCHAR(100),
          all_day BOOLEAN DEFAULT FALSE,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);

      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_calendar_events_start ON calendar_events(start_time)
      `);
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_calendar_events_end ON calendar_events(end_time)
      `);
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_calendar_events_calendar_id ON calendar_events(calendar_id)
      `);

      console.log('[CalendarService] Tables ensured');
    } finally {
      await client.end();
    }
  }

  async createEvent(event: CalendarEventInput): Promise<CalendarEvent> {
    const client = new pg.Client({ connectionString: POSTGRES_URL });
    await client.connect();

    try {
      const result = await client.query(
        `
        INSERT INTO calendar_events (title, start_time, end_time, description, location, people, calendar_id, all_day)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING id, title, start_time, end_time, description, location, people, calendar_id, all_day, created_at, updated_at
        `,
        [
          event.title,
          event.start,
          event.end,
          event.description || null,
          event.location || null,
          JSON.stringify(event.people || []),
          event.calendarId || null,
          event.allDay || false,
        ],
      );

      const row = result.rows[0];
      console.log(`[CalendarService] Created event: ${row.id} - ${row.title}`);
      return this.rowToEvent(row);
    } finally {
      await client.end();
    }
  }

  async updateEvent(id: number, event: Partial<CalendarEventInput>): Promise<CalendarEvent | null> {
    const client = new pg.Client({ connectionString: POSTGRES_URL });
    await client.connect();

    try {
      const fields: string[] = [];
      const values: unknown[] = [];
      let paramIndex = 1;

      if (event.title !== undefined) {
        fields.push(`title = $${paramIndex++}`);
        values.push(event.title);
      }
      if (event.start !== undefined) {
        fields.push(`start_time = $${paramIndex++}`);
        values.push(event.start);
      }
      if (event.end !== undefined) {
        fields.push(`end_time = $${paramIndex++}`);
        values.push(event.end);
      }
      if (event.description !== undefined) {
        fields.push(`description = $${paramIndex++}`);
        values.push(event.description);
      }
      if (event.location !== undefined) {
        fields.push(`location = $${paramIndex++}`);
        values.push(event.location);
      }
      if (event.people !== undefined) {
        fields.push(`people = $${paramIndex++}`);
        values.push(JSON.stringify(event.people));
      }
      if (event.calendarId !== undefined) {
        fields.push(`calendar_id = $${paramIndex++}`);
        values.push(event.calendarId);
      }
      if (event.allDay !== undefined) {
        fields.push(`all_day = $${paramIndex++}`);
        values.push(event.allDay);
      }

      if (fields.length === 0) {
        return this.getEvent(id);
      }

      fields.push(`updated_at = CURRENT_TIMESTAMP`);
      values.push(id);

      const result = await client.query(
        `
        UPDATE calendar_events
        SET ${fields.join(', ')}
        WHERE id = $${paramIndex}
        RETURNING id, title, start_time, end_time, description, location, people, calendar_id, all_day, created_at, updated_at
        `,
        values,
      );

      if (result.rows.length === 0) {
        return null;
      }

      console.log(`[CalendarService] Updated event: ${id}`);
      return this.rowToEvent(result.rows[0]);
    } finally {
      await client.end();
    }
  }

  async deleteEvent(id: number): Promise<boolean> {
    const client = new pg.Client({ connectionString: POSTGRES_URL });
    await client.connect();

    try {
      const result = await client.query(
        'DELETE FROM calendar_events WHERE id = $1',
        [id],
      );

      const deleted = result.rowCount !== null && result.rowCount > 0;
      if (deleted) {
        console.log(`[CalendarService] Deleted event: ${id}`);
      }
      return deleted;
    } finally {
      await client.end();
    }
  }

  async getEvent(id: number): Promise<CalendarEvent | null> {
    const client = new pg.Client({ connectionString: POSTGRES_URL });
    await client.connect();

    try {
      const result = await client.query(
        `
        SELECT id, title, start_time, end_time, description, location, people, calendar_id, all_day, created_at, updated_at
        FROM calendar_events
        WHERE id = $1
        `,
        [id],
      );

      if (result.rows.length === 0) {
        return null;
      }

      return this.rowToEvent(result.rows[0]);
    } finally {
      await client.end();
    }
  }

  async getEvents(options?: {
    startAfter?: string;
    endBefore?: string;
    calendarId?: string;
  }): Promise<CalendarEvent[]> {
    const client = new pg.Client({ connectionString: POSTGRES_URL });
    await client.connect();

    try {
      const conditions: string[] = [];
      const values: unknown[] = [];
      let paramIndex = 1;

      if (options?.startAfter) {
        conditions.push(`end_time >= $${paramIndex++}`);
        values.push(options.startAfter);
      }
      if (options?.endBefore) {
        conditions.push(`start_time <= $${paramIndex++}`);
        values.push(options.endBefore);
      }
      if (options?.calendarId) {
        conditions.push(`calendar_id = $${paramIndex++}`);
        values.push(options.calendarId);
      }

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

      const result = await client.query(
        `
        SELECT id, title, start_time, end_time, description, location, people, calendar_id, all_day, created_at, updated_at
        FROM calendar_events
        ${whereClause}
        ORDER BY start_time ASC
        `,
        values,
      );

      console.log(`[CalendarService] Fetched ${result.rows.length} events`);
      return result.rows.map(row => this.rowToEvent(row));
    } finally {
      await client.end();
    }
  }

  async getAllEvents(): Promise<CalendarEvent[]> {
    return this.getEvents();
  }

  private rowToEvent(row: Record<string, unknown>): CalendarEvent {
    return {
      id: row.id as number,
      title: row.title as string,
      start: (row.start_time as Date).toISOString(),
      end: (row.end_time as Date).toISOString(),
      description: row.description as string | undefined,
      location: row.location as string | undefined,
      people: row.people as string[] | undefined,
      calendarId: row.calendar_id as string | undefined,
      allDay: row.all_day as boolean | undefined,
      createdAt: row.created_at as Date | undefined,
      updatedAt: row.updated_at as Date | undefined,
    };
  }
}
