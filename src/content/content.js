// Google Calendar Multi-Select Content Script
// Handles event selection UI and DOM interaction

(function() {
  'use strict';

  // State management
  const state = {
    selectedEvents: new Map(), // eventId -> { element, title, calendarId }
    isInitialized: false
  };

  // Event selectors - Google Calendar uses various data attributes
  const EVENT_SELECTORS = [
    '[data-eventid]',
    '[data-eventchip]',
    '[role="button"][data-eventid]',
    '.WjJeHe', // Event chip class
    '[data-eventchip][role="button"]'
  ];

  // Initialize the extension
  function init() {
    if (state.isInitialized) return;

    console.log('[GCal Multi-Select] Initializing...');

    // Wait for calendar to fully load
    waitForCalendar().then(() => {
      setupEventListeners();
      createSelectionBadge();
      observeCalendarChanges();
      state.isInitialized = true;
      console.log('[GCal Multi-Select] Ready!');
    });
  }

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

      // Timeout after 30 seconds
      setTimeout(() => {
        clearInterval(checkInterval);
        resolve();
      }, 30000);
    });
  }

  // Set up click listeners for event selection
  function setupEventListeners() {
    document.addEventListener('click', handleClick, true);
    document.addEventListener('keydown', handleKeydown);
  }

  // Handle click events on calendar
  function handleClick(e) {
    const eventElement = findEventElement(e.target);

    if (!eventElement) return;

    // Check for Ctrl/Cmd + Click for multi-select
    const isMultiSelectClick = e.ctrlKey || e.metaKey;

    // Check for Shift + Click for range selection
    const isRangeClick = e.shiftKey;

    if (isMultiSelectClick) {
      e.preventDefault();
      e.stopPropagation();
      toggleEventSelection(eventElement);
    } else if (isRangeClick && state.selectedEvents.size > 0) {
      e.preventDefault();
      e.stopPropagation();
      handleRangeSelection(eventElement);
    }
    // Regular clicks pass through normally to open the event
  }

  // Handle keyboard shortcuts
  function handleKeydown(e) {
    // Escape to clear selection
    if (e.key === 'Escape' && state.selectedEvents.size > 0) {
      clearSelection();
    }

    // Ctrl/Cmd + A to select all visible events
    if ((e.ctrlKey || e.metaKey) && e.key === 'a' && e.shiftKey) {
      e.preventDefault();
      selectAllVisibleEvents();
    }
  }

  // Find the event element from a click target
  function findEventElement(target) {
    for (const selector of EVENT_SELECTORS) {
      const element = target.closest(selector);
      if (element) return element;
    }
    return null;
  }

  // Get event info from DOM element
  function getEventInfo(element) {
    const eventId = element.getAttribute('data-eventid') ||
                   element.getAttribute('data-eventchip') ||
                   generateTempId(element);

    // Try to get the title
    const titleEl = element.querySelector('[aria-hidden="true"]') ||
                   element.querySelector('.FAxxKc') ||
                   element;
    const title = titleEl?.textContent?.trim() || 'Untitled Event';

    // Try to extract calendar ID from element or parent
    const calendarId = extractCalendarId(element);

    return {
      eventId,
      title,
      calendarId,
      element
    };
  }

  // Generate temporary ID for events without data-eventid
  function generateTempId(element) {
    const rect = element.getBoundingClientRect();
    return `temp-${rect.top}-${rect.left}-${element.textContent?.slice(0, 20)}`;
  }

  // Extract calendar ID from event element
  function extractCalendarId(element) {
    // Google Calendar stores calendar info in various ways
    const dataCalendarId = element.getAttribute('data-calendarid');
    if (dataCalendarId) return dataCalendarId;

    // Default to primary calendar
    return 'primary';
  }

  // Toggle selection state of an event
  function toggleEventSelection(element) {
    const eventInfo = getEventInfo(element);

    if (state.selectedEvents.has(eventInfo.eventId)) {
      // Deselect
      state.selectedEvents.delete(eventInfo.eventId);
      element.classList.remove('gcal-ms-selected');
    } else {
      // Select
      state.selectedEvents.set(eventInfo.eventId, eventInfo);
      element.classList.add('gcal-ms-selected');
    }

    updateSelectionBadge();
    notifyBackgroundOfSelection();
  }

  // Handle shift+click range selection
  function handleRangeSelection(endElement) {
    const allEvents = getAllVisibleEvents();
    const endInfo = getEventInfo(endElement);

    // Find the last selected event and the clicked event in the list
    let lastSelectedIndex = -1;
    let endIndex = -1;

    const selectedIds = Array.from(state.selectedEvents.keys());
    const lastSelectedId = selectedIds[selectedIds.length - 1];

    allEvents.forEach((el, index) => {
      const info = getEventInfo(el);
      if (info.eventId === lastSelectedId) lastSelectedIndex = index;
      if (info.eventId === endInfo.eventId) endIndex = index;
    });

    if (lastSelectedIndex === -1 || endIndex === -1) {
      // Fallback to single selection
      toggleEventSelection(endElement);
      return;
    }

    // Select all events in range
    const start = Math.min(lastSelectedIndex, endIndex);
    const end = Math.max(lastSelectedIndex, endIndex);

    for (let i = start; i <= end; i++) {
      const el = allEvents[i];
      const info = getEventInfo(el);
      if (!state.selectedEvents.has(info.eventId)) {
        state.selectedEvents.set(info.eventId, info);
        el.classList.add('gcal-ms-selected');
      }
    }

    updateSelectionBadge();
    notifyBackgroundOfSelection();
  }

  // Get all visible event elements
  function getAllVisibleEvents() {
    const events = [];
    for (const selector of EVENT_SELECTORS) {
      document.querySelectorAll(selector).forEach(el => {
        if (!events.includes(el)) {
          events.push(el);
        }
      });
    }
    return events;
  }

  // Select all visible events
  function selectAllVisibleEvents() {
    const events = getAllVisibleEvents();
    events.forEach(element => {
      const info = getEventInfo(element);
      if (!state.selectedEvents.has(info.eventId)) {
        state.selectedEvents.set(info.eventId, info);
        element.classList.add('gcal-ms-selected');
      }
    });

    updateSelectionBadge();
    notifyBackgroundOfSelection();
  }

  // Clear all selections
  function clearSelection() {
    state.selectedEvents.forEach((info) => {
      info.element?.classList.remove('gcal-ms-selected');
    });
    state.selectedEvents.clear();
    updateSelectionBadge();
    notifyBackgroundOfSelection();
  }

  // Create the floating selection count badge
  function createSelectionBadge() {
    const badge = document.createElement('div');
    badge.id = 'gcal-ms-badge';
    badge.className = 'gcal-ms-badge';
    badge.innerHTML = `
      <span class="gcal-ms-badge-count">0</span>
      <span class="gcal-ms-badge-text">selected</span>
      <button class="gcal-ms-badge-clear" title="Clear selection (Esc)">✕</button>
    `;
    badge.style.display = 'none';

    badge.querySelector('.gcal-ms-badge-clear').addEventListener('click', (e) => {
      e.stopPropagation();
      clearSelection();
    });

    document.body.appendChild(badge);
  }

  // Update the selection badge count
  function updateSelectionBadge() {
    const badge = document.getElementById('gcal-ms-badge');
    if (!badge) return;

    const count = state.selectedEvents.size;
    badge.querySelector('.gcal-ms-badge-count').textContent = count;
    badge.style.display = count > 0 ? 'flex' : 'none';
  }

  // Observe calendar for dynamic changes
  function observeCalendarChanges() {
    const observer = new MutationObserver((mutations) => {
      // Re-apply selection styles to elements that may have been re-rendered
      state.selectedEvents.forEach((info, eventId) => {
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

  // Notify background script of selection changes
  function notifyBackgroundOfSelection() {
    const selectedData = Array.from(state.selectedEvents.entries()).map(([id, info]) => ({
      eventId: id,
      title: info.title,
      calendarId: info.calendarId
    }));

    chrome.runtime.sendMessage({
      type: 'SELECTION_CHANGED',
      data: selectedData
    }).catch(() => {
      // Background script may not be ready, ignore
    });

    // Also store in local storage for popup access
    chrome.storage.local.set({
      selectedEvents: selectedData
    }).catch(() => {});
  }

  // Listen for messages from popup/background
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    switch (message.type) {
      case 'GET_SELECTION':
        sendResponse({
          selectedEvents: Array.from(state.selectedEvents.entries()).map(([id, info]) => ({
            eventId: id,
            title: info.title,
            calendarId: info.calendarId
          }))
        });
        break;

      case 'CLEAR_SELECTION':
        clearSelection();
        sendResponse({ success: true });
        break;

      case 'OPERATION_COMPLETE':
        // Clear selection after successful bulk operation
        clearSelection();
        sendResponse({ success: true });
        break;
    }
    return true;
  });

  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
