/**
 * Type definitions for calendar events and summaries
 */

/**
 * Represents a single calendar event
 */
export interface CalendarEvent {
  /** Event title/name */
  title: string;
  /** Start time in minutes since midnight */
  startMinutes: number;
  /** End time in minutes since midnight */
  endMinutes: number;
  /** Date of the event */
  date: Date;
  /** Duration in minutes */
  duration: number;
  /** Event color (hex code or CSS color) */
  color?: string;
}

/**
 * Represents a grouped activity with total time
 */
export interface ActivitySummary {
  /** Activity name */
  name: string;
  /** Total duration in minutes */
  totalMinutes: number;
  /** Number of occurrences */
  count: number;
  /** Formatted duration string (e.g., "3h 30m") */
  formattedDuration: string;
  /** Activity color (hex code or CSS color) */
  color?: string;
}

/**
 * Calendar view mode
 */
export enum CalendarViewMode {
  DAY = 'day',
  WEEK = 'week',
  MONTH = 'month',
  AGENDA = 'agenda',
  UNKNOWN = 'unknown'
}

/**
 * Result of page detection
 */
export interface PageDetectionResult {
  /** Whether we're on Google Calendar */
  isCalendarPage: boolean;
  /** Current view mode */
  viewMode: CalendarViewMode;
  /** Visible date range */
  dateRange: {
    start: Date;
    end: Date;
  } | null;
}

