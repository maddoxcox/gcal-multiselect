// Google Calendar Multi-Select - UI Components
// Floating action panel, status messages, and selection badge

(function() {
  'use strict';

  const G = window.GCalMS;

  // Create the floating action panel
  G.createSelectionBadge = function() {
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
      </div>
      <p class="gcal-ms-hint">Drag any selected event to move all together</p>
      <div class="gcal-ms-panel-status hidden" id="gcal-ms-status">
        <span class="gcal-ms-status-text">Processing...</span>
      </div>
    `;
    panel.style.display = 'none';

    // Event listeners
    panel.querySelector('.gcal-ms-panel-close').addEventListener('click', (e) => {
      e.stopPropagation();
      G.clearSelection();
    });

    panel.querySelector('.gcal-ms-btn-delete').addEventListener('click', (e) => {
      e.stopPropagation();
      G.handleDelete();
    });

    document.body.appendChild(panel);
  };

  // Show status message
  G.showStatus = function(message) {
    const status = document.getElementById('gcal-ms-status');
    const actions = document.querySelector('.gcal-ms-panel-actions');
    status.querySelector('.gcal-ms-status-text').textContent = message;
    status.classList.remove('hidden');
    actions.classList.add('hidden');
  };

  // Hide status message
  G.hideStatus = function() {
    const status = document.getElementById('gcal-ms-status');
    const actions = document.querySelector('.gcal-ms-panel-actions');
    status.classList.add('hidden');
    actions.classList.remove('hidden');
  };

  // Update the selection panel count
  G.updateSelectionBadge = function() {
    const panel = document.getElementById('gcal-ms-panel');
    if (!panel) return;

    const count = G.state.selectedEvents.size;
    panel.querySelector('.gcal-ms-panel-count').textContent = count;
    panel.style.display = count > 0 ? 'block' : 'none';

    if (count > 0) {
      G.hideStatus();
    }
  };
})();
