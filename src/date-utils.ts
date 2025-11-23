/**
 * Utility functions for date validation and manipulation
 */

/**
 * Validates if a date is valid and within reasonable range
 */
export function isValidDate(date: Date | null | undefined): boolean {
  if (!date) return false;
  if (!(date instanceof Date)) return false;
  if (isNaN(date.getTime())) return false;
  const year = date.getFullYear();
  return year >= 1900 && year <= 2100;
}

/**
 * Normalizes a date by setting time to midnight
 */
export function normalizeDate(date: Date): Date {
  const normalized = new Date(date);
  normalized.setHours(0, 0, 0, 0);
  return normalized;
}

/**
 * Creates a normalized date from various inputs
 */
export function createNormalizedDate(input: Date | string | number): Date | null {
  try {
    const date = input instanceof Date ? input : new Date(input);
    if (!isValidDate(date)) return null;
    return normalizeDate(date);
  } catch {
    return null;
  }
}

