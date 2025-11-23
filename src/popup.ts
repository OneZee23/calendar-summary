/**
 * Popup script for Chrome extension
 * Displays calendar summary when extension icon is clicked
 */

import { RETRY_CONSTANTS, UI_CONSTANTS } from './constants/ui-constants';
import { MESSAGES } from './constants/messages';

type GroupingMode = 'byName' | 'byColor';

interface ActivitySummary {
  name: string;
  totalMinutes: number;
  count: number;
  formattedDuration: string;
  color?: string;
}

interface SummaryData {
  summaries: ActivitySummary[];
  dateRange: { start: string; end: string } | null;
  error: string | null;
}

/**
 * Formats date range for display
 */
function formatDateRange(start: string, end: string): string {
  const startDate = new Date(start);
  const endDate = new Date(end);
  const startStr = startDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  const endStr = endDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  return `${startStr} - ${endStr}`;
}

/**
 * Renders the summary list
 */
function renderSummaryList(summaries: ActivitySummary[]): string {
  if (summaries.length === 0) {
    return `<p class="${UI_CONSTANTS.CSS_CLASSES.NO_ACTIVITIES}">${MESSAGES.UI.NO_ACTIVITIES}</p>`;
  }

  const items = summaries.map(summary => {
    const borderColor = summary.color || UI_CONSTANTS.DEFAULT_BORDER_COLOR;
    const durationColor = summary.color || UI_CONSTANTS.DEFAULT_BORDER_COLOR;
    return `
    <div class="activity-item" style="border-left-color: ${borderColor};">
      <div class="activity-header">
        <span class="activity-name">${escapeHtml(summary.name)}</span>
        <span class="activity-duration" style="color: ${durationColor};">${summary.formattedDuration}</span>
      </div>
      <div class="activity-count">
        ${summary.count} ${summary.count !== 1 ? MESSAGES.UI.OCCURRENCES : MESSAGES.UI.OCCURRENCE}
      </div>
    </div>
  `;
  }).join('');

  const totalMinutes = summaries.reduce((sum, s) => sum + s.totalMinutes, 0);
  const totalFormatted = formatDuration(totalMinutes);

  return `
    ${items}
    <div class="${UI_CONSTANTS.CSS_CLASSES.TOTAL_SECTION}">
      <span class="${UI_CONSTANTS.CSS_CLASSES.TOTAL_LABEL}">${MESSAGES.UI.TOTAL}</span>
      <span class="${UI_CONSTANTS.CSS_CLASSES.TOTAL_DURATION}">${totalFormatted}</span>
    </div>
  `;
}

/**
 * Formats duration in minutes to human-readable string
 */
function formatDuration(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;

  if (hours === 0) {
    return `${mins}m`;
  }
  if (mins === 0) {
    return `${hours}h`;
  }
  return `${hours}h ${mins}m`;
}

/**
 * Escapes HTML to prevent XSS
 */
function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/**
 * Updates the popup UI with summary data
 */
function updatePopup(data: SummaryData): void {
  const container = document.getElementById('summary-container');
  const errorContainer = document.getElementById('error-container');
  const loadingContainer = document.getElementById('loading-container');

  if (!container || !errorContainer || !loadingContainer) {
    console.error('[Popup] Required elements not found');
    return;
  }

  // Hide loading
  loadingContainer.style.display = 'none';

  if (data.error) {
    // Show error
    errorContainer.style.display = 'block';
    container.style.display = 'none';
    const errorText = document.getElementById('error-text');
    if (errorText) {
      errorText.textContent = data.error;
    }
    return;
  }

  // Show summary
  errorContainer.style.display = 'none';
  container.style.display = 'block';

  // Update date range
  const dateRangeEl = document.getElementById('date-range');
  if (dateRangeEl) {
    if (data.dateRange) {
      dateRangeEl.textContent = formatDateRange(data.dateRange.start, data.dateRange.end);
      dateRangeEl.style.display = 'block';
    } else {
      dateRangeEl.textContent = 'Current view';
      dateRangeEl.style.display = 'block';
    }
  }

  // Update summary list
  const summaryList = document.getElementById('summary-list');
  if (summaryList) {
    summaryList.innerHTML = renderSummaryList(data.summaries);
  }
}

