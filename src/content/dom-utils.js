// Google Calendar Multi-Select - DOM Utilities
// Functions for finding and parsing event elements in the Google Calendar DOM

(function() {
  'use strict';

  const G = window.GCalMS;

  // Find the event element from a click target
  G.findEventElement = function(target) {
    for (const selector of G.EVENT_SELECTORS) {
      const element = target.closest(selector);
      if (element) return element;
    }
    return null;
  };

  // Decode base64 event data from Google Calendar DOM
  G.decodeEventData = function(encodedId) {
    const tryDecode = (value) => {
      try {
        const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
        const padded = normalized + '='.repeat((4 - (normalized.length % 4)) % 4);
        return atob(padded);
      } catch {
        return null;
      }
    };

    const decoded = tryDecode(encodedId);
    if (decoded) {
      const parts = decoded.split(' ');
      if (parts.length >= 2) {
        const calendarId = parts[parts.length - 1];
        const eventId = parts.slice(0, -1).join(' ');
        if (calendarId.includes('@') || calendarId.includes('calendar.google.com')) {
          return { eventId, calendarId };
        }
      }
    }

    // Fallback: treat as raw event ID (calendarId resolved elsewhere)
    return { eventId: encodedId, calendarId: null };
  };

  // Generate temporary ID for events without data-eventid
  G.generateTempId = function(element) {
    const rect = element.getBoundingClientRect();
    return `temp-${rect.top}-${rect.left}-${element.textContent?.slice(0, 20)}`;
  };

  // Extract calendar ID from event element
  G.extractCalendarId = function(element) {
    const dataCalendarId = element.getAttribute('data-calendarid');
    if (dataCalendarId) return dataCalendarId;
    return 'primary';
  };

  // Get event info from DOM element
  G.getEventInfo = function(element) {
    const rawEventId = element.getAttribute('data-eventid') ||
                       element.getAttribute('data-eventchip') ||
                       G.generateTempId(element);

    const decoded = G.decodeEventData(rawEventId);
    let calendarId = G.HARDCODED_CALENDAR_ID;

    if (G.DEBUG) {
      console.log('[GCal Multi-Select] Event info', {
        rawEventId,
        decoded,
        calendarId
      });
    }

    const titleEl = element.querySelector('[aria-hidden="true"]') ||
                   element.querySelector('.FAxxKc') ||
                   element;
    const title = titleEl?.textContent?.trim() || 'Untitled Event';

    return {
      eventId: decoded.eventId,
      title,
      calendarId,
      element,
      rawEventId
    };
  };

  // Get all visible event elements
  G.getAllVisibleEvents = function() {
    const events = [];
    for (const selector of G.EVENT_SELECTORS) {
      document.querySelectorAll(selector).forEach(el => {
        if (!events.includes(el)) {
          events.push(el);
        }
      });
    }
    return events;
  };
})();
