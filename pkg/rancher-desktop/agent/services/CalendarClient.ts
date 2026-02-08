// src/services/CalendarClient.ts
// PostgreSQL-backed calendar client — singleton wrapper for LLM/agent use

import { postgresClient } from '../database/PostgresClient';
import { CalendarEvent } from '../database/models/CalendarEvent';
import { getWebSocketClientService } from './WebSocketClientService';

export interface CalendarEventData {
  id: number;
  title: string;
  start: string;          // ISO string
  end: string;            // ISO string
  description?: string;
  location?: string;
  people?: string[];
  calendarId?: string;
  allDay?: boolean;
  status?: 'active' | 'cancelled' | 'completed';
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
  status?: 'active' | 'cancelled' | 'completed';
}

export class CalendarClient {
  private static instance: CalendarClient | null = null;

  static getInstance(): CalendarClient {
    return this.instance ?? (this.instance = new CalendarClient());
  }

  private constructor() {}

  async create(input: CalendarEventInput): Promise<CalendarEventData> {
    const event = await CalendarEvent.create({
      title: input.title,
      start_time: input.start,
      end_time: input.end,
      description: input.description,
      location: input.location,
      people: input.people,
      calendar_id: input.calendarId,
      all_day: input.allDay,
      status: input.status ?? 'active',
    });

    if (!event?.id) throw new Error('Failed to create calendar event');

    const data = this.toData(event);
    this.notify(data, 'created');
    return data;
  }

  async update(id: number, updates: Partial<CalendarEventInput>): Promise<CalendarEventData | null> {
    const event = await CalendarEvent.find(id);
    if (!event) return null;

    event.updateAttributes({
      title: updates.title,
      start_time: updates.start,
      end_time: updates.end,
      description: updates.description,
      location: updates.location,
      people: updates.people,
      calendar_id: updates.calendarId,
      all_day: updates.allDay,
      status: updates.status,
    });

    await event.save();
    const data = this.toData(event);
    this.notify(data, 'updated');
    return data;
  }

  async delete(id: number): Promise<boolean> {
    const event = await CalendarEvent.find(id);
    if (!event) return false;

    await event.delete();
    const data = this.toData(event);
    this.notify(data, 'deleted');
    return true;
  }

  async cancel(id: number): Promise<CalendarEventData | null> {
    const event = await CalendarEvent.find(id);
    if (!event) return null;

    event.attributes.status = 'cancelled';
    await event.save();

    const data = this.toData(event);
    this.notify(data, 'updated');
    return data;
  }

  async get(id: number): Promise<CalendarEventData | null> {
    const event = await CalendarEvent.find(id);
    return event ? this.toData(event) : null;
  }

  async getUpcoming(limit = 10, startAfter?: string): Promise<CalendarEventData[]> {
    const events = await CalendarEvent.findUpcoming(limit, startAfter);
    return events.map(e => this.toData(e));
  }

  async getAll(): Promise<CalendarEventData[]> {
    const events = await CalendarEvent.getAllEvents();
    return events.map(e => this.toData(e));
  }

  async getEvents(options: {
    startAfter?: string;
    endBefore?: string;
    calendarId?: string;
  }): Promise<CalendarEventData[]> {
    const events = await CalendarEvent.findWithFilters(options);
    return events.map((e: CalendarEvent) => this.toData(e));
  }

  private toData(event: CalendarEvent): CalendarEventData {
    return {
      id: event.id!,
      title: event.attributes.title || '',
      start: event.attributes.start_time || '',
      end: event.attributes.end_time || '',
      description: event.attributes.description,
      location: event.attributes.location,
      people: event.attributes.people,
      calendarId: event.attributes.calendar_id,
      allDay: event.attributes.all_day,
      status: event.attributes.status,
      createdAt: event.attributes.created_at ? new Date(event.attributes.created_at) : undefined,
      updatedAt: event.attributes.updated_at ? new Date(event.attributes.updated_at) : undefined,
    };
  }

  private notify(data: CalendarEventData, action: 'created' | 'updated' | 'deleted') {
    const ws = getWebSocketClientService();
    ws.send('calendar_event', {
      type: action === 'created' ? 'scheduled' : action === 'deleted' ? 'cancel' : 'updated',
      event: data,
    });
  }
}

export const calendarClient = CalendarClient.getInstance();