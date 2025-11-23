/**
 * Main content script entry point
 * Runs on Google Calendar pages to analyze and summarize events
 */

import { PageDetector } from './page-detector';
import { EventParser } from './event-parser';
import { TimeCalculator, GroupingMode } from './time-calculator';
import { isValidDate } from './date-utils';

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
    // No automatic UI updates - only respond to popup requests
  }

  /**
   * Gets current summary data for popup
   */
  public getSummaryData(groupingMode: GroupingMode = GroupingMode.BY_NAME): { summaries: any[]; dateRange: any; error: string | null } {
    try {
      
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
          if (!event) {
            return false;
          }
          try {
            if (!isValidDate(event.date)) {
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
      

      // Filter by date range if available
      if (detection.dateRange) {
        const { start, end } = detection.dateRange;
        if (isValidDate(start) && isValidDate(end)) {
          try {
            events = this.timeCalculator.filterEventsByDateRange(events, start!, end!);
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
        summaries = this.timeCalculator.calculateSummaries(events, groupingMode);
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
        const { start, end } = detection.dateRange;
        if (isValidDate(start) && isValidDate(end)) {
          try {
            dateRange = {
              start: start!.toISOString(),
              end: end!.toISOString()
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
          formattedDuration: s.formattedDuration,
          color: s.color
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
const app = new CalendarSummaryApp();
app.init();

// Listen for messages from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'getSummary') {
    try {
      const groupingMode = request.groupingMode || GroupingMode.BY_NAME;
      const data = app.getSummaryData(groupingMode);
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

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
  app.destroy();
});

