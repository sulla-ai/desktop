<template>
  <div class="min-h-screen overflow-y-auto bg-white text-[#0d0d0d] dark:bg-slate-900 dark:text-neutral-50 font-sans" :class="{ dark: isDark }">
    <div class="flex min-h-screen flex-col">
      <AgentHeader :is-dark="isDark" :toggle-theme="toggleTheme" />

      <div class="flex items-center justify-end px-4 py-3">
        <button
          type="button"
          class="flex h-10 items-center gap-2 rounded-full border border-black/10 bg-indigo-600 px-4 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700"
          @click="showAddEventModal = true"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M12 5v14M5 12h14" />
          </svg>
          Add Event
        </button>
      </div>

      <div class="flex-1 overflow-hidden">
        <ScheduleXCalendar :calendar-app="calendar" />
      </div>
    </div>

    <!-- Add Event Modal -->
    <div v-if="showAddEventModal" class="fixed inset-0 z-50 flex items-center justify-center bg-black/50" @click.self="closeModal">
      <div class="w-full max-w-md rounded-2xl border border-black/10 bg-white p-6 shadow-xl dark:border-white/10 dark:bg-neutral-900">
        <h2 class="text-lg font-semibold text-neutral-900 dark:text-white">Add Event</h2>

        <div class="mt-4 space-y-4">
          <div>
            <label class="block text-sm font-medium text-neutral-700 dark:text-neutral-300">Title</label>
            <input
              v-model="newEventTitle"
              type="text"
              class="mt-1 block w-full rounded-lg border border-black/10 bg-white px-3 py-2 text-sm text-neutral-900 placeholder-neutral-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-white/10 dark:bg-neutral-800 dark:text-white dark:placeholder-neutral-500"
              placeholder="Event title"
            />
          </div>

          <div>
            <label class="block text-sm font-medium text-neutral-700 dark:text-neutral-300">Date</label>
            <input
              v-model="newEventDate"
              type="date"
              class="mt-1 block w-full rounded-lg border border-black/10 bg-white px-3 py-2 text-sm text-neutral-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-white/10 dark:bg-neutral-800 dark:text-white"
            />
          </div>

          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="block text-sm font-medium text-neutral-700 dark:text-neutral-300">Start Time</label>
              <input
                v-model="newEventStartTime"
                type="time"
                class="mt-1 block w-full rounded-lg border border-black/10 bg-white px-3 py-2 text-sm text-neutral-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-white/10 dark:bg-neutral-800 dark:text-white"
              />
            </div>
            <div>
              <label class="block text-sm font-medium text-neutral-700 dark:text-neutral-300">End Time</label>
              <input
                v-model="newEventEndTime"
                type="time"
                class="mt-1 block w-full rounded-lg border border-black/10 bg-white px-3 py-2 text-sm text-neutral-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-white/10 dark:bg-neutral-800 dark:text-white"
              />
            </div>
          </div>

          <div>
            <label class="block text-sm font-medium text-neutral-700 dark:text-neutral-300">Location</label>
            <input
              v-model="newEventLocation"
              type="text"
              class="mt-1 block w-full rounded-lg border border-black/10 bg-white px-3 py-2 text-sm text-neutral-900 placeholder-neutral-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-white/10 dark:bg-neutral-800 dark:text-white dark:placeholder-neutral-500"
              placeholder="Location (optional)"
            />
          </div>

          <div>
            <label class="block text-sm font-medium text-neutral-700 dark:text-neutral-300">Description</label>
            <textarea
              v-model="newEventDescription"
              rows="3"
              class="mt-1 block w-full rounded-lg border border-black/10 bg-white px-3 py-2 text-sm text-neutral-900 placeholder-neutral-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-white/10 dark:bg-neutral-800 dark:text-white dark:placeholder-neutral-500"
              placeholder="Description (optional)"
            ></textarea>
          </div>
        </div>

        <div class="mt-6 flex justify-end gap-3">
          <button
            type="button"
            class="rounded-lg border border-black/10 bg-white px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50 dark:border-white/10 dark:bg-neutral-800 dark:text-neutral-300 dark:hover:bg-neutral-700"
            @click="closeModal"
          >
            Cancel
          </button>
          <button
            type="button"
            class="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
            :disabled="!newEventTitle.trim() || !newEventDate || savingEvent"
            @click="saveEvent"
          >
            {{ savingEvent ? 'Saving...' : 'Save Event' }}
          </button>
        </div>
      </div>
    </div>

    <!-- Event Info Modal -->
    <div v-if="showEventInfoModal && selectedEvent" class="fixed inset-0 z-50 flex items-center justify-center bg-black/50" @click.self="showEventInfoModal = false">
      <div class="w-full max-w-md rounded-2xl border border-black/10 bg-white p-6 shadow-xl dark:border-white/10 dark:bg-neutral-900">
        <div class="flex items-start justify-between">
          <h2 class="text-lg font-semibold text-neutral-900 dark:text-white">{{ selectedEvent.title }}</h2>
          <div class="flex items-center gap-1">
            <button
              type="button"
              class="rounded-lg p-1 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-600 dark:hover:bg-neutral-800 dark:hover:text-neutral-300"
              @click="openEditModal"
              title="Edit event"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
                <path d="m15 5 4 4" />
              </svg>
            </button>
            <button
              type="button"
              class="rounded-lg p-1 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-600 dark:hover:bg-neutral-800 dark:hover:text-neutral-300"
              @click="showEventInfoModal = false"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M18 6 6 18M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        <div class="mt-4 space-y-3">
          <div class="flex items-center gap-3 text-sm text-neutral-600 dark:text-neutral-400">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
            <span>{{ selectedEvent.start }} – {{ selectedEvent.end }}</span>
          </div>

          <div v-if="selectedEvent.location" class="flex items-center gap-3 text-sm text-neutral-600 dark:text-neutral-400">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
              <circle cx="12" cy="10" r="3" />
            </svg>
            <span>{{ selectedEvent.location }}</span>
          </div>

          <div v-if="selectedEvent.description" class="pt-2 text-sm text-neutral-700 dark:text-neutral-300">
            {{ selectedEvent.description }}
          </div>
        </div>

        <div class="mt-6 flex justify-end">
          <button
            type="button"
            class="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
            @click="showEventInfoModal = false"
          >
            Close
          </button>
        </div>
      </div>
    </div>

    <!-- Edit Event Modal -->
    <div v-if="showEditEventModal" class="fixed inset-0 z-50 flex items-center justify-center bg-black/50" @click.self="closeEditModal">
      <div class="w-full max-w-md rounded-2xl border border-black/10 bg-white p-6 shadow-xl dark:border-white/10 dark:bg-neutral-900">
        <h2 class="text-lg font-semibold text-neutral-900 dark:text-white">Edit Event</h2>

        <div class="mt-4 space-y-4">
          <div>
            <label class="block text-sm font-medium text-neutral-700 dark:text-neutral-300">Title</label>
            <input
              v-model="editEventTitle"
              type="text"
              class="mt-1 block w-full rounded-lg border border-black/10 bg-white px-3 py-2 text-sm text-neutral-900 placeholder-neutral-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-white/10 dark:bg-neutral-800 dark:text-white dark:placeholder-neutral-500"
              placeholder="Event title"
            />
          </div>

          <div>
            <label class="block text-sm font-medium text-neutral-700 dark:text-neutral-300">Date</label>
            <input
              v-model="editEventDate"
              type="date"
              class="mt-1 block w-full rounded-lg border border-black/10 bg-white px-3 py-2 text-sm text-neutral-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-white/10 dark:bg-neutral-800 dark:text-white"
            />
          </div>

          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="block text-sm font-medium text-neutral-700 dark:text-neutral-300">Start Time</label>
              <input
                v-model="editEventStartTime"
                type="time"
                class="mt-1 block w-full rounded-lg border border-black/10 bg-white px-3 py-2 text-sm text-neutral-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-white/10 dark:bg-neutral-800 dark:text-white"
              />
            </div>
            <div>
              <label class="block text-sm font-medium text-neutral-700 dark:text-neutral-300">End Time</label>
              <input
                v-model="editEventEndTime"
                type="time"
                class="mt-1 block w-full rounded-lg border border-black/10 bg-white px-3 py-2 text-sm text-neutral-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-white/10 dark:bg-neutral-800 dark:text-white"
              />
            </div>
          </div>

          <div>
            <label class="block text-sm font-medium text-neutral-700 dark:text-neutral-300">Location</label>
            <input
              v-model="editEventLocation"
              type="text"
              class="mt-1 block w-full rounded-lg border border-black/10 bg-white px-3 py-2 text-sm text-neutral-900 placeholder-neutral-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-white/10 dark:bg-neutral-800 dark:text-white dark:placeholder-neutral-500"
              placeholder="Location (optional)"
            />
          </div>

          <div>
            <label class="block text-sm font-medium text-neutral-700 dark:text-neutral-300">Description</label>
            <textarea
              v-model="editEventDescription"
              rows="3"
              class="mt-1 block w-full rounded-lg border border-black/10 bg-white px-3 py-2 text-sm text-neutral-900 placeholder-neutral-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-white/10 dark:bg-neutral-800 dark:text-white dark:placeholder-neutral-500"
              placeholder="Description (optional)"
            ></textarea>
          </div>
        </div>

        <div class="mt-6 flex justify-between">
          <button
            type="button"
            class="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-100 dark:border-red-900 dark:bg-red-950 dark:text-red-400 dark:hover:bg-red-900"
            @click="deleteEvent"
          >
            Delete
          </button>
          <div class="flex gap-3">
            <button
              type="button"
              class="rounded-lg border border-black/10 bg-white px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50 dark:border-white/10 dark:bg-neutral-800 dark:text-neutral-300 dark:hover:bg-neutral-700"
              @click="closeEditModal"
            >
              Cancel
            </button>
            <button
              type="button"
              class="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
              :disabled="!editEventTitle.trim() || !editEventDate || savingEditEvent"
              @click="updateEvent"
            >
              {{ savingEditEvent ? 'Saving...' : 'Save Changes' }}
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import AgentHeader from './agent/AgentHeader.vue';

