import { NextRequest, NextResponse } from 'next/server';
import { authorizeInternalScheduler } from '@/lib/auth';
import { executeAttendanceFinalization } from '@/lib/attendanceFinalization';

export async function POST(request: NextRequest) {
    const auth = authorizeInternalScheduler(request);
    if (!auth.authorized) {
        return NextResponse.json(
            { success: false, error: auth.error },
            { status: auth.status }
        );
    }

    try {
        const result = await executeAttendanceFinalization();
        return NextResponse.json(result.body, { status: result.status });
    } catch (error) {
        console.error('Internal attendance finalization error:', error);
        return NextResponse.json(
            { success: false, error: 'Internal server error' },
            { status: 500 }
        );
    }
}
