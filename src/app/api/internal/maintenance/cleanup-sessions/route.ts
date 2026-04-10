import { NextRequest, NextResponse } from 'next/server';

import { authorizeInternalScheduler } from '@/lib/auth';
import { cleanupExpiredSessions } from '@/lib/auth/session';

export async function POST(request: NextRequest) {
  const guard = authorizeInternalScheduler(request);
  if (!guard.authorized) {
    return NextResponse.json(
      { success: false, error: guard.error },
      { status: guard.status }
    );
  }

  try {
    const removed = await cleanupExpiredSessions();
    return NextResponse.json({ success: true, data: { removed } });
  } catch (error) {
    console.error('cleanup-sessions cron error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
