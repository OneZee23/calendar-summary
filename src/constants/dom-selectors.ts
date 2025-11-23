/**
 * DOM selectors and attributes used for parsing Google Calendar
 */

export const DOM_SELECTORS = {
  // Event selectors
  EVENT_BY_ID: '[data-eventid]',
  GRID_EVENTS: '[role="gridcell"] [role="button"][aria-label]',
  EVENT_CONTAINERS: '.event-container, .event, [class*="event"]',
  
  // Time-related selectors
  TIME_ELEMENT: '[data-time]',
  EVENT_TIME_CLASS: '.event-time',
  TIME_CLASS_PATTERN: '[class*="time"]',
  
  // Title selectors
  EVENT_TITLE_ATTR: '[data-event-title]',
  EVENT_TITLE_CLASS: '.event-title',
  
  // Date selectors
  DATE_ATTRIBUTE: '[data-date]',
  WEEK_COLUMNS: '[role="columnheader"][data-date]',
  TIME_SLOTS: '[data-hour]',
  EVENTS_IN_SLOT: '[role="button"]',
  
  // View type selectors
  WEEK_VIEW: '[data-viewtype="week"]',
  DAY_VIEW: '[data-viewtype="day"]',
  MONTH_VIEW: '[data-viewtype="month"]',
} as const;

export const DOM_ATTRIBUTES = {
  // Data attributes
  DATA_EVENT_ID: 'data-eventid',
  DATA_TIME: 'data-time',
  DATA_EVENT_TITLE: 'data-event-title',
  DATA_DATE: 'data-date',
  DATA_DAY: 'data-day',
  DATA_START_TIME: 'data-start-time',
  DATA_END_TIME: 'data-end-time',
  DATA_HOUR: 'data-hour',
  DATA_COLOR_ID: 'data-color-id',
  DATA_COLOR: 'data-color',
  DATA_VIEW_TYPE: 'data-viewtype',
  
  // ARIA attributes
  ARIA_LABEL: 'aria-label',
  
  // Standard attributes
  TITLE: 'title',
  STYLE: 'style',
  ROLE: 'role',
  
  // Role values
  ROLE_GRIDCELL: 'gridcell',
  ROLE_BUTTON: 'button',
  ROLE_COLUMNHEADER: 'columnheader',
} as const;

export const CSS_CLASSES = {
  EVENT_CONTAINER: 'event-container',
  EVENT: 'event',
  EVENT_TIME: 'event-time',
  EVENT_TITLE: 'event-title',
  EVENT_COLOR_PREFIX: 'event-color-',
  COLOR_PREFIX: 'color-',
} as const;

