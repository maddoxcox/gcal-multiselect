// Google Calendar Multi-Select - Chrome Messaging
// Communication between content script, background, and popup

(function() {
  'use strict';

  const G = window.GCalMS;

  // Notify background script of selection changes
  G.notifyBackgroundOfSelection = function() {
    const selectedData = Array.from(G.state.selectedEvents.entries()).map(([id, info]) => ({
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

    chrome.storage.local.set({
      selectedEvents: selectedData
    }).catch(() => {});
  };

  // Listen for messages from popup/background
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    switch (message.type) {
      case 'GET_SELECTION':
        sendResponse({
          selectedEvents: Array.from(G.state.selectedEvents.entries()).map(([id, info]) => ({
            eventId: id,
            title: info.title,
            calendarId: info.calendarId
          }))
        });
        break;

      case 'CLEAR_SELECTION':
        G.clearSelection();
        sendResponse({ success: true });
        break;

      case 'OPERATION_COMPLETE':
        G.clearSelection();
        sendResponse({ success: true });
        break;
    }
    return true;
  });
})();
