import { NextRequest, NextResponse } from 'next/server';

import { getCurrentUser } from '@/lib/auth';

export async function GET(request: NextRequest) {
  const user = await getCurrentUser(request);

  if (!user) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized' },
      { status: 401 }
    );
  }

  return NextResponse.json({
    success: true,
    data: {
      id: user.id,
      email: user.email,
      full_name: user.fullName,
      role: user.role,
      branch: user.branch,
      job_title: user.jobTitle,
      shift_start: user.shiftStart,
      shift_end: user.shiftEnd,
      off_day: user.offDay,
      overtime_enabled: Boolean(user.overtimeEnabled),
      must_change_password: Boolean(user.mustChangePassword),
      created_at: user.createdAt.toISOString(),
      updated_at: user.updatedAt.toISOString(),
    },
  });
}
