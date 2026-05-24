import {
  Document,
  Font,
  Image,
  Page,
  StyleSheet,
  Text,
  View,
} from '@react-pdf/renderer';
import React from 'react';

import type { AttendanceReportData, AttendanceReportRow } from '@/lib/attendance-report';
import { hasArabic } from '@/lib/attendance-report';

// Font registration is performed by the API route before calling renderToBuffer.
// Disable hyphenation here so it applies whenever fonts are registered.
Font.registerHyphenationCallback((word) => [word]);

// ─── Brand tokens ─────────────────────────────────────────────────────────────

const BRAND = {
  blue: '#34AAE1',
  gold: '#F8B548',
  navy: '#123047',
  graphite: '#2F3A45',
  lightBlue: '#EAF7FD',
  lightGold: '#FFF4DF',
  border: '#E5E7EB',
  white: '#FFFFFF',
  pageBg: '#F8FAFC',
  rowAlt: '#F4F8FB',
  green: '#16A34A',
  red: '#DC2626',
  amber: '#D97706',
  orange: '#EA580C',
  gray: '#6B7280',
};

// ─── Layout constants ─────────────────────────────────────────────────────────

// A4 landscape: 841.89 × 595.28 pt
const PAGE_PAD_H = 30;   // left + right
const PAGE_PAD_V_BOTTOM = 32;
const FOOTER_H = 22;
const TABLE_PAGE_BANNER_H = 34;  // compact repeating header on every page
const TABLE_HEADER_H = 22;       // column header row

// Manual page chunks keep employee rows intact and repeat the table header.
const FIRST_PAGE_ROW_LIMIT = 20;
const CONTINUATION_PAGE_ROW_LIMIT = 25;

// Column widths (pt) — total ≈ 782 (= 841.89 - 60 padding)
const COL = {
  index:      18,
  employee:  128,
  branch:     83,
  date:       65,
  shift:      65,
  checkIn:    48,
  checkOut:   48,
  late:       38,
  earlyLeave: 42,
  overtime:   38,
  status:     74,
  location:  135,
} as const;

const FONT_SM = 6.5;
const FONT_BASE = 7.5;
const REPORT_TITLE = 'Amwag Travel — Attendance Daily Report';

// ─── Grid / row shading (Excel-style) ────────────────────────────────────────

const GRID = '#D4DEE7';          // cell divider lines
const ROW_BG_A = '#F4F8FB';      // odd rows (soft blue/gray)
const ROW_BG_B = BRAND.white;    // even rows

function rowBg(rowIndex: number): string {
  return rowIndex % 2 === 0 ? ROW_BG_A : ROW_BG_B;
}

function bodyCell(rowIndex: number, i: number, width: number) {
  return {
    width,
    backgroundColor: rowBg(rowIndex),
    paddingHorizontal: 3,
    paddingVertical: 3,
    borderRightWidth: 0.5,
    borderRightColor: GRID,
    borderLeftWidth: i === 0 ? 0.5 : 0,
    borderLeftColor: GRID,
  };
}

function headerCell(i: number, width: number) {
  return {
    width,
    paddingHorizontal: 3,
    justifyContent: 'center' as const,
    borderRightWidth: 0.5,
    borderRightColor: GRID,
    borderLeftWidth: i === 0 ? 0.5 : 0,
    borderLeftColor: GRID,
  };
}

