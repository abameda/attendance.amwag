import { and, eq } from 'drizzle-orm';
import { NextRequest, NextResponse } from 'next/server';

import { isAdmin } from '@/lib/auth';
import { db } from '@/lib/db';
import { attendance, sessions, users, type User } from '@/lib/db/schema';

function serializeEmployee(user: User) {
  return {
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
    created_at: user.createdAt,
    updated_at: user.updatedAt,
  };
}

async function findEmployee(id: string): Promise<User | null> {
  const rows = await db
    .select()
    .from(users)
    .where(and(eq(users.id, id), eq(users.role, 'employee')))
    .limit(1);

  return rows[0] ?? null;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await isAdmin(request);
    if (!auth.authorized) {
      return NextResponse.json(
        { success: false, error: auth.error },
        { status: auth.status }
      );
    }

    const { id } = await params;
    const employee = await findEmployee(id);

    if (!employee) {
      return NextResponse.json(
        { success: false, error: 'Employee not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, data: serializeEmployee(employee) });
  } catch (error) {
    console.error('Get employee error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await isAdmin(request);
    if (!auth.authorized) {
      return NextResponse.json(
        { success: false, error: auth.error },
        { status: auth.status }
      );
    }

    const { id } = await params;
    const existing = await findEmployee(id);

    if (!existing) {
      return NextResponse.json(
        { success: false, error: 'Employee not found' },
        { status: 404 }
      );
    }

    const body = await request.json();
    const {
      full_name,
      branch,
      job_title,
      shift_start,
      shift_end,
      off_day,
      overtime_enabled,
    } = body ?? {};

    if (!full_name) {
      return NextResponse.json(
        { success: false, error: 'Full name is required' },
        { status: 400 }
      );
    }

    await db
      .update(users)
      .set({
        fullName: String(full_name).trim(),
        branch: branch ? String(branch).trim() : null,
        jobTitle: job_title ? String(job_title).trim() : null,
        shiftStart: shift_start || null,
        shiftEnd: shift_end || null,
        offDay: off_day ? String(off_day).trim().toLowerCase() : null,
        overtimeEnabled: overtime_enabled === false ? 0 : 1,
        updatedAt: new Date(),
      })
      .where(and(eq(users.id, id), eq(users.role, 'employee')));

    const updated = await findEmployee(id);

    return NextResponse.json({
      success: true,
      data: updated ? serializeEmployee(updated) : null,
    });
  } catch (error) {
    console.error('Update employee error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await isAdmin(request);
    if (!auth.authorized) {
      return NextResponse.json(
        { success: false, error: auth.error },
        { status: auth.status }
      );
    }

    const { id } = await params;
    const existing = await findEmployee(id);

    if (!existing) {
      return NextResponse.json(
        { success: false, error: 'Employee not found' },
        { status: 404 }
      );
    }

    await db.transaction(async (tx) => {
      await tx.delete(attendance).where(eq(attendance.userId, id));
      await tx.delete(sessions).where(eq(sessions.userId, id));
      await tx.delete(users).where(and(eq(users.id, id), eq(users.role, 'employee')));
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete employee error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
