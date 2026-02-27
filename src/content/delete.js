// Google Calendar Multi-Select - Delete Logic
// Handles bulk deletion of selected events

(function() {
  'use strict';

  const G = window.GCalMS;

  // Handle delete action
  G.handleDelete = async function() {
    if (G.state.selectedEvents.size === 0) return;

    const count = G.state.selectedEvents.size;
    if (!confirm(`Delete ${count} event(s)? This cannot be undone.`)) return;

    G.showStatus(`Deleting ${count} events...`);

    const events = Array.from(G.state.selectedEvents.entries()).map(([id, info]) => ({
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
        G.showStatus(`Deleted ${response.success.length} events!`);
        setTimeout(() => {
          G.clearSelection();
          G.hideStatus();
        }, 1500);
      } else if (response.error) {
        G.showStatus(`Error: ${response.error}`);
        setTimeout(G.hideStatus, 3000);
      }
    } catch (error) {
      G.showStatus(`Error: ${error.message}`);
      setTimeout(G.hideStatus, 3000);
    }
  };
})();
