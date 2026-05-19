import { and, eq } from 'drizzle-orm';
import { NextRequest, NextResponse } from 'next/server';

import { isAdmin } from '@/lib/auth';
import { db } from '@/lib/db';
import { attendance, branches, sessions, users, type User } from '@/lib/db/schema';

function serializeEmployee(user: User) {
  return {
    id: user.id,
    email: user.email,
    full_name: user.fullName,
    role: user.role,
    branch: user.branch,
    branch_id: user.branchId,
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

async function resolveBranchAssignment(input: { branchId?: unknown; branchName?: unknown }) {
  const branchId = typeof input.branchId === 'string' ? input.branchId.trim() : '';
  const branchName = typeof input.branchName === 'string' ? input.branchName.trim() : '';

  if (branchId) {
    const rows = await db.select().from(branches).where(eq(branches.id, branchId)).limit(1);
    const branch = rows[0];
    if (!branch || !branch.isActive) {
      return { ok: false as const, error: 'Choose an active branch' };
    }
    return { ok: true as const, branchId: branch.id, branchName: branch.name };
  }

  if (branchName) {
    const rows = await db.select().from(branches).where(eq(branches.name, branchName)).limit(1);
    const branch = rows[0];
    return {
      ok: true as const,
      branchId: branch?.isActive ? branch.id : null,
      branchName,
    };
  }

  return { ok: true as const, branchId: null, branchName: null };
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
      branch_id,
      branch,
      job_title,
      shift_start,
      shift_end,
      off_day,
      overtime_enabled,
      must_change_password,
    } = body ?? {};

    if (!full_name) {
      return NextResponse.json(
        { success: false, error: 'Full name is required' },
        { status: 400 }
      );
    }

    const branchAssignment = await resolveBranchAssignment({ branchId: branch_id, branchName: branch });
    if (!branchAssignment.ok) {
      return NextResponse.json({ success: false, error: branchAssignment.error }, { status: 400 });
    }

    await db
      .update(users)
      .set({
        fullName: String(full_name).trim(),
        branch: branchAssignment.branchName,
        branchId: branchAssignment.branchId,
        jobTitle: job_title ? String(job_title).trim() : null,
        shiftStart: shift_start || null,
        shiftEnd: shift_end || null,
        offDay: off_day ? String(off_day).trim().toLowerCase() : null,
        overtimeEnabled: overtime_enabled === false ? 0 : 1,
        ...(must_change_password !== undefined && { mustChangePassword: must_change_password ? 1 : 0 }),
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
