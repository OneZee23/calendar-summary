/**
 * UI and retry mechanism constants
 */

export const RETRY_CONSTANTS = {
  MAX_RETRIES: 5 as number,
  INITIAL_DELAY_MS: 300 as number,
  MAX_DELAY_MS: 2000 as number,
  DELAY_MULTIPLIER: 1.5 as number,
};

export const UI_CONSTANTS = {
  CSS_CLASSES: {
    NO_ACTIVITIES: 'no-activities',
    ACTIVITY_ITEM: 'activity-item',
    ACTIVITY_HEADER: 'activity-header',
    ACTIVITY_NAME: 'activity-name',
    ACTIVITY_DURATION: 'activity-duration',
    ACTIVITY_COUNT: 'activity-count',
    TOTAL_SECTION: 'total-section',
    TOTAL_LABEL: 'total-label',
    TOTAL_DURATION: 'total-duration',
  },
  DEFAULT_BORDER_COLOR: '#e1e1e1',
} as const;

