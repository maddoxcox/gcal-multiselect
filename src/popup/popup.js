// Google Calendar Multi-Select Popup Script

// DOM Elements
const views = {
  authRequired: document.getElementById('auth-required'),
  noSelection: document.getElementById('no-selection'),
  selectionActive: document.getElementById('selection-active'),
  progress: document.getElementById('progress'),
  moveDialog: document.getElementById('move-dialog')
};

const elements = {
  authBtn: document.getElementById('auth-btn'),
  logoutBtn: document.getElementById('logout-btn'),
  selectionCount: document.getElementById('selection-count'),
  eventsList: document.getElementById('selected-events-list'),
  deleteBtn: document.getElementById('delete-btn'),
  moveBtn: document.getElementById('move-btn'),
  clearBtn: document.getElementById('clear-btn'),
  targetCalendar: document.getElementById('target-calendar'),
  newDate: document.getElementById('new-date'),
  closeDialog: document.getElementById('close-dialog'),
  cancelMove: document.getElementById('cancel-move'),
  confirmMove: document.getElementById('confirm-move'),
  progressText: document.getElementById('progress-text')
};

// State
let selectedEvents = [];
let calendars = [];
let isAuthenticated = false;

// Initialize popup
async function init() {
  setupEventListeners();
  await checkAuthStatus();

  if (isAuthenticated) {
    await loadSelection();
    await loadCalendars();
  }
}

// Set up event listeners
function setupEventListeners() {
  elements.authBtn.addEventListener('click', handleAuth);
  elements.logoutBtn.addEventListener('click', handleLogout);
  elements.deleteBtn.addEventListener('click', handleDelete);
  elements.moveBtn.addEventListener('click', showMoveDialog);
  elements.clearBtn.addEventListener('click', handleClear);
  elements.closeDialog.addEventListener('click', hideMoveDialog);
  elements.cancelMove.addEventListener('click', hideMoveDialog);
  elements.confirmMove.addEventListener('click', handleMove);
}

// Check authentication status
async function checkAuthStatus() {
  try {
    const response = await sendMessage({ type: 'GET_AUTH_STATUS' });
    isAuthenticated = response.authenticated;

    if (isAuthenticated) {
      elements.logoutBtn.classList.remove('hidden');
    } else {
      showView('authRequired');
    }
  } catch (error) {
    console.error('Auth check failed:', error);
    showView('authRequired');
  }
}

// Handle authentication
async function handleAuth() {
  elements.authBtn.disabled = true;
  elements.authBtn.textContent = 'Signing in...';

  try {
    const response = await sendMessage({ type: 'AUTHENTICATE' });

    if (response.success) {
      isAuthenticated = true;
      elements.logoutBtn.classList.remove('hidden');
      await loadSelection();
      await loadCalendars();
    } else {
      alert('Authentication failed: ' + (response.error || 'Unknown error'));
    }
  } catch (error) {
    alert('Authentication failed: ' + error.message);
  } finally {
    elements.authBtn.disabled = false;
    elements.authBtn.textContent = 'Sign in with Google';
  }
}

// Handle logout
async function handleLogout() {
  await sendMessage({ type: 'LOGOUT' });
  isAuthenticated = false;
  elements.logoutBtn.classList.add('hidden');
  showView('authRequired');
}

// Load selected events from storage
async function loadSelection() {
  try {
    const data = await chrome.storage.local.get('selectedEvents');
    selectedEvents = data.selectedEvents || [];
    updateSelectionUI();
  } catch (error) {
    console.error('Failed to load selection:', error);
    selectedEvents = [];
    updateSelectionUI();
  }
}

// Load user's calendars
async function loadCalendars() {
  try {
    const response = await sendMessage({ type: 'GET_CALENDARS' });
    calendars = response.calendars || [];
    populateCalendarSelect();
  } catch (error) {
    console.error('Failed to load calendars:', error);
  }
}

// Populate calendar dropdown
function populateCalendarSelect() {
  elements.targetCalendar.innerHTML = '<option value="">Keep current calendar</option>';

  calendars.forEach(cal => {
    const option = document.createElement('option');
    option.value = cal.id;
    option.textContent = cal.summary + (cal.primary ? ' (Primary)' : '');
    elements.targetCalendar.appendChild(option);
  });
}

