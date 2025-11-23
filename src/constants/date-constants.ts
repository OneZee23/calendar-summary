/**
 * Date-related constants
 */

export const DATE_CONSTANTS = {
  MIN_YEAR: 1900,
  MAX_YEAR: 2100,
  MAX_DAY_IN_MONTH: 31,
  DAYS_IN_WEEK: 7,
  SUNDAY_INDEX: 0,
  MONDAY_INDEX: 1,
  HOURS_IN_DAY: 24,
  MINUTES_IN_HOUR: 60,
  END_OF_DAY_HOURS: 23,
  END_OF_DAY_MINUTES: 59,
  END_OF_DAY_SECONDS: 59,
  END_OF_DAY_MILLISECONDS: 999,
  MIDNIGHT_HOURS: 0,
  MIDNIGHT_MINUTES: 0,
  MIDNIGHT_SECONDS: 0,
  MIDNIGHT_MILLISECONDS: 0,
} as const;

/**
 * Russian month names for date parsing
 */
export const RUSSIAN_MONTHS = [
  'января',
  'февраля',
  'марта',
  'апреля',
  'мая',
  'июня',
  'июля',
  'августа',
  'сентября',
  'октября',
  'ноября',
  'декабря',
] as const;

