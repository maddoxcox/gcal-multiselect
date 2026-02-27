// Google Calendar Multi-Select - Initialization
// Entry point: sets up listeners, waits for calendar, starts the extension

(function() {
  'use strict';

  const G = window.GCalMS;

  // Wait for the calendar grid to be available
  function waitForCalendar() {
    return new Promise((resolve) => {
      const checkInterval = setInterval(() => {
        const calendarGrid = document.querySelector('[role="main"]') ||
                            document.querySelector('[role="grid"]') ||
                            document.querySelector('.tEhMVd');
        if (calendarGrid) {
          clearInterval(checkInterval);
          resolve();
        }
      }, 500);

      setTimeout(() => {
        clearInterval(checkInterval);
        resolve();
      }, 30000);
    });
  }

  // Set up click listeners for event selection
  function setupEventListeners() {
    document.addEventListener('click', G.handleClick, true);
    document.addEventListener('keydown', G.handleKeydown);

    document.addEventListener('mousedown', G.handleDragStart, true);
    window.addEventListener('mouseup', G.handleDragEnd, true);
    window.addEventListener('dragend', G.handleDragEnd, true);
  }

  // Observe calendar for dynamic changes
  function observeCalendarChanges() {
    const observer = new MutationObserver((mutations) => {
      G.state.selectedEvents.forEach((info, eventId) => {
        const newElement = document.querySelector(`[data-eventid="${eventId}"]`) ||
                          document.querySelector(`[data-eventchip="${eventId}"]`);
        if (newElement && newElement !== info.element) {
          info.element = newElement;
          newElement.classList.add('gcal-ms-selected');
        }
      });
    });

    const mainContent = document.querySelector('[role="main"]') || document.body;
    observer.observe(mainContent, {
      childList: true,
      subtree: true
    });
  }

  // Initialize the extension
  function init() {
    if (G.state.isInitialized) return;

    console.log('[GCal Multi-Select] Initializing...');

    waitForCalendar().then(() => {
      setupEventListeners();
      G.createSelectionBadge();
      observeCalendarChanges();
      G.state.isInitialized = true;
      console.log('[GCal Multi-Select] Ready!');
    });
  }

  // Start when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
