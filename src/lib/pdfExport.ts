import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import type { AttendanceRecord } from '@/types';

interface ExportOptions {
    locale?: string;
    dateFilter?: string;
    statusFilter?: string;
    searchQuery?: string;
}

function formatTimePDF(timestamp: string | null): string {
    if (!timestamp) return '-';
    const date = new Date(timestamp);
    return date.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
    });
}

function formatMinutes(minutes: number): string {
    if (minutes <= 0) return '-';
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function statusLabel(status: string): string {
    switch (status) {
        case 'present': return 'Present';
        case 'late': return 'Late';
        case 'absent': return 'Absent';
        case 'missing_checkout': return 'Missing C/O';
        default: return status;
    }
}

function statusColor(status: string): string {
    switch (status) {
        case 'present': return '#059669';
        case 'late': return '#d97706';
        case 'absent': return '#dc2626';
        case 'missing_checkout': return '#ea580c';
        default: return '#64748b';
    }
}

/**
 * Builds a premium high-fidelity HTML report with navy header,
 * full table with both check-in and check-out locations.
 */
function buildReportHTML(
    records: AttendanceRecord[],
    options: ExportOptions
): string {
    const { dateFilter, statusFilter, searchQuery } = options;

    // Export timestamp
    const exportedOn = new Date().toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
    });

    // Report date is aligned with the date-first admin flow.
    const reportDateLabel = dateFilter
        ? new Date(dateFilter + 'T00:00:00').toLocaleDateString('en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
        })
        : 'Selected date required';

    const filters: string[] = [];
    if (statusFilter) filters.push(`Status: ${statusFilter}`);
    if (searchQuery) filters.push(`Search: ${searchQuery}`);

    // Column definitions — 12 columns including both locations
    const cols = [
        { header: '#', width: '3%', align: 'center' },
        { header: 'EMPLOYEE', width: '12%', align: 'left' },
        { header: 'BRANCH', width: '9%', align: 'center' },
        { header: 'DATE', width: '8%', align: 'center' },
        { header: 'CHECK IN', width: '7%', align: 'center' },
        { header: 'CHECK OUT', width: '7%', align: 'center' },
        { header: 'LATE', width: '6%', align: 'center' },
        { header: 'EARLY LEAVE', width: '7%', align: 'center' },
        { header: 'OVERTIME', width: '7%', align: 'center' },
        { header: 'STATUS', width: '7%', align: 'center' },
        { header: 'LOCATION IN', width: '13.5%', align: 'center' },
        { header: 'LOCATION OUT', width: '13.5%', align: 'center' },
    ];

    // Table header cells
    const thCells = cols.map((c, idx) => `
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
            ${idx < cols.length - 1 ? 'border-right: 1px solid rgba(255,255,255,0.12);' : ''}
        ">${c.header}</th>
    `).join('');

    // Table rows
    const rows = records.map((r, i) => {
        const bg = i % 2 === 0 ? '#ffffff' : '#f8fafc';
        const sc = statusColor(r.status);
        const lateVal = r.late_minutes || 0;
        const earlyVal = r.early_departure_minutes || 0;
        const otVal = r.overtime_minutes || 0;

        const tdStyle = (align: string = 'center', extra: string = '') => `
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
            <td style="${tdStyle('center', 'color: #94a3b8; font-size: 10px;')}">${i + 1}</td>
            <td style="${tdStyle('left', 'font-weight: 600; color: #0f172a;')}">${r.profiles?.full_name || '-'}</td>
            <td style="${tdStyle('center', 'font-size: 10px;')}">${r.profiles?.branch || '-'}</td>
            <td style="${tdStyle('center', 'font-size: 10px; font-family: monospace;')}">${r.date}</td>
            <td style="${tdStyle('center', 'font-size: 10px;')}">${formatTimePDF(r.check_in_time)}</td>
            <td style="${tdStyle('center', 'font-size: 10px;')}">${formatTimePDF(r.check_out_time)}</td>
            <td style="${tdStyle('center', `font-size: 10px; color: ${lateVal > 0 ? '#dc2626' : '#94a3b8'}; font-weight: ${lateVal > 0 ? '700' : '400'};`)}">${formatMinutes(lateVal)}</td>
            <td style="${tdStyle('center', `font-size: 10px; color: ${earlyVal > 0 ? '#dc2626' : '#94a3b8'}; font-weight: ${earlyVal > 0 ? '700' : '400'};`)}">${formatMinutes(earlyVal)}</td>
            <td style="${tdStyle('center', `font-size: 10px; color: ${otVal > 0 ? '#2563eb' : '#94a3b8'}; font-weight: ${otVal > 0 ? '700' : '400'};`)}">${formatMinutes(otVal)}</td>
            <td style="${tdStyle('center')}">
                <span style="
                    display: inline-block;
                    padding: 2px 8px;
                    border-radius: 4px;
                    font-size: 10px;
                    font-weight: 700;
                    color: ${sc};
                ">${statusLabel(r.status)}</span>
            </td>
            <td style="${tdStyle('center', 'font-size: 10px;')}">${r.check_in_location || '-'}</td>
            <td style="${tdStyle('center', 'font-size: 10px;')}">${r.check_out_location || '-'}</td>
        </tr>`;
    }).join('');

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
                ${filters.length > 0 ? `<div style="font-size: 9px; color: #93b4d4; margin-top: 3px;">${filters.join('  •  ')}</div>` : ''}
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
                تم التطوير بواسطة م. عبدالحميد الشوربجي
            </div>
            <div style="font-size: 10px; color: #94a3b8;">Page 1</div>
        </div>
    </div>`;
}

/**
 * Generates a high-quality branded PDF using html2canvas + jsPDF.
 * Renders at 4x scale with PNG format for maximum clarity.
 */
export async function exportAttendancePDF(
    records: AttendanceRecord[],
    options: ExportOptions = {}
) {
    // Create offscreen container
    const container = document.createElement('div');
    container.style.position = 'fixed';
    container.style.left = '-9999px';
    container.style.top = '0';
    container.style.zIndex = '-1';
    container.dir = 'ltr';
    container.style.direction = 'ltr';
    container.style.textAlign = 'left';
    container.innerHTML = buildReportHTML(records, options);
    document.body.appendChild(container);

    const reportEl = container.querySelector('#pdf-report') as HTMLElement;

    // Wait for logo to load
    await new Promise<void>((resolve) => {
        const img = reportEl.querySelector('img');
        if (img && !img.complete) {
            img.onload = () => resolve();
            img.onerror = () => resolve();
        } else {
            resolve();
        }
    });

    await new Promise(r => setTimeout(r, 200));

    try {
        // Capture at 4x scale with PNG for lossless, ultra-crisp text
        const canvas = await html2canvas(reportEl, {
            scale: 4,
            useCORS: true,
            allowTaint: true,
            backgroundColor: '#ffffff',
            logging: false,
            imageTimeout: 8000,
        });

        // Use PNG for lossless quality
        const imgData = canvas.toDataURL('image/png');
        const imgW = canvas.width;
        const imgH = canvas.height;

        // A4 Landscape
        const pdf = new jsPDF({
            orientation: 'landscape',
            unit: 'mm',
            format: 'a4',
        });
        const pageW = pdf.internal.pageSize.getWidth();
        const pageH = pdf.internal.pageSize.getHeight();

        const margin = 5;
        const printW = pageW - margin * 2;
        const printH = (imgH * printW) / imgW;

        if (printH <= pageH - margin * 2) {
            pdf.addImage(imgData, 'PNG', margin, margin, printW, printH);
        } else {
            // Multi-page slicing
            const pageContentH = pageH - margin * 2;
            const sourcePixelsPerPage = (pageContentH / printH) * imgH;
            let yOffset = 0;
            let pageNum = 0;

            while (yOffset < imgH) {
                if (pageNum > 0) pdf.addPage();

                const sliceH = Math.min(sourcePixelsPerPage, imgH - yOffset);
                const pageCanvas = document.createElement('canvas');
                pageCanvas.width = imgW;
                pageCanvas.height = sliceH;
                const ctx = pageCanvas.getContext('2d')!;
                ctx.fillStyle = '#ffffff';
                ctx.fillRect(0, 0, imgW, sliceH);
                ctx.drawImage(canvas, 0, yOffset, imgW, sliceH, 0, 0, imgW, sliceH);

                const sliceData = pageCanvas.toDataURL('image/png');
                const slicePrintH = (sliceH * printW) / imgW;
                pdf.addImage(sliceData, 'PNG', margin, margin, printW, slicePrintH);

                yOffset += sliceH;
                pageNum++;
            }
        }

        const fileName = `amwag_attendance_${new Date().toISOString().split('T')[0]}.pdf`;
        pdf.save(fileName);
    } finally {
        document.body.removeChild(container);
    }
}