// ─── StyleSheet ──────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  // ── Report pages ─────────────────────────────
  reportPage: {
    backgroundColor: BRAND.white,
    paddingTop: TABLE_PAGE_BANNER_H + 8,
    paddingBottom: PAGE_PAD_V_BOTTOM + FOOTER_H,
    paddingHorizontal: PAGE_PAD_H,
    fontFamily: 'Helvetica',
    fontSize: FONT_BASE,
    color: BRAND.graphite,
  },

  // ── Report metadata (first page) ─────────────
  reportMetaSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 6,
    marginBottom: 6,
    borderBottomWidth: 0.5,
    borderBottomColor: BRAND.border,
  },
  metaBlock: {
    flex: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 2,
  },
  metaLine: {
    fontSize: FONT_SM,
    color: BRAND.graphite,
    marginRight: 12,
  },
  metaLabel: {
    fontFamily: 'Helvetica-Bold',
    color: BRAND.navy,
  },
  metaValueArabic: {
    fontFamily: 'Amiri',
    fontSize: FONT_BASE,
  },

  // ── KPI cards ────────────────────────────────
  kpiSection: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 8,
  },
  kpiCard: {
    flex: 1,
    backgroundColor: BRAND.white,
    borderRadius: 4,
    border: `1 solid ${BRAND.border}`,
    padding: 6,
  },
  kpiAccentLine: {
    height: 2,
    borderRadius: 1,
    width: 20,
    marginBottom: 5,
  },
  kpiLabel: {
    fontSize: 5.5,
    fontFamily: 'Helvetica-Bold',
    color: BRAND.gray,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  kpiValue: {
    fontSize: 13,
    fontFamily: 'Helvetica-Bold',
    marginTop: 3,
  },

  // ── Compact repeating banner (table pages) ───
  tableBanner: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: TABLE_PAGE_BANNER_H,
    backgroundColor: BRAND.navy,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: PAGE_PAD_H,
  },
  tableBannerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  tableBannerLogo: {
    width: 20,
    height: 20,
    objectFit: 'contain',
  },
  tableBannerTitle: {
    fontSize: 8,
    fontFamily: 'Helvetica-Bold',
    color: BRAND.white,
    letterSpacing: 0.3,
  },
  // ── Table header ─────────────────────────────
  tableHeaderRow: {
    height: TABLE_HEADER_H,
    flexDirection: 'row',
    alignItems: 'stretch',
    backgroundColor: BRAND.navy,
    borderBottomWidth: 2,
    borderBottomColor: BRAND.gold,
  },
  thCell: {
    fontSize: 5.5,
    fontFamily: 'Helvetica-Bold',
    color: BRAND.white,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  tableBody: {
    borderLeftWidth: 0.5,
    borderLeftColor: GRID,
  },

  // ── Table rows ───────────────────────────────
  tableRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    minHeight: 18,
    borderBottomWidth: 0.5,
    borderBottomColor: GRID,
  },
  tdCell: {
    fontSize: FONT_SM,
    color: BRAND.graphite,
    flexWrap: 'wrap',
  },
  tdCellArabic: {
    fontFamily: 'Amiri',
    fontSize: FONT_BASE,
  },
  tdCellTwoLine: {
    maxLines: 2,
  },

  // ── Status badge ─────────────────────────────
  badge: {
    borderRadius: 3,
    paddingHorizontal: 4,
    paddingVertical: 2,
    alignSelf: 'flex-start',
  },
  badgeText: {
    fontSize: 5.5,
    fontFamily: 'Helvetica-Bold',
    letterSpacing: 0.2,
  },

  // ── Footer ───────────────────────────────────
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: FOOTER_H,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: PAGE_PAD_H,
    borderTopWidth: 0.5,
    borderTopColor: BRAND.border,
    backgroundColor: BRAND.white,
  },
  footerText: {
    fontSize: 6,
    color: BRAND.gray,
  },
  footerSlotLeft: {
    flex: 1,
    alignItems: 'flex-start',
  },
  footerSlotCenter: {
    flex: 1,
    alignItems: 'center',
  },
  footerSlotRight: {
    flex: 1,
    alignItems: 'flex-end',
  },

  // ── Empty state ──────────────────────────────
  emptyBox: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  emptyTitle: {
    fontSize: 11,
    fontFamily: 'Helvetica-Bold',
    color: BRAND.navy,
  },
  emptySubtitle: {
    fontSize: FONT_BASE,
    color: BRAND.gray,
  },
});

// ─── Status badge ─────────────────────────────────────────────────────────────

type StatusKey = AttendanceReportRow['status'];

