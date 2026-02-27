// Google Calendar Multi-Select - Shared State & Config
// All modules access state through window.GCalMS

window.GCalMS = {
  DEBUG: true,
  HARDCODED_CALENDAR_ID: 'maddox.cox04@gmail.com',

  // State management
  state: {
    selectedEvents: new Map(), // eventId -> { element, title, calendarId }
    isInitialized: false,
    isDragging: false,
    dragStartY: null,
    dragStartX: null,
    draggedEventId: null,
    draggedEventCalendarId: null,
    draggedEventTimePromise: null
  },

  // Event selectors - Google Calendar uses various data attributes
  EVENT_SELECTORS: [
    '[data-eventid]',
    '[data-eventchip]',
    '[role="button"][data-eventid]',
    '.WjJeHe', // Event chip class (fallback container)
    '[data-eventchip][role="button"]'
  ]
};
