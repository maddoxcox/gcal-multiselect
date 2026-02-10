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

  // Create the floating action panel
  function createSelectionBadge() {
    const panel = document.createElement('div');
    panel.id = 'gcal-ms-panel';
    panel.className = 'gcal-ms-panel';
    panel.innerHTML = `
      <div class="gcal-ms-panel-header">
        <span class="gcal-ms-panel-count">0</span>
        <span class="gcal-ms-panel-text">events selected</span>
        <button class="gcal-ms-panel-close" title="Clear selection (Esc)">✕</button>
      </div>
      <div class="gcal-ms-panel-actions">
        <button class="gcal-ms-btn gcal-ms-btn-delete" title="Delete selected events">
          🗑️ Delete
        </button>
        <button class="gcal-ms-btn gcal-ms-btn-move" title="Move or reschedule events">
          📦 Move
        </button>
      </div>
      <div class="gcal-ms-panel-move hidden" id="gcal-ms-move-options">
        <div class="gcal-ms-form-group">
          <label>Move to calendar:</label>
          <select id="gcal-ms-calendar-select">
            <option value="">Loading calendars...</option>
          </select>
        </div>
        <div class="gcal-ms-form-group">
          <label>Reschedule to:</label>
          <input type="datetime-local" id="gcal-ms-new-date">
        </div>
        <div class="gcal-ms-move-actions">
          <button class="gcal-ms-btn gcal-ms-btn-cancel">Cancel</button>
          <button class="gcal-ms-btn gcal-ms-btn-confirm">Confirm Move</button>
        </div>
      </div>
      <div class="gcal-ms-panel-status hidden" id="gcal-ms-status">
        <span class="gcal-ms-status-text">Processing...</span>
      </div>
    `;
    panel.style.display = 'none';

    // Event listeners
    panel.querySelector('.gcal-ms-panel-close').addEventListener('click', (e) => {
      e.stopPropagation();
      clearSelection();
    });

    panel.querySelector('.gcal-ms-btn-delete').addEventListener('click', (e) => {
      e.stopPropagation();
      handleDelete();
    });

    panel.querySelector('.gcal-ms-btn-move').addEventListener('click', (e) => {
      e.stopPropagation();
      showMoveOptions();
    });

    panel.querySelector('.gcal-ms-btn-cancel').addEventListener('click', (e) => {
      e.stopPropagation();
      hideMoveOptions();
    });

    panel.querySelector('.gcal-ms-btn-confirm').addEventListener('click', (e) => {
      e.stopPropagation();
      handleMove();
    });

    document.body.appendChild(panel);
  }

  // Show move options
  function showMoveOptions() {
    const movePanel = document.getElementById('gcal-ms-move-options');
    movePanel.classList.remove('hidden');
    loadCalendars();
  }

  // Hide move options
  function hideMoveOptions() {
    const movePanel = document.getElementById('gcal-ms-move-options');
    movePanel.classList.add('hidden');
  }

  // Load calendars into select
  async function loadCalendars() {
    const select = document.getElementById('gcal-ms-calendar-select');
    try {
      const response = await chrome.runtime.sendMessage({ type: 'GET_CALENDARS' });
      if (response.calendars) {
        select.innerHTML = '<option value="">Keep current calendar</option>';
        response.calendars.forEach(cal => {
          const option = document.createElement('option');
          option.value = cal.id;
          option.textContent = cal.summary + (cal.primary ? ' (Primary)' : '');
          select.appendChild(option);
        });
      }
    } catch (error) {
      select.innerHTML = '<option value="">Error loading calendars</option>';
    }
  }

  // Handle delete action
  async function handleDelete() {
    if (state.selectedEvents.size === 0) return;

    const count = state.selectedEvents.size;
    if (!confirm(`Delete ${count} event(s)? This cannot be undone.`)) return;

    showStatus(`Deleting ${count} events...`);

    const events = Array.from(state.selectedEvents.entries()).map(([id, info]) => ({
      eventId: id,
      title: info.title,
      calendarId: info.calendarId
    }));

    try {
      const response = await chrome.runtime.sendMessage({
        type: 'DELETE_EVENTS',
        events
      });

      if (response.success && response.success.length > 0) {
        showStatus(`Deleted ${response.success.length} events!`);
        setTimeout(() => {
          clearSelection();
          hideStatus();
        }, 1500);
      } else if (response.error) {
        showStatus(`Error: ${response.error}`);
        setTimeout(hideStatus, 3000);
      }
    } catch (error) {
      showStatus(`Error: ${error.message}`);
      setTimeout(hideStatus, 3000);
    }
  }

  // Handle move action
  async function handleMove() {
    const targetCalendar = document.getElementById('gcal-ms-calendar-select').value;
    const newDate = document.getElementById('gcal-ms-new-date').value;

    if (!targetCalendar && !newDate) {
      alert('Please select a calendar or pick a new date/time.');
      return;
    }

    const count = state.selectedEvents.size;
    showStatus(`Moving ${count} events...`);
    hideMoveOptions();

    const events = Array.from(state.selectedEvents.entries()).map(([id, info]) => ({
      eventId: id,
      title: info.title,
      calendarId: info.calendarId
    }));

    try {
      const response = await chrome.runtime.sendMessage({
        type: 'MOVE_EVENTS',
        events,
        targetCalendarId: targetCalendar || null,
        newDateTime: newDate || null
      });

      if (response.success && response.success.length > 0) {
        showStatus(`Moved ${response.success.length} events!`);
        setTimeout(() => {
          clearSelection();
          hideStatus();
        }, 1500);
      } else if (response.error) {
        showStatus(`Error: ${response.error}`);
        setTimeout(hideStatus, 3000);
      }
    } catch (error) {
      showStatus(`Error: ${error.message}`);
      setTimeout(hideStatus, 3000);
    }
  }

  // Show status message
  function showStatus(message) {
    const status = document.getElementById('gcal-ms-status');
    const actions = document.querySelector('.gcal-ms-panel-actions');
    status.querySelector('.gcal-ms-status-text').textContent = message;
    status.classList.remove('hidden');
    actions.classList.add('hidden');
  }

  // Hide status message
  function hideStatus() {
    const status = document.getElementById('gcal-ms-status');
    const actions = document.querySelector('.gcal-ms-panel-actions');
    status.classList.add('hidden');
    actions.classList.remove('hidden');
  }

  // Update the selection panel count
  function updateSelectionBadge() {
    const panel = document.getElementById('gcal-ms-panel');
    if (!panel) return;

    const count = state.selectedEvents.size;
    panel.querySelector('.gcal-ms-panel-count').textContent = count;
    panel.style.display = count > 0 ? 'block' : 'none';

    // Reset panel state when shown
    if (count > 0) {
      hideMoveOptions();
      hideStatus();
    }
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