const STATUS_STYLE: Record<StatusKey, { bg: string; text: string; label: string }> = {
  present:          { bg: '#DCFCE7', text: BRAND.green,    label: 'PRESENT' },
  late:             { bg: BRAND.lightGold, text: BRAND.amber,    label: 'LATE' },
  absent:           { bg: '#FEE2E2', text: BRAND.red,      label: 'ABSENT' },
  missing_checkout: { bg: '#FFEDD5', text: BRAND.orange,   label: 'NO CHECKOUT' },
  pending:          { bg: '#F3F4F6', text: BRAND.gray,     label: 'PENDING' },
};

function StatusBadge({ status }: { status: StatusKey }) {
  const cfg = STATUS_STYLE[status] ?? STATUS_STYLE.pending;
  return (
    <View style={[s.badge, { backgroundColor: cfg.bg }]}>
      <Text style={[s.badgeText, { color: cfg.text }]}>{cfg.label}</Text>
    </View>
  );
}

// ─── KPI section ─────────────────────────────────────────────────────────────

const KPI_CONFIG = [
  { key: 'totalRecords' as const, label: 'Total Records', color: BRAND.navy },
  { key: 'present'     as const, label: 'Present',       color: BRAND.green },
  { key: 'absent'      as const, label: 'Absent',        color: BRAND.red },
  { key: 'late'        as const, label: 'Late',          color: BRAND.amber },
  { key: 'earlyLeave'  as const, label: 'Early Leave',   color: BRAND.orange },
  { key: 'missingCheckout' as const, label: 'No Checkout', color: BRAND.orange },
  { key: 'overtime'    as const, label: 'Overtime',      color: BRAND.blue },
];

function KpiSection({ summary }: { summary: AttendanceReportData['summary'] }) {
  return (
    <View style={s.kpiSection}>
      {KPI_CONFIG.map(({ key, label, color }) => (
        <View key={key} style={s.kpiCard}>
          <View style={[s.kpiAccentLine, { backgroundColor: color }]} />
          <Text style={s.kpiLabel}>{label}</Text>
          <Text style={[s.kpiValue, { color }]}>{summary[key]}</Text>
        </View>
      ))}
    </View>
  );
}

// ─── Footer ───────────────────────────────────────────────────────────────────

function Footer({
  pageNumber,
  totalPages,
}: {
  pageNumber: number;
  totalPages: number;
}) {
  return (
    <View style={s.footer} fixed>
      <View style={s.footerSlotLeft}>
        <Text style={s.footerText}>Amwag Travel Attendance System</Text>
      </View>
      <View style={s.footerSlotCenter}>
        <Text style={s.footerText}>Powered by Abdelhmeed Elshorbagy</Text>
      </View>
      <View style={s.footerSlotRight}>
        <Text style={s.footerText}>Page {pageNumber} of {totalPages}</Text>
      </View>
    </View>
  );
}

export function getAttendancePdfFooterTextsForTest(pageNumber: number, totalPages: number) {
  return [
    'Amwag Travel Attendance System',
    'Powered by Abdelhmeed Elshorbagy',
    `Page ${pageNumber} of ${totalPages}`,
  ];
}

// ─── Table column header ─────────────────────────────────────────────────────

const COLUMNS: Array<{ label: string; width: number }> = [
  { label: '#',            width: COL.index },
  { label: 'Employee',     width: COL.employee },
  { label: 'Branch',       width: COL.branch },
  { label: 'Date',         width: COL.date },
  { label: 'Shift',        width: COL.shift },
  { label: 'Check In',     width: COL.checkIn },
  { label: 'Check Out',    width: COL.checkOut },
  { label: 'Late',         width: COL.late },
  { label: 'Early Leave',  width: COL.earlyLeave },
  { label: 'Overtime',     width: COL.overtime },
  { label: 'Status',       width: COL.status },
  { label: 'Location',     width: COL.location },
];

function TableColumnHeader() {
  return (
    <View style={s.tableHeaderRow}>
      {COLUMNS.map((col, i) => (
        <View key={col.label} style={headerCell(i, col.width)}>
          <Text style={s.thCell}>{col.label}</Text>
        </View>
      ))}
    </View>
  );
}

