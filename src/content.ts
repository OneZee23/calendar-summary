/**
 * Main content script entry point
 * Runs on Google Calendar pages to analyze and summarize events
 */

import { PageDetector } from './page-detector';
import { EventParser } from './event-parser';
import { TimeCalculator } from './time-calculator';

/**
 * Main application class
 * Orchestrates page detection, event parsing, and UI display
 */
class CalendarSummaryApp {
  private pageDetector: PageDetector;
  private eventParser: EventParser;
  private timeCalculator: TimeCalculator;

  constructor() {
    this.pageDetector = new PageDetector();
    this.eventParser = new EventParser();
    this.timeCalculator = new TimeCalculator();
  }

  /**
   * Initializes the application
   * No UI updates - only prepares for popup requests
   */
  public init(): void {
    console.log('[Calendar Summary] Content script initialized (popup mode)');
    // No automatic UI updates - only respond to popup requests
  }

  /**
   * Gets current summary data for popup
   */
  public getSummaryData(): { summaries: any[]; dateRange: any; error: string | null } {
    try {
      console.log('[Calendar Summary] Getting summary data for popup...');
      
      let detection;
      try {
        detection = this.pageDetector.detectPage();
      } catch (error) {
        console.error('[Calendar Summary] Error detecting page:', error);
        return {
          summaries: [],
          dateRange: null,
          error: `Error detecting page: ${error instanceof Error ? error.message : String(error)}`
        };
      }

      if (!detection.isCalendarPage) {
        return {
          summaries: [],
          dateRange: null,
          error: 'Please navigate to Google Calendar and select a calendar view.'
        };
      }

      // Parse events with error handling
      let events: any[] = [];
      try {
        const parsedEvents = this.eventParser.parseEvents();
        // Filter out events with invalid dates before processing
        events = parsedEvents.filter(event => {
          if (!event || !event.date) {
            return false;
          }
          try {
            // Check if date is a valid Date object
            const date = event.date instanceof Date ? event.date : new Date(event.date);
            if (isNaN(date.getTime()) || 
                date.getFullYear() < 1900 || date.getFullYear() > 2100) {
              return false;
            }
            // Validate other required fields
            if (typeof event.title !== 'string' || !event.title.trim()) {
              return false;
            }
            if (typeof event.duration !== 'number' || isNaN(event.duration) || event.duration <= 0) {
              return false;
            }
            return true;
          } catch (error) {
            console.warn('[Calendar Summary] Error validating event:', error, event);
            return false;
          }
        });
      } catch (error) {
        console.error('[Calendar Summary] Error parsing events:', error);
        return {
          summaries: [],
          dateRange: null,
          error: `Error parsing events: ${error instanceof Error ? error.message : String(error)}`
        };
      }
      
      console.log('[Calendar Summary] Found events for popup:', events.length, 'after filtering invalid dates');

      // Filter by date range if available
      if (detection.dateRange) {
        const { start, end } = detection.dateRange;
        // Validate date range before filtering
        if (start && end && 
            !isNaN(start.getTime()) && !isNaN(end.getTime()) &&
            start.getFullYear() > 1900 && end.getFullYear() < 2100) {
          try {
            events = this.timeCalculator.filterEventsByDateRange(
              events,
              start,
              end
            );
          } catch (error) {
            console.error('[Calendar Summary] Error filtering by date range:', error);
            // Continue without filtering
          }
        } else {
          console.warn('[Calendar Summary] Skipping date range filter due to invalid dates');
        }
      }

      // Calculate summaries with error handling
      let summaries: any[] = [];
      try {
        summaries = this.timeCalculator.calculateSummaries(events);
        console.log('[Calendar Summary] Summaries for popup:', summaries);
      } catch (error) {
        console.error('[Calendar Summary] Error calculating summaries:', error);
        return {
          summaries: [],
          dateRange: null,
          error: `Error calculating summaries: ${error instanceof Error ? error.message : String(error)}`
        };
      }

      // Validate date range before converting to ISO string
      let dateRange = null;
      if (detection.dateRange) {
        const start = detection.dateRange.start;
        const end = detection.dateRange.end;
        
        // Validate dates
        if (start && end && 
            !isNaN(start.getTime()) && !isNaN(end.getTime()) &&
            start.getFullYear() > 1900 && start.getFullYear() < 2100 &&
            end.getFullYear() > 1900 && end.getFullYear() < 2100) {
          try {
            dateRange = {
              start: start.toISOString(),
              end: end.toISOString()
            };
          } catch (error) {
            console.error('[Calendar Summary] Error converting dates to ISO:', error);
            dateRange = null;
          }
        } else {
          console.warn('[Calendar Summary] Invalid date range detected:', { start, end });
        }
      }

      return {
        summaries: summaries.map(s => ({
          name: s.name,
          totalMinutes: s.totalMinutes,
          count: s.count,
          formattedDuration: s.formattedDuration
        })),
        dateRange,
        error: null
      };
    } catch (error) {
      console.error('[Calendar Summary] Error getting summary data:', error);
      return {
        summaries: [],
        dateRange: null,
        error: `Error parsing calendar: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }

  /**
   * Cleans up resources
   */
  public destroy(): void {
    // No cleanup needed in popup-only mode
  }
}

// Initialize the application
console.log('[Calendar Summary] Initializing content script...');
const app = new CalendarSummaryApp();
app.init();

// Listen for messages from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('[Calendar Summary] Received message:', request);
  if (request.action === 'getSummary') {
    try {
      const data = app.getSummaryData();
      console.log('[Calendar Summary] Sending summary data:', data);
      sendResponse(data);
      return true; // Keep channel open for async response
    } catch (error) {
      console.error('[Calendar Summary] Error getting summary data:', error);
      sendResponse({
        summaries: [],
        dateRange: null,
        error: `Error: ${error instanceof Error ? error.message : String(error)}`
      });
      return true;
    }
  }
  return false;
});

// Signal that content script is ready
console.log('[Calendar Summary] Content script ready');

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
  app.destroy();
});