// Update selection UI
function updateSelectionUI() {
  if (selectedEvents.length === 0) {
    showView('noSelection');
    return;
  }

  showView('selectionActive');
  elements.selectionCount.textContent = selectedEvents.length;

  // Build events list
  elements.eventsList.innerHTML = '';
  selectedEvents.forEach(event => {
    const item = document.createElement('div');
    item.className = 'event-item';
    item.innerHTML = `
      <div class="event-color" style="background-color: #1a73e8"></div>
      <span class="event-title">${escapeHtml(event.title)}</span>
    `;
    elements.eventsList.appendChild(item);
  });
}

// Show a specific view
function showView(viewName) {
  Object.values(views).forEach(view => {
    if (view) view.classList.add('hidden');
  });

  const view = views[viewName];
  if (view) view.classList.remove('hidden');
}

// Handle delete action
async function handleDelete() {
  if (selectedEvents.length === 0) return;

  const confirmed = confirm(
    `Are you sure you want to delete ${selectedEvents.length} event(s)? This cannot be undone.`
  );

  if (!confirmed) return;

  showView('progress');
  elements.progressText.textContent = `Deleting ${selectedEvents.length} events...`;

  try {
    const response = await sendMessage({
      type: 'DELETE_EVENTS',
      events: selectedEvents
    });

    if (response.success && response.success.length > 0) {
      elements.progressText.textContent =
        `Deleted ${response.success.length} events successfully!`;

      // Notify content script to clear selection
      await notifyContentScript('OPERATION_COMPLETE');

      // Clear local state
      selectedEvents = [];
      await chrome.storage.local.set({ selectedEvents: [] });

      // Show success briefly, then update UI
      setTimeout(() => {
        updateSelectionUI();
      }, 1500);
    }

    if (response.failed && response.failed.length > 0) {
      alert(`Failed to delete ${response.failed.length} event(s). They may have already been deleted.`);
    }
  } catch (error) {
    alert('Delete failed: ' + error.message);
    updateSelectionUI();
  }
}

// Show move dialog
function showMoveDialog() {
  views.moveDialog.classList.remove('hidden');
}

// Hide move dialog
function hideMoveDialog() {
  views.moveDialog.classList.add('hidden');
  elements.targetCalendar.value = '';
  elements.newDate.value = '';
}

// Handle move action
async function handleMove() {
  const targetCalendarId = elements.targetCalendar.value;
  const newDateTime = elements.newDate.value;

  if (!targetCalendarId && !newDateTime) {
    alert('Please select a calendar to move to or a new date/time.');
    return;
  }

  hideMoveDialog();
  showView('progress');
  elements.progressText.textContent = `Moving ${selectedEvents.length} events...`;

  try {
    const response = await sendMessage({
      type: 'MOVE_EVENTS',
      events: selectedEvents,
      targetCalendarId: targetCalendarId || null,
      newDateTime: newDateTime || null
    });

    if (response.success && response.success.length > 0) {
      elements.progressText.textContent =
        `Moved ${response.success.length} events successfully!`;

      await notifyContentScript('OPERATION_COMPLETE');

      selectedEvents = [];
      await chrome.storage.local.set({ selectedEvents: [] });

      setTimeout(() => {
        updateSelectionUI();
      }, 1500);
    }

    if (response.failed && response.failed.length > 0) {
      alert(`Failed to move ${response.failed.length} event(s).`);
    }
  } catch (error) {
    alert('Move failed: ' + error.message);
    updateSelectionUI();
  }
}

// Handle clear selection
async function handleClear() {
  await notifyContentScript('CLEAR_SELECTION');
  selectedEvents = [];
  await chrome.storage.local.set({ selectedEvents: [] });
  updateSelectionUI();
}

// Send message to background script
function sendMessage(message) {
  return chrome.runtime.sendMessage(message);
}

// Notify content script
async function notifyContentScript(type) {
  try {
    const [tab] = await chrome.tabs.query({
      active: true,
      currentWindow: true,
      url: 'https://calendar.google.com/*'
    });

    if (tab) {
      await chrome.tabs.sendMessage(tab.id, { type });
    }
  } catch (error) {
    console.error('Failed to notify content script:', error);
  }
}

// Escape HTML
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Listen for selection changes from content script
chrome.storage.onChanged.addListener((changes, namespace) => {
  if (namespace === 'local' && changes.selectedEvents) {
    selectedEvents = changes.selectedEvents.newValue || [];
    if (isAuthenticated) {
      updateSelectionUI();
    }
  }
});

// Initialize
init();
