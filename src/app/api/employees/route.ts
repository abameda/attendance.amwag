import { randomUUID } from 'node:crypto';

import { desc, eq, sql } from 'drizzle-orm';
import { NextRequest, NextResponse } from 'next/server';

import { isAdmin } from '@/lib/auth';
import { hashPassword } from '@/lib/auth/password';
import { db } from '@/lib/db';
import { branches, users, type User } from '@/lib/db/schema';
import { normalizeEmployeeListParams } from '@/lib/employeeDirectory';

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

type EmployeeOptionRow = Pick<User, 'id' | 'email' | 'fullName' | 'branch' | 'branchId' | 'jobTitle'>;

function serializeEmployeeOption(user: EmployeeOptionRow) {
  return {
    id: user.id,
    email: user.email,
    full_name: user.fullName,
    branch: user.branch,
    branch_id: user.branchId,
    job_title: user.jobTitle,
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

function toCount(value: unknown): number {
  if (typeof value === 'number') {
    return value;
  }

  if (typeof value === 'bigint') {
    return Number(value);
  }

  if (typeof value === 'string') {
    return Number.parseInt(value, 10) || 0;
  }

  return 0;
}

async function getEmployeeStats() {
  const rows = await db
    .select({
      employees: sql<number>`count(*)`,
      branches: sql<number>`count(distinct ${users.branch})`,
      overtimeEnabled: sql<number>`sum(case when ${users.overtimeEnabled} = 1 then 1 else 0 end)`,
    })
    .from(users)
    .where(eq(users.role, 'employee'));

  const stats = rows[0];

  return {
    employees: toCount(stats?.employees),
    branches: toCount(stats?.branches),
    overtimeEnabled: toCount(stats?.overtimeEnabled),
  };
}

export async function GET(request: NextRequest) {
  try {
    const auth = await isAdmin(request);
    if (!auth.authorized) {
      return NextResponse.json(
        { success: false, error: auth.error },
        { status: auth.status }
      );
    }

    const searchParams = request.nextUrl.searchParams;
    const isOptionsRequest = searchParams.get('view') === 'options' || searchParams.get('options') === 'true';
    const isPagedRequest = searchParams.has('limit') || searchParams.has('page') || searchParams.has('pageSize');

    if (isOptionsRequest) {
      const rows = await db
        .select({
          id: users.id,
          email: users.email,
          fullName: users.fullName,
          branch: users.branch,
          branchId: users.branchId,
          jobTitle: users.jobTitle,
        })
        .from(users)
        .where(eq(users.role, 'employee'))
        .orderBy(desc(users.createdAt));

      return NextResponse.json({
        success: true,
        data: rows.map(serializeEmployeeOption),
      });
    }

    if (isPagedRequest) {
      const pagination = normalizeEmployeeListParams(searchParams);
      const includeStats = searchParams.get('includeStats') === 'true';

      const [rows, countRows, stats] = await Promise.all([
        db
          .select()
          .from(users)
          .where(eq(users.role, 'employee'))
          .orderBy(desc(users.createdAt))
          .limit(pagination.pageSize)
          .offset(pagination.offset),
        db
          .select({ total: sql<number>`count(*)` })
          .from(users)
          .where(eq(users.role, 'employee')),
        includeStats ? getEmployeeStats() : Promise.resolve(null),
      ]);

      const total = toCount(countRows[0]?.total);

      return NextResponse.json({
        success: true,
        data: rows.map(serializeEmployee),
        total,
        page: pagination.page,
        pageSize: pagination.pageSize,
        totalPages: Math.ceil(total / pagination.pageSize),
        ...(stats && { stats }),
      });
    }

    const rows = await db
      .select()
      .from(users)
      .where(eq(users.role, 'employee'))
      .orderBy(desc(users.createdAt));

    return NextResponse.json({
      success: true,
      data: rows.map(serializeEmployee),
    });
  } catch (error) {
    console.error('Get employees error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await isAdmin(request);
    if (!auth.authorized) {
      return NextResponse.json(
        { success: false, error: auth.error },
        { status: auth.status }
      );
    }

    const body = await request.json();
    const {
      email,
      password,
      full_name,
      branch_id,
      branch,
      job_title,
      shift_start,
      shift_end,
      off_day,
      overtime_enabled,
    } = body ?? {};

    if (!email || !password || !full_name) {
      return NextResponse.json(
        { success: false, error: 'Email, password, and full name are required' },
        { status: 400 }
      );
    }

    if (typeof password !== 'string' || password.length < 8) {
      return NextResponse.json(
        { success: false, error: 'Password must be at least 8 characters' },
        { status: 400 }
      );
    }

    const normalizedEmail = String(email).trim().toLowerCase();
    const existing = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, normalizedEmail))
      .limit(1);

    if (existing[0]) {
      return NextResponse.json(
        { success: false, error: 'Email already in use' },
        { status: 409 }
      );
    }

    const id = randomUUID();
    const passwordHash = await hashPassword(password);
    const branchAssignment = await resolveBranchAssignment({ branchId: branch_id, branchName: branch });
    if (!branchAssignment.ok) {
      return NextResponse.json({ success: false, error: branchAssignment.error }, { status: 400 });
    }

    await db.insert(users).values({
      id,
      email: normalizedEmail,
      passwordHash,
      fullName: String(full_name).trim(),
      role: 'employee',
      branch: branchAssignment.branchName,
      branchId: branchAssignment.branchId,
      jobTitle: job_title ? String(job_title).trim() : null,
      shiftStart: shift_start || null,
      shiftEnd: shift_end || null,
      offDay: off_day ? String(off_day).trim().toLowerCase() : null,
      overtimeEnabled: overtime_enabled === false ? 0 : 1,
    });

    return NextResponse.json({
      success: true,
      data: { id, email: normalizedEmail },
    });
  } catch (error) {
    console.error('Create employee error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
