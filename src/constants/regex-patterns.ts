/**
 * Regular expression patterns for parsing dates, times, and text
 */

export const REGEX_PATTERNS = {
  // Time patterns
  TIME_FORMAT: /(\d{1,2}):(\d{2})/,
  RUSSIAN_TIME_FORMAT: /[Сс]\s*(\d{1,2}):(\d{2})\s+до\s+(\d{1,2}):(\d{2})/i,
  TIME_WITH_AMPM: /(\d{1,2}):(\d{2})\s*(AM|PM)?.*?(\d{1,2}):(\d{2})\s*(AM|PM)?/i,
  
  // Date patterns
  ISO_DATE: /^\d{4}-\d{2}-\d{2}/,
  RUSSIAN_DATE: /(\d{1,2})\s+(января|февраля|марта|апреля|мая|июня|июля|августа|сентября|октября|ноября|декабря)\s+(\d{4})/i,
  URL_DATE_PATH: /\/(week|day|month)\/(\d{4})\/(\d{1,2})\/(\d{1,2})/,
  
  // Text patterns
  TIME_IN_TEXT: /\d{1,2}:\d{2}/,
  RUSSIAN_TIME_IN_TEXT: /[Сс]\s*\d{1,2}:\d{2}/,
  GENERIC_TITLE_PATTERN: /^\d+\s+(мероприятий?|events?|событий?)/i,
  SINGLE_CHARACTER: /^.$/,
  RUSSIAN_FULL_NAME: /^[А-ЯЁ][а-яё]+\s+[А-ЯЁ][а-яё]+$/,
  ENGLISH_FULL_NAME: /^[A-Z][a-z]+\s+[A-Z][a-z]+$/,
} as const;

export const TEXT_SEPARATORS = [',', ';', '|', '–', '-', '—'] as const;

