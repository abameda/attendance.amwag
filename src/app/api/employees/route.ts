import { randomUUID } from 'node:crypto';

import { desc, eq } from 'drizzle-orm';
import { NextRequest, NextResponse } from 'next/server';

import { isAdmin } from '@/lib/auth';
import { hashPassword } from '@/lib/auth/password';
import { db } from '@/lib/db';
import { users, type User } from '@/lib/db/schema';

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

export async function GET(request: NextRequest) {
  try {
    const auth = await isAdmin(request);
    if (!auth.authorized) {
      return NextResponse.json(
        { success: false, error: auth.error },
        { status: auth.status }
      );
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

    await db.insert(users).values({
      id,
      email: normalizedEmail,
      passwordHash,
      fullName: String(full_name).trim(),
      role: 'employee',
      branch: branch ? String(branch).trim() : null,
      jobTitle: job_title ? String(job_title).trim() : null,
      shiftStart: shift_start || null,
      shiftEnd: shift_end || null,
      offDay: off_day ? String(off_day).trim().toLowerCase() : null,
      overtimeEnabled: overtime_enabled === false ? 0 : 1,
      mustChangePassword: 1,
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
