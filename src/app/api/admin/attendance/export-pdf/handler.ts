import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { NextRequest, NextResponse } from 'next/server';
import React from 'react';

import type { AdminCheckResult } from '@/lib/auth';
import {
  buildAttendanceReportData,
  buildPdfFilename,
  type AttendanceReportData,
  type AttendanceReportFilters,
} from '@/lib/attendance-report';
import {
  isAttendancePdfRequestTooLarge,
  ATTENDANCE_PDF_CAP_ERROR,
  validateAttendancePdfExportCaps,
} from '@/lib/attendancePdfExportLimits';
import type { AttendanceRecord } from '@/types';

// Read logo once per module lifecycle (safe; no react-pdf involved).
const logoSrc = (() => {
  try {
    const buf = readFileSync(join(process.cwd(), 'public', 'logo.png'));
    return `data:image/png;base64,${buf.toString('base64')}`;
  } catch {
    return '';
  }
})();

type PdfExportUser = {
  fullName?: string | null;
  email?: string | null;
} | null;

export interface AttendancePdfExportDependencies {
  isAdminOrAccountant: (request: NextRequest) => Promise<AdminCheckResult>;
  getCurrentUser: (request: NextRequest) => Promise<PdfExportUser>;
  renderPdf: (data: AttendanceReportData) => Promise<Buffer | Uint8Array>;
}

export async function renderAttendancePdf(data: AttendanceReportData): Promise<Buffer | Uint8Array> {
  // Dynamic imports keep @react-pdf/renderer out of webpack's static
  // analysis graph. The package is ESM-only with a WASM dependency that hangs
  // the webpack compiler if bundled.
  const [{ Font, renderToBuffer }, { AttendanceReportPdf }] = await Promise.all([
    import('@react-pdf/renderer'),
    import('@/components/pdf/AttendanceReportPdf'),
  ]);

  // @react-pdf/font loads a local font only when src is a plain filesystem
  // path. A file:// URL is treated as remote and rejected by Node fetch.
  const fontsDir = join(process.cwd(), 'public', 'fonts');
  Font.register({
    family: 'Amiri',
    fonts: [
      { src: join(fontsDir, 'Amiri-Regular.ttf') },
      { src: join(fontsDir, 'Amiri-Bold.ttf'), fontWeight: 'bold' },
    ],
  });

  const element = React.createElement(AttendanceReportPdf, {
    data,
    logoSrc,
  });

  // AttendanceReportPdf renders a <Document> root, so this is valid at
  // runtime; the cast satisfies renderToBuffer's strict DocumentProps param.
  return renderToBuffer(element as unknown as Parameters<typeof renderToBuffer>[0]);
}

export function createAttendancePdfExportHandler(dependencies: AttendancePdfExportDependencies) {
  return async function POST(request: NextRequest) {
    try {
      const auth = await dependencies.isAdminOrAccountant(request);
      if (!auth.authorized) {
        return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
      }

      if (isAttendancePdfRequestTooLarge(request.headers.get('content-length'))) {
        return NextResponse.json(
          { success: false, error: ATTENDANCE_PDF_CAP_ERROR },
          { status: 413 },
        );
      }

      const body: { records?: AttendanceRecord[]; filters?: AttendanceReportFilters } =
        await request.json();

      const records = Array.isArray(body.records) ? body.records : [];
      const filters = body.filters ?? {};
      const capResult = validateAttendancePdfExportCaps(records, filters);

      if (!capResult.allowed) {
        return NextResponse.json(
          { success: false, error: capResult.error },
          { status: capResult.status },
        );
      }

      const currentUser = await dependencies.getCurrentUser(request);
      const generatedBy = currentUser?.fullName ?? currentUser?.email ?? 'Admin';

      const reportData = buildAttendanceReportData(records, filters, generatedBy);
      const buffer = await dependencies.renderPdf(reportData);
      const filename = buildPdfFilename(filters);

      return new NextResponse(new Uint8Array(buffer), {
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename="${filename}"`,
          'Cache-Control': 'no-store',
        },
      });
    } catch (error) {
      console.error('PDF export error:', error);
      return NextResponse.json({ success: false, error: 'Failed to generate PDF' }, { status: 500 });
    }
  };
}