// ─── Table row ────────────────────────────────────────────────────────────────

function tdStyle(text: string) {
  return hasArabic(text)
    ? [s.tdCell, s.tdCellArabic]
    : [s.tdCell];
}

function TableDataRow({ row }: { row: AttendanceReportRow }) {
  const rowIndex = Math.max(0, row.index - 1);

  return (
    <View style={s.tableRow} wrap={false}>
      <View style={bodyCell(rowIndex, 0, COL.index)}>
        <Text style={s.tdCell}>{row.index}</Text>
      </View>
      <View style={bodyCell(rowIndex, 1, COL.employee)}>
        <Text style={[...tdStyle(row.employeeName), s.tdCellTwoLine]}>{row.employeeName}</Text>
      </View>
      <View style={bodyCell(rowIndex, 2, COL.branch)}>
        <Text style={[...tdStyle(row.branch), s.tdCellTwoLine]}>{row.branch}</Text>
      </View>
      <View style={bodyCell(rowIndex, 3, COL.date)}>
        <Text style={s.tdCell}>{row.date}</Text>
      </View>
      <View style={bodyCell(rowIndex, 4, COL.shift)}>
        <Text style={s.tdCell}>{row.shift}</Text>
      </View>
      <View style={bodyCell(rowIndex, 5, COL.checkIn)}>
        <Text style={s.tdCell}>{row.checkIn}</Text>
      </View>
      <View style={bodyCell(rowIndex, 6, COL.checkOut)}>
        <Text style={s.tdCell}>{row.checkOut}</Text>
      </View>
      <View style={bodyCell(rowIndex, 7, COL.late)}>
        <Text style={s.tdCell}>{row.late}</Text>
      </View>
      <View style={bodyCell(rowIndex, 8, COL.earlyLeave)}>
        <Text style={s.tdCell}>{row.earlyLeave}</Text>
      </View>
      <View style={bodyCell(rowIndex, 9, COL.overtime)}>
        <Text style={s.tdCell}>{row.overtime}</Text>
      </View>
      <View style={bodyCell(rowIndex, 10, COL.status)}>
        <StatusBadge status={row.status} />
      </View>
      <View style={bodyCell(rowIndex, 11, COL.location)}>
        <Text style={[...tdStyle(row.location), s.tdCellTwoLine]}>{row.location}</Text>
      </View>
    </View>
  );
}

export function getAttendancePdfRowStyleForTest(rowIndex: number, columnIndex: number) {
  return bodyCell(rowIndex, columnIndex, 1);
}

export function getAttendancePdfHeaderCellStyleForTest(columnIndex: number, width: number) {
  return headerCell(columnIndex, width);
}

// ─── Report page layout ──────────────────────────────────────────────────────

type AttendancePdfPage = {
  pageIndex: number;
  isFirstPage: boolean;
  rows: AttendanceReportRow[];
};

function periodLabel(data: AttendanceReportData): string {
  const { filters } = data;
  if (filters.dateRangeLabel) return filters.dateRangeLabel;
  if (filters.dateFilter) return `${filters.dateFilter} to ${filters.dateFilter}`;
  return 'All Dates';
}

function metadataValueStyle(text: string) {
  return hasArabic(text) ? s.metaValueArabic : {};
}

function paginateRows(rows: AttendanceReportRow[]): AttendancePdfPage[] {
  if (rows.length === 0) {
    return [{ pageIndex: 0, isFirstPage: true, rows: [] }];
  }

  const pages: AttendancePdfPage[] = [];
  pages.push({
    pageIndex: 0,
    isFirstPage: true,
    rows: rows.slice(0, FIRST_PAGE_ROW_LIMIT),
  });

  let offset = FIRST_PAGE_ROW_LIMIT;
  while (offset < rows.length) {
    pages.push({
      pageIndex: pages.length,
      isFirstPage: false,
      rows: rows.slice(offset, offset + CONTINUATION_PAGE_ROW_LIMIT),
    });
    offset += CONTINUATION_PAGE_ROW_LIMIT;
  }

  return pages;
}