import { ref, onMounted, watch } from 'vue';
import { ScheduleXCalendar } from '@schedule-x/vue';
import { createCalendar, createViewMonthGrid, createViewMonthAgenda, createViewWeek, createViewDay } from '@schedule-x/calendar';
import { createEventsServicePlugin } from '@schedule-x/events-service';
import '@schedule-x/theme-default/dist/index.css';
import 'temporal-polyfill/global';
import { getCalendarService } from '@pkg/agent/services/CalendarService';
const calendarService = getCalendarService();

const THEME_STORAGE_KEY = 'agentTheme';
const isDark = ref(false);
const showAddEventModal = ref(false);
const newEventTitle = ref('');
const newEventDate = ref('');
const newEventStartTime = ref('09:00');
const newEventEndTime = ref('10:00');
const newEventLocation = ref('');
const newEventDescription = ref('');
const savingEvent = ref(false);
const previewEventId = ref<string | null>(null);
const skipNextCallback = ref(false); // Skip callback when UI triggers the change

interface SelectedEvent {
  id: number;
  title: string;
  start: string;
  end: string;
  description?: string;
  location?: string;
}
const selectedEvent = ref<SelectedEvent | null>(null);
const showEventInfoModal = ref(false);

const showEditEventModal = ref(false);
const editEventId = ref<number | null>(null);
const editEventTitle = ref('');
const editEventDate = ref('');
const editEventStartTime = ref('');
const editEventEndTime = ref('');
const editEventDescription = ref('');
const editEventLocation = ref('');
const savingEditEvent = ref(false);

