/**
 * Parses calendar events from Google Calendar DOM
 */

import { CalendarEvent } from './types';
import { isValidDate, normalizeDate, createNormalizedDate } from './date-utils';
import { DOM_SELECTORS, DOM_ATTRIBUTES, CSS_CLASSES } from './constants/dom-selectors';
import { DATE_CONSTANTS, RUSSIAN_MONTHS } from './constants/date-constants';
import { REGEX_PATTERNS, TEXT_SEPARATORS } from './constants/regex-patterns';
import { COLOR_MAP, COLOR_NAMES, DEFAULT_COLOR, DEFAULT_COLOR_NAME } from './constants/colors';
import { MESSAGES } from './constants/messages';

/**
 * Service for parsing calendar events from the page
 */
export class EventParser {
  /**
   * Extracts all visible calendar events from the DOM
   * Google Calendar's DOM structure can vary, so we use multiple strategies
   */
  public parseEvents(): CalendarEvent[] {
    const events: CalendarEvent[] = [];

    // Strategy 1: Look for event containers with data-eventid (most reliable)
    const eventElements = document.querySelectorAll(DOM_SELECTORS.EVENT_BY_ID);
    eventElements.forEach((element) => {
      const event = this.parseEventElement(element as HTMLElement);
      if (event) {
        events.push(event);
      }
    });

    // Strategy 2: Look for event buttons in grid cells
    if (events.length === 0) {
      const gridEvents = document.querySelectorAll(DOM_SELECTORS.GRID_EVENTS);
      gridEvents.forEach(element => {
        const event = this.parseEventElement(element as HTMLElement);
        if (event) events.push(event);
      });
    }

    // Strategy 3: Look for elements with event-related classes
    if (events.length === 0) {
      const classEvents = document.querySelectorAll(DOM_SELECTORS.EVENT_CONTAINERS);
      classEvents.forEach(element => {
        const event = this.parseEventElement(element as HTMLElement);
        if (event) events.push(event);
      });
    }

    // Strategy 4: Parse from time slots (for week/day views)
    this.parseFromTimeSlots(events);

    const deduplicated = this.deduplicateEvents(events);
    return deduplicated;
  }

