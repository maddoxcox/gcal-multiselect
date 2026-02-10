// Google Calendar API Wrapper
// Handles all Calendar API v3 operations

const API_BASE = 'https://www.googleapis.com/calendar/v3';
const BATCH_SIZE = 50; // Google API batch limit

export class CalendarAPI {
  constructor(accessToken) {
    this.accessToken = accessToken;
  }

  // Make authenticated API request
  async request(endpoint, options = {}) {
    const url = endpoint.startsWith('http') ? endpoint : `${API_BASE}${endpoint}`;

    const response = await fetch(url, {
      ...options,
      headers: {
        'Authorization': `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json',
        ...options.headers
      }
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: { message: response.statusText } }));
      throw new Error(error.error?.message || `API Error: ${response.status}`);
    }

    // Handle 204 No Content
    if (response.status === 204) {
      return null;
    }

    return response.json();
  }

  // Get list of user's calendars
  async getCalendarList() {
    const data = await this.request('/users/me/calendarList');
    return data.items.map(cal => ({
      id: cal.id,
      summary: cal.summary,
      primary: cal.primary || false,
      backgroundColor: cal.backgroundColor,
      accessRole: cal.accessRole
    }));
  }

  // Delete multiple events
  async deleteEvents(events) {
    const results = {
      success: [],
      failed: []
    };

    // Process in batches
    for (let i = 0; i < events.length; i += BATCH_SIZE) {
      const batch = events.slice(i, i + BATCH_SIZE);
      const batchResults = await Promise.allSettled(
        batch.map(event => this.deleteEvent(event))
      );

      batchResults.forEach((result, index) => {
        const event = batch[index];
        if (result.status === 'fulfilled') {
          results.success.push(event.eventId);
        } else {
          results.failed.push({
            eventId: event.eventId,
            error: result.reason?.message || 'Unknown error'
          });
        }
      });
    }

    return results;
  }

  // Delete a single event
  async deleteEvent(event) {
    const calendarId = encodeURIComponent(event.calendarId || 'primary');
    const eventId = encodeURIComponent(event.eventId);

    await this.request(`/calendars/${calendarId}/events/${eventId}`, {
      method: 'DELETE'
    });

    return { success: true };
  }

  // Move multiple events to a new calendar or reschedule
  async moveEvents(events, targetCalendarId, newDateTime) {
    const results = {
      success: [],
      failed: []
    };

    for (let i = 0; i < events.length; i += BATCH_SIZE) {
      const batch = events.slice(i, i + BATCH_SIZE);
      const batchResults = await Promise.allSettled(
        batch.map(event => this.moveEvent(event, targetCalendarId, newDateTime))
      );

      batchResults.forEach((result, index) => {
        const event = batch[index];
        if (result.status === 'fulfilled') {
          results.success.push(event.eventId);
        } else {
          results.failed.push({
            eventId: event.eventId,
            error: result.reason?.message || 'Unknown error'
          });
        }
      });
    }

    return results;
  }

  // Move a single event
  async moveEvent(event, targetCalendarId, newDateTime) {
    const sourceCalendarId = encodeURIComponent(event.calendarId || 'primary');
    const eventId = encodeURIComponent(event.eventId);

    // If moving to a different calendar
    if (targetCalendarId && targetCalendarId !== event.calendarId) {
      const targetId = encodeURIComponent(targetCalendarId);
      await this.request(
        `/calendars/${sourceCalendarId}/events/${eventId}/move?destination=${targetId}`,
        { method: 'POST' }
      );
    }

    // If rescheduling to a new date/time
    if (newDateTime) {
      const calendarId = encodeURIComponent(targetCalendarId || event.calendarId || 'primary');

      // First get the current event to preserve other properties
      const currentEvent = await this.request(
        `/calendars/${calendarId}/events/${eventId}`
      );

      // Calculate duration
      const startDate = new Date(currentEvent.start.dateTime || currentEvent.start.date);
      const endDate = new Date(currentEvent.end.dateTime || currentEvent.end.date);
      const duration = endDate - startDate;

      // Create new start/end times
      const newStart = new Date(newDateTime);
      const newEnd = new Date(newStart.getTime() + duration);

      const updateBody = {
        start: currentEvent.start.dateTime
          ? { dateTime: newStart.toISOString(), timeZone: currentEvent.start.timeZone }
          : { date: newStart.toISOString().split('T')[0] },
        end: currentEvent.end.dateTime
          ? { dateTime: newEnd.toISOString(), timeZone: currentEvent.end.timeZone }
          : { date: newEnd.toISOString().split('T')[0] }
      };

      await this.request(
        `/calendars/${calendarId}/events/${eventId}`,
        {
          method: 'PATCH',
          body: JSON.stringify(updateBody)
        }
      );
    }

    return { success: true };
  }

  // Get event details
  async getEvent(calendarId, eventId) {
    const calId = encodeURIComponent(calendarId || 'primary');
    const evtId = encodeURIComponent(eventId);
    return this.request(`/calendars/${calId}/events/${evtId}`);
  }

  // Move multiple events by a time delta (for drag operations)
  async moveEventsByDelta(events, timeDelta) {
    const results = {
      success: [],
      failed: []
    };

    for (let i = 0; i < events.length; i += BATCH_SIZE) {
      const batch = events.slice(i, i + BATCH_SIZE);
      const batchResults = await Promise.allSettled(
        batch.map(event => this.moveEventByDelta(event, timeDelta))
      );

      batchResults.forEach((result, index) => {
        const event = batch[index];
        if (result.status === 'fulfilled') {
          results.success.push(event.eventId);
        } else {
          results.failed.push({
            eventId: event.eventId,
            error: result.reason?.message || 'Unknown error'
          });
        }
      });
    }

    return results;
  }

  // Move a single event by a time delta
  async moveEventByDelta(event, timeDelta) {
    const calendarId = encodeURIComponent(event.calendarId || 'primary');
    const eventId = encodeURIComponent(event.eventId);

    // Get the current event
    const currentEvent = await this.request(
      `/calendars/${calendarId}/events/${eventId}`
    );

    // Calculate new times by adding the delta
    const startDate = new Date(currentEvent.start.dateTime || currentEvent.start.date);
    const endDate = new Date(currentEvent.end.dateTime || currentEvent.end.date);

    const newStart = new Date(startDate.getTime() + timeDelta);
    const newEnd = new Date(endDate.getTime() + timeDelta);

    const updateBody = {
      start: currentEvent.start.dateTime
        ? { dateTime: newStart.toISOString(), timeZone: currentEvent.start.timeZone }
        : { date: newStart.toISOString().split('T')[0] },
      end: currentEvent.end.dateTime
        ? { dateTime: newEnd.toISOString(), timeZone: currentEvent.end.timeZone }
        : { date: newEnd.toISOString().split('T')[0] }
    };

    await this.request(
      `/calendars/${calendarId}/events/${eventId}`,
      {
        method: 'PATCH',
        body: JSON.stringify(updateBody)
      }
    );

    return { success: true };
  }
}
