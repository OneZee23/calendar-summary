/**
 * Parses calendar events from Google Calendar DOM
 */

import { CalendarEvent } from './types';

/**
 * Service for parsing calendar events from the page
 */
export class EventParser {
  /**
   * Extracts all visible calendar events from the DOM
   * Google Calendar's DOM structure can vary, so we use multiple strategies
   */
  public parseEvents(): CalendarEvent[] {
    console.log('[Event Parser] Starting to parse events...');
    const events: CalendarEvent[] = [];

    // Strategy 1: Look for event containers with data-eventid (most reliable)
    const eventElements = document.querySelectorAll('[data-eventid]');
    console.log('[Event Parser] Strategy 1: Found', eventElements.length, 'elements with data-eventid');
    if (eventElements.length > 0) {
      console.log('[Event Parser] Sample event element:', eventElements[0]);
      console.log('[Event Parser] Sample event element classes:', eventElements[0].className);
      console.log('[Event Parser] Sample event element attributes:', Array.from(eventElements[0].attributes).map(a => `${a.name}="${a.value}"`));
    }
    eventElements.forEach((element, index) => {
      if (index < 3) { // Log first 3 for debugging
        console.log(`[Event Parser] Parsing element ${index}:`, element);
      }
      const event = this.parseEventElement(element as HTMLElement);
      if (event) {
        events.push(event);
        if (events.length <= 3) { // Log first 3 parsed events
          console.log('[Event Parser] Successfully parsed event:', event);
        }
      }
    });

    // Strategy 2: Look for event buttons in grid cells
    if (events.length === 0) {
      const gridEvents = document.querySelectorAll('[role="gridcell"] [role="button"][aria-label]');
      console.log('[Event Parser] Strategy 2: Found', gridEvents.length, 'grid cell buttons');
      gridEvents.forEach(element => {
        const event = this.parseEventElement(element as HTMLElement);
        if (event) events.push(event);
      });
    }

    // Strategy 3: Look for elements with event-related classes
    if (events.length === 0) {
      const classEvents = document.querySelectorAll('.event-container, .event, [class*="event"]');
      console.log('[Event Parser] Strategy 3: Found', classEvents.length, 'elements with event classes');
      classEvents.forEach(element => {
        const event = this.parseEventElement(element as HTMLElement);
        if (event) events.push(event);
      });
    }

    // Strategy 4: Parse from time slots (for week/day views)
    console.log('[Event Parser] Strategy 4: Parsing from time slots...');
    this.parseFromTimeSlots(events);

    const deduplicated = this.deduplicateEvents(events);
    console.log('[Event Parser] Final result:', deduplicated.length, 'events after deduplication');
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
          const timeElement = searchElement.querySelector('[data-time]') ||
                             searchElement.querySelector('.event-time') ||
                             searchElement.querySelector('[class*="time"]');
          
          const candidate = timeElement?.textContent?.trim() || 
                           searchElement.getAttribute('aria-label') ||
                           searchElement.getAttribute('title') ||
                           searchElement.textContent?.trim() ||
                           '';
          
          if (candidate && (candidate.match(/\d{1,2}:\d{2}/) || candidate.match(/[Сс]\s*\d{1,2}:\d{2}/))) {
            timeText = candidate;
          }
        }
        
