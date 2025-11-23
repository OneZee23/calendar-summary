/**
 * Detects if we're on Google Calendar and determines the current view mode
 */

import { CalendarViewMode, PageDetectionResult } from './types';

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
        const baseDate = new Date(dateParam);
        if (!isNaN(baseDate.getTime()) && baseDate.getFullYear() > 1900 && baseDate.getFullYear() < 2100) {
          return this.calculateRange(baseDate, viewMode);
        }
      }

      // Try to parse from URL path (e.g., /calendar/u/0/r/week/2025/11/30)
      const urlMatch = window.location.pathname.match(/\/(week|day|month)\/(\d{4})\/(\d{1,2})\/(\d{1,2})/);
      if (urlMatch) {
        const year = parseInt(urlMatch[2]);
        const month = parseInt(urlMatch[3]) - 1; // Month is 0-indexed
        const day = parseInt(urlMatch[4]);
        const baseDate = new Date(year, month, day);
        if (!isNaN(baseDate.getTime())) {
          console.log('[Page Detector] Parsed date from URL:', baseDate, 'viewMode:', viewMode);
          const range = this.calculateRange(baseDate, viewMode);
          console.log('[Page Detector] Calculated range:', range);
          return range;
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
            
            // Try parsing as ISO string first
            let date = new Date(dateStr);
            // If that fails, try parsing as YYYY-MM-DD
            if (isNaN(date.getTime()) && dateStr.match(/^\d{4}-\d{2}-\d{2}/)) {
              const parts = dateStr.split('-');
              date = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
            }
            
            // Validate date
            if (isNaN(date.getTime()) || date.getFullYear() < 1900 || date.getFullYear() > 2100) {
              return null;
            }
            return date;
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
            
            if (!isNaN(monday.getTime()) && !isNaN(sunday.getTime()) &&
                monday.getFullYear() > 1900 && sunday.getFullYear() < 2100) {
              console.log('[Page Detector] Week range from DOM:', monday, 'to', sunday);
              return { start: monday, end: sunday };
            }
          }
          
          // For other views or fallback
          const start = new Date(minDate);
          start.setHours(0, 0, 0, 0);
          const end = new Date(maxDate);
          end.setHours(23, 59, 59, 999);
          
          // Validate result
          if (!isNaN(start.getTime()) && !isNaN(end.getTime()) &&
              start.getFullYear() > 1900 && end.getFullYear() < 2100) {
            return { start, end };
          }
        }
      }

      // Fallback: use current date and calculate range
      const today = new Date();
      if (!isNaN(today.getTime())) {
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
    if (isNaN(baseDate.getTime()) || baseDate.getFullYear() < 1900 || baseDate.getFullYear() > 2100) {
      console.warn('[Page Detector] Invalid base date, using today:', baseDate);
      baseDate = new Date();
    }

    let start = new Date(baseDate);
    start.setHours(0, 0, 0, 0);

    let end = new Date(start);

    switch (viewMode) {
      case CalendarViewMode.DAY:
        end.setDate(end.getDate() + 1);
        break;
      case CalendarViewMode.WEEK:
        // Get Monday of the week containing baseDate
        const dayOfWeek = start.getDay();
        console.log('[Page Detector] Base date day of week:', dayOfWeek, 'date:', start);
        // Calculate days to subtract to get to Monday (0=Sunday, 1=Monday, etc.)
        // If Sunday (0), go back 6 days. If Monday (1), no change. If Tuesday (2), go back 1 day, etc.
        const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
        console.log('[Page Detector] Days to Monday:', diffToMonday);
        const mondayDate = new Date(start);
        mondayDate.setDate(mondayDate.getDate() + diffToMonday);
        mondayDate.setHours(0, 0, 0, 0);
        start = mondayDate;
        console.log('[Page Detector] Monday date:', start);
        // Sunday is 6 days after Monday
        end = new Date(start);
        end.setDate(end.getDate() + 6);
        end.setHours(23, 59, 59, 999);
        console.log('[Page Detector] Sunday date:', end);
        break;
      case CalendarViewMode.MONTH:
        end.setMonth(end.getMonth() + 1);
        break;
      default:
        end.setDate(end.getDate() + 7); // Default to week
    }

    // Final validation
    if (isNaN(start.getTime()) || isNaN(end.getTime()) ||
        start.getFullYear() < 1900 || start.getFullYear() > 2100 ||
        end.getFullYear() < 1900 || end.getFullYear() > 2100) {
      console.error('[Page Detector] Invalid calculated date range:', { start, end });
      // Fallback to current week
      const today = new Date();
      today.setHours(0, 0, 0, 0);
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

