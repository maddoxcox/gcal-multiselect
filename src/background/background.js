// Google Calendar Multi-Select Background Service Worker
// Handles OAuth authentication and Google Calendar API calls

import { CalendarAPI } from '../utils/calendar-api.js';

// State
let authToken = null;
let calendarAPI = null;

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
      resolve(token);
    });
  });
}

// Remove cached token (for re-auth)
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
  handleMessage(message, sender, sendResponse);
  return true; // Keep channel open for async response
});

async function handleMessage(message, sender, sendResponse) {
  try {
    switch (message.type) {
      case 'GET_AUTH_STATUS':
        try {
          // Try non-interactive first
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
        await ensureAuthenticated();
        const deleteResults = await calendarAPI.deleteEvents(message.events);
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
        await ensureAuthenticated();
        const deltaResults = await calendarAPI.moveEventsByDelta(
          message.events,
          message.timeDelta
        );
        sendResponse(deltaResults);
        break;

      case 'GET_CALENDARS':
        await ensureAuthenticated();
        const calendars = await calendarAPI.getCalendarList();
        sendResponse({ calendars });
        break;

      case 'SELECTION_CHANGED':
        // Store selection for popup access
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

// Ensure we have a valid auth token
async function ensureAuthenticated() {
  if (!authToken) {
    await getAuthToken(true);
  }
  if (!calendarAPI) {
    calendarAPI = new CalendarAPI(authToken);
  }
}
