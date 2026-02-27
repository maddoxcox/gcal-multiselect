// Google Calendar Multi-Select - Selection Logic
// Handles click-to-select, range selection, select all, and clear

(function() {
  'use strict';

  const G = window.GCalMS;

  // Handle click events on calendar
  G.handleClick = function(e) {
    const eventElement = G.findEventElement(e.target);

    if (!eventElement) return;

    const isMultiSelectClick = e.ctrlKey || e.metaKey;
    const isRangeClick = e.shiftKey;

    if (isMultiSelectClick) {
      e.preventDefault();
      e.stopPropagation();
      G.toggleEventSelection(eventElement);
    } else if (isRangeClick && G.state.selectedEvents.size > 0) {
      e.preventDefault();
      e.stopPropagation();
      G.handleRangeSelection(eventElement);
    }
  };

  // Handle keyboard shortcuts
  G.handleKeydown = function(e) {
    if (e.key === 'Escape' && G.state.selectedEvents.size > 0) {
      G.clearSelection();
    }

    if ((e.ctrlKey || e.metaKey) && e.key === 'a' && e.shiftKey) {
      e.preventDefault();
      G.selectAllVisibleEvents();
    }
  };

  // Toggle selection state of an event
  G.toggleEventSelection = function(element) {
    const eventInfo = G.getEventInfo(element);

    if (G.state.selectedEvents.has(eventInfo.eventId)) {
      G.state.selectedEvents.delete(eventInfo.eventId);
      element.classList.remove('gcal-ms-selected');
    } else {
      G.state.selectedEvents.set(eventInfo.eventId, eventInfo);
      element.classList.add('gcal-ms-selected');
    }

    G.updateSelectionBadge();
    G.notifyBackgroundOfSelection();
  };

  // Handle shift+click range selection
  G.handleRangeSelection = function(endElement) {
    const allEvents = G.getAllVisibleEvents();
    const endInfo = G.getEventInfo(endElement);

    let lastSelectedIndex = -1;
    let endIndex = -1;

    const selectedIds = Array.from(G.state.selectedEvents.keys());
    const lastSelectedId = selectedIds[selectedIds.length - 1];

    allEvents.forEach((el, index) => {
      const info = G.getEventInfo(el);
      if (info.eventId === lastSelectedId) lastSelectedIndex = index;
      if (info.eventId === endInfo.eventId) endIndex = index;
    });

    if (lastSelectedIndex === -1 || endIndex === -1) {
      G.toggleEventSelection(endElement);
      return;
    }

    const start = Math.min(lastSelectedIndex, endIndex);
    const end = Math.max(lastSelectedIndex, endIndex);

    for (let i = start; i <= end; i++) {
      const el = allEvents[i];
      const info = G.getEventInfo(el);
      if (!G.state.selectedEvents.has(info.eventId)) {
        G.state.selectedEvents.set(info.eventId, info);
        el.classList.add('gcal-ms-selected');
      }
    }

    G.updateSelectionBadge();
    G.notifyBackgroundOfSelection();
  };

  // Select all visible events
  G.selectAllVisibleEvents = function() {
    const events = G.getAllVisibleEvents();
    events.forEach(element => {
      const info = G.getEventInfo(element);
      if (!G.state.selectedEvents.has(info.eventId)) {
        G.state.selectedEvents.set(info.eventId, info);
        element.classList.add('gcal-ms-selected');
      }
    });

    G.updateSelectionBadge();
    G.notifyBackgroundOfSelection();
  };

  // Clear all selections
  G.clearSelection = function() {
    G.state.selectedEvents.forEach((info) => {
      info.element?.classList.remove('gcal-ms-selected');
    });
    G.state.selectedEvents.clear();
    G.updateSelectionBadge();
    G.notifyBackgroundOfSelection();
  };
})();
