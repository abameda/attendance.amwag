import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import type { AttendanceRecord } from "@/types";

interface ExportOptions {
  locale?: string;
  dateFilter?: string;
  statusFilter?: string;
  searchQuery?: string;
}

function formatTimePDF(timestamp: string | null): string {
  if (!timestamp) return "-";
  const date = new Date(timestamp);
  return date.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

function formatMinutes(minutes: number): string {
  if (minutes <= 0) return "-";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
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
    default:
      return status;
  }
}

function statusColor(status: string): string {
  switch (status) {
    case "present":
      return "#059669";
    case "late":
      return "#d97706";
    case "absent":
      return "#dc2626";
    case "missing_checkout":
      return "#ea580c";
    default:
      return "#64748b";
  }
}

function buildExportableRecords(records: AttendanceRecord[]) {
  return records.filter((record) => record.status !== "pending");
}

function getReportMeta(options: ExportOptions) {
  const { dateFilter, statusFilter, searchQuery } = options;
  const exportedOn = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  const reportDateLabel = dateFilter
    ? new Date(dateFilter + "T00:00:00").toLocaleDateString("en-US", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : "Selected date required";

  const filters: string[] = [];
  if (statusFilter) filters.push(`Status: ${statusFilter}`);
  if (searchQuery) filters.push(`Search: ${searchQuery}`);

  return { exportedOn, reportDateLabel, filters };
}

/**
 * Builds a premium high-fidelity HTML report with navy header,
 * full table with both check-in and check-out locations.
 */
function buildReportHTML(
  records: AttendanceRecord[],
  options: ExportOptions,
): string {
  const { exportedOn, reportDateLabel, filters } = getReportMeta(options);

  // Column definitions — 12 columns including both locations
  const cols = [
    { header: "#", width: "3%", align: "center" },
    { header: "EMPLOYEE", width: "12%", align: "left" },
    { header: "BRANCH", width: "9%", align: "center" },
    { header: "DATE", width: "8%", align: "center" },
    { header: "CHECK IN", width: "7%", align: "center" },
    { header: "CHECK OUT", width: "7%", align: "center" },
    { header: "LATE", width: "6%", align: "center" },
    { header: "EARLY LEAVE", width: "7%", align: "center" },
    { header: "OVERTIME", width: "7%", align: "center" },
    { header: "STATUS", width: "7%", align: "center" },
    { header: "LOCATION IN", width: "13.5%", align: "center" },
    { header: "LOCATION OUT", width: "13.5%", align: "center" },
  ];

  // Table header cells
  const thCells = cols
    .map(
      (c, idx) => `
        <th style="
            padding: 11px 6px;
            text-align: ${c.align};
            font-size: 10px;
            font-weight: 700;
            color: #ffffff;
            text-transform: uppercase;
            letter-spacing: 0.8px;
            width: ${c.width};
            white-space: nowrap;
            ${idx < cols.length - 1 ? "border-right: 1px solid rgba(255,255,255,0.12);" : ""}
        ">${c.header}</th>
    `,
    )
    .join("");

  // Table rows
  const rows = records
    .map((r, i) => {
      const bg = i % 2 === 0 ? "#ffffff" : "#f8fafc";
      const sc = statusColor(r.status);
      const lateVal = r.late_minutes || 0;
      const earlyVal = r.early_departure_minutes || 0;
      const otVal = r.overtime_minutes || 0;

      const tdStyle = (align: string = "center", extra: string = "") => `
            padding: 9px 6px;
            text-align: ${align};
            font-size: 11px;
            color: #334155;
            border-bottom: 1px solid #e2e8f0;
            white-space: nowrap;
            line-height: 1.4;
            ${extra}
        `;

      return `<tr style="background: ${bg};">
            <td style="${tdStyle("center", "color: #94a3b8; font-size: 10px;")}">${i + 1}</td>
            <td style="${tdStyle("left", "font-weight: 600; color: #0f172a;")}">${r.profiles?.full_name || "-"}</td>
            <td style="${tdStyle("center", "font-size: 10px;")}">${r.profiles?.branch || "-"}</td>
            <td style="${tdStyle("center", "font-size: 10px; font-family: monospace;")}">${r.date}</td>
            <td style="${tdStyle("center", "font-size: 10px;")}">${formatTimePDF(r.check_in_time)}</td>
            <td style="${tdStyle("center", "font-size: 10px;")}">${formatTimePDF(r.check_out_time)}</td>
            <td style="${tdStyle("center", `font-size: 10px; color: ${lateVal > 0 ? "#dc2626" : "#94a3b8"}; font-weight: ${lateVal > 0 ? "700" : "400"};`)}">${formatMinutes(lateVal)}</td>
            <td style="${tdStyle("center", `font-size: 10px; color: ${earlyVal > 0 ? "#dc2626" : "#94a3b8"}; font-weight: ${earlyVal > 0 ? "700" : "400"};`)}">${formatMinutes(earlyVal)}</td>
            <td style="${tdStyle("center", `font-size: 10px; color: ${otVal > 0 ? "#2563eb" : "#94a3b8"}; font-weight: ${otVal > 0 ? "700" : "400"};`)}">${formatMinutes(otVal)}</td>
            <td style="${tdStyle("center")}">
                <span style="
                    display: inline-block;
                    padding: 2px 8px;
                    border-radius: 4px;
                    font-size: 10px;
                    font-weight: 700;
                    color: ${sc};
                ">${statusLabel(r.status)}</span>
            </td>
            <td style="${tdStyle("center", "font-size: 10px;")}">${r.check_in_location || "-"}</td>
            <td style="${tdStyle("center", "font-size: 10px;")}">${r.check_out_location || "-"}</td>
        </tr>`;
    })
    .join("");

  return `
    <div id="pdf-report" dir="ltr" style="
        width: 1180px;
        direction: ltr;
        text-align: left;
        unicode-bidi: embed;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Helvetica Neue', Arial, sans-serif;
        background: #ffffff;
        color: #1e293b;
        -webkit-font-smoothing: antialiased;
        -moz-osx-font-smoothing: grayscale;
    ">
        <!-- ═══ NAVY HEADER BAR ═══ -->
        <div style="
            background: linear-gradient(135deg, #1e3a5f 0%, #1a365d 100%);
            padding: 20px 28px;
            display: flex;
            align-items: center;
            justify-content: space-between;
        ">
            <div style="display: flex; align-items: center; gap: 16px;">
                <img src="/logo.png" alt="Amwag" style="width: 48px; height: 48px; object-fit: contain;" />
                <div>
                    <div style="font-size: 22px; font-weight: 800; color: #ffffff; letter-spacing: 0.3px;">Amwag Travel</div>
                    <div style="font-size: 12px; color: #E8A838; margin-top: 2px; font-weight: 500; letter-spacing: 0.5px;">Attendance Report</div>
                </div>
            </div>
            <div style="text-align: right;">
                <div style="font-size: 13px; color: #ffffff; font-weight: 600;">${reportDateLabel}</div>
                <div style="font-size: 10px; color: #93b4d4; margin-top: 4px;">Exported on: ${exportedOn}</div>
                ${filters.length > 0 ? `<div style="font-size: 9px; color: #93b4d4; margin-top: 3px;">${filters.join("  •  ")}</div>` : ""}
                <div style="font-size: 10px; color: #93b4d4; margin-top: 3px;">Total Records: ${records.length}</div>
            </div>
        </div>

        <!-- Gold accent line -->
        <div style="height: 3px; background: linear-gradient(90deg, #E8A838 0%, #f0c060 50%, #E8A838 100%);"></div>

        <!-- ═══ TABLE ═══ -->
        <div style="padding: 12px 16px 0 16px;">
            <table style="width: 100%; border-collapse: collapse; border: 1px solid #cbd5e1;">
                <thead>
                    <tr style="background: linear-gradient(135deg, #1e3a5f 0%, #1a365d 100%);">
                        ${thCells}
                    </tr>
                </thead>
                <tbody>
                    ${rows}
                </tbody>
            </table>
        </div>

        <!-- ═══ FOOTER ═══ -->
        <div style="
            margin: 12px 16px 0 16px;
            padding: 12px 20px;
            display: flex;
            justify-content: space-between;
            align-items: center;
            border-top: 2px solid #1e3a5f;
        ">
            <div style="font-size: 11px; color: #1e3a5f; font-weight: 700; letter-spacing: 0.5px;">Amwag Travel</div>
            <div style="font-size: 11px; color: #64748b; font-weight: 500; direction: rtl; font-family: -apple-system, 'Segoe UI', Tahoma, Arial, sans-serif;">
                تم التطوير بواسطة مهندس. عبدالحميد الشوربجي
            </div>
            <div style="font-size: 10px; color: #94a3b8;">Page 1</div>
        </div>
    </div>`;
}

function buildPremiumReportHTML(
  records: AttendanceRecord[],
  options: ExportOptions,
): string {
  const { exportedOn, reportDateLabel, filters } = getReportMeta(options);
  const rows = records
    .map((record, index) => {
      const bg = index % 2 === 0 ? "#ffffff" : "#f6f8fb";
      const statusBg = `${statusColor(record.status)}18`;
      const highlight = (value: number, activeColor: string) =>
        value > 0 ? activeColor : "#94a3b8";
      const weight = (value: number) => (value > 0 ? "700" : "500");

      return `
            <tr style="background: ${bg};">
                <td style="padding: 11px 8px; text-align: center; font-size: 10px; color: #64748b; border-bottom: 1px solid rgba(148,163,184,0.16);">${index + 1}</td>
                <td style="padding: 11px 10px; text-align: left; border-bottom: 1px solid rgba(148,163,184,0.16);">
                    <div style="font-size: 12px; font-weight: 800; color: #0f172a; line-height: 1.3;">${record.profiles?.full_name || "-"}</div>
                </td>
                <td style="padding: 11px 8px; text-align: center; font-size: 10px; color: #334155; border-bottom: 1px solid rgba(148,163,184,0.16);">${record.profiles?.branch || "-"}</td>
                <td style="padding: 11px 8px; text-align: center; font-size: 10px; color: #1e293b; font-family: Menlo, Monaco, Consolas, monospace; border-bottom: 1px solid rgba(148,163,184,0.16);">${record.date}</td>
                <td style="padding: 11px 8px; text-align: center; font-size: 10px; color: #0f172a; font-weight: 700; border-bottom: 1px solid rgba(148,163,184,0.16);">${formatTimePDF(record.check_in_time)}</td>
                <td style="padding: 11px 8px; text-align: center; font-size: 10px; color: #0f172a; font-weight: 700; border-bottom: 1px solid rgba(148,163,184,0.16);">${formatTimePDF(record.check_out_time)}</td>
                <td style="padding: 11px 8px; text-align: center; font-size: 10px; color: ${highlight(record.late_minutes || 0, "#dc2626")}; font-weight: ${weight(record.late_minutes || 0)}; border-bottom: 1px solid rgba(148,163,184,0.16);">${formatMinutes(record.late_minutes || 0)}</td>
                <td style="padding: 11px 8px; text-align: center; font-size: 10px; color: ${highlight(record.early_departure_minutes || 0, "#ea580c")}; font-weight: ${weight(record.early_departure_minutes || 0)}; border-bottom: 1px solid rgba(148,163,184,0.16);">${formatMinutes(record.early_departure_minutes || 0)}</td>
                <td style="padding: 11px 8px; text-align: center; font-size: 10px; color: ${highlight(record.overtime_minutes || 0, "#2563eb")}; font-weight: ${weight(record.overtime_minutes || 0)}; border-bottom: 1px solid rgba(148,163,184,0.16);">${formatMinutes(record.overtime_minutes || 0)}</td>
                <td style="padding: 11px 8px; text-align: center; border-bottom: 1px solid rgba(148,163,184,0.16);">
                    <span style="
                        display: inline-flex;
                        align-items: center;
                        justify-content: center;
                        padding: 4px 10px;
                        min-width: 82px;
                        border-radius: 999px;
                        background: ${statusBg};
                        color: ${statusColor(record.status)};
                        font-size: 10px;
                        font-weight: 800;
                        letter-spacing: 0.2px;
                    ">${statusLabel(record.status)}</span>
                </td>
                <td style="padding: 11px 8px; text-align: center; font-size: 10px; color: #334155; border-bottom: 1px solid rgba(148,163,184,0.16);">${record.check_in_location || "-"}</td>
                <td style="padding: 11px 8px; text-align: center; font-size: 10px; color: #334155; border-bottom: 1px solid rgba(148,163,184,0.16);">${record.check_out_location || "-"}</td>
            </tr>
        `;
    })
    .join("");

  return `
    <div id="pdf-report" dir="ltr" style="
        width: 1180px;
        direction: ltr;
        text-align: left;
        unicode-bidi: embed;
        font-family: 'Segoe UI', 'Helvetica Neue', Arial, sans-serif;
        background:
            radial-gradient(circle at top left, rgba(232,168,56,0.10), transparent 25%),
            linear-gradient(180deg, #f7f9fc 0%, #eef3f8 100%);
        color: #0f172a;
        padding: 18px;
        box-sizing: border-box;
    ">
        <div style="
            position: relative;
            overflow: hidden;
            border-radius: 22px;
            background: linear-gradient(135deg, #102943 0%, #173a61 52%, #102943 100%);
            padding: 24px 28px;
            box-shadow: 0 16px 42px rgba(15, 23, 42, 0.16);
        ">
            <div style="
                position: absolute;
                inset: auto -40px -48px auto;
                width: 140px;
                height: 140px;
                border-radius: 999px;
                background: radial-gradient(circle, rgba(232,168,56,0.14), rgba(232,168,56,0));
            "></div>
            <div style="
                position: absolute;
                top: -70px;
                right: 120px;
                width: 160px;
                height: 160px;
                border-radius: 999px;
                background: radial-gradient(circle, rgba(255,255,255,0.05), rgba(255,255,255,0));
            "></div>

            <div style="
                display: flex;
                justify-content: space-between;
                align-items: center;
                gap: 24px;
                position: relative;
            ">
                <div style="display: flex; align-items: center; gap: 16px; min-width: 0; flex: 1;">
                    <div style="
                        width: 74px;
                        height: 74px;
                        border-radius: 18px;
                        background: rgba(255,255,255,0.08);
                        border: 1px solid rgba(255,255,255,0.14);
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        flex-shrink: 0;
                    ">
                        <img src="/logo.png" alt="Amwag" style="width: 52px; height: 52px; object-fit: contain;" />
                    </div>
                    <div style="min-width: 0;">
                        <div style="font-size: 11px; letter-spacing: 2px; text-transform: uppercase; color: rgba(232,168,56,0.95); font-weight: 700;">Amwag Travel</div>
                        <div style="margin-top: 6px; font-size: 28px; line-height: 1.1; color: #ffffff; font-weight: 800; font-family: Georgia, 'Times New Roman', serif;">Attendance Report</div>
                    </div>
                </div>

                <div style="
                    width: 300px;
                    flex-shrink: 0;
                    padding-left: 22px;
                    border-left: 1px solid rgba(255,255,255,0.14);
                ">
                    <div style="font-size: 10px; text-transform: uppercase; letter-spacing: 1.2px; color: rgba(226,232,240,0.62);">Report Date</div>
                    <div style="margin-top: 8px; font-size: 20px; font-weight: 800; color: #ffffff; line-height: 1.3;">${reportDateLabel}</div>
                    <div style="margin-top: 14px; display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
                        <div style="
                            padding-top: 10px;
                            border-top: 1px solid rgba(255,255,255,0.12);
                        ">
                            <div style="font-size: 10px; text-transform: uppercase; letter-spacing: 1px; color: rgba(226,232,240,0.58);">Exported</div>
                            <div style="margin-top: 6px; font-size: 11px; color: #f8fafc; font-weight: 700; line-height: 1.45;">${exportedOn}</div>
                        </div>
                        <div>
                            <div style="
                                padding-top: 10px;
                                border-top: 1px solid rgba(255,255,255,0.12);
                                text-align: right;
                            ">
                                <div style="font-size: 10px; text-transform: uppercase; letter-spacing: 1px; color: rgba(226,232,240,0.58);">Prepared By</div>
                                <div style="margin-top: 6px; font-size: 11px; color: #f8fafc; font-weight: 700; line-height: 1.45;">Amwag System</div>
                            </div>
                        </div>
                    </div>
                    <div style="margin-top: 14px; padding-top: 10px; border-top: 1px solid rgba(232,168,56,0.26); font-size: 10px; color: rgba(226,232,240,0.72); line-height: 1.6;">
                        ${filters.length > 0 ? filters.join(" • ") : "Full attendance dataset for the selected scope"}
                    </div>
                </div>
            </div>
        </div>

        <div style="
            margin-top: 14px;
            border-radius: 24px;
            overflow: hidden;
            background: rgba(255,255,255,0.9);
            border: 1px solid rgba(148,163,184,0.16);
            box-shadow: 0 14px 38px rgba(15,23,42,0.07);
            backdrop-filter: blur(10px);
        ">
            <div style="
                padding: 15px 20px;
                display: flex;
                align-items: center;
                justify-content: space-between;
                gap: 14px;
                background:
                    linear-gradient(90deg, rgba(15,39,66,0.98), rgba(22,56,94,0.94)),
                    linear-gradient(90deg, rgba(232,168,56,0.12), rgba(232,168,56,0));
            ">
                <div style="font-size: 11px; letter-spacing: 2px; text-transform: uppercase; color: rgba(232,168,56,0.95); font-weight: 800;">Attendance Details</div>
                <div style="font-size: 11px; color: rgba(226,232,240,0.82); font-weight: 700;">Total Records: ${records.length}</div>
            </div>

            <div style="padding: 14px 14px 16px;">
                <table style="width: 100%; border-collapse: separate; border-spacing: 0; table-layout: fixed;">
                    <thead>
                        <tr style="background: linear-gradient(180deg, #f8fafc, #eef2f7);">
                            <th style="padding: 12px 8px; width: 3%; text-align: center; font-size: 10px; color: #475569; font-weight: 800; letter-spacing: 0.8px; text-transform: uppercase; border-bottom: 1px solid rgba(148,163,184,0.24);">#</th>
                            <th style="padding: 12px 10px; width: 18%; text-align: left; font-size: 10px; color: #475569; font-weight: 800; letter-spacing: 0.8px; text-transform: uppercase; border-bottom: 1px solid rgba(148,163,184,0.24);">Employee</th>
                            <th style="padding: 12px 8px; width: 10%; text-align: center; font-size: 10px; color: #475569; font-weight: 800; letter-spacing: 0.8px; text-transform: uppercase; border-bottom: 1px solid rgba(148,163,184,0.24);">Branch</th>
                            <th style="padding: 12px 8px; width: 9%; text-align: center; font-size: 10px; color: #475569; font-weight: 800; letter-spacing: 0.8px; text-transform: uppercase; border-bottom: 1px solid rgba(148,163,184,0.24);">Date</th>
                            <th style="padding: 12px 8px; width: 7%; text-align: center; font-size: 10px; color: #475569; font-weight: 800; letter-spacing: 0.8px; text-transform: uppercase; border-bottom: 1px solid rgba(148,163,184,0.24);">Check In</th>
                            <th style="padding: 12px 8px; width: 7%; text-align: center; font-size: 10px; color: #475569; font-weight: 800; letter-spacing: 0.8px; text-transform: uppercase; border-bottom: 1px solid rgba(148,163,184,0.24);">Check Out</th>
                            <th style="padding: 12px 8px; width: 6%; text-align: center; font-size: 10px; color: #475569; font-weight: 800; letter-spacing: 0.8px; text-transform: uppercase; border-bottom: 1px solid rgba(148,163,184,0.24);">Late</th>
                            <th style="padding: 12px 8px; width: 7%; text-align: center; font-size: 10px; color: #475569; font-weight: 800; letter-spacing: 0.8px; text-transform: uppercase; border-bottom: 1px solid rgba(148,163,184,0.24);">Early Leave</th>
                            <th style="padding: 12px 8px; width: 7%; text-align: center; font-size: 10px; color: #475569; font-weight: 800; letter-spacing: 0.8px; text-transform: uppercase; border-bottom: 1px solid rgba(148,163,184,0.24);">Overtime</th>
                            <th style="padding: 12px 8px; width: 9%; text-align: center; font-size: 10px; color: #475569; font-weight: 800; letter-spacing: 0.8px; text-transform: uppercase; border-bottom: 1px solid rgba(148,163,184,0.24);">Status</th>
                            <th style="padding: 12px 8px; width: 8.5%; text-align: center; font-size: 10px; color: #475569; font-weight: 800; letter-spacing: 0.8px; text-transform: uppercase; border-bottom: 1px solid rgba(148,163,184,0.24);">Location In</th>
                            <th style="padding: 12px 8px; width: 8.5%; text-align: center; font-size: 10px; color: #475569; font-weight: 800; letter-spacing: 0.8px; text-transform: uppercase; border-bottom: 1px solid rgba(148,163,184,0.24);">Location Out</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${rows}
                    </tbody>
                </table>
            </div>
        </div>

        <div style="
            margin-top: 10px;
            padding: 10px 6px 2px;
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 14px;
        ">
            <div style="font-size: 11px; color: #0f2742; font-weight: 800; letter-spacing: 0.4px;">Amwag Travel</div>
            <div style="font-size: 11px; color: #475569; font-weight: 600;">تم التطوير بواسطة م. عبدالحميد الشوربجي</div>
        </div>
    </div>`;
}

async function renderAttendancePDF(
  records: AttendanceRecord[],
  options: ExportOptions,
  buildHtml: (
    exportableRecords: AttendanceRecord[],
    options: ExportOptions,
  ) => string,
  fileNamePrefix: string,
) {
  const exportableRecords = buildExportableRecords(records);

  // Create offscreen container
  const container = document.createElement("div");
  container.style.position = "fixed";
  container.style.left = "-9999px";
  container.style.top = "0";
  container.style.zIndex = "-1";
  container.dir = "ltr";
  container.style.direction = "ltr";
  container.style.textAlign = "left";
  container.innerHTML = buildHtml(exportableRecords, options);
  document.body.appendChild(container);

  const reportEl = container.querySelector("#pdf-report") as HTMLElement;

  // Wait for logo to load
  await new Promise<void>((resolve) => {
    const img = reportEl.querySelector("img");
    if (img && !img.complete) {
      img.onload = () => resolve();
      img.onerror = () => resolve();
    } else {
      resolve();
    }
  });

  await new Promise((r) => setTimeout(r, 200));

  try {
    // Capture at 4x scale with PNG for lossless, ultra-crisp text
    const canvas = await html2canvas(reportEl, {
      scale: 4,
      useCORS: true,
      allowTaint: true,
      backgroundColor: "#ffffff",
      logging: false,
      imageTimeout: 8000,
    });

    // Use PNG for lossless quality
    const imgData = canvas.toDataURL("image/png");
    const imgW = canvas.width;
    const imgH = canvas.height;

    // A4 Landscape
    const pdf = new jsPDF({
      orientation: "landscape",
      unit: "mm",
      format: "a4",
    });
    const pageW = pdf.internal.pageSize.getWidth();
    const pageH = pdf.internal.pageSize.getHeight();

    const margin = 5;
    const printW = pageW - margin * 2;
    const printH = (imgH * printW) / imgW;

    if (printH <= pageH - margin * 2) {
      pdf.addImage(imgData, "PNG", margin, margin, printW, printH);
    } else {
      // Multi-page slicing
      const pageContentH = pageH - margin * 2;
      const sourcePixelsPerPage = (pageContentH / printH) * imgH;
      let yOffset = 0;
      let pageNum = 0;

      while (yOffset < imgH) {
        if (pageNum > 0) pdf.addPage();

        const sliceH = Math.min(sourcePixelsPerPage, imgH - yOffset);
        const pageCanvas = document.createElement("canvas");
        pageCanvas.width = imgW;
        pageCanvas.height = sliceH;
        const ctx = pageCanvas.getContext("2d")!;
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, imgW, sliceH);
        ctx.drawImage(canvas, 0, yOffset, imgW, sliceH, 0, 0, imgW, sliceH);

        const sliceData = pageCanvas.toDataURL("image/png");
        const slicePrintH = (sliceH * printW) / imgW;
        pdf.addImage(sliceData, "PNG", margin, margin, printW, slicePrintH);

        yOffset += sliceH;
        pageNum++;
      }
    }

    const fileName = `${fileNamePrefix}_${new Date().toISOString().split("T")[0]}.pdf`;
    pdf.save(fileName);
  } finally {
    document.body.removeChild(container);
  }
}

/**
 * Generates the classic branded PDF.
 */
export async function exportAttendancePDF(
  records: AttendanceRecord[],
  options: ExportOptions = {},
) {
  return renderAttendancePDF(
    records,
    options,
    buildReportHTML,
    "amwag_attendance",
  );
}

/**
 * Generates the premium branded PDF.
 */
export async function exportAttendancePremiumPDF(
  records: AttendanceRecord[],
  options: ExportOptions = {},
) {
  return renderAttendancePDF(
    records,
    options,
    buildPremiumReportHTML,
    "amwag_attendance_premium",
  );
}