  /**
   * Parses a single event element
   * Handles various Google Calendar DOM structures
   */
  private parseEventElement(element: HTMLElement): CalendarEvent | null {
    try {
      // First, extract timeText and aria-label from element and parents
      let timeText = '';
      let ariaLabel = '';
      let searchElement: HTMLElement | null = element;
      
      while (searchElement && (!timeText || !ariaLabel)) {
        if (!timeText) {
          const timeElement = searchElement.querySelector(DOM_SELECTORS.TIME_ELEMENT) ||
                             searchElement.querySelector(DOM_SELECTORS.EVENT_TIME_CLASS) ||
                             searchElement.querySelector(DOM_SELECTORS.TIME_CLASS_PATTERN);
          
          const candidate = timeElement?.textContent?.trim() || 
                           searchElement.getAttribute(DOM_ATTRIBUTES.ARIA_LABEL) ||
                           searchElement.getAttribute(DOM_ATTRIBUTES.TITLE) ||
                           searchElement.textContent?.trim() ||
                           '';
          
          if (candidate && (REGEX_PATTERNS.TIME_IN_TEXT.test(candidate) || REGEX_PATTERNS.RUSSIAN_TIME_IN_TEXT.test(candidate))) {
            timeText = candidate;
          }
        }
        
        if (!ariaLabel) {
          const candidate = searchElement.getAttribute(DOM_ATTRIBUTES.ARIA_LABEL) || '';
          if (candidate) {
            ariaLabel = candidate;
          }
        }
        
        searchElement = searchElement.parentElement;
      }

      // Try to extract title from timeText or aria-label FIRST (most reliable source)
      let title = this.extractTitleFromText(timeText || ariaLabel);
      
      // If not found, try data-event-title attribute
      if (!title) {
        let current: HTMLElement | null = element;
        while (current && !title) {
          const dataTitle = current.getAttribute(DOM_ATTRIBUTES.DATA_EVENT_TITLE);
          if (dataTitle) {
            title = dataTitle;
            break;
          }
          
          const titleElement = current.querySelector(DOM_SELECTORS.EVENT_TITLE_ATTR) ||
                              current.querySelector(DOM_SELECTORS.EVENT_TITLE_CLASS);
          if (titleElement) {
            title = titleElement.textContent?.trim() || 
                    titleElement.getAttribute(DOM_ATTRIBUTES.TITLE) ||
                    '';
            if (title) break;
          }
          
          current = current.parentElement;
        }
      }
      
      // If still no title, try textContent (but filter out generic titles)
      if (!title) {
        let current: HTMLElement | null = element;
        while (current && !title) {
          const textContent = current.textContent?.trim() || '';
          if (textContent && !textContent.match(/^[Сс]\s*\d{1,2}:\d{2}/)) {
            const candidate = textContent.split(',')[0].split('С ')[0].split('с ')[0].trim();
            if (candidate && 
                candidate.length > 0 && 
                !candidate.match(/^\d{1,2}:\d{2}/) &&
                !candidate.match(/^\d+\s*мероприяти[ея]$/i)) {
              title = candidate;
              break;
            }
          }
          current = current.parentElement;
        }
      }
      
      // If we got a generic title, try to extract real title from timeText/ariaLabel
      if (title && title.match(/^\d+\s*мероприяти[ея]$/i)) {
        // First, try to extract from timeText/ariaLabel
        const realTitle = this.extractTitleFromText(timeText || ariaLabel);
        if (realTitle && !realTitle.match(/^\d+\s*мероприяти[ея]$/i)) {
          title = realTitle;
        } else {
          // Try to find title in all text nodes of element and its parents
          let foundTitle = false;
          let searchEl: HTMLElement | null = element;
          
          while (searchEl && !foundTitle) {
            // Get all text nodes from this element and its children
            const allTextNodes = Array.from(searchEl.querySelectorAll('*'))
              .map(el => el.textContent?.trim())
              .filter(text => text && text.length > 0);
            
            // Also check the element's own text (excluding children)
            const walker = document.createTreeWalker(
              searchEl,
              NodeFilter.SHOW_TEXT,
              null
            );
            const directTexts: string[] = [];
            let node;
            while (node = walker.nextNode()) {
              const text = node.textContent?.trim();
              if (text && text.length > 0) {
                directTexts.push(text);
              }
            }
            
            // Combine all texts
            const allTexts = [...allTextNodes, ...directTexts];
            
            // Try to find a real title in these texts
            for (const text of allTexts) {
              if (!text) continue;
              
              // Try to extract title from text if it contains comma-separated values
              const extracted = this.extractTitleFromText(text);
              if (extracted && !extracted.match(/^\d+\s*мероприяти[ея]$/i)) {
                title = extracted;
                foundTitle = true;
                break;
              }
              
              // Or use the text directly if it looks like a valid title
              const trimmed = text.trim();
              if (trimmed && 
                  trimmed.length > 2 &&
                  !trimmed.match(/^\d+\s*мероприяти[ея]$/i) &&
                  !trimmed.match(/^\d{1,2}:\d{2}/) &&
                  !trimmed.match(/^[Сс]\s*\d{1,2}:\d{2}/) &&
                  !trimmed.match(/^\d{1,2}:\d{2}–\d{1,2}:\d{2}/) &&
                  !trimmed.includes('Место') &&
                  !trimmed.includes('цвет') &&
                  !trimmed.match(/\d{1,2}\s+(января|февраля|марта|апреля|мая|июня|июля|августа|сентября|октября|ноября|декабря)\s+\d{4}/i) &&
                  !trimmed.match(/^[А-ЯЁ][а-яё]+\s+[А-ЯЁ][а-яё]+$/) &&
                  !trimmed.match(/^[A-Z][a-z]+\s+[A-Z][a-z]+$/)) {
                title = trimmed;
                foundTitle = true;
                break;
              }
            }
            
            // Also check parent's aria-label and title attributes
            if (!foundTitle && searchEl.parentElement) {
              const parentAriaLabel = searchEl.parentElement.getAttribute('aria-label') || '';
              const parentTitle = searchEl.parentElement.getAttribute('title') || '';
              
              const parentExtracted = this.extractTitleFromText(parentAriaLabel || parentTitle);
              if (parentExtracted && !parentExtracted.match(/^\d+\s*мероприяти[ея]$/i)) {
                title = parentExtracted;
                foundTitle = true;
                break;
              }
            }
            
            searchEl = searchEl.parentElement;
          }
        }
      }
      
      // Final validation - skip if still generic or invalid
      if (!title || 
          title.length <= 1 || 
          title.match(/^\d+\s*мероприяти[ея]$/i) ||
          title === 'С' || 
          title === 'с') {
        return null;
      }

      // Try to extract date from time text first (it often contains date)
      let date = this.extractDateFromTimeText(timeText);
      if (!isValidDate(date)) {
        date = this.extractDate(element);
      }

      // Parse time from text or attributes
      const { startMinutes, endMinutes } = this.parseTime(timeText, element);

      if (startMinutes === null || endMinutes === null) {
        return null;
      }

      if (endMinutes <= startMinutes) {
        return null;
      }

      const duration = endMinutes - startMinutes;
      
      // Validate date, fallback to today if invalid
      if (!date || !isValidDate(date)) {
        date = normalizeDate(new Date());
      } else {
        date = normalizeDate(date);
      }

      // Extract color from element
      const color = this.extractColor(element);

      return {
        title,
        startMinutes,
        endMinutes,
        date,
        duration,
        color
      };
    } catch (error) {
      console.error('Error parsing event element:', error);
      return null;
    }
  }

