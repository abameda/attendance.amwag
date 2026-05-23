import type { AttendanceRecord } from '@/types';
import {
  formatDate,
  formatEarlyDeparture,
  formatLateness,
  formatOvertime,
  formatTimestamp,
} from '@/lib/utils';

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

function formatShift(record: AttendanceRecord): string {
  const start = record.profiles?.shift_start;
  const end = record.profiles?.shift_end;
  return start && end ? `${start} - ${end}` : '-';
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

function formatGeneratedAt(now: Date): string {
  return now.toLocaleString('en-US', {
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
): AttendanceReportData {
  const now = new Date();

  const meta: AttendanceReportMeta = {
    generatedBy,
    generatedAt: formatGeneratedAt(now),
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
      date: formatDate(record.date),
      shift: formatShift(record),
      checkIn: formatTimestamp(record.check_in_time),
      checkOut: formatTimestamp(record.check_out_time),
      late: formatLateness(record.late_minutes),
      earlyLeave: formatEarlyDeparture(record.early_departure_minutes),
      overtime: formatOvertime(record.overtime_minutes),
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

export function buildPdfFilename(filters: AttendanceReportFilters): string {
  const dateLabel =
    filters.dateFilter ??
    (filters.dateRangeLabel ? filters.dateRangeLabel.replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_-]/g, '') : null) ??
    new Date().toISOString().slice(0, 10);
  return `Amwag_Attendance_Report_${dateLabel}.pdf`;
}
