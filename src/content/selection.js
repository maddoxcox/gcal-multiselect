// Google Calendar Multi-Select - Selection Logic
// Handles click-to-select, range selection, select all, and clear
// Uses overlay divs instead of modifying GCal's DOM elements

(function() {
  'use strict';

  const G = window.GCalMS;

  // Map of eventId -> overlay element
  G.overlays = new Map();

  // Create an overlay div positioned over an event element
  G.createOverlay = function(element, eventId) {
    const rect = element.getBoundingClientRect();
    const overlay = document.createElement('div');
    overlay.className = 'gcal-ms-overlay';
    overlay.dataset.eventId = eventId;
    overlay.style.top = rect.top + 'px';
    overlay.style.left = rect.left + 'px';
    overlay.style.width = rect.width + 'px';
    overlay.style.height = rect.height + 'px';
    document.body.appendChild(overlay);
    G.overlays.set(eventId, overlay);
  };

  // Remove an overlay for an event
  G.removeOverlay = function(eventId) {
    const overlay = G.overlays.get(eventId);
    if (overlay) {
      overlay.remove();
      G.overlays.delete(eventId);
    }
  };

  // Remove all overlays
  G.removeAllOverlays = function() {
    G.overlays.forEach(overlay => overlay.remove());
    G.overlays.clear();
  };

  // Reposition all overlays to match current element positions
  G.repositionOverlays = function() {
    G.state.selectedEvents.forEach((info, eventId) => {
      const overlay = G.overlays.get(eventId);
      if (!overlay) return;

      // Find the current element (may have been re-rendered)
      const element = info.element ||
        document.querySelector(`[data-eventid="${eventId}"]`) ||
        document.querySelector(`[data-eventchip="${eventId}"]`);

      if (element) {
        const rect = element.getBoundingClientRect();
        overlay.style.top = rect.top + 'px';
        overlay.style.left = rect.left + 'px';
        overlay.style.width = rect.width + 'px';
        overlay.style.height = rect.height + 'px';
      }
    });
  };

  // Handle click events on calendar
  G.handleClick = function(e) {
    const eventElement = G.findEventElement(e.target);

    if (!eventElement) return;

    const isMultiSelectClick = e.ctrlKey || e.metaKey;
    const isRangeClick = e.shiftKey;

    if (isMultiSelectClick) {
      e.stopPropagation();
      G.toggleEventSelection(eventElement);
    } else if (isRangeClick && G.state.selectedEvents.size > 0) {
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
      G.removeOverlay(eventInfo.eventId);
    } else {
      G.state.selectedEvents.set(eventInfo.eventId, eventInfo);
      G.createOverlay(element, eventInfo.eventId);
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
        G.createOverlay(el, info.eventId);
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
        G.createOverlay(element, info.eventId);
      }
    });

    G.updateSelectionBadge();
    G.notifyBackgroundOfSelection();
  };

  // Clear all selections
  G.clearSelection = function() {
    G.removeAllOverlays();
    G.state.selectedEvents.clear();
    G.updateSelectionBadge();
    G.notifyBackgroundOfSelection();
  };
})();
