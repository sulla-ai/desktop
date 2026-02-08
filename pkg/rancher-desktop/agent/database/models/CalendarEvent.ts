// src/models/CalendarEvent.ts

import { BaseModel } from '../BaseModel';

export type CalendarEventStatus = 'active' | 'cancelled' | 'completed';

export interface CalendarEventAttributes {
  id?: number;
  title: string;
  start_time: string;           // ISO string
  end_time: string;             // ISO string
  description?: string;
  location?: string;
  people?: string[];
  calendar_id?: string;
  all_day?: boolean;
  status?: 'active' | 'cancelled' | 'completed';
  created_at?: string;
  updated_at?: string;
}

export class CalendarEvent extends BaseModel<CalendarEventAttributes> {
  protected tableName = 'calendar_events';
  protected primaryKey = 'id';
  protected fillable = [
    'title',
    'start_time',
    'end_time',
    'description',
    'location',
    'people',
    'calendar_id',
    'all_day',
    'status'
  ];
  protected guarded = ['id', 'created_at', 'updated_at'];

  // Static helpers
  static async getAllEvents(): Promise<CalendarEvent[]> {
    return this.all();
  }

  static async findUpcoming(
    limit = 10,
    startAfter: string = new Date().toISOString()
  ): Promise<CalendarEvent[]> {
    return this.where(
      'start_time >= $1',
      startAfter
    ).then(results => results.slice(0, limit));
  }

  static async findByCalendar(
    calendarId: string,
    limit = 20
  ): Promise<CalendarEvent[]> {
    return this.where({ calendar_id: calendarId }, null).then(results =>
      results.slice(0, limit)
    );
  }

  static async findWithFilters(options: {
    startAfter?: string;
    endBefore?: string;
    calendarId?: string;
  }): Promise<CalendarEvent[]> {
    const conditions: string[] = [];
    const params: any[] = [];

    if (options.startAfter) {
      conditions.push(`start_time >= $${params.length + 1}`);
      params.push(options.startAfter);
    }

    if (options.endBefore) {
      conditions.push(`end_time <= $${params.length + 1}`);
      params.push(options.endBefore);
    }

    if (options.calendarId) {
      conditions.push(`calendar_id = $${params.length + 1}`);
      params.push(options.calendarId);
    }

    const whereClause = conditions.length > 0 ? conditions.join(' AND ') : '1=1';
    
    return this.where(whereClause, params.length > 0 ? params : undefined);
  }

  // Instance methods
  async isAllDay(): Promise<boolean> {
    return !!this.attributes.all_day;
  }

  async isUpcoming(): Promise<boolean> {
    const now = new Date();
    const start = new Date(this.attributes.start_time!);
    return start > now;
  }

  async markCancelled(): Promise<this> {
    // Optional: add status field later if needed
    // For now just log or soft-delete
    return this;
  }

  // Override save method to add logging and WebSocket notification
  async save(): Promise<this> {
    const isNew = !this.exists;
    const eventId = this.attributes.id || 'new';
    
    console.log(`[CalendarEvent] ${isNew ? 'Creating' : 'Updating'} calendar event:`, {
      id: eventId,
      title: this.attributes.title,
      start: this.attributes.start_time,
      end: this.attributes.end_time
    });

    const result = await super.save();

    console.log(`[CalendarEvent] Successfully ${isNew ? 'created' : 'updated'} calendar event:`, {
      id: this.attributes.id,
      title: this.attributes.title,
      start: this.attributes.start_time,
      end: this.attributes.end_time
    });

    return result;
  }
}