// Current grouping mode
let currentGroupingMode: GroupingMode = 'byColor';

/**
 * Requests summary data from content script
 */
function requestSummary(groupingMode: GroupingMode = currentGroupingMode): void {
  // Get active tab
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (!tabs[0] || !tabs[0].id) {
      updatePopup({
        summaries: [],
        dateRange: null,
        error: 'No active tab found'
      });
      return;
    }

    const tab = tabs[0];
    const tabId = tab.id!;
    
    // Check if we're on Google Calendar
    if (!tab.url || !tab.url.includes('calendar.google.com')) {
      updatePopup({
        summaries: [],
        dateRange: null,
        error: MESSAGES.ERROR.NOT_CALENDAR_PAGE
      });
      return;
    }

      // Send message with retry mechanism and increasing delays
      const sendMessageWithRetry = (retries = RETRY_CONSTANTS.MAX_RETRIES, delay = RETRY_CONSTANTS.INITIAL_DELAY_MS): void => {
        chrome.tabs.sendMessage(tabId, { action: 'getSummary', groupingMode }, (response: SummaryData) => {
          if (chrome.runtime.lastError) {
            const errorMsg = chrome.runtime.lastError.message || '';
            
            // If content script is not loaded, increase delay and retry more times
            if (errorMsg.includes('Receiving end does not exist') || 
                errorMsg.includes('Could not establish connection')) {
              
              if (retries > 0) {
                const nextDelay = Math.min(delay * RETRY_CONSTANTS.DELAY_MULTIPLIER, RETRY_CONSTANTS.MAX_DELAY_MS);
                setTimeout(() => sendMessageWithRetry(retries - 1, nextDelay), nextDelay);
                return;
              }
              
              // Final attempt failed
              updatePopup({
                summaries: [],
                dateRange: null,
                error: MESSAGES.ERROR.CONTENT_SCRIPT_NOT_LOADED
              });
              return;
            }
            
            // For other errors, retry with normal delay
            if (retries > 0) {
              setTimeout(() => sendMessageWithRetry(retries - 1, delay), delay);
              return;
            }
            
            updatePopup({
              summaries: [],
              dateRange: null,
              error: MESSAGES.ERROR.CONNECTION_FAILED
            });
            return;
          }

          if (response) {
            updatePopup(response);
          } else {
            updatePopup({
              summaries: [],
              dateRange: null,
              error: 'No response from content script. Please refresh the page and try again.'
            });
          }
        });
      };

      sendMessageWithRetry();
  });
}

/**
 * Sets up grouping mode toggle buttons
 */
function setupGroupingToggle(): void {
  const byNameBtn = document.getElementById('group-by-name');
  const byColorBtn = document.getElementById('group-by-color');
  
  if (!byNameBtn || !byColorBtn) {
    return;
  }
  
  const updateButtons = (mode: GroupingMode) => {
    if (mode === 'byName') {
      byNameBtn.classList.add('active');
      byColorBtn.classList.remove('active');
    } else {
      byColorBtn.classList.add('active');
      byNameBtn.classList.remove('active');
    }
  };
  
  // Set initial state based on current mode
  updateButtons(currentGroupingMode);
  
  byNameBtn.addEventListener('click', () => {
    currentGroupingMode = 'byName';
    updateButtons(currentGroupingMode);
    requestSummary(currentGroupingMode);
  });
  
  byColorBtn.addEventListener('click', () => {
    currentGroupingMode = 'byColor';
    updateButtons(currentGroupingMode);
    requestSummary(currentGroupingMode);
  });
  
  // Initialize button states
  updateButtons(currentGroupingMode);
}

// Initialize popup when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    setupGroupingToggle();
    requestSummary();
  });
} else {
  setupGroupingToggle();
  requestSummary();
}