const toggleTheme = () => {
  isDark.value = !isDark.value;
  localStorage.setItem(THEME_STORAGE_KEY, isDark.value ? 'dark' : 'light');
  calendar.setTheme(isDark.value ? 'dark' : 'light');
};

const eventsService = createEventsServicePlugin();

const systemTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
const todayInLocalTz = Temporal.Now.zonedDateTimeISO(systemTimezone).toPlainDate();

const calendar = createCalendar({
  views: [createViewMonthGrid(), createViewMonthAgenda(), createViewWeek(), createViewDay()],
  selectedDate: todayInLocalTz,
  locale: 'en-US',
  timezone: systemTimezone,
  events: [],
  plugins: [eventsService],
  callbacks: {
    onEventClick(calendarEvent) {
      if (String(calendarEvent.id).startsWith('preview-')) {
        return;
      }
      const startZdt = calendarEvent.start as Temporal.ZonedDateTime;
      const endZdt = calendarEvent.end as Temporal.ZonedDateTime;
      const startPlain = startZdt.toPlainDateTime();
      const endPlain = endZdt.toPlainDateTime();
      selectedEvent.value = {
        id: calendarEvent.id as number,
        title: calendarEvent.title || '',
        start: startPlain.toLocaleString('en-US', { dateStyle: 'full', timeStyle: 'short' }),
        end: endPlain.toLocaleString('en-US', { timeStyle: 'short' }),
        description: calendarEvent.description,
        location: calendarEvent.location,
      };
      showEventInfoModal.value = true;
    },
    onClickDateTime(dateTime) {
      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      const clickedZdt = dateTime as Temporal.ZonedDateTime;
      const clickedPlain = clickedZdt.toPlainDateTime();
      
      newEventDate.value = clickedPlain.toPlainDate().toString();
      const hour = clickedPlain.hour.toString().padStart(2, '0');
      const minute = clickedPlain.minute.toString().padStart(2, '0');
      newEventStartTime.value = `${hour}:${minute}`;
      
      const endHour = (clickedPlain.hour + 1).toString().padStart(2, '0');
      newEventEndTime.value = `${endHour}:${minute}`;
      
      const previewId = `preview-${Date.now()}`;
      previewEventId.value = previewId;
      
      const endZdt = clickedZdt.add({ hours: 1 });
      eventsService.add({
        id: previewId,
        title: '(New Event)',
        start: clickedZdt,
        end: endZdt,
      });
      
      showAddEventModal.value = true;
    },
    onClickDate(date) {
      const clickedDate = date as Temporal.PlainDate;
      newEventDate.value = clickedDate.toString();
      newEventStartTime.value = '09:00';
      newEventEndTime.value = '10:00';
      
      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      const previewId = `preview-${Date.now()}`;
      previewEventId.value = previewId;
      
      const startZdt = Temporal.PlainDateTime.from(`${clickedDate.toString()}T09:00:00`).toZonedDateTime(timezone);
      const endZdt = startZdt.add({ hours: 1 });
      eventsService.add({
        id: previewId,
        title: '(New Event)',
        start: startZdt,
        end: endZdt,
      });
      
      showAddEventModal.value = true;
    },
  },
});

