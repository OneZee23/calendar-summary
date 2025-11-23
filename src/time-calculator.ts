/**
 * Calculates time summaries for calendar activities
 */

import { CalendarEvent, ActivitySummary } from './types';

/**
 * Service for calculating activity time summaries
 */
export class TimeCalculator {
  /**
   * Groups events by activity name and calculates totals
   */
  public calculateSummaries(events: CalendarEvent[]): ActivitySummary[] {
    // Group events by title (activity name)
    const grouped = new Map<string, CalendarEvent[]>();

    events.forEach(event => {
      const key = this.normalizeActivityName(event.title);
      if (!grouped.has(key)) {
        grouped.set(key, []);
      }
      grouped.get(key)!.push(event);
    });

    // Calculate summaries
    const summaries: ActivitySummary[] = [];

    grouped.forEach((eventGroup, activityName) => {
      const totalMinutes = eventGroup.reduce((sum, event) => sum + event.duration, 0);
      const count = eventGroup.length;
      const formattedDuration = this.formatDuration(totalMinutes);
      
      // Use color from first event with this name (or most common color)
      const color = eventGroup.find(e => e.color)?.color;

      summaries.push({
        name: activityName,
        totalMinutes,
        count,
        formattedDuration,
        color
      });
    });

    // Sort by total time (descending)
    return summaries.sort((a, b) => b.totalMinutes - a.totalMinutes);
  }

  /**
   * Normalizes activity name for grouping
   * Removes variations like "Breakfast", "Breakfast ", "breakfast" -> "Breakfast"
   */
  private normalizeActivityName(name: string): string {
    return name.trim();
  }

  /**
   * Formats duration in minutes to human-readable string
   * Examples: 30 -> "30m", 90 -> "1h 30m", 210 -> "3h 30m"
   */
  private formatDuration(minutes: number): string {
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
   * Filters events within a date range
   */
  public filterEventsByDateRange(
    events: CalendarEvent[],
    startDate: Date,
    endDate: Date
  ): CalendarEvent[] {
    // Validate input dates
    if (!startDate || !endDate || 
        isNaN(startDate.getTime()) || isNaN(endDate.getTime()) ||
        startDate.getFullYear() < 1900 || endDate.getFullYear() > 2100) {
      console.warn('[Time Calculator] Invalid date range for filtering, returning all events');
      return events;
    }

    return events.filter(event => {
      try {
        // Validate event date
        if (!event.date || isNaN(event.date.getTime()) || 
            event.date.getFullYear() < 1900 || event.date.getFullYear() > 2100) {
          console.warn('[Time Calculator] Skipping event with invalid date:', event);
          return false;
        }

        const eventDate = new Date(event.date);
        if (isNaN(eventDate.getTime())) {
          return false;
        }
        eventDate.setHours(0, 0, 0, 0);
        
        const start = new Date(startDate);
        if (isNaN(start.getTime())) {
          return false;
        }
        start.setHours(0, 0, 0, 0);
        
        const end = new Date(endDate);
        if (isNaN(end.getTime())) {
          return false;
        }
        end.setHours(0, 0, 0, 0);

        return eventDate >= start && eventDate <= end;
      } catch (error) {
        console.error('[Time Calculator] Error filtering event:', error, event);
        return false;
      }
    });
  }
}

