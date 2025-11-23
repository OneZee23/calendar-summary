/**
 * Detects if we're on Google Calendar and determines the current view mode
 */

import { CalendarViewMode, PageDetectionResult } from './types';
import { isValidDate, normalizeDate, createNormalizedDate } from './date-utils';

/**
 * Service for detecting Google Calendar page state
 */
export class PageDetector {
  /**
   * Checks if current page is Google Calendar
   */
  public isGoogleCalendarPage(): boolean {
    return window.location.hostname === 'calendar.google.com';
  }

  /**
   * Detects the current calendar view mode
   */
  public detectViewMode(): CalendarViewMode {
    const url = window.location.href;
    const pathname = window.location.pathname;
    
    // Check URL path first (e.g., /calendar/u/0/r/week/2025/11/30)
    if (pathname.includes('/week/')) {
      return CalendarViewMode.WEEK;
    }
    if (pathname.includes('/day/')) {
      return CalendarViewMode.DAY;
    }
    if (pathname.includes('/month/')) {
      return CalendarViewMode.MONTH;
    }
    
    // Check URL parameters
    if (url.includes('view=day')) {
      return CalendarViewMode.DAY;
    }
    if (url.includes('view=week') || url.includes('view=agenda')) {
      return CalendarViewMode.WEEK;
    }
    if (url.includes('view=month')) {
      return CalendarViewMode.MONTH;
    }

    // Try to detect from DOM
    const weekView = document.querySelector('[data-viewtype="week"]');
    const dayView = document.querySelector('[data-viewtype="day"]');
    const monthView = document.querySelector('[data-viewtype="month"]');

    if (weekView) return CalendarViewMode.WEEK;
    if (dayView) return CalendarViewMode.DAY;
    if (monthView) return CalendarViewMode.MONTH;

    // Default to week if we're on calendar page
    return CalendarViewMode.WEEK;
  }

  /**
   * Detects the visible date range based on current view
   */
  public detectDateRange(viewMode: CalendarViewMode): { start: Date; end: Date } | null {
    try {
      // Google Calendar stores date info in various places
      // Try to get from URL parameters
      const urlParams = new URLSearchParams(window.location.search);
      const dateParam = urlParams.get('date');

      if (dateParam) {
        const baseDate = createNormalizedDate(dateParam);
        if (isValidDate(baseDate)) {
          return this.calculateRange(baseDate!, viewMode);
        }
      }

      // Try to parse from URL path (e.g., /calendar/u/0/r/week/2025/11/30)
      const urlMatch = window.location.pathname.match(/\/(week|day|month)\/(\d{4})\/(\d{1,2})\/(\d{1,2})/);
      if (urlMatch) {
        const year = parseInt(urlMatch[2]);
        const month = parseInt(urlMatch[3]) - 1; // Month is 0-indexed
        const day = parseInt(urlMatch[4]);
        const baseDate = new Date(year, month, day);
        const normalized = normalizeDate(baseDate);
        if (isValidDate(normalized)) {
          return this.calculateRange(normalized, viewMode);
        }
      }

      // Try to get from DOM - look for date indicators in week view headers
      // Google Calendar week view has date headers with data-date attributes
      const dateElements = document.querySelectorAll('[data-date]');
      if (dateElements.length > 0) {
        const dates = Array.from(dateElements)
          .map(el => {
            const dateStr = el.getAttribute('data-date');
            if (!dateStr) return null;
            
            let date: Date | null = null;
            // Try parsing as YYYY-MM-DD first
            if (dateStr.match(/^\d{4}-\d{2}-\d{2}/)) {
              const parts = dateStr.split('-');
              date = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
            } else {
              date = createNormalizedDate(dateStr);
            }
            
            if (isValidDate(date)) {
              return normalizeDate(date!);
            }
            return null;
          })
          .filter((d): d is Date => d !== null);

        if (dates.length > 0) {
          // For week view, we want the range from Monday to Sunday
          const minDate = new Date(Math.min(...dates.map(d => d.getTime())));
          const maxDate = new Date(Math.max(...dates.map(d => d.getTime())));
          
          // If we're in week view, ensure we have a full week
          if (viewMode === CalendarViewMode.WEEK) {
            // Find Monday of the week containing minDate
            const dayOfWeek = minDate.getDay();
            const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
            const monday = new Date(minDate);
            monday.setDate(monday.getDate() + diffToMonday);
            monday.setHours(0, 0, 0, 0);
            
            // Sunday is 6 days after Monday
            const sunday = new Date(monday);
            sunday.setDate(sunday.getDate() + 6);
            sunday.setHours(23, 59, 59, 999);
            
            if (isValidDate(monday) && isValidDate(sunday)) {
              return { start: monday, end: sunday };
            }
          }
          
          // For other views or fallback
          const start = normalizeDate(minDate);
          const end = new Date(maxDate);
          end.setHours(23, 59, 59, 999);
          
          if (isValidDate(start) && isValidDate(end)) {
            return { start, end };
          }
        }
      }

      // Fallback: use current date and calculate range
      const today = normalizeDate(new Date());
      if (isValidDate(today)) {
        return this.calculateRange(today, viewMode);
      }
      
      return null;
    } catch (error) {
      console.error('[Page Detector] Error detecting date range:', error);
      return null;
    }
  }

