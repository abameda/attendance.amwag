import { NextRequest, NextResponse } from 'next/server';

import { authorizeInternalScheduler } from '@/lib/auth';
import { markAbsentForEndedShifts } from '@/lib/attendanceFinalization';

export async function POST(request: NextRequest) {
  const guard = authorizeInternalScheduler(request);
  if (!guard.authorized) {
    return NextResponse.json(
      { success: false, error: guard.error },
      { status: guard.status }
    );
  }

  try {
    const result = await markAbsentForEndedShifts();
    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    console.error('mark-absent cron error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
