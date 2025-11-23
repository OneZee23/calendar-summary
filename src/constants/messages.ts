/**
 * User-facing messages and error messages
 */

export const MESSAGES = {
  ERROR: {
    INVALID_PAGE: 'Please navigate to Google Calendar and select a calendar view.',
    NOT_CALENDAR_PAGE: 'Please navigate to Google Calendar (calendar.google.com) and open this popup again.',
    CONTENT_SCRIPT_NOT_LOADED: 'Content script is not loaded. Please refresh the page (F5) and wait a few seconds before opening this popup again.',
    CONNECTION_FAILED: 'Could not connect to Google Calendar page. Please refresh the page (F5) and try again.',
    PARSING_EVENTS: 'Error parsing events',
    CALCULATING_SUMMARIES: 'Error calculating summaries',
    DETECTING_PAGE: 'Error detecting page',
    FILTERING_EVENTS: 'Error filtering by date range',
    CONVERTING_DATES: 'Error converting dates to ISO',
    INVALID_DATE_RANGE: 'Invalid date range detected',
    INVALID_BASE_DATE: 'Invalid base date, using today',
    INVALID_CALCULATED_RANGE: 'Invalid calculated date range',
    INVALID_DATE_RANGE_FILTERING: 'Invalid date range for filtering, returning all events',
    SKIPPING_INVALID_DATE: 'Skipping event with invalid date',
    SKIPPING_INVALID_DATE_DEDUP: 'Skipping event with invalid date in deduplication',
    ERROR_FILTERING_EVENT: 'Error filtering event',
    ERROR_DEDUPLICATION: 'Error in deduplication',
    ERROR_VALIDATING_EVENT: 'Error validating event',
    ERROR_DETECTING_DATE_RANGE: 'Error detecting date range',
  },
  UI: {
    NO_ACTIVITIES: 'No activities found',
    LOADING: 'Loading...',
    TOTAL: 'Total',
    OCCURRENCE: 'occurrence',
    OCCURRENCES: 'occurrences',
  },
} as const;

