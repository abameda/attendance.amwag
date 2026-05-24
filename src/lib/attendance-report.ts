import type { AttendanceRecord } from '@/types';
import { formatShiftTimeRange } from '@/lib/utils';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AttendanceReportRow {
  index: number;
  employeeName: string;
  branch: string;
  date: string;         // formatted display date
  shift: string;        // "HH:MM - HH:MM" or "-"
  checkIn: string;      // formatted time or "-"
  checkOut: string;     // formatted time or "-"
  late: string;         // formatted duration or "-"
  earlyLeave: string;   // formatted duration or "-"
  overtime: string;     // formatted duration or "-"
  status: AttendanceRecord['status'];
  location: string;
}

export interface AttendanceReportSummary {
  totalRecords: number;
  present: number;
  absent: number;
  late: number;
  earlyLeave: number;
  missingCheckout: number;
  overtime: number;
  pending: number;
}

export interface AttendanceReportFilters {
  employeeName?: string;
  branchName?: string;
  dateRangeLabel?: string;   // used by Attendance Logs page
  dateFilter?: string;       // used by dashboard (single date)
  status?: string;
  search?: string;
}

export type AttendanceReportLocale = 'en' | 'ar';

export interface AttendanceReportMeta {
  generatedBy: string;
  generatedAt: string;       // formatted date-time string
  reportId: string;
}

export interface AttendanceReportNotes {
  pendingCount: number;
  missingCheckoutCount: number;
  lateCount: number;
  earlyLeaveCount: number;
}

export interface AttendanceReportData {
  filters: AttendanceReportFilters;
  meta: AttendanceReportMeta;
  summary: AttendanceReportSummary;
  rows: AttendanceReportRow[];
  notes: AttendanceReportNotes;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

export function hasArabic(text: string): boolean {
  return /[؀-ۿݐ-ݿࢠ-ࣿﭐ-﷿ﹰ-﻿]/.test(text);
}

export function normalizeAttendanceReportLocale(locale: unknown): AttendanceReportLocale {
  return locale === 'ar' ? 'ar' : 'en';
}

function formatLocation(record: AttendanceRecord): string {
  const checkIn = record.check_in_location ?? '-';
  const checkOut = record.check_out_location ?? '-';
  return checkIn === checkOut ? checkIn : `${checkIn} / ${checkOut}`;
}

function buildReportId(): string {
  const now = new Date();
  const pad = (n: number, len = 2) => String(n).padStart(len, '0');
  const y = now.getFullYear();
  const mo = pad(now.getMonth() + 1);
  const d = pad(now.getDate());
  const h = pad(now.getHours());
  const mi = pad(now.getMinutes());
  const s = pad(now.getSeconds());
  return `AMW-${y}${mo}${d}-${h}${mi}${s}`;
}

function localeCode(locale: AttendanceReportLocale): string {
  return locale === 'ar' ? 'ar-EG' : 'en-US';
}

function formatReportDate(dateString: string, locale: AttendanceReportLocale): string {
  const date = new Date(dateString);
  return date.toLocaleDateString(localeCode(locale), {
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function formatReportTimestamp(timestamp: string | null, locale: AttendanceReportLocale): string {
  if (!timestamp) return '-';

  const date = new Date(timestamp);
  return date.toLocaleTimeString(localeCode(locale), {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
}

function formatReportDuration(minutes: number, locale: AttendanceReportLocale, suffix?: string): string {
  if (minutes <= 0) return '-';

  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;

  if (locale === 'ar') {
    const parts = [];
    if (hours > 0) parts.push(`${hours}س`);
    if (mins > 0) parts.push(`${mins}د`);
    const duration = parts.length > 0 ? parts.join(' ') : '0د';
    return suffix ? `${duration} ${suffix}` : duration;
  }

  if (hours > 0) {
    return `${hours}h ${mins}m${suffix ? ` ${suffix}` : ''}`;
  }
  return `${mins}m${suffix ? ` ${suffix}` : ''}`;
}

function formatGeneratedAt(now: Date, locale: AttendanceReportLocale): string {
  return now.toLocaleString(localeCode(locale), {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
}

// ─── Core builder ────────────────────────────────────────────────────────────

export function buildAttendanceReportData(
  records: AttendanceRecord[],
  filters: AttendanceReportFilters,
  generatedBy: string,
  locale: AttendanceReportLocale = 'en',
): AttendanceReportData {
  const now = new Date();

  const meta: AttendanceReportMeta = {
    generatedBy,
    generatedAt: formatGeneratedAt(now, locale),
    reportId: buildReportId(),
  };

  const summary: AttendanceReportSummary = {
    totalRecords: 0,
    present: 0,
    absent: 0,
    late: 0,
    earlyLeave: 0,
    missingCheckout: 0,
    overtime: 0,
    pending: 0,
  };

  let index = 1;
  const rows: AttendanceReportRow[] = [];

  for (const record of records) {
    summary.totalRecords += 1;

    if (record.status === 'present') summary.present += 1;
    else if (record.status === 'absent') summary.absent += 1;
    else if (record.status === 'late') summary.late += 1;
    else if (record.status === 'missing_checkout') summary.missingCheckout += 1;
    else if (record.status === 'pending') summary.pending += 1;

    if (record.early_departure_minutes > 0) summary.earlyLeave += 1;
    if (record.overtime_minutes > 0) summary.overtime += 1;

    rows.push({
      index: index++,
      employeeName: record.profiles?.full_name ?? '-',
      branch: record.profiles?.branch ?? '-',
      date: formatReportDate(record.date, locale),
      shift: formatShiftTimeRange(record.profiles?.shift_start ?? null, record.profiles?.shift_end ?? null, locale),
      checkIn: formatReportTimestamp(record.check_in_time, locale),
      checkOut: formatReportTimestamp(record.check_out_time, locale),
      late: formatReportDuration(record.late_minutes, locale),
      earlyLeave: formatReportDuration(
        record.early_departure_minutes,
        locale,
        locale === 'ar' ? 'مبكر' : 'early',
      ),
      overtime: formatReportDuration(record.overtime_minutes, locale),
      status: record.status,
      location: formatLocation(record),
    });
  }

  const notes: AttendanceReportNotes = {
    pendingCount: summary.pending,
    missingCheckoutCount: summary.missingCheckout,
    lateCount: summary.late,
    earlyLeaveCount: summary.earlyLeave,
  };

  return { filters, meta, summary, rows, notes };
}

// ─── Filename helper ─────────────────────────────────────────────────────────

function sanitizeFilenameLabel(label: string): string {
  const sanitized = label
    .replace(/\s+/g, '_')
    .replace(/[^a-zA-Z0-9_-]/g, '')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '');

  return sanitized || 'all-history';
}

export function buildPdfFilename(
  filters: AttendanceReportFilters,
  locale: AttendanceReportLocale = 'en',
): string {
  const dateLabel =
    filters.dateFilter ??
    (filters.dateRangeLabel ? sanitizeFilenameLabel(filters.dateRangeLabel) : null) ??
    new Date().toISOString().slice(0, 10);
  const localeSuffix = locale === 'ar' ? '_AR' : '';
  return `Amwag_Attendance_Report${localeSuffix}_${dateLabel}.pdf`;
}