  /**
   * Extracts title from text (e.g., "С 12:00 до 12:15, Event Title, ...")
   * Also handles formats like "Event Title, 12:00" or "Title10:00–13:00"
   */
  private extractTitleFromText(text: string): string | null {
    if (!text) {
      return null;
    }
    
    // If text contains comma, split and process parts
    if (text.includes(TEXT_SEPARATORS[0])) {
      const parts = text.split(TEXT_SEPARATORS[0]);
      if (parts.length < 2) {
        return null;
      }
      
      // Skip first part (time), try to find title in subsequent parts
      for (let i = 1; i < parts.length; i++) {
        const candidate = parts[i].trim();
        
        if (this.isValidTitle(candidate)) {
          return candidate;
        }
      }
    }
    
    // Try to extract from patterns like "Title10:00–13:00" or "Title, 10:00"
    // Remove time patterns and see what's left
    const russianDatePattern = new RegExp(`\\d{1,2}\\s+(${RUSSIAN_MONTHS.join('|')})\\s+\\d{4}`, 'gi');
    const withoutTime = text
      .replace(REGEX_PATTERNS.RUSSIAN_TIME_FORMAT, '')
      .replace(/\d{1,2}:\d{2}–\d{1,2}:\d{2}/g, '')
      .replace(REGEX_PATTERNS.TIME_FORMAT, '')
      .replace(russianDatePattern, '')
      .trim();
    
    // Split by common separators and try each part
    for (const sep of TEXT_SEPARATORS) {
      if (withoutTime.includes(sep)) {
        const parts = withoutTime.split(sep);
        for (const part of parts) {
          const candidate = part.trim();
          if (this.isValidTitle(candidate)) {
            return candidate;
          }
        }
      }
    }
    
    // If no separators, check if the whole text (after removing time) is a valid title
    if (this.isValidTitle(withoutTime)) {
      return withoutTime;
    }
    
    return null;
  }
  
  /**
   * Validates if a string is a valid event title (not generic, not time, not metadata)
   */
  private isValidTitle(candidate: string): boolean {
    if (!candidate || candidate.length <= 1) {
      return false;
    }
    
    // Reject generic titles
    if (REGEX_PATTERNS.GENERIC_TITLE_PATTERN.test(candidate)) {
      return false;
    }
    
    // Reject time patterns
    if (REGEX_PATTERNS.RUSSIAN_TIME_IN_TEXT.test(candidate) ||
        REGEX_PATTERNS.TIME_IN_TEXT.test(candidate) ||
        /^\d{1,2}:\d{2}–\d{1,2}:\d{2}/.test(candidate)) {
      return false;
    }
    
    // Reject metadata
    const russianDatePattern = new RegExp(`\\d{1,2}\\s+(${RUSSIAN_MONTHS.join('|')})\\s+\\d{4}`, 'i');
    if (candidate.includes('Место') ||
        candidate.includes('цвет') ||
        russianDatePattern.test(candidate)) {
      return false;
    }
    
    // Reject single characters
    if (REGEX_PATTERNS.SINGLE_CHARACTER.test(candidate)) {
      return false;
    }
    
    // Accept all valid titles (don't filter out two-word titles as they might be valid activity names)
    return true;
  }

