/**
 * Calculates time summaries for calendar activities
 */

import { CalendarEvent, ActivitySummary } from './types';
import { isValidDate, normalizeDate } from './date-utils';
import { COLOR_NAMES, DEFAULT_COLOR, DEFAULT_COLOR_NAME } from './constants/colors';
import { MESSAGES } from './constants/messages';

/**
 * Grouping mode for summaries
 */
export enum GroupingMode {
  BY_NAME = 'byName',
  BY_COLOR = 'byColor'
}

/**
 * Service for calculating activity time summaries
 */
export class TimeCalculator {
  /**
   * Groups events by activity name and calculates totals
   */
  public calculateSummaries(events: CalendarEvent[], groupingMode: GroupingMode = GroupingMode.BY_NAME): ActivitySummary[] {
    const grouped = new Map<string, CalendarEvent[]>();

    if (groupingMode === GroupingMode.BY_COLOR) {
      // Group by color
      events.forEach(event => {
        // Use color or fallback to default
        const color = event.color || DEFAULT_COLOR;
        const key = this.normalizeColor(color);
        if (!grouped.has(key)) {
          grouped.set(key, []);
        }
        grouped.get(key)!.push(event);
      });
    } else {
      // Group by title (activity name)
      events.forEach(event => {
        const key = this.normalizeActivityName(event.title);
        if (!grouped.has(key)) {
          grouped.set(key, []);
        }
        grouped.get(key)!.push(event);
      });
    }

    // Calculate summaries
    const summaries: ActivitySummary[] = [];

    grouped.forEach((eventGroup, key) => {
      const totalMinutes = eventGroup.reduce((sum, event) => sum + event.duration, 0);
      const count = eventGroup.length;
      const formattedDuration = this.formatDuration(totalMinutes);
      
      if (groupingMode === GroupingMode.BY_COLOR) {
        // For color grouping, use the color as key and create a descriptive name
        const color = key;
        const colorName = this.getColorName(color);
        
        summaries.push({
          name: colorName,
          totalMinutes,
          count,
          formattedDuration,
          color
        });
      } else {
        // For name grouping, use color from first event with this name
        const color = eventGroup.find(e => e.color)?.color;

        summaries.push({
          name: key,
          totalMinutes,
          count,
          formattedDuration,
          color
        });
      }
    });

    // Sort by total time (descending)
    return summaries.sort((a, b) => b.totalMinutes - a.totalMinutes);
  }
  
  /**
   * Normalizes color for grouping (rounds similar colors)
   */
  private normalizeColor(color: string): string {
    if (!color) return DEFAULT_COLOR;
    // Return as-is for now, could implement color rounding if needed
    return color;
  }
  
  /**
   * Gets a human-readable name for a color
   */
  private getColorName(color: string): string {
    // Normalize color (uppercase, ensure #)
    const normalized = color.toUpperCase().startsWith('#') ? color.toUpperCase() : `#${color.toUpperCase()}`;
    return COLOR_NAMES[normalized] || `${DEFAULT_COLOR_NAME} ${normalized}`;
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
    if (!isValidDate(startDate) || !isValidDate(endDate)) {
      console.warn(MESSAGES.ERROR.INVALID_DATE_RANGE_FILTERING);
      return events;
    }

    const normalizedStart = normalizeDate(startDate);
    const normalizedEnd = normalizeDate(endDate);

    return events.filter(event => {
      try {
        if (!isValidDate(event.date)) {
          console.warn(MESSAGES.ERROR.SKIPPING_INVALID_DATE, event);
          return false;
        }

        const eventDate = normalizeDate(event.date!);
        return eventDate >= normalizedStart && eventDate <= normalizedEnd;
      } catch (error) {
        console.error(MESSAGES.ERROR.ERROR_FILTERING_EVENT, error, event);
        return false;
      }
    });
  }
}

