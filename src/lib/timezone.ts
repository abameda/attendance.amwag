/**
 * Egypt timezone utilities.
 * Always use Africa/Cairo — it observes DST correctly.
 * Never use toLocaleString (inconsistent across environments).
 * Never hardcode UTC+2 (Africa/Cairo observes DST).
 */

export const TIMEZONE = 'Africa/Cairo' as const;

/**
 * Returns the current date in Egypt as 'YYYY-MM-DD'.
 * Uses 'en-CA' locale because it produces ISO-8601 date format.
 */
export function getEgyptDate(date: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: TIMEZONE }).format(date);
}

/**
 * Returns hours, minutes, and totalMinutes for a given date in Egypt time.
 */
export function getEgyptTime(date: Date = new Date()): {
  hours: number;
  minutes: number;
  totalMinutes: number;
} {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: TIMEZONE,
    hour: 'numeric',
    minute: 'numeric',
    hour12: false,
  }).formatToParts(date);

  const hours = parseInt(parts.find((p) => p.type === 'hour')?.value ?? '0', 10);
  const minutes = parseInt(parts.find((p) => p.type === 'minute')?.value ?? '0', 10);

  return { hours, minutes, totalMinutes: hours * 60 + minutes };
}

/**
 * Returns both the Egypt date string and time components for the current moment.
 */
export function getEgyptNow(): {
  date: string;
  hours: number;
  minutes: number;
  totalMinutes: number;
} {
  const now = new Date();
  return {
    date: getEgyptDate(now),
    ...getEgyptTime(now),
  };
}

/**
 * Checks whether `currentMinutes` falls within [windowStart, windowEnd).
 * Handles overnight windows (e.g. 22:00–06:00) where windowEnd < windowStart.
 */
export function isWithinTimeWindow(
  currentMinutes: number,
  windowStart: number,
  windowEnd: number,
): boolean {
  if (windowEnd >= windowStart) {
    // Same-day window
    return currentMinutes >= windowStart && currentMinutes < windowEnd;
  } else {
    // Overnight window: e.g. 22*60 to 6*60
    return currentMinutes >= windowStart || currentMinutes < windowEnd;
  }
}
