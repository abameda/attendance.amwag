import jsPDF from "jspdf";
import type { AttendanceRecord } from "@/types";
import amiriRegularBase64 from "./amiriRegularBase64";

interface ExportOptions {
  locale?: string;
  dateFilter?: string;
  dateRangeLabel?: string;
  statusFilter?: string;
  searchQuery?: string;
  employeeName?: string;
  branchName?: string;
  generatedBy?: string;
  generatedAt?: Date;
  arabicFontBase64?: string;
}

interface PdfSummary {
  totalRecords: number;
  present: number;
  absent: number;
  late: number;
  earlyLeave: number;
  missingCheckout: number;
  overtime: number;
}

interface PdfColumn {
  key:
    | "index"
    | "employee"
    | "branch"
    | "date"
    | "shift"
    | "checkIn"
    | "checkOut"
    | "late"
    | "earlyLeave"
    | "overtime"
    | "status"
    | "location";
  header: string;
  width: number;
  align?: "left" | "center" | "right";
}

const PAGE = {
  marginX: 8,
  marginTop: 8,
  footerH: 10,
  rowMinH: 8,
};

const COLORS = {
  canvas: "#f6f2e5",
  surface: "#fbf9f1",
  surfaceMuted: "#f2eddc",
  primary: "#30775a",
  primarySoft: "#d9eadf",
  ink: "#303a31",
  text: "#303a31",
  muted: "#6c725f",
  label: "#797563",
  line: "#d9d0b8",
  softLine: "#e8dfc8",
  headerFill: "#f2eddc",
  rowAlt: "#f8f4e9",
  success: "#27724d",
  successBg: "#dcf2e2",
  warning: "#93681f",
  warningBg: "#f7e7bc",
  danger: "#a43b2f",
  dangerBg: "#f4d9d2",
  info: "#356f98",
  infoBg: "#dceaf1",
  neutralBg: "#ece6d5",
};

const FONT = {
  regular: "helvetica",
  bold: "helvetica",
  arabic: "Amiri",
};

const COLUMNS: PdfColumn[] = [
  { key: "index", header: "#", width: 8, align: "center" },
  { key: "employee", header: "Employee", width: 34 },
  { key: "branch", header: "Branch", width: 24 },
  { key: "date", header: "Date", width: 21, align: "center" },
  { key: "shift", header: "Shift", width: 22, align: "center" },
  { key: "checkIn", header: "Check In", width: 18, align: "center" },
  { key: "checkOut", header: "Check Out", width: 18, align: "center" },
  { key: "late", header: "Late", width: 17, align: "center" },
  { key: "earlyLeave", header: "Early Leave", width: 20, align: "center" },
  { key: "overtime", header: "Overtime", width: 18, align: "center" },
  { key: "status", header: "Status", width: 22, align: "center" },
  { key: "location", header: "Location", width: 59 },
];