const loadEvents = async () => {
  try {
    await calendarService.initialize();
    const events = await calendarService.getAllEvents();
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const scheduleXEvents = events.map((e) => ({
      id: e.id,
      title: e.title,
      start: Temporal.Instant.from(e.start).toZonedDateTimeISO(timezone),
      end: Temporal.Instant.from(e.end).toZonedDateTimeISO(timezone),
      description: e.description,
      location: e.location,
    }));
    eventsService.set(scheduleXEvents);
    console.log(`[AgentCalendar] Loaded ${scheduleXEvents.length} events`);
  } catch (err) {
    console.warn('[AgentCalendar] Error loading events:', err);
  }
};

onMounted(async () => {
  try {
    const saved = localStorage.getItem(THEME_STORAGE_KEY);
    isDark.value = saved === 'dark';
  } catch {
    isDark.value = false;
  }

  calendar.setTheme(isDark.value ? 'dark' : 'light');

  await loadEvents();

  // Set default date to today
  const today = Temporal.Now.plainDateISO();
  newEventDate.value = today.toString();

  // Listen for calendar event changes (from tools, scheduler, etc.)
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  calendarService.onEventChange((event, action) => {
    // Skip if this change was triggered by the UI itself
    if (skipNextCallback.value) {
      skipNextCallback.value = false;
      return;
    }
    
    console.log(`[AgentCalendar] Event ${action} (external):`, event.id, event.title);
    
    if (action === 'created') {
      eventsService.add({
        id: event.id,
        title: event.title,
        start: Temporal.Instant.from(event.start).toZonedDateTimeISO(timezone),
        end: Temporal.Instant.from(event.end).toZonedDateTimeISO(timezone),
        description: event.description,
        location: event.location,
      });
    } else if (action === 'updated') {
      eventsService.update({
        id: event.id,
        title: event.title,
        start: Temporal.Instant.from(event.start).toZonedDateTimeISO(timezone),
        end: Temporal.Instant.from(event.end).toZonedDateTimeISO(timezone),
        description: event.description,
        location: event.location,
      });
    } else if (action === 'deleted') {
      eventsService.remove(event.id);
    }
  });
});

