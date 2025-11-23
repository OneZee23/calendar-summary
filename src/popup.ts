/**
 * Popup script for Chrome extension
 * Displays calendar summary when extension icon is clicked
 */

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
    return '<p class="no-activities">No activities found</p>';
  }

  const items = summaries.map(summary => {
    const borderColor = summary.color || '#4285f4';
    const durationColor = summary.color || '#4285f4';
    return `
    <div class="activity-item" style="border-left-color: ${borderColor};">
      <div class="activity-header">
        <span class="activity-name">${escapeHtml(summary.name)}</span>
        <span class="activity-duration" style="color: ${durationColor};">${summary.formattedDuration}</span>
      </div>
      <div class="activity-count">
        ${summary.count} occurrence${summary.count !== 1 ? 's' : ''}
      </div>
    </div>
  `;
  }).join('');

  const totalMinutes = summaries.reduce((sum, s) => sum + s.totalMinutes, 0);
  const totalFormatted = formatDuration(totalMinutes);

  return `
    ${items}
    <div class="total-section">
      <span class="total-label">Total</span>
      <span class="total-duration">${totalFormatted}</span>
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

/**
 * Requests summary data from content script
 */
function requestSummary(): void {
  console.log('[Popup] Requesting summary data...');
  
  // Get active tab
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (!tabs[0] || !tabs[0].id) {
      console.error('[Popup] No active tab found');
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
      console.log('[Popup] Not on Google Calendar page');
      updatePopup({
        summaries: [],
        dateRange: null,
        error: 'Please navigate to Google Calendar (calendar.google.com) and open this popup again.'
      });
      return;
    }

      console.log('[Popup] Sending message to tab:', tabId, 'URL:', tab.url);

      // Send message with retry mechanism and increasing delays
      const sendMessageWithRetry = (retries = 5, delay = 300): void => {
        chrome.tabs.sendMessage(tabId, { action: 'getSummary' }, (response: SummaryData) => {
          console.log('[Popup] Received response:', response);
          
          if (chrome.runtime.lastError) {
            const errorMsg = chrome.runtime.lastError.message || '';
            console.error('[Popup] Error:', errorMsg);
            
            // If content script is not loaded, increase delay and retry more times
            if (errorMsg.includes('Receiving end does not exist') || 
                errorMsg.includes('Could not establish connection')) {
              
              if (retries > 0) {
                const nextDelay = Math.min(delay * 1.5, 2000); // Increase delay up to 2 seconds
                console.log(`[Popup] Content script not ready, retrying in ${nextDelay}ms... (${retries} attempts left)`);
                setTimeout(() => sendMessageWithRetry(retries - 1, nextDelay), nextDelay);
                return;
              }
              
              // Final attempt failed
              updatePopup({
                summaries: [],
                dateRange: null,
                error: 'Content script is not loaded. Please refresh the page (F5) and wait a few seconds before opening this popup again.'
              });
              return;
            }
            
            // For other errors, retry with normal delay
            if (retries > 0) {
              console.log(`[Popup] Retrying... (${retries} attempts left)`);
              setTimeout(() => sendMessageWithRetry(retries - 1, delay), delay);
              return;
            }
            
            updatePopup({
              summaries: [],
              dateRange: null,
              error: 'Could not connect to Google Calendar page. Please refresh the page (F5) and try again.'
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

// Initialize popup when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', requestSummary);
} else {
  requestSummary();
}

