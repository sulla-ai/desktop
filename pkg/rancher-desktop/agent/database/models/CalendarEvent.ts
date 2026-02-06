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
  ];

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
}