const resetEventForm = () => {
  newEventTitle.value = '';
  newEventStartTime.value = '09:00';
  newEventEndTime.value = '10:00';
  newEventLocation.value = '';
  newEventDescription.value = '';
  const today = Temporal.Now.plainDateISO();
  newEventDate.value = today.toString();
};

const closeModal = () => {
  if (previewEventId.value) {
    eventsService.remove(previewEventId.value);
    previewEventId.value = null;
  }
  showAddEventModal.value = false;
  resetEventForm();
};

const saveEvent = async () => {
  if (!newEventTitle.value.trim() || !newEventDate.value) {
    return;
  }

  savingEvent.value = true;
  try {
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const startZdt = Temporal.PlainDateTime.from(`${newEventDate.value}T${newEventStartTime.value}:00`).toZonedDateTime(timezone);
    const endZdt = Temporal.PlainDateTime.from(`${newEventDate.value}T${newEventEndTime.value}:00`).toZonedDateTime(timezone);

    console.log('[AgentCalendar] Save - Input:', newEventDate.value, newEventStartTime.value);
    console.log('[AgentCalendar] Save - ZonedDateTime:', startZdt.toString());
    console.log('[AgentCalendar] Save - Instant:', startZdt.toInstant().toString());

    skipNextCallback.value = true; // Skip callback since UI will update eventsService directly
    const event = await calendarService.createEvent({
      title: newEventTitle.value.trim(),
      start: startZdt.toInstant().toString(),
      end: endZdt.toInstant().toString(),
      location: newEventLocation.value || undefined,
      description: newEventDescription.value || undefined,
    });

    console.log('[AgentCalendar] Save - Returned from DB:', event.start);

    if (previewEventId.value) {
      eventsService.remove(previewEventId.value);
      previewEventId.value = null;
    }

    const addStartZdt = Temporal.Instant.from(event.start).toZonedDateTimeISO(timezone);
    const addEndZdt = Temporal.Instant.from(event.end).toZonedDateTimeISO(timezone);
    console.log('[AgentCalendar] Save - Adding to calendar:', addStartZdt.toString());

    eventsService.add({
      id: event.id,
      title: event.title,
      start: addStartZdt,
      end: addEndZdt,
    });
    console.log('[AgentCalendar] Created event:', event.id);
    showAddEventModal.value = false;
    resetEventForm();
  } catch (err) {
    console.error('[AgentCalendar] Error saving event:', err);
  } finally {
    savingEvent.value = false;
  }
};

const updatePreviewEvent = () => {
  if (!previewEventId.value || !newEventDate.value) return;
  
  try {
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const startZdt = Temporal.PlainDateTime.from(`${newEventDate.value}T${newEventStartTime.value}:00`).toZonedDateTime(timezone);
    const endZdt = Temporal.PlainDateTime.from(`${newEventDate.value}T${newEventEndTime.value}:00`).toZonedDateTime(timezone);
    
    eventsService.update({
      id: previewEventId.value,
      title: newEventTitle.value.trim() || '(New Event)',
      start: startZdt,
      end: endZdt,
    });
  } catch {
    // Ignore parse errors while typing
  }
};

watch([newEventDate, newEventStartTime, newEventEndTime, newEventTitle], () => {
  updatePreviewEvent();
});