  /**
   * Extracts color from event element
   * Google Calendar uses various methods: CSS classes, data attributes, inline styles
   */
  private extractColor(element: HTMLElement): string | undefined {
    // First, check the element itself and all its children
    const allElements = [element, ...Array.from(element.querySelectorAll('*'))];
    
    for (const current of allElements) {
      if (!(current instanceof HTMLElement)) continue;
      
      // Method 1: Check for data-color-id or data-color attribute
      const dataColorId = current.getAttribute(DOM_ATTRIBUTES.DATA_COLOR_ID);
      if (dataColorId) {
        const color = this.getColorFromId(dataColorId);
        if (color) {
          return color;
        }
      }
      
      const dataColor = current.getAttribute(DOM_ATTRIBUTES.DATA_COLOR);
      if (dataColor) {
        return dataColor;
      }
      
      // Method 2: Check for event-color-* classes or any class with "color" in name
      const classList = Array.from(current.classList);
      
      for (const cls of classList) {
        // Look for patterns like "event-color-1", "color-1", "eventColor1", etc.
        const colorMatch = cls.match(/(?:event[-_]?color|color)[-_]?(\d+)/i);
        if (colorMatch) {
          const colorId = colorMatch[1];
          const color = this.getColorFromId(colorId);
          if (color) {
            return color;
          }
        }
      }
      
      // Method 3: Check computed styles (background-color or border-color)
      try {
        const computedStyle = window.getComputedStyle(current);
        const bgColor = computedStyle.backgroundColor;
        const borderColor = computedStyle.borderLeftColor || computedStyle.borderTopColor || computedStyle.borderColor;
        
        // Use border color if it's not transparent/default, otherwise use background
        const styleColor = borderColor && 
                          borderColor !== 'rgba(0, 0, 0, 0)' && 
                          borderColor !== 'transparent' &&
                          borderColor !== 'rgb(0, 0, 0)' &&
                          borderColor !== 'rgb(255, 255, 255)'
          ? borderColor 
          : bgColor;
        
        if (styleColor && 
            styleColor !== 'rgba(0, 0, 0, 0)' && 
            styleColor !== 'transparent' &&
            styleColor !== 'rgb(255, 255, 255)' &&
            styleColor !== 'rgb(0, 0, 0)' &&
            styleColor !== '#ffffff' &&
            styleColor !== '#fff' &&
            styleColor !== '#000000' &&
            styleColor !== '#000') {
          const hexColor = this.rgbToHex(styleColor);
          if (hexColor) {
            return hexColor;
          }
        }
      } catch (e) {
        // Silently continue if computed style fails
      }
      
      // Method 4: Check inline style attribute
      const inlineStyle = current.getAttribute(DOM_ATTRIBUTES.STYLE);
      if (inlineStyle) {
        // Try background-color, border-color, border-left-color, etc.
        const bgMatch = inlineStyle.match(/background(?:-color)?:\s*([^;]+)/i);
        const borderMatch = inlineStyle.match(/border(?:-left|-top|-right|-bottom)?(?:-color)?:\s*([^;]+)/i);
        const colorMatch = bgMatch || borderMatch;
        if (colorMatch) {
          const color = colorMatch[1].trim();
          const hexColor = this.rgbToHex(color) || color;
          if (hexColor && 
              hexColor !== '#ffffff' && 
              hexColor !== '#fff' &&
              hexColor !== '#000000' &&
              hexColor !== '#000') {
            return hexColor;
          }
        }
      }
    }
    
    // Method 5: Check parent elements
    let current: HTMLElement | null = element.parentElement;
    let depth = 0;
    const MAX_PARENT_DEPTH = 3;
    while (current && depth < MAX_PARENT_DEPTH) {
      const dataColorId = current.getAttribute(DOM_ATTRIBUTES.DATA_COLOR_ID);
      if (dataColorId) {
        const color = this.getColorFromId(dataColorId);
        if (color) {
          return color;
        }
      }
      
      const classList = Array.from(current.classList);
      for (const cls of classList) {
        const colorMatch = cls.match(/(?:event[-_]?color|color)[-_]?(\d+)/i);
        if (colorMatch) {
          const colorId = colorMatch[1];
          const color = this.getColorFromId(colorId);
          if (color) {
            return color;
          }
        }
      }
      
      current = current.parentElement;
      depth++;
    }
    
    return undefined;
  }
  