export function getAttendancePdfPagesForTest(data: AttendanceReportData): AttendancePdfPage[] {
  return paginateRows(data.rows);
}

function ReportBanner({
  logoSrc,
}: {
  logoSrc: string;
}) {
  return (
    <View style={s.tableBanner} fixed>
      <View style={s.tableBannerLeft}>
        {logoSrc ? (
          // eslint-disable-next-line jsx-a11y/alt-text -- React PDF Image does not support alt.
          <Image style={s.tableBannerLogo} src={logoSrc} />
        ) : null}
        <Text style={s.tableBannerTitle}>{REPORT_TITLE}</Text>
      </View>
    </View>
  );
}

export function getAttendancePdfReportBannerTextsForTest(
  _data: AttendanceReportData,
): string[] {
  return [REPORT_TITLE];
}

export function getAttendancePdfMetadataValueStyleForTest(text: string) {
  return metadataValueStyle(text);
}

function MetadataLine({ label, value }: { label: string; value: string }) {
  return (
    <Text style={s.metaLine}>
      <Text style={s.metaLabel}>{label}: </Text>
      <Text style={metadataValueStyle(value)}>{value}</Text>
    </Text>
  );
}

function ReportMetadata({ data }: { data: AttendanceReportData }) {
  const { filters, meta } = data;
  const period = periodLabel(data);

  return (
    <View style={s.reportMetaSection}>
      <View style={s.metaBlock}>
        <MetadataLine label="Period" value={period} />
        <MetadataLine label="Generated By" value={meta.generatedBy} />
        <MetadataLine label="Generated At" value={meta.generatedAt} />
        {filters.branchName && (
          <MetadataLine label="Branch" value={filters.branchName} />
        )}
        {filters.employeeName && (
          <MetadataLine label="Employee" value={filters.employeeName} />
        )}
      </View>
    </View>
  );
}

// ─── Report page ──────────────────────────────────────────────────────────────

function ReportPage({
  data,
  logoSrc,
  page,
  totalPages,
}: {
  data: AttendanceReportData;
  logoSrc: string;
  page: AttendancePdfPage;
  totalPages: number;
}) {
  return (
    <Page size="A4" orientation="landscape" style={s.reportPage}>
      <ReportBanner logoSrc={logoSrc} />

      {page.isFirstPage && (
        <>
          <ReportMetadata data={data} />
          <KpiSection summary={data.summary} />
        </>
      )}

      {page.rows.length > 0 && (
        <>
          <TableColumnHeader />
          <View style={s.tableBody}>
            {page.rows.map((row) => (
              <TableDataRow key={row.index} row={row} />
            ))}
          </View>
        </>
      )}

      {page.isFirstPage && data.rows.length === 0 && (
        <View style={s.emptyBox}>
          <Text style={s.emptyTitle}>No Attendance Records Found</Text>
          <Text style={s.emptySubtitle}>
            No records match the selected filters. Please adjust your search criteria.
          </Text>
        </View>
      )}
      <Footer pageNumber={page.pageIndex + 1} totalPages={totalPages} />
    </Page>
  );
}

// ─── Document ─────────────────────────────────────────────────────────────────

export interface AttendanceReportPdfProps {
  data: AttendanceReportData;
  logoSrc: string;
}

export function AttendanceReportPdf({ data, logoSrc }: AttendanceReportPdfProps) {
  const pages = paginateRows(data.rows);

  return (
    <Document
      title="Amwag Travel — Attendance Daily Report"
      author="Amwag Travel Attendance System"
      subject={`Attendance Report — ${data.filters.dateRangeLabel ?? data.filters.dateFilter ?? ''}`}
      creator="Amwag Attendance System"
    >
      {pages.map((page) => (
        <ReportPage
          key={page.pageIndex}
          data={data}
          logoSrc={logoSrc}
          page={page}
          totalPages={pages.length}
        />
      ))}
    </Document>
  );
}
