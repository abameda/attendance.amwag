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

export function getEgyptMonth(date: Date = new Date()): string {
  return getEgyptDate(date).slice(0, 7);
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
    hourCycle: 'h23',
  }).formatToParts(date);

  const rawHours = parseInt(parts.find((p) => p.type === 'hour')?.value ?? '0', 10);
  const hours = rawHours === 24 ? 0 : rawHours;
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

export function getEgyptDayName(date: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: TIMEZONE,
    weekday: 'long',
  })
    .format(date)
    .toLowerCase();
}

export function isValidISODateString(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

export function isValidISOMonthString(value: string): boolean {
  return /^\d{4}-\d{2}$/.test(value);
}

export function getEgyptDayNameFromISODate(date: string): string {
  const normalizedDate = new Date(`${date}T12:00:00Z`);
  return getEgyptDayName(normalizedDate);
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