  /**
   * Converts RGB/RGBA color to hex
   */
  private rgbToHex(color: string): string | null {
    if (!color) return null;
    
    // Trim and normalize
    color = color.trim();
    
    // If already hex, return as is (normalize to 6 digits)
    if (color.startsWith('#')) {
      const hex = color.substring(1);
      if (hex.length === 3) {
        // Expand short hex (#abc -> #aabbcc)
        return `#${hex.split('').map(c => c + c).join('')}`;
      }
      if (hex.length === 6) {
        return `#${hex}`;
      }
      return null;
    }
    
    // Parse rgb/rgba
    const rgbMatch = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
    if (rgbMatch) {
      const r = parseInt(rgbMatch[1]);
      const g = parseInt(rgbMatch[2]);
      const b = parseInt(rgbMatch[3]);
      if (r >= 0 && r <= 255 && g >= 0 && g <= 255 && b >= 0 && b <= 255) {
        return `#${[r, g, b].map(x => {
          const hex = x.toString(16);
          return hex.length === 1 ? '0' + hex : hex;
        }).join('')}`;
      }
    }
    
    // Try to parse as named color (basic set)
    const namedColors: { [key: string]: string } = {
      'red': '#ff0000',
      'green': '#008000',
      'blue': '#0000ff',
      'yellow': '#ffff00',
      'orange': '#ffa500',
      'purple': '#800080',
      'pink': '#ffc0cb',
      'cyan': '#00ffff',
      'magenta': '#ff00ff',
      'lime': '#00ff00',
      'navy': '#000080',
      'teal': '#008080',
      'maroon': '#800000',
      'olive': '#808000',
    };
    
    const lowerColor = color.toLowerCase();
    if (namedColors[lowerColor]) {
      return namedColors[lowerColor];
    }
    
    return null;
  }
  
  /**
   * Maps Google Calendar color IDs to hex colors
   * These are the default Google Calendar colors
   */
  private getColorFromId(colorId: string): string | null {
    // Normalize color ID (remove leading zeros, handle string/number)
    const normalizedId = String(parseInt(colorId, 10));
    
    return COLOR_MAP[normalizedId] || null;
  }

  /**
   * Extracts date from time text (e.g., "С 12:00 до 12:15, Event Title, ..., 26 ноября 2025")
   */
  private extractDateFromTimeText(timeText: string): Date | null {
    if (!timeText) return null;
    
    // Try to find Russian date pattern
    const russianDateMatch = timeText.match(REGEX_PATTERNS.RUSSIAN_DATE);
    if (russianDateMatch) {
      const day = parseInt(russianDateMatch[1]);
      const month = RUSSIAN_MONTHS.findIndex(m => m.toLowerCase() === russianDateMatch[2].toLowerCase());
      const year = parseInt(russianDateMatch[3]);
      if (month >= 0 && day > 0 && day <= DATE_CONSTANTS.MAX_DAY_IN_MONTH && 
          year >= DATE_CONSTANTS.MIN_YEAR && year <= DATE_CONSTANTS.MAX_YEAR) {
        const date = new Date(year, month, day);
        const normalized = normalizeDate(date);
        if (isValidDate(normalized)) {
          return normalized;
        }
      }
    }
    
    return null;
  }