function formatTimePDF(timestamp: string | null): string {
  if (!timestamp) return "-";
  const date = new Date(timestamp);
  return date.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

function formatDatePDF(date: string): string {
  if (!date) return "-";
  return new Date(`${date}T00:00:00`).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatDateTimePDF(date: Date): string {
  return date.toLocaleString("en-GB", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatMinutes(minutes: number): string {
  if (minutes <= 0) return "-";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h > 0 && m > 0) return `${h}h ${m}m`;
  return h > 0 ? `${h}h` : `${m}m`;
}

function statusLabel(status: string): string {
  switch (status) {
    case "present":
      return "Present";
    case "late":
      return "Late";
    case "absent":
      return "Absent";
    case "missing_checkout":
      return "Missing C/O";
    case "pending":
      return "Pending";
    default:
      return status;
  }
}

function statusBadgeColors(label: string): { bg: string; text: string; border: string } {
  switch (label) {
    case "Present":
      return { bg: COLORS.successBg, text: COLORS.success, border: "#86efac" };
    case "Late":
      return { bg: COLORS.warningBg, text: COLORS.warning, border: "#fde68a" };
    case "Absent":
      return { bg: COLORS.dangerBg, text: COLORS.danger, border: "#fecaca" };
    case "Missing C/O":
      return { bg: "#ffedd5", text: "#c2410c", border: "#fed7aa" };
    default:
      return { bg: COLORS.neutralBg, text: COLORS.muted, border: COLORS.line };
  }
}

function buildExportableRecords(records: AttendanceRecord[]) {
  return records.filter((record) => record.status !== "pending");
}

function hasArabic(text: string): boolean {
  return /[\u0600-\u06FF]/.test(text);
}

function reportHasArabic(records: AttendanceRecord[], options: ExportOptions) {
  const values = [
    options.locale === "ar" ? "تقرير الحضور" : "",
    options.employeeName,
    options.branchName,
    options.dateRangeLabel,
    options.generatedBy,
    options.searchQuery,
    ...records.flatMap((record) => [
      record.profiles?.full_name,
      record.profiles?.branch,
      record.check_in_location,
      record.check_out_location,
    ]),
  ];

  return values.some((value) => hasArabic(String(value ?? "")));
}

function safeText(value: unknown): string {
  const text = String(value ?? "").trim();
  return text || "-";
}

function rgb(hex: string): [number, number, number] {
  const value = hex.replace("#", "");
  return [
    Number.parseInt(value.slice(0, 2), 16),
    Number.parseInt(value.slice(2, 4), 16),
    Number.parseInt(value.slice(4, 6), 16),
  ];
}

function setFill(pdf: jsPDF, color: string) {
  pdf.setFillColor(...rgb(color));
}

function setStroke(pdf: jsPDF, color: string) {
  pdf.setDrawColor(...rgb(color));
}

function setText(pdf: jsPDF, color: string) {
  pdf.setTextColor(...rgb(color));
}

function resolveBranchLabel(records: AttendanceRecord[], options: ExportOptions): string {
  if (options.branchName) return options.branchName;
  const branches = new Set(
    records
      .map((record) => record.profiles?.branch?.trim())
      .filter((branch): branch is string => Boolean(branch))
  );

  if (branches.size === 1) return Array.from(branches)[0];
  return "All Branches";
}

function resolveEmployeeLabel(records: AttendanceRecord[], options: ExportOptions): string | undefined {
  if (options.employeeName) return options.employeeName;
  const employeeNames = new Set(
    records
      .map((record) => record.profiles?.full_name?.trim())
      .filter((name): name is string => Boolean(name))
  );

  if (employeeNames.size === 1) return Array.from(employeeNames)[0];
  return undefined;
}

function pdfLabels(locale?: string) {
  const isArabicLocale = locale === "ar";
  return {
    reportTitle: isArabicLocale ? "تقرير الحضور" : "Attendance Report",
    branch: isArabicLocale ? "الفرع" : "Branch",
    employee: isArabicLocale ? "الموظف" : "Employee",
    dateRange: isArabicLocale ? "نطاق التاريخ" : "Date Range",
    generated: isArabicLocale ? "تم الإنشاء" : "Generated",
    generatedBy: isArabicLocale ? "تم الإنشاء بواسطة" : "Generated By",
  };
}

function resolveReportTitle(records: AttendanceRecord[], options: ExportOptions): string {
  const labels = pdfLabels(options.locale);
  const employeeName = resolveEmployeeLabel(records, options);
  if (employeeName) return `${labels.reportTitle} - ${employeeName}`;
  if (options.branchName) return `${labels.reportTitle} - ${labels.branch}: ${options.branchName}`;
  return labels.reportTitle;
}

function resolveDateRange(records: AttendanceRecord[], options: ExportOptions): string {
  if (options.dateRangeLabel) return options.dateRangeLabel;
  if (options.dateFilter) return formatDatePDF(options.dateFilter);

  const dates = records.map((record) => record.date).filter(Boolean).sort();
  if (dates.length === 0) return "No records";
  if (dates[0] === dates[dates.length - 1]) return formatDatePDF(dates[0]);
  return `${formatDatePDF(dates[0])} to ${formatDatePDF(dates[dates.length - 1])}`;
}

function shiftLabel(record: AttendanceRecord): string {
  const start = record.profiles?.shift_start;
  const end = record.profiles?.shift_end;
  return start && end ? `${start}-${end}` : "-";
}

function locationLabel(record: AttendanceRecord): string {
  const checkIn = safeText(record.check_in_location);
  const checkOut = safeText(record.check_out_location);
  if (checkIn === checkOut) return checkIn;
  return `In: ${checkIn}\nOut: ${checkOut}`;
}

export function getAttendancePdfSummary(records: AttendanceRecord[]): PdfSummary {
  return records.reduce<PdfSummary>(
    (summary, record) => {
      summary.totalRecords += 1;
      if (record.status === "present") summary.present += 1;
      if (record.status === "absent") summary.absent += 1;
      if (record.status === "late") summary.late += 1;
      if (record.status === "missing_checkout") summary.missingCheckout += 1;
      if ((record.early_departure_minutes || 0) > 0) summary.earlyLeave += 1;
      if ((record.overtime_minutes || 0) > 0) summary.overtime += 1;
      return summary;
    },
    {
      totalRecords: 0,
      present: 0,
      absent: 0,
      late: 0,
      earlyLeave: 0,
      missingCheckout: 0,
      overtime: 0,
    }
  );
}

function registerArabicFont(pdf: jsPDF, fontBase64?: string) {
  const regularFontBase64 = fontBase64 || amiriRegularBase64;
  if (!regularFontBase64) return false;

  try {
    pdf.addFileToVFS("Amiri-Regular.ttf", regularFontBase64);
    pdf.addFont("Amiri-Regular.ttf", FONT.arabic, "normal");
    pdf.addFont("Amiri-Regular.ttf", FONT.arabic, "bold");
    return true;
  } catch {
    return false;
  }
}

function setFont(pdf: jsPDF, size: number, style: "normal" | "bold" = "normal", useArabic = false) {
  pdf.setFont(useArabic ? FONT.arabic : FONT.regular, style);
  pdf.setFontSize(size);
}

function processPdfText(pdf: jsPDF, text: string): string {
  const processor = (pdf as unknown as { processArabic?: (value: string) => string }).processArabic;
  return processor && hasArabic(text) ? processor.call(pdf, text) : text;
}

function splitLines(pdf: jsPDF, text: string, maxWidth: number): string[] {
  const rawLines = String(text).split("\n");
  return rawLines.flatMap((line) => {
    const processed = processPdfText(pdf, line);
    const split = pdf.splitTextToSize(processed, maxWidth);
    return Array.isArray(split) ? split : [processed];
  });
}

function text(
  pdf: jsPDF,
  value: string,
  x: number,
  y: number,
  options: { align?: "left" | "center" | "right"; maxWidth?: number } = {}
) {
  pdf.text(processPdfText(pdf, value), x, y, options);
}

function drawFooter(pdf: jsPDF, pageNum: number, totalPages: number, generatedAt: Date) {
  const pageW = pdf.internal.pageSize.getWidth();
  const pageH = pdf.internal.pageSize.getHeight();
  const y = pageH - 6;

  setStroke(pdf, COLORS.line);
  pdf.setLineWidth(0.15);
  pdf.line(PAGE.marginX, pageH - PAGE.footerH, pageW - PAGE.marginX, pageH - PAGE.footerH);
  setText(pdf, COLORS.muted);
  setFont(pdf, 7);
  text(pdf, "Generated by Amwag Attendance System", PAGE.marginX, y);
  text(pdf, formatDateTimePDF(generatedAt), pageW / 2, y, { align: "center" });
  text(pdf, `Page ${pageNum} of ${totalPages}`, pageW - PAGE.marginX, y, { align: "right" });
}

function drawPageBackground(pdf: jsPDF) {
  const pageW = pdf.internal.pageSize.getWidth();
  const pageH = pdf.internal.pageSize.getHeight();
  setFill(pdf, COLORS.canvas);
  pdf.rect(0, 0, pageW, pageH, "F");
}

function drawHeader(
  pdf: jsPDF,
  records: AttendanceRecord[],
  options: ExportOptions,
  generatedAt: Date,
  useArabic: boolean
) {
  const pageW = pdf.internal.pageSize.getWidth();
  const headerX = PAGE.marginX;
  const headerW = pageW - PAGE.marginX * 2;
  const logoX = headerX;
  const logoY = PAGE.marginTop + 1;

  setFill(pdf, COLORS.surface);
  setStroke(pdf, COLORS.line);
  pdf.setLineWidth(0.2);
  pdf.roundedRect(headerX, PAGE.marginTop, headerW, 25, 2.2, 2.2, "FD");

  setFill(pdf, COLORS.primarySoft);
  setStroke(pdf, COLORS.primary);
  pdf.setLineWidth(0.25);
  pdf.roundedRect(logoX + 4, logoY + 4, 13, 13, 1.8, 1.8, "FD");
  setText(pdf, COLORS.primary);
  setFont(pdf, 7.2, "bold");
  text(pdf, "AW", logoX + 10.5, logoY + 12.2, { align: "center" });
  // Placeholder for a future base64 logo:
  // pdf.addImage(base64Logo, "PNG", logoX, logoY, 14, 14);

  setText(pdf, COLORS.ink);
  setFont(pdf, 14.5, "bold", useArabic);
  text(pdf, "Amwag Attendance", headerX + 22, PAGE.marginTop + 9);
  setFont(pdf, 9.5, "bold", useArabic);
  setText(pdf, COLORS.primary);
  text(pdf, resolveReportTitle(records, options), headerX + 22, PAGE.marginTop + 15.2);

  const metaX = headerX + headerW - 4;
  const employeeLabel = resolveEmployeeLabel(records, options);
  const labels = pdfLabels(options.locale);
  const meta = [
    ...(employeeLabel ? [`${labels.employee}: ${employeeLabel}`] : []),
    `${labels.dateRange}: ${resolveDateRange(records, options)}`,
    `${labels.branch}: ${resolveBranchLabel(records, options)}`,
    `${labels.generated}: ${formatDateTimePDF(generatedAt)}`,
    `${labels.generatedBy}: ${options.generatedBy || "Amwag Admin"}`,
  ];

  setFont(pdf, 7.4, "normal", useArabic);
  setText(pdf, COLORS.text);
  meta.forEach((line, index) => {
    text(pdf, line, metaX, PAGE.marginTop + 5.5 + index * 4.2, { align: "right" });
  });

  setFill(pdf, COLORS.primary);
  pdf.rect(headerX, 30, headerW, 0.6, "F");

  const filterParts: string[] = [];
  if (options.statusFilter) filterParts.push(`Status: ${statusLabel(options.statusFilter)}`);
  if (options.searchQuery) filterParts.push(`Search: ${options.searchQuery}`);
  if (filterParts.length) {
    setText(pdf, COLORS.label);
    setFont(pdf, 7.2, "normal", useArabic);
    text(pdf, filterParts.join(" | "), headerX + 22, PAGE.marginTop + 21);
  }
}

function drawSummary(pdf: jsPDF, records: AttendanceRecord[], y: number) {
  const summary = getAttendancePdfSummary(records);
  const pageW = pdf.internal.pageSize.getWidth();
  const availableW = pageW - PAGE.marginX * 2;
  const metrics = [
    ["Total Records", summary.totalRecords],
    ["Present", summary.present],
    ["Absent", summary.absent],
    ["Late", summary.late],
    ["Early Leave", summary.earlyLeave],
    ["Missing Checkout", summary.missingCheckout],
    ["Overtime", summary.overtime],
  ];
  const gap = 2;
  const cardH = 16;
  const cellW = (availableW - gap * (metrics.length - 1)) / metrics.length;

  metrics.forEach(([label, value], index) => {
    const x = PAGE.marginX + index * (cellW + gap);
    setFill(pdf, COLORS.surface);
    setStroke(pdf, COLORS.line);
    pdf.setLineWidth(0.18);
    pdf.roundedRect(x, y, cellW, cardH, 2, 2, "FD");
    setText(pdf, COLORS.label);
    setFont(pdf, 6.4, "bold");
    text(pdf, String(label).toUpperCase(), x + cellW / 2, y + 4.7, { align: "center" });
    setText(pdf, index === 0 ? COLORS.ink : COLORS.primary);
    setFont(pdf, 12, "bold");
    text(pdf, String(value), x + cellW / 2, y + 11.4, { align: "center" });
  });
}

function rowValues(record: AttendanceRecord, index: number): Record<PdfColumn["key"], string> {
  return {
    index: String(index + 1),
    employee: safeText(record.profiles?.full_name),
    branch: safeText(record.profiles?.branch),
    date: formatDatePDF(record.date),
    shift: shiftLabel(record),
    checkIn: formatTimePDF(record.check_in_time),
    checkOut: formatTimePDF(record.check_out_time),
    late: formatMinutes(record.late_minutes || 0),
    earlyLeave: formatMinutes(record.early_departure_minutes || 0),
    overtime: formatMinutes(record.overtime_minutes || 0),
    status: statusLabel(record.status),
    location: locationLabel(record),
  };
}

function drawTableHeader(pdf: jsPDF, y: number) {
  let x = PAGE.marginX;
  setFill(pdf, COLORS.headerFill);
  setStroke(pdf, COLORS.line);
  pdf.setLineWidth(0.1);
  setFont(pdf, 6.8, "bold");

  for (const column of COLUMNS) {
    setFill(pdf, COLORS.headerFill);
    pdf.rect(x, y, column.width, 8, "FD");
    setText(pdf, COLORS.ink);
    text(pdf, column.header.toUpperCase(), x + column.width / 2, y + 5.2, { align: "center" });
    x += column.width;
  }
}

function drawRow(
  pdf: jsPDF,
  values: Record<PdfColumn["key"], string>,
  y: number,
  rowH: number,
  rowIndex: number,
  useArabic: boolean
) {
  let x = PAGE.marginX;
  setFill(pdf, rowIndex % 2 === 0 ? COLORS.surface : COLORS.rowAlt);
  pdf.rect(PAGE.marginX, y, COLUMNS.reduce((sum, column) => sum + column.width, 0), rowH, "F");

  for (const column of COLUMNS) {
    const value = values[column.key];
    const maxTextW = column.width - 3;
    const lines = splitLines(pdf, value, maxTextW);
    const align = column.align ?? "left";
    const textX =
      align === "center" ? x + column.width / 2 : align === "right" ? x + column.width - 1.5 : x + 1.5;
    const textY = y + 4.6;

    setStroke(pdf, COLORS.line);
    pdf.setLineWidth(0.12);
    pdf.rect(x, y, column.width, rowH, "S");

    if (column.key === "status") {
      const badge = statusBadgeColors(value);
      const badgeW = Math.min(column.width - 4, Math.max(13, pdf.getTextWidth(value) + 6));
      const badgeH = Math.min(5.4, rowH - 2);
      const badgeX = x + (column.width - badgeW) / 2;
      const badgeY = y + Math.max(1.4, (rowH - badgeH) / 2);
      setFill(pdf, badge.bg);
      setStroke(pdf, badge.border);
      pdf.setLineWidth(0.12);
      pdf.roundedRect(badgeX, badgeY, badgeW, badgeH, 1.9, 1.9, "FD");
      setText(pdf, badge.text);
      setFont(pdf, 6.6, "bold", useArabic);
      text(pdf, value, x + column.width / 2, badgeY + 3.65, { align: "center" });
      x += column.width;
      continue;
    } else if (["late", "earlyLeave"].includes(column.key) && value !== "-") {
      setText(pdf, COLORS.danger);
      setFont(pdf, 6.5, "bold", useArabic);
    } else if (column.key === "overtime" && value !== "-") {
      setText(pdf, COLORS.info);
      setFont(pdf, 6.5, "bold", useArabic);
    } else {
      setText(pdf, column.key === "index" ? COLORS.muted : COLORS.text);
      setFont(pdf, 6.5, column.key === "employee" ? "bold" : "normal", useArabic);
    }

    pdf.text(lines.slice(0, 3), textX, textY, {
      align,
      baseline: "top",
      maxWidth: maxTextW,
      lineHeightFactor: 1.1,
    });
    x += column.width;
  }
}

function calculateRowHeight(pdf: jsPDF, values: Record<PdfColumn["key"], string>, useArabic: boolean): number {
  setFont(pdf, 6.5, "normal", useArabic);
  const maxLines = COLUMNS.reduce((count, column) => {
    const lines = splitLines(pdf, values[column.key], column.width - 3);
    return Math.max(count, Math.min(lines.length, 3));
  }, 1);
  return Math.max(PAGE.rowMinH, 3.2 + maxLines * 3.2);
}

function addReportPage(
  pdf: jsPDF,
  records: AttendanceRecord[],
  options: ExportOptions,
  generatedAt: Date,
  useArabic: boolean,
  isFirstPage: boolean
) {
  if (!isFirstPage) pdf.addPage();
  drawPageBackground(pdf);
  drawHeader(pdf, records, options, generatedAt, useArabic);
  if (isFirstPage) {
    drawSummary(pdf, records, 39);
    drawTableHeader(pdf, 59);
    return 67;
  }

  drawTableHeader(pdf, 38);
  return 46;
}

export function createAttendancePdfDocument(records: AttendanceRecord[], options: ExportOptions = {}) {
  const exportableRecords = buildExportableRecords(records);
  const generatedAt = options.generatedAt ?? new Date();
  const pdf = new jsPDF({
    orientation: "landscape",
    unit: "mm",
    format: "a4",
    compress: true,
    putOnlyUsedFonts: true,
  });
  const useArabic = reportHasArabic(exportableRecords, options) && registerArabicFont(pdf, options.arabicFontBase64);
  const pageH = pdf.internal.pageSize.getHeight();
  const bottomLimit = pageH - PAGE.footerH - 2;

  let y = addReportPage(pdf, exportableRecords, options, generatedAt, useArabic, true);

  if (exportableRecords.length === 0) {
    setText(pdf, COLORS.muted);
    setFont(pdf, 9, "normal", useArabic);
    text(pdf, "No attendance records match the selected filters.", PAGE.marginX, y + 10);
  }

  exportableRecords.forEach((record, index) => {
    const values = rowValues(record, index);
    const rowH = calculateRowHeight(pdf, values, useArabic);

    if (y + rowH > bottomLimit) {
      y = addReportPage(pdf, exportableRecords, options, generatedAt, useArabic, false);
    }

    drawRow(pdf, values, y, rowH, index, useArabic);
    y += rowH;
  });

  const totalPages = pdf.getNumberOfPages();
  for (let page = 1; page <= totalPages; page += 1) {
    pdf.setPage(page);
    drawFooter(pdf, page, totalPages, generatedAt);
  }

  return pdf;
}

async function loadArabicFontBase64(records: AttendanceRecord[], options: ExportOptions) {
  if (!reportHasArabic(records, options) || options.arabicFontBase64) {
    return options.arabicFontBase64;
  }

  if (amiriRegularBase64) {
    return amiriRegularBase64;
  }

  if (typeof window === "undefined" || typeof fetch === "undefined") {
    return undefined;
  }

  try {
    const response = await fetch("/fonts/Amiri-Regular.ttf");
    if (!response.ok) return undefined;
    const buffer = await response.arrayBuffer();
    let binary = "";
    const bytes = new Uint8Array(buffer);
    const chunkSize = 0x8000;
    for (let i = 0; i < bytes.length; i += chunkSize) {
      binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
    }
    return btoa(binary);
  } catch {
    return undefined;
  }
}

async function exportPdf(records: AttendanceRecord[], options: ExportOptions, fileNamePrefix: string) {
  const exportableRecords = buildExportableRecords(records);
  const arabicFontBase64 = await loadArabicFontBase64(exportableRecords, options);
  const pdf = createAttendancePdfDocument(exportableRecords, {
    ...options,
    arabicFontBase64,
  });
  const fileDate = new Date().toISOString().split("T")[0];
  pdf.save(`${fileNamePrefix}_${fileDate}.pdf`);
}

/**
 * Generates a compact real-text PDF report.
 */
export async function exportAttendancePDF(records: AttendanceRecord[], options: ExportOptions = {}) {
  return exportPdf(records, options, "amwag_attendance");
}

/**
 * Generates a compact real-text PDF report.
 */
export async function exportAttendancePremiumPDF(records: AttendanceRecord[], options: ExportOptions = {}) {
  return exportPdf(records, options, "amwag_attendance");
}