  /**
   * Calculates date range based on view mode and base date
   */
  private calculateRange(baseDate: Date, viewMode: CalendarViewMode): { start: Date; end: Date } {
    // Validate base date
    if (!isValidDate(baseDate)) {
      console.warn('[Page Detector] Invalid base date, using today:', baseDate);
      baseDate = normalizeDate(new Date());
    } else {
      baseDate = normalizeDate(baseDate);
    }

    let start = new Date(baseDate);

    let end = new Date(start);

    switch (viewMode) {
      case CalendarViewMode.DAY:
        end.setDate(end.getDate() + 1);
        break;
      case CalendarViewMode.WEEK:
        // Get Monday of the week containing baseDate
        const dayOfWeek = start.getDay();
        // Calculate days to subtract to get to Monday (0=Sunday, 1=Monday, etc.)
        // If Sunday (0), go back 6 days. If Monday (1), no change. If Tuesday (2), go back 1 day, etc.
        const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
        const mondayDate = new Date(start);
        mondayDate.setDate(mondayDate.getDate() + diffToMonday);
        mondayDate.setHours(0, 0, 0, 0);
        start = mondayDate;
        // Sunday is 6 days after Monday
        end = new Date(start);
        end.setDate(end.getDate() + 6);
        end.setHours(23, 59, 59, 999);
        break;
      case CalendarViewMode.MONTH:
        end.setMonth(end.getMonth() + 1);
        break;
      default:
        end.setDate(end.getDate() + 7); // Default to week
    }

    // Final validation
    if (!isValidDate(start) || !isValidDate(end)) {
      console.error('[Page Detector] Invalid calculated date range:', { start, end });
      // Fallback to current week
      const today = normalizeDate(new Date());
      const dayOfWeek = today.getDay();
      const diff = today.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
      const fallbackStart = new Date(today);
      fallbackStart.setDate(diff);
      const fallbackEnd = new Date(fallbackStart);
      fallbackEnd.setDate(diff + 7);
      return { start: fallbackStart, end: fallbackEnd };
    }

    return { start, end };
  }

  /**
   * Performs full page detection
   */
  public detectPage(): PageDetectionResult {
    const isCalendarPage = this.isGoogleCalendarPage();
    const viewMode = isCalendarPage ? this.detectViewMode() : CalendarViewMode.UNKNOWN;
    const dateRange = isCalendarPage ? this.detectDateRange(viewMode) : null;

    return {
      isCalendarPage,
      viewMode,
      dateRange
    };
  }
}

