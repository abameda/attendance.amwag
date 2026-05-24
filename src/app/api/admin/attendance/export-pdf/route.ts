import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { NextRequest, NextResponse } from 'next/server';
import React from 'react';

import { isAdminOrAccountant, getCurrentUser } from '@/lib/auth';
import {
  buildAttendanceReportData,
  buildPdfFilename,
  normalizeAttendanceReportLocale,
  type AttendanceReportFilters,
} from '@/lib/attendance-report';
import type { AttendanceRecord } from '@/types';

export const runtime = 'nodejs';

// Read logo once per module lifecycle (safe — no react-pdf involved)
const logoSrc = (() => {
  try {
    const buf = readFileSync(join(process.cwd(), 'public', 'logo.png'));
    return `data:image/png;base64,${buf.toString('base64')}`;
  } catch {
    return '';
  }
})();

export async function POST(request: NextRequest) {
  try {
    const auth = await isAdminOrAccountant(request);
    if (!auth.authorized) {
      return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
    }

    const body: { records?: AttendanceRecord[]; filters?: AttendanceReportFilters; locale?: unknown } =
      await request.json();

    const records = body.records ?? [];
    const filters = body.filters ?? {};
    const reportLocale = normalizeAttendanceReportLocale(body.locale);

    const currentUser = await getCurrentUser(request);
    const generatedBy = currentUser?.fullName ?? currentUser?.email ?? 'Admin';

    const reportData = buildAttendanceReportData(records, filters, generatedBy, reportLocale);

    // Dynamic imports keep @react-pdf/renderer out of webpack's static
    // analysis graph — the package is ESM-only with a WASM dependency
    // (yoga-layout) that hangs the webpack compiler if bundled.
    const [{ Font, renderToBuffer }, { AttendanceReportPdf }] = await Promise.all([
      import('@react-pdf/renderer'),
      import('@/components/pdf/AttendanceReportPdf'),
    ]);

    // @react-pdf/font loads a local font only when src is a plain filesystem
    // path — a file:// URL is treated as a remote source and fetched, which
    // Node's fetch rejects ("not implemented"), failing every Arabic report.
    const fontsDir = join(process.cwd(), 'public', 'fonts');
    Font.register({
      family: 'Amiri',
      fonts: [
        { src: join(fontsDir, 'Amiri-Regular.ttf') },
        { src: join(fontsDir, 'Amiri-Bold.ttf'), fontWeight: 'bold' },
      ],
    });

    const element = React.createElement(AttendanceReportPdf, {
      data: reportData,
      logoSrc,
      locale: reportLocale,
    });

    // AttendanceReportPdf renders a <Document> root, so this is valid at
    // runtime; the cast satisfies renderToBuffer's strict DocumentProps param.
    const buffer = await renderToBuffer(
      element as unknown as Parameters<typeof renderToBuffer>[0],
    );

    const filename = buildPdfFilename(filters, reportLocale);

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
}