  /**
   * Extracts date from element or its parents
   */
  private extractDate(element: HTMLElement): Date {
    // Try to get date from data attributes
    let current: HTMLElement | null = element;
    while (current) {
      // Try data-date first (most reliable)
      const dataDate = current.getAttribute(DOM_ATTRIBUTES.DATA_DATE);
      if (dataDate) {
        let date: Date | null = null;
        // Try parsing as ISO string or YYYY-MM-DD
        if (REGEX_PATTERNS.ISO_DATE.test(dataDate)) {
          const parts = dataDate.split('-');
          date = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
        } else {
          date = createNormalizedDate(dataDate);
        }
        if (isValidDate(date)) {
          return normalizeDate(date!);
        }
      }
      
      // Try other attributes
      const dateAttr = current.getAttribute(DOM_ATTRIBUTES.DATA_DAY) ||
                      current.getAttribute(DOM_ATTRIBUTES.DATA_START_TIME) ||
                      current.getAttribute(DOM_ATTRIBUTES.ARIA_LABEL);
      
      if (dateAttr) {
        const parsed = this.parseDateString(dateAttr);
        if (isValidDate(parsed)) {
          return normalizeDate(parsed!);
        }
      }

      current = current.parentElement;
    }
    
    // Try to find date from week view column headers
    // Look for the column header that contains this event
    const weekColumns = document.querySelectorAll(DOM_SELECTORS.WEEK_COLUMNS);
    if (weekColumns.length > 0) {
      // Find which column the event is in by checking position
      const eventRect = element.getBoundingClientRect();
      for (const col of Array.from(weekColumns)) {
        const colRect = col.getBoundingClientRect();
        // Check if event is in this column (horizontally)
        if (eventRect.left >= colRect.left && eventRect.left <= colRect.right) {
          const dateStr = col.getAttribute(DOM_ATTRIBUTES.DATA_DATE);
          if (dateStr) {
            let date: Date | null = null;
            if (REGEX_PATTERNS.ISO_DATE.test(dateStr)) {
              const parts = dateStr.split('-');
              date = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
            } else {
              date = createNormalizedDate(dateStr);
            }
            if (isValidDate(date)) {
              return normalizeDate(date!);
            }
          }
        }
      }
    }

    // Try to get date from URL or current page context
    const urlParams = new URLSearchParams(window.location.search);
    const dateParam = urlParams.get('date');
    if (dateParam) {
      const date = createNormalizedDate(dateParam);
      if (isValidDate(date)) {
        return date!;
      }
    }

    // Fallback to today
    return normalizeDate(new Date());
  }

  /**
   * Parses date string to Date object
   */
  private parseDateString(dateStr: string): Date | null {
    try {
      // Skip if it's clearly not a date (contains time patterns)
      if (dateStr.match(/[Сс]\s*\d{1,2}:\d{2}/) || dateStr.match(/\d{1,2}:\d{2}/)) {
        return null;
      }

      // Try various date formats
      const date = createNormalizedDate(dateStr);
      if (isValidDate(date)) {
        return date!;
      }

      // Try parsing relative dates
      if (dateStr.includes('Today') || dateStr.includes('Сегодня')) {
        return new Date();
      }
      if (dateStr.includes('Tomorrow') || dateStr.includes('Завтра')) {
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        return tomorrow;
      }

      // Try parsing Russian date format
      const russianDateMatch = dateStr.match(REGEX_PATTERNS.RUSSIAN_DATE);
      if (russianDateMatch) {
        const day = parseInt(russianDateMatch[1]);
        const month = RUSSIAN_MONTHS.findIndex(m => m.toLowerCase() === russianDateMatch[2].toLowerCase());
        const year = parseInt(russianDateMatch[3]);
        if (month >= 0 && day > 0 && day <= DATE_CONSTANTS.MAX_DAY_IN_MONTH && 
            year >= DATE_CONSTANTS.MIN_YEAR && year <= DATE_CONSTANTS.MAX_YEAR) {
          const date = new Date(year, month, day);
          const normalized = normalizeDate(date);
          if (isValidDate(normalized)) {
            return normalized;
          }
        }
      }

      return null;
    } catch (error) {
      return null;
    }
  }