const openEditModal = async () => {
  if (!selectedEvent.value) return;
  
  const eventData = await calendarService.getEvent(selectedEvent.value.id);
  if (!eventData) return;
  
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const startZdt = Temporal.Instant.from(eventData.start).toZonedDateTimeISO(timezone);
  const endZdt = Temporal.Instant.from(eventData.end).toZonedDateTimeISO(timezone);
  
  editEventId.value = eventData.id;
  editEventTitle.value = eventData.title;
  editEventDate.value = startZdt.toPlainDate().toString();
  editEventStartTime.value = `${startZdt.hour.toString().padStart(2, '0')}:${startZdt.minute.toString().padStart(2, '0')}`;
  editEventEndTime.value = `${endZdt.hour.toString().padStart(2, '0')}:${endZdt.minute.toString().padStart(2, '0')}`;
  editEventDescription.value = eventData.description || '';
  editEventLocation.value = eventData.location || '';
  
  showEventInfoModal.value = false;
  showEditEventModal.value = true;
};

const closeEditModal = () => {
  showEditEventModal.value = false;
  editEventId.value = null;
  editEventTitle.value = '';
  editEventDate.value = '';
  editEventStartTime.value = '';
  editEventEndTime.value = '';
  editEventDescription.value = '';
  editEventLocation.value = '';
};

const updateEvent = async () => {
  if (!editEventId.value || !editEventTitle.value.trim() || !editEventDate.value) {
    return;
  }

  savingEditEvent.value = true;
  try {
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const startZdt = Temporal.PlainDateTime.from(`${editEventDate.value}T${editEventStartTime.value}:00`).toZonedDateTime(timezone);
    const endZdt = Temporal.PlainDateTime.from(`${editEventDate.value}T${editEventEndTime.value}:00`).toZonedDateTime(timezone);

    skipNextCallback.value = true; // Skip callback since UI will update eventsService directly
    const updatedEvent = await calendarService.updateEvent(editEventId.value, {
      title: editEventTitle.value.trim(),
      start: startZdt.toInstant().toString(),
      end: endZdt.toInstant().toString(),
      description: editEventDescription.value || undefined,
      location: editEventLocation.value || undefined,
    });

    if (updatedEvent) {
      eventsService.update({
        id: updatedEvent.id,
        title: updatedEvent.title,
        start: Temporal.Instant.from(updatedEvent.start).toZonedDateTimeISO(timezone),
        end: Temporal.Instant.from(updatedEvent.end).toZonedDateTimeISO(timezone),
        description: updatedEvent.description,
        location: updatedEvent.location,
      });
      console.log('[AgentCalendar] Updated event:', updatedEvent.id);
    }
    closeEditModal();
  } catch (err) {
    console.error('[AgentCalendar] Error updating event:', err);
  } finally {
    savingEditEvent.value = false;
  }
};

const deleteEvent = async () => {
  if (!editEventId.value) return;
  
  const confirmed = confirm('Are you sure you want to delete this event?');
  if (!confirmed) return;
  
  try {
    skipNextCallback.value = true; // Skip callback since UI will update eventsService directly
    const deleted = await calendarService.deleteEvent(editEventId.value);
    if (deleted) {
      eventsService.remove(editEventId.value);
      console.log('[AgentCalendar] Deleted event:', editEventId.value);
    }
    closeEditModal();
  } catch (err) {
    console.error('[AgentCalendar] Error deleting event:', err);
  }
};
</script>

<style>
.sx-vue-calendar-wrapper {
  width: 100%;
  height: 100%;
}

div.sx__calendar,.sx__calendar,
.sx-vue-calendar-wrapper .sx-calendar {
  border: none;
}

.dark div.sx__calendar,
.dark .sx__calendar,
.dark .sx-vue-calendar-wrapper .sx-calendar {
  background-color: color-mix(in oklab, var(--color-slate-900) 75%, transparent);
}

div.sx__calendar,
.sx__calendar,
.dark div.sx__calendar,
.dark .sx__calendar,
.dark .sx-vue-calendar-wrapper {
  --sx-color-primary: var(--color-sky-300);
  --sx-color-on-primary: var(--color-slate-900);
  --sx-color-primary-container: color-mix(in oklab, var(--color-sky-300) 25%, transparent);
  --sx-color-on-primary-container: var(--color-sky-100);
  --sx-color-neutral: var(--color-slate-400);
  --sx-color-neutral-variant: var(--color-slate-400);
}

</style>