        if (!ariaLabel) {
          const candidate = searchElement.getAttribute('aria-label') || '';
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
          const dataTitle = current.getAttribute('data-event-title');
          if (dataTitle) {
            title = dataTitle;
            break;
          }
          
          const titleElement = current.querySelector('[data-event-title]') ||
                              current.querySelector('.event-title');
          if (titleElement) {
            title = titleElement.textContent?.trim() || 
                    titleElement.getAttribute('title') ||
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
        console.log('[Event Parser] Found generic title, extracting real title:', title);
        
        // First, try to extract from timeText/ariaLabel
        const realTitle = this.extractTitleFromText(timeText || ariaLabel);
        if (realTitle && !realTitle.match(/^\d+\s*мероприяти[ея]$/i)) {
          title = realTitle;
          console.log('[Event Parser] Extracted real title from timeText/ariaLabel:', title);
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
                console.log('[Event Parser] Extracted title from text node:', title);
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
                console.log('[Event Parser] Found valid title in text node:', title);
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
                console.log('[Event Parser] Extracted title from parent:', title);
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
        console.log('[Event Parser] Skipping event with generic/invalid title:', title);
        return null;
      }

      console.log('[Event Parser] Parsing event:', title);
      
      console.log('[Event Parser] Time text found:', timeText);

      // Try to extract date from time text first (it often contains date like "26 ноября 2025")
      let date = this.extractDateFromTimeText(timeText);
      if (!date || isNaN(date.getTime())) {
        date = this.extractDate(element);
      }

      // Parse time from text or attributes
      const { startMinutes, endMinutes } = this.parseTime(timeText, element);

      if (startMinutes === null || endMinutes === null) {
        console.log('[Event Parser] Could not parse time for event:', title);
        return null;
      }

      if (endMinutes <= startMinutes) {
        console.log('[Event Parser] Invalid time range:', startMinutes, endMinutes);
        return null;
      }

      const duration = endMinutes - startMinutes;
      
      // Validate date
      if (isNaN(date.getTime()) || date.getFullYear() < 1900 || date.getFullYear() > 2100) {
        console.log('[Event Parser] Invalid date, using today:', date);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        date = today;
      }

      // Extract color from element
      const color = this.extractColor(element);

      console.log('[Event Parser] Event parsed successfully:', { title, startMinutes, endMinutes, duration, date, color });

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
   * Extracts title from text (e.g., "С 12:00 до 12:15, Daily iMe, Никита Шевелев, ...")
   * Also handles formats like "Daily iMe, 12:00" or "Arbeit iMe10:00–13:00"
   */
  private extractTitleFromText(text: string): string | null {
    if (!text) {
      return null;
    }
    
    // If text contains comma, split and process parts
    if (text.includes(',')) {
      const parts = text.split(',');
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
    const withoutTime = text
      .replace(/[Сс]\s*\d{1,2}:\d{2}\s+до\s+\d{1,2}:\d{2}/g, '')
      .replace(/\d{1,2}:\d{2}–\d{1,2}:\d{2}/g, '')
      .replace(/\d{1,2}:\d{2}/g, '')
      .replace(/\d{1,2}\s+(января|февраля|марта|апреля|мая|июня|июля|августа|сентября|октября|ноября|декабря)\s+\d{4}/gi, '')
      .trim();
    
    // Split by common separators and try each part
    const separators = [',', ' ', '•', '·'];
    for (const sep of separators) {
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
    if (candidate.match(/^\d+\s*мероприяти[ея]$/i)) {
      return false;
    }
    
    // Reject time patterns
    if (candidate.match(/^[Сс]\s*\d{1,2}:\d{2}/) ||
        candidate.match(/^\d{1,2}:\d{2}/) ||
        candidate.match(/^\d{1,2}:\d{2}–\d{1,2}:\d{2}/)) {
      return false;
    }
    
    // Reject metadata
    if (candidate.includes('Место') ||
        candidate.includes('цвет') ||
        candidate.match(/\d{1,2}\s+(января|февраля|марта|апреля|мая|июня|июля|августа|сентября|октября|ноября|декабря)\s+\d{4}/i)) {
      return false;
    }
    
    // Reject single characters
    if (candidate === 'С' || 
        candidate === 'с' ||
        candidate.match(/^[А-ЯЁа-яё]$/) ||
        candidate.match(/^[A-Za-z]$/)) {
      return false;
    }
    
    // Reject full names (two words, both capitalized)
    // But allow if it's a known activity name pattern
    if (candidate.match(/^[А-ЯЁ][а-яё]+\s+[А-ЯЁ][а-яё]+$/) ||
        candidate.match(/^[A-Z][a-z]+\s+[A-Z][a-z]+$/)) {
      // Allow if it contains common activity words
      const activityWords = ['Arbeit', 'Frühstück', 'Mittagessen', 'Abendessen', 'Daily', 'Weekly', 'Planning', 'Подъем', 'Поездка', 'Психолог', 'Подолог'];
      const hasActivityWord = activityWords.some(word => candidate.includes(word));
      if (!hasActivityWord) {
        return false;
      }
    }
    
    return true;
  }

  /**
   * Extracts color from event element
   * Google Calendar uses various methods: CSS classes, data attributes, inline styles
   */
  private extractColor(element: HTMLElement): string | undefined {
    let current: HTMLElement | null = element;
    
    while (current) {
      // Method 1: Check for data-color-id or data-color attribute
      const dataColorId = current.getAttribute('data-color-id');
      if (dataColorId) {
        // Google Calendar color IDs map to specific colors
        const color = this.getColorFromId(dataColorId);
        if (color) {
          console.log('[Event Parser] Found color from data-color-id:', color);
          return color;
        }
      }
      
      const dataColor = current.getAttribute('data-color');
      if (dataColor) {
        console.log('[Event Parser] Found color from data-color:', dataColor);
        return dataColor;
      }
      
      // Method 2: Check for event-color-* classes
      const classList = Array.from(current.classList);
      const colorClass = classList.find(cls => cls.startsWith('event-color-') || cls.startsWith('color-'));
      if (colorClass) {
        const colorId = colorClass.replace('event-color-', '').replace('color-', '');
        const color = this.getColorFromId(colorId);
        if (color) {
          console.log('[Event Parser] Found color from class:', colorClass, '->', color);
          return color;
        }
      }
      
      // Method 3: Check computed styles (background-color or border-color)
      const computedStyle = window.getComputedStyle(current);
      const bgColor = computedStyle.backgroundColor;
      const borderColor = computedStyle.borderLeftColor || computedStyle.borderColor;
      
      // Use border color if it's not transparent/default, otherwise use background
      const styleColor = borderColor && borderColor !== 'rgba(0, 0, 0, 0)' && borderColor !== 'transparent' 
        ? borderColor 
        : bgColor;
      
      if (styleColor && 
          styleColor !== 'rgba(0, 0, 0, 0)' && 
          styleColor !== 'transparent' &&
          styleColor !== 'rgb(255, 255, 255)' &&
          styleColor !== '#ffffff' &&
          styleColor !== '#fff') {
        const hexColor = this.rgbToHex(styleColor);
        if (hexColor) {
          console.log('[Event Parser] Found color from computed style:', hexColor);
          return hexColor;
        }
      }
      
      // Method 4: Check inline style attribute
      const inlineStyle = current.getAttribute('style');
      if (inlineStyle) {
        const bgMatch = inlineStyle.match(/background(?:-color)?:\s*([^;]+)/i);
        const borderMatch = inlineStyle.match(/border(?:-left)?(?:-color)?:\s*([^;]+)/i);
        const colorMatch = bgMatch || borderMatch;
        if (colorMatch) {
          const color = colorMatch[1].trim();
          const hexColor = this.rgbToHex(color) || color;
          if (hexColor && hexColor !== '#ffffff' && hexColor !== '#fff') {
            console.log('[Event Parser] Found color from inline style:', hexColor);
            return hexColor;
          }
        }
      }
      
      current = current.parentElement;
    }
    
    return undefined;
  }
  
  /**
   * Converts RGB/RGBA color to hex
   */
  private rgbToHex(color: string): string | null {
    if (!color) return null;
    
    // If already hex, return as is
    if (color.startsWith('#')) {
      return color;
    }
    
    // Parse rgb/rgba
    const rgbMatch = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
    if (rgbMatch) {
      const r = parseInt(rgbMatch[1]);
      const g = parseInt(rgbMatch[2]);
      const b = parseInt(rgbMatch[3]);
      return `#${[r, g, b].map(x => {
        const hex = x.toString(16);
        return hex.length === 1 ? '0' + hex : hex;
      }).join('')}`;
    }
    
    return null;
  }
  
  /**
   * Maps Google Calendar color IDs to hex colors
   * These are the default Google Calendar colors
   */
  private getColorFromId(colorId: string): string | null {
    const colorMap: { [key: string]: string } = {
      '1': '#a4bdfc', // Lavender
      '2': '#7ae7bf', // Sage
      '3': '#dbadff', // Grape
      '4': '#ff887c', // Flamingo
      '5': '#fbd75b', // Banana
      '6': '#ffb878', // Tangerine
      '7': '#46d6db', // Peacock
      '8': '#e1e1e1', // Graphite
      '9': '#5484ed', // Blueberry
      '10': '#51b749', // Basil
      '11': '#dc2127', // Tomato
    };
    
    return colorMap[colorId] || null;
  }

  /**
   * Extracts date from time text (e.g., "С 12:00 до 12:15, Daily iMe, ..., 26 ноября 2025")
   */
  private extractDateFromTimeText(timeText: string): Date | null {
    if (!timeText) return null;
    
    // Try to find Russian date pattern: "26 ноября 2025"
    const russianDateMatch = timeText.match(/(\d{1,2})\s+(января|февраля|марта|апреля|мая|июня|июля|августа|сентября|октября|ноября|декабря)\s+(\d{4})/i);
    if (russianDateMatch) {
      const day = parseInt(russianDateMatch[1]);
      const monthNames = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 
                         'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
      const month = monthNames.findIndex(m => m.toLowerCase() === russianDateMatch[2].toLowerCase());
      const year = parseInt(russianDateMatch[3]);
      if (month >= 0 && day > 0 && day <= 31 && year > 1900 && year < 2100) {
        const date = new Date(year, month, day);
        date.setHours(0, 0, 0, 0);
        if (!isNaN(date.getTime())) {
          console.log('[Event Parser] Extracted date from time text:', date);
          return date;
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
      const dataDate = current.getAttribute('data-date');
      if (dataDate) {
        // Try parsing as ISO string or YYYY-MM-DD
        let date = new Date(dataDate);
        if (isNaN(date.getTime()) && dataDate.match(/^\d{4}-\d{2}-\d{2}/)) {
          const parts = dataDate.split('-');
          date = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
        }
        if (!isNaN(date.getTime()) && date.getFullYear() > 1900 && date.getFullYear() < 2100) {
          date.setHours(0, 0, 0, 0);
          console.log('[Event Parser] Extracted date from data-date:', date);
          return date;
        }
      }
      
      // Try other attributes
      const dateAttr = current.getAttribute('data-day') ||
                      current.getAttribute('data-start-time') ||
                      current.getAttribute('aria-label');
      
      if (dateAttr) {
        const parsed = this.parseDateString(dateAttr);
        if (parsed && !isNaN(parsed.getTime())) {
          parsed.setHours(0, 0, 0, 0);
          console.log('[Event Parser] Extracted date:', parsed);
          return parsed;
        }
      }

      current = current.parentElement;
    }
    
    // Try to find date from week view column headers
    // Look for the column header that contains this event
    const weekColumns = document.querySelectorAll('[role="columnheader"][data-date]');
    if (weekColumns.length > 0) {
      // Find which column the event is in by checking position
      const eventRect = element.getBoundingClientRect();
      for (const col of Array.from(weekColumns)) {
        const colRect = col.getBoundingClientRect();
        // Check if event is in this column (horizontally)
        if (eventRect.left >= colRect.left && eventRect.left <= colRect.right) {
          const dateStr = col.getAttribute('data-date');
          if (dateStr) {
            let date = new Date(dateStr);
            if (isNaN(date.getTime()) && dateStr.match(/^\d{4}-\d{2}-\d{2}/)) {
              const parts = dateStr.split('-');
              date = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
            }
            if (!isNaN(date.getTime()) && date.getFullYear() > 1900 && date.getFullYear() < 2100) {
              date.setHours(0, 0, 0, 0);
              console.log('[Event Parser] Extracted date from column header:', date);
              return date;
            }
          }
        }
      }
    }

    // Try to get date from URL or current page context
    const urlParams = new URLSearchParams(window.location.search);
    const dateParam = urlParams.get('date');
    if (dateParam) {
      try {
        const date = new Date(dateParam);
        if (!isNaN(date.getTime())) {
          console.log('[Event Parser] Extracted date from URL:', date);
          return date;
        }
      } catch (e) {
        console.log('[Event Parser] Could not parse date from URL:', dateParam);
      }
    }

    // Fallback to today
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    console.log('[Event Parser] Using today as fallback:', today);
    return today;
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
      const date = new Date(dateStr);
      if (!isNaN(date.getTime()) && date.getFullYear() > 1900 && date.getFullYear() < 2100) {
        return date;
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

      // Try parsing Russian date format like "30 ноября 2025"
      const russianDateMatch = dateStr.match(/(\d{1,2})\s+(января|февраля|марта|апреля|мая|июня|июля|августа|сентября|октября|ноября|декабря)\s+(\d{4})/i);
      if (russianDateMatch) {
        const day = parseInt(russianDateMatch[1]);
        const monthNames = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 
                           'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
        const month = monthNames.findIndex(m => m.toLowerCase() === russianDateMatch[2].toLowerCase());
        const year = parseInt(russianDateMatch[3]);
        if (month >= 0 && day > 0 && day <= 31 && year > 1900 && year < 2100) {
          const date = new Date(year, month, day);
          if (!isNaN(date.getTime())) {
            return date;
          }
        }
      }

      return null;
    } catch (error) {
      console.log('[Event Parser] Error parsing date string:', dateStr, error);
      return null;
    }
  }

  /**
   * Parses time from text or element attributes
   * Supports formats: "9:30 AM - 10:00 AM", "09:30-10:00", "С 13:00 до 13:30" (Russian)
   */
  private parseTime(timeText: string, element: HTMLElement): { startMinutes: number | null; endMinutes: number | null } {
    console.log('[Event Parser] Parsing time from text:', timeText);
    
    // Try to get from data attributes first
    const startTime = element.getAttribute('data-start-time');
    const endTime = element.getAttribute('data-end-time');

    if (startTime && endTime) {
      console.log('[Event Parser] Found time in data attributes:', startTime, endTime);
      return {
        startMinutes: this.timeToMinutes(startTime),
        endMinutes: this.timeToMinutes(endTime)
      };
    }

    // Parse Russian format: "С 13:00 до 13:30" or "с 13:00 до 13:30"
    const russianMatch = timeText.match(/[Сс]\s*(\d{1,2}):(\d{2})\s+до\s+(\d{1,2}):(\d{2})/i);
    if (russianMatch) {
      console.log('[Event Parser] Found Russian time format');
      const startHour = parseInt(russianMatch[1]);
      const startMin = parseInt(russianMatch[2]);
      const endHour = parseInt(russianMatch[3]);
      const endMin = parseInt(russianMatch[4]);

      const startMinutes = startHour * 60 + startMin;
      const endMinutes = endHour * 60 + endMin;
      console.log('[Event Parser] Parsed time:', startMinutes, endMinutes);
      return { startMinutes, endMinutes };
    }

    // Parse from text like "9:30 AM - 10:00 AM" or "09:30-10:00"
    const timeMatch = timeText.match(/(\d{1,2}):(\d{2})\s*(AM|PM)?.*?(\d{1,2}):(\d{2})\s*(AM|PM)?/i);
    if (timeMatch) {
      console.log('[Event Parser] Found English time format');
      const startHour = parseInt(timeMatch[1]);
      const startMin = parseInt(timeMatch[2]);
      const startAmPm = timeMatch[3]?.toUpperCase();
      const endHour = parseInt(timeMatch[4]);
      const endMin = parseInt(timeMatch[5]);
      const endAmPm = timeMatch[6]?.toUpperCase();

      const startMinutes = this.convertTo24Hour(startHour, startMin, startAmPm);
      const endMinutes = this.convertTo24Hour(endHour, endMin, endAmPm);
      console.log('[Event Parser] Parsed time:', startMinutes, endMinutes);
      return { startMinutes, endMinutes };
    }

    // Try to parse from aria-label or title (any format with two times)
    const ariaLabel = element.getAttribute('aria-label') || '';
    const ariaMatch = ariaLabel.match(/(\d{1,2}):(\d{2}).*?(\d{1,2}):(\d{2})/);
    if (ariaMatch) {
      console.log('[Event Parser] Found time in aria-label');
      const startHour = parseInt(ariaMatch[1]);
      const startMin = parseInt(ariaMatch[2]);
      const endHour = parseInt(ariaMatch[3]);
      const endMin = parseInt(ariaMatch[4]);

      const startMinutes = startHour * 60 + startMin;
      const endMinutes = endHour * 60 + endMin;
      console.log('[Event Parser] Parsed time from aria-label:', startMinutes, endMinutes);
      return {
        startMinutes,
        endMinutes
      };
    }

    console.log('[Event Parser] Could not parse time from:', timeText);
    return { startMinutes: null, endMinutes: null };
  }

  /**
   * Converts time string to minutes since midnight
   */
  private timeToMinutes(timeStr: string): number | null {
    const match = timeStr.match(/(\d{1,2}):(\d{2})/);
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
    return h24 * 60 + minute;
  }

  /**
   * Parses events from time slot elements
   */
  private parseFromTimeSlots(events: CalendarEvent[]): void {
    // Google Calendar has time slots in the grid
    const timeSlots = document.querySelectorAll('[data-hour]');
    timeSlots.forEach(slot => {
      const hour = parseInt(slot.getAttribute('data-hour') || '0');
      const eventsInSlot = slot.querySelectorAll('[role="button"]');
      
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
          // Validate date before using toDateString
          if (!event.date || isNaN(event.date.getTime())) {
            console.warn('[Event Parser] Skipping event with invalid date in deduplication:', event);
            return false;
          }
          const key = `${event.title}-${event.date.toDateString()}-${event.startMinutes}`;
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

