import { and, desc, eq, isNull, or, sql } from 'drizzle-orm';
import { NextRequest, NextResponse } from 'next/server';

import { isAdmin } from '@/lib/auth';
import { buildBranchCode, normalizeBranchName } from '@/lib/branchDirectory';
import { db } from '@/lib/db';
import { attendance, branchAllowedIps, branches, users, type Branch } from '@/lib/db/schema';
import { getEgyptDate } from '@/lib/timezone';

function serializeBranch(branch: Branch) {
  return {
    id: branch.id,
    name: branch.name,
    code: branch.code,
    address: branch.address,
    is_active: Boolean(branch.isActive),
    created_at: branch.createdAt,
    updated_at: branch.updatedAt,
  };
}

function normalizeBranchCode(value: string) {
  return value.trim().replace(/\s+/g, '-').replace(/[^a-zA-Z0-9-]/g, '').toUpperCase().slice(0, 64);
}

function branchEmployeePredicate(branch: Branch) {
  return and(
    eq(users.role, 'employee'),
    or(eq(users.branchId, branch.id), and(isNull(users.branchId), eq(users.branch, branch.name)))!
  );
}

function branchIpPredicate(branch: Branch) {
  return or(
    eq(branchAllowedIps.branchId, branch.id),
    and(isNull(branchAllowedIps.branchId), eq(branchAllowedIps.branchName, branch.name))
  )!;
}

async function findBranch(id: string) {
  const rows = await db.select().from(branches).where(eq(branches.id, id)).limit(1);
  return rows[0] ?? null;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await isAdmin(request);
    if (!auth.authorized) {
      return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
    }

    const { id } = await params;
    const branch = await findBranch(id);
    if (!branch) {
      return NextResponse.json({ success: false, error: 'Branch not found' }, { status: 404 });
    }

    const today = new Date(`${getEgyptDate()}T00:00:00.000Z`);
    const employeeWhere = branchEmployeePredicate(branch);
    const [employeeRows, ipRows, summaryRows] = await Promise.all([
      db
        .select({
          id: users.id,
          email: users.email,
          fullName: users.fullName,
          branch: users.branch,
          branchId: users.branchId,
          jobTitle: users.jobTitle,
          shiftStart: users.shiftStart,
          shiftEnd: users.shiftEnd,
          offDay: users.offDay,
        })
        .from(users)
        .where(employeeWhere)
        .orderBy(desc(users.createdAt)),
      db
        .select({
          id: branchAllowedIps.id,
          branchName: branchAllowedIps.branchName,
          branchId: branchAllowedIps.branchId,
          ruleType: branchAllowedIps.ruleType,
          value: branchAllowedIps.ipNetwork,
          label: branchAllowedIps.description,
          isActive: branchAllowedIps.isActive,
        })
        .from(branchAllowedIps)
        .where(branchIpPredicate(branch))
        .orderBy(desc(branchAllowedIps.createdAt)),
      db
        .select({
          present: sql<number>`sum(case when ${attendance.status} = 'present' then 1 else 0 end)`.mapWith(Number),
          late: sql<number>`sum(case when ${attendance.status} = 'late' then 1 else 0 end)`.mapWith(Number),
          absent: sql<number>`sum(case when ${attendance.status} = 'absent' then 1 else 0 end)`.mapWith(Number),
          missingCheckout:
            sql<number>`sum(case when ${attendance.status} = 'missing_checkout' then 1 else 0 end)`.mapWith(Number),
        })
        .from(attendance)
        .leftJoin(users, eq(attendance.userId, users.id))
        .where(and(eq(attendance.date, today), employeeWhere)),
    ]);

    const summary = summaryRows[0];

    return NextResponse.json({
      success: true,
      data: {
        ...serializeBranch(branch),
        employee_count: employeeRows.length,
        attendance_summary: {
          present: summary?.present ?? 0,
          late: summary?.late ?? 0,
          absent: summary?.absent ?? 0,
          missing_checkout: summary?.missingCheckout ?? 0,
        },
        employees: employeeRows.map((employee) => ({
          id: employee.id,
          email: employee.email,
          full_name: employee.fullName,
          branch: employee.branch,
          branch_id: employee.branchId,
          job_title: employee.jobTitle,
          shift_start: employee.shiftStart,
          shift_end: employee.shiftEnd,
          off_day: employee.offDay,
        })),
        ip_rules: ipRows.map((rule) => ({
          id: rule.id,
          branch_name: rule.branchName,
          branch_id: rule.branchId,
          rule_type: rule.ruleType,
          value: rule.value,
          label: rule.label ?? '',
          is_active: Boolean(rule.isActive),
        })),
      },
    });
  } catch (error) {
    console.error('Get branch detail error:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await isAdmin(request);
    if (!auth.authorized) {
      return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
    }

    const { id } = await params;
    const existing = await findBranch(id);
    if (!existing) {
      return NextResponse.json({ success: false, error: 'Branch not found' }, { status: 404 });
    }

    const body = ((await request.json()) ?? {}) as Record<string, unknown>;
    const nextName =
      typeof body.name === 'string' ? normalizeBranchName(body.name) : existing.name;
    const nextCode =
      typeof body.code === 'string' && body.code.trim()
        ? normalizeBranchCode(body.code)
        : existing.code || buildBranchCode(nextName);
    const nextAddress =
      typeof body.address === 'string' ? body.address.trim() : existing.address ?? '';
    const nextIsActive =
      body.is_active === undefined ? Boolean(existing.isActive) : Boolean(body.is_active);

    if (!nextName) {
      return NextResponse.json({ success: false, error: 'Branch name is required' }, { status: 400 });
    }

    const duplicates = await db
      .select({ id: branches.id })
      .from(branches)
      .where(or(eq(branches.name, nextName), eq(branches.code, nextCode)))
      .limit(2);

    if (duplicates.some((row) => row.id !== id)) {
      return NextResponse.json({ success: false, error: 'Branch name or code already exists' }, { status: 409 });
    }

    await db.transaction(async (tx) => {
      await tx
        .update(branches)
        .set({
          name: nextName,
          code: nextCode,
          address: nextAddress || null,
          isActive: nextIsActive ? 1 : 0,
          updatedAt: new Date(),
        })
        .where(eq(branches.id, id));

      if (nextName !== existing.name) {
        await tx
          .update(users)
          .set({ branch: nextName, updatedAt: new Date() })
          .where(eq(users.branchId, id));
        await tx
          .update(branchAllowedIps)
          .set({ branchName: nextName, updatedAt: new Date() })
          .where(eq(branchAllowedIps.branchId, id));
      }
    });

    const updated = await findBranch(id);
    return NextResponse.json({ success: true, data: updated ? serializeBranch(updated) : null });
  } catch (error) {
    console.error('Update branch error:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
