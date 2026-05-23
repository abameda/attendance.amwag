import type { AttendanceRecord } from '@/types';
import type { AttendanceReportFilters } from '@/lib/attendance-report';

export async function downloadAttendanceReportPdf(
  records: AttendanceRecord[],
  filters: AttendanceReportFilters,
): Promise<void> {
  const response = await fetch('/api/admin/attendance/export-pdf', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ records, filters }),
  });

  if (!response.ok) {
    let message = 'Failed to generate PDF';
    try {
      const json: { error?: string } = await response.json();
      if (json.error) message = json.error;
    } catch {
      // ignore parse errors
    }
    throw new Error(message);
  }

  const blob = await response.blob();
  const url = URL.createObjectURL(blob);

  const filename =
    response.headers.get('Content-Disposition')?.match(/filename="(.+?)"/)?.[1] ??
    'Amwag_Attendance_Report.pdf';

  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.style.display = 'none';
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);

  // Release after a short delay to allow the download to start
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
