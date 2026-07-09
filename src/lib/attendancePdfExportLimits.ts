import type { AttendanceReportFilters } from '@/lib/attendance-report';
import type { AttendanceRecord } from '@/types';

export const ATTENDANCE_PDF_MAX_ROWS = 2000;
export const ATTENDANCE_PDF_MAX_RANGE_DAYS = 31;
export const ATTENDANCE_PDF_CAP_ERROR =
  'Please narrow your date range or filter by employee';

const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const DAY_MS = 24 * 60 * 60 * 1000;

type DateRange = {
  start: number;
  end: number;
};

export type AttendancePdfExportCapResult =
  | { allowed: true }
  | { allowed: false; status: number; error: string };

function parseIsoDate(value: string | undefined): number | null {
  if (!value || !ISO_DATE_PATTERN.test(value)) {
    return null;
  }

  const [year, month, day] = value.split('-').map(Number);
  const timestamp = Date.UTC(year, month - 1, day);
  const parsed = new Date(timestamp);

  if (
    parsed.getUTCFullYear() !== year ||
    parsed.getUTCMonth() !== month - 1 ||
    parsed.getUTCDate() !== day
  ) {
    return null;
  }

  return timestamp;
}

function normalizeRange(start: number, end: number): DateRange {
  return start <= end ? { start, end } : { start: end, end: start };
}

function inclusiveDays(range: DateRange): number {
  return Math.floor((range.end - range.start) / DAY_MS) + 1;
}

function rangeFromFilters(filters: AttendanceReportFilters): DateRange | null {
  const singleDate = parseIsoDate(filters.dateFilter);
  if (singleDate !== null) {
    return { start: singleDate, end: singleDate };
  }

  const dates = filters.dateRangeLabel?.match(/\d{4}-\d{2}-\d{2}/g) ?? [];
  if (dates.length >= 2) {
    const start = parseIsoDate(dates[0]);
    const end = parseIsoDate(dates[1]);
    if (start !== null && end !== null) {
      return normalizeRange(start, end);
    }
  }

  return null;
}

function rangeFromRecords(records: AttendanceRecord[]): DateRange | null {
  let start: number | null = null;
  let end: number | null = null;

  for (const record of records) {
    const date = parseIsoDate(record.date);
    if (date === null) {
      continue;
    }

    start = start === null ? date : Math.min(start, date);
    end = end === null ? date : Math.max(end, date);
  }

  return start === null || end === null ? null : { start, end };
}

function isSingleEmployeeExport(
  records: AttendanceRecord[],
  filters: AttendanceReportFilters,
): boolean {
  if (filters.employeeName?.trim()) {
    return true;
  }

  const employeeIds = new Set(records.map((record) => record.user_id).filter(Boolean));
  return employeeIds.size === 1;
}

export function validateAttendancePdfExportCaps(
  records: AttendanceRecord[],
  filters: AttendanceReportFilters,
): AttendancePdfExportCapResult {
  if (isSingleEmployeeExport(records, filters)) {
    return { allowed: true };
  }

  if (records.length > ATTENDANCE_PDF_MAX_ROWS) {
    return { allowed: false, status: 413, error: ATTENDANCE_PDF_CAP_ERROR };
  }

  const ranges = [rangeFromFilters(filters), rangeFromRecords(records)].filter(
    (range): range is DateRange => Boolean(range),
  );
  const exceedsDateRange = ranges.some(
    (range) => inclusiveDays(range) > ATTENDANCE_PDF_MAX_RANGE_DAYS,
  );

  if (exceedsDateRange) {
    return { allowed: false, status: 413, error: ATTENDANCE_PDF_CAP_ERROR };
  }

  return { allowed: true };
}