  /**
   * Parses time from text or element attributes
   * Supports formats: "9:30 AM - 10:00 AM", "09:30-10:00", "С 13:00 до 13:30" (Russian)
   */
  private parseTime(timeText: string, element: HTMLElement): { startMinutes: number | null; endMinutes: number | null } {
    // Try to get from data attributes first
    const startTime = element.getAttribute(DOM_ATTRIBUTES.DATA_START_TIME);
    const endTime = element.getAttribute(DOM_ATTRIBUTES.DATA_END_TIME);

    if (startTime && endTime) {
      return {
        startMinutes: this.timeToMinutes(startTime),
        endMinutes: this.timeToMinutes(endTime)
      };
    }

    // Parse Russian format
    const russianMatch = timeText.match(REGEX_PATTERNS.RUSSIAN_TIME_FORMAT);
    if (russianMatch) {
      const startHour = parseInt(russianMatch[1]);
      const startMin = parseInt(russianMatch[2]);
      const endHour = parseInt(russianMatch[3]);
      const endMin = parseInt(russianMatch[4]);

      const startMinutes = startHour * DATE_CONSTANTS.MINUTES_IN_HOUR + startMin;
      const endMinutes = endHour * DATE_CONSTANTS.MINUTES_IN_HOUR + endMin;
      return { startMinutes, endMinutes };
    }

    // Parse from text like "9:30 AM - 10:00 AM" or "09:30-10:00"
    const timeMatch = timeText.match(REGEX_PATTERNS.TIME_WITH_AMPM);
    if (timeMatch) {
      const startHour = parseInt(timeMatch[1]);
      const startMin = parseInt(timeMatch[2]);
      const startAmPm = timeMatch[3]?.toUpperCase();
      const endHour = parseInt(timeMatch[4]);
      const endMin = parseInt(timeMatch[5]);
      const endAmPm = timeMatch[6]?.toUpperCase();

      const startMinutes = this.convertTo24Hour(startHour, startMin, startAmPm);
      const endMinutes = this.convertTo24Hour(endHour, endMin, endAmPm);
      return { startMinutes, endMinutes };
    }

    // Try to parse from aria-label or title (any format with two times)
    const ariaLabel = element.getAttribute(DOM_ATTRIBUTES.ARIA_LABEL) || '';
    const ariaMatch = ariaLabel.match(REGEX_PATTERNS.TIME_FORMAT);
    if (ariaMatch) {
      const startHour = parseInt(ariaMatch[1]);
      const startMin = parseInt(ariaMatch[2]);
      const endHour = parseInt(ariaMatch[3]);
      const endMin = parseInt(ariaMatch[4]);

      const startMinutes = startHour * DATE_CONSTANTS.MINUTES_IN_HOUR + startMin;
      const endMinutes = endHour * DATE_CONSTANTS.MINUTES_IN_HOUR + endMin;
      return {
        startMinutes,
        endMinutes
      };
    }

    return { startMinutes: null, endMinutes: null };
  }

  /**
   * Converts time string to minutes since midnight
   */
  private timeToMinutes(timeStr: string): number | null {
    const match = timeStr.match(REGEX_PATTERNS.TIME_FORMAT);
    if (match) {
      const hour = parseInt(match[1]);
      const min = parseInt(match[2]);
      return hour * 60 + min;
    }
    return null;
  }

  /**
   * Converts 12-hour format to 24-hour minutes
   */
  private convertTo24Hour(hour: number, minute: number, amPm?: string): number {
    let h24 = hour;
    if (amPm === 'PM' && hour !== 12) {
      h24 += 12;
    } else if (amPm === 'AM' && hour === 12) {
      h24 = 0;
    }
    return h24 * DATE_CONSTANTS.MINUTES_IN_HOUR + minute;
  }

  /**
   * Parses events from time slot elements
   */
  private parseFromTimeSlots(events: CalendarEvent[]): void {
    // Google Calendar has time slots in the grid
    const timeSlots = document.querySelectorAll(DOM_SELECTORS.TIME_SLOTS);
    timeSlots.forEach(slot => {
      const hour = parseInt(slot.getAttribute(DOM_ATTRIBUTES.DATA_HOUR) || '0');
      const eventsInSlot = slot.querySelectorAll(DOM_SELECTORS.EVENTS_IN_SLOT);
      
      eventsInSlot.forEach(eventEl => {
        const event = this.parseEventElement(eventEl as HTMLElement);
        if (event && event.startMinutes === null) {
          // If we couldn't parse time, use the slot hour
          event.startMinutes = hour * 60;
          event.endMinutes = (hour + 1) * 60; // Default 1 hour
          event.duration = 60;
        }
        if (event) {
          events.push(event);
        }
      });
    });
  }

    /**
     * Removes duplicate events
     */
    private deduplicateEvents(events: CalendarEvent[]): CalendarEvent[] {
      const seen = new Set<string>();
      return events.filter(event => {
        try {
          if (!isValidDate(event.date)) {
            console.warn('[Event Parser] Skipping event with invalid date in deduplication:', event);
            return false;
          }
          const key = `${event.title}-${event.date!.toDateString()}-${event.startMinutes}`;
          if (seen.has(key)) {
            return false;
          }
          seen.add(key);
          return true;
        } catch (error) {
          console.error('[Event Parser] Error in deduplication:', error, event);
          return false;
        }
      });
    }
}

