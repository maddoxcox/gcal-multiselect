// Google Calendar Multi-Select - Drag & Move Logic
// Handles drag-to-reschedule for multiple selected events

(function() {
  'use strict';

  const G = window.GCalMS;

  // Fetch event start/end times via background script
  G.fetchEventTimes = async function(eventInfo) {
    try {
      const response = await chrome.runtime.sendMessage({
        type: 'GET_EVENT_TIME',
        event: {
          eventId: eventInfo.eventId,
          calendarId: eventInfo.calendarId
        }
      });

      if (!response || !response.start || !response.end) return null;

      return {
        start: new Date(response.start),
        end: new Date(response.end)
      };
    } catch (error) {
      return null;
    }
  };

  // Handle drag start on selected events
  G.handleDragStart = function(e) {
    if (G.state.isDragging) return;

    if (G.state.selectedEvents.size < 2) return;

    const eventElement = G.findEventElement(e.target);
    if (!eventElement) return;

    const eventInfo = G.getEventInfo(eventElement);
    if (!eventInfo) return;

    // Only track if dragging a selected event
    if (G.state.selectedEvents.has(eventInfo.eventId)) {
      G.state.isDragging = true;
      G.state.draggedEventId = eventInfo.eventId;
      G.state.draggedEventCalendarId = eventInfo.calendarId;
      G.state.dragStartY = e.clientY;
      G.state.dragStartX = e.clientX;
      G.state.draggedEventTimePromise = G.fetchEventTimes(eventInfo);
      console.log('[GCal Multi-Select] Drag started at Y:', e.clientY);

      document.body.classList.add('gcal-ms-dragging');
    }
  };

  // Handle drag end - detect where event was dropped
  G.handleDragEnd = function(e) {
    console.log('[GCal Multi-Select] Drag end event fired, type:', e.type, 'isDragging:', G.state.isDragging);

    if (!G.state.isDragging || G.state.selectedEvents.size < 2) {
      G.state.isDragging = false;
      return;
    }

    document.body.classList.remove('gcal-ms-dragging');

    // Wait briefly for Google Calendar to process its own drag
    setTimeout(async () => {
      let timeDelta = null;

      // Preferred: compute delta from actual event times via API
      try {
        const originalTimes = await G.state.draggedEventTimePromise;
        const updatedTimes = await G.fetchEventTimes({
          eventId: G.state.draggedEventId,
          calendarId: G.state.draggedEventCalendarId
        });

        if (originalTimes && updatedTimes) {
          timeDelta = updatedTimes.start.getTime() - originalTimes.start.getTime();
          console.log('[GCal Multi-Select] Time delta from API (ms):', timeDelta);
        }
      } catch (err) {
        console.warn('[GCal Multi-Select] Failed to compute time delta from API:', err);
      }

      // Fallback: compute delta from pixel movement (less reliable)
      if (timeDelta === null) {
        const dragEndY = e.clientY;
        const pixelDeltaY = dragEndY - G.state.dragStartY;

        console.log('[GCal Multi-Select] Drag ended. Y delta:', pixelDeltaY, 'pixels');

        const grid = document.querySelector('[role="grid"]') || document.querySelector('[role="main"]');
        const gridHeight = grid ? grid.getBoundingClientRect().height : 1000;
        const hoursPerGrid = 24;
        const pixelsPerHour = gridHeight / hoursPerGrid;
        const hoursDelta = pixelDeltaY / pixelsPerHour;
        timeDelta = Math.round(hoursDelta * 60) * 60 * 1000;

        console.log('[GCal Multi-Select] Grid height:', gridHeight, 'Hours delta:', hoursDelta, 'Time delta (ms):', timeDelta);
      }

      // Only proceed if there was a meaningful time change (more than 5 minutes)
      if (Math.abs(timeDelta) > 5 * 60 * 1000) {
        console.log('[GCal Multi-Select] Moving events by', timeDelta / 60000, 'minutes');
        await G.moveAllSelectedByDelta(timeDelta);
      } else {
        console.log('[GCal Multi-Select] Time delta too small, not moving');
      }

      G.state.isDragging = false;
      G.state.dragStartY = null;
      G.state.dragStartX = null;
      G.state.draggedEventId = null;
      G.state.draggedEventCalendarId = null;
      G.state.draggedEventTimePromise = null;
    }, 300);
  };

  // Move all selected events by a time delta
  G.moveAllSelectedByDelta = async function(timeDelta) {
    // Don't move the event that was dragged (Google Calendar already moved it)
    const eventsToMove = Array.from(G.state.selectedEvents.entries())
      .filter(([id]) => id !== G.state.draggedEventId)
      .map(([id, info]) => ({
        eventId: id,
        title: info.title,
        calendarId: info.calendarId
      }));

    if (eventsToMove.length === 0) return;

    G.showStatus(`Moving ${eventsToMove.length} other events...`);

    try {
      const response = await chrome.runtime.sendMessage({
        type: 'MOVE_EVENTS_BY_DELTA',
        events: eventsToMove,
        timeDelta: timeDelta
      });

      if (response.success && response.success.length > 0) {
        G.showStatus(`Moved ${response.success.length + 1} events together!`);
        setTimeout(() => {
          G.hideStatus();
          location.reload();
        }, 1000);
      } else if (response.failed && response.failed.length > 0) {
        G.showStatus(`Moved 1 event; ${response.failed.length} failed (check permissions/calendar ownership)`);
        setTimeout(G.hideStatus, 3500);
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
