// Google Calendar Multi-Select Background Service Worker
// Handles OAuth authentication and Google Calendar API calls

const API_BASE = 'https://www.googleapis.com/calendar/v3';
const BATCH_SIZE = 50;

// State
let authToken = null;
let calendarAPI = null;

// Calendar API Class
class CalendarAPI {
  constructor(accessToken) {
    this.accessToken = accessToken;
  }

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
      console.error('[GCal Multi-Select] API Error:', response.status, error);
      throw new Error(error.error?.message || `API Error: ${response.status}`);
    }

    if (response.status === 204) {
      return null;
    }

    return response.json();
  }

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

  async deleteEvents(events) {
    const results = { success: [], failed: [] };

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

  async deleteEvent(event) {
    const calendarId = encodeURIComponent(event.calendarId || 'primary');
    const eventId = encodeURIComponent(event.eventId);

    const url = `/calendars/${calendarId}/events/${eventId}`;
    console.log('[GCal Multi-Select] DELETE request:', url);

    await this.request(url, {
      method: 'DELETE'
    });

    return { success: true };
  }

  async moveEvents(events, targetCalendarId, newDateTime) {
    const results = { success: [], failed: [] };

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

  async moveEvent(event, targetCalendarId, newDateTime) {
    const sourceCalendarId = encodeURIComponent(event.calendarId || 'primary');
    const eventId = encodeURIComponent(event.eventId);

    if (targetCalendarId && targetCalendarId !== event.calendarId) {
      const targetId = encodeURIComponent(targetCalendarId);
      await this.request(
        `/calendars/${sourceCalendarId}/events/${eventId}/move?destination=${targetId}`,
        { method: 'POST' }
      );
    }

    if (newDateTime) {
      const calendarId = encodeURIComponent(targetCalendarId || event.calendarId || 'primary');

      const currentEvent = await this.request(
        `/calendars/${calendarId}/events/${eventId}`
      );

      const startDate = new Date(currentEvent.start.dateTime || currentEvent.start.date);
      const endDate = new Date(currentEvent.end.dateTime || currentEvent.end.date);
      const duration = endDate - startDate;

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

  async moveEventsByDelta(events, timeDelta) {
    const results = { success: [], failed: [] };

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

  async moveEventByDelta(event, timeDelta) {
    const calendarIdRaw = event.calendarId || 'primary';
    const eventIdRaw = event.eventId;
    const calendarId = encodeURIComponent(calendarIdRaw);
    const eventId = encodeURIComponent(eventIdRaw);

    console.log('[GCal Multi-Select] MOVE_EVENT_BY_DELTA', { calendarId: calendarIdRaw, eventId: eventIdRaw, timeDelta });

    const currentEvent = await this.request(
      `/calendars/${calendarId}/events/${eventId}`
    );

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

  async getEventTime(event) {
    const calendarIdRaw = event.calendarId || 'primary';
    const eventIdRaw = event.eventId;
    const calendarId = encodeURIComponent(calendarIdRaw);
    const eventId = encodeURIComponent(eventIdRaw);

    console.log('[GCal Multi-Select] GET_EVENT_TIME', { calendarId: calendarIdRaw, eventId: eventIdRaw });

    const currentEvent = await this.request(
      `/calendars/${calendarId}/events/${eventId}`
    );

    return {
      start: currentEvent.start.dateTime || currentEvent.start.date,
      end: currentEvent.end.dateTime || currentEvent.end.date
    };
  }
}

// Initialize on install
chrome.runtime.onInstalled.addListener(() => {
  console.log('[GCal Multi-Select] Extension installed');
});

// Get OAuth token
async function getAuthToken(interactive = true) {
  return new Promise((resolve, reject) => {
    chrome.identity.getAuthToken({ interactive }, (token) => {
      if (chrome.runtime.lastError) {
        console.error('[GCal Multi-Select] Auth error:', chrome.runtime.lastError);
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }
      authToken = token;
      calendarAPI = new CalendarAPI(token);
      console.log('[GCal Multi-Select] Authenticated successfully');
      resolve(token);
    });
  });
}

// Remove cached token
async function removeCachedToken() {
  if (authToken) {
    return new Promise((resolve) => {
      chrome.identity.removeCachedAuthToken({ token: authToken }, () => {
        authToken = null;
        calendarAPI = null;
        resolve();
      });
    });
  }
}

// Handle messages from content script and popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('[GCal Multi-Select] Received message:', message.type);
  handleMessage(message, sender, sendResponse);
  return true;
});

async function handleMessage(message, sender, sendResponse) {
  try {
    switch (message.type) {
      case 'GET_AUTH_STATUS':
        try {
          await getAuthToken(false);
          sendResponse({ authenticated: true });
        } catch {
          sendResponse({ authenticated: false });
        }
        break;

      case 'AUTHENTICATE':
        try {
          await getAuthToken(true);
          sendResponse({ success: true });
        } catch (error) {
          sendResponse({ success: false, error: error.message });
        }
        break;

      case 'LOGOUT':
        await removeCachedToken();
        sendResponse({ success: true });
        break;

      case 'DELETE_EVENTS':
        console.log('[GCal Multi-Select] Deleting events:', message.events);
        await ensureAuthenticated();
        const deleteResults = await calendarAPI.deleteEvents(message.events);
        console.log('[GCal Multi-Select] Delete results:', deleteResults);
        sendResponse(deleteResults);
        break;

      case 'MOVE_EVENTS':
        await ensureAuthenticated();
        const moveResults = await calendarAPI.moveEvents(
          message.events,
          message.targetCalendarId,
          message.newDateTime
        );
        sendResponse(moveResults);
        break;

      case 'MOVE_EVENTS_BY_DELTA':
        console.log('[GCal Multi-Select] Moving events by delta:', message.timeDelta);
        console.log('[GCal Multi-Select] Events to move:', message.events);
        await ensureAuthenticated();
        const deltaResults = await calendarAPI.moveEventsByDelta(
          message.events,
          message.timeDelta
        );
        console.log('[GCal Multi-Select] Move results:', deltaResults);
        sendResponse(deltaResults);
        break;

      case 'GET_CALENDARS':
        await ensureAuthenticated();
        const calendars = await calendarAPI.getCalendarList();
        sendResponse({ calendars });
        break;

      case 'GET_EVENT_TIME':
        await ensureAuthenticated();
        const times = await calendarAPI.getEventTime(message.event);
        sendResponse(times);
        break;

      case 'SELECTION_CHANGED':
        chrome.storage.local.set({ selectedEvents: message.data });
        sendResponse({ success: true });
        break;

      default:
        sendResponse({ error: 'Unknown message type' });
    }
  } catch (error) {
    console.error('[GCal Multi-Select] Error handling message:', error);
    sendResponse({ error: error.message });
  }
}

async function ensureAuthenticated() {
  if (!authToken) {
    await getAuthToken(true);
  }
  if (!calendarAPI) {
    calendarAPI = new CalendarAPI(authToken);
  }
}

console.log('[GCal Multi-Select] Background script loaded');
