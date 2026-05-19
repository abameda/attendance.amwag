import { randomUUID } from 'node:crypto';

import { asc, eq, or } from 'drizzle-orm';
import { NextRequest, NextResponse } from 'next/server';

import { isAdmin } from '@/lib/auth';
import { BRANCHES as DEFAULT_BRANCH_NAMES } from '@/lib/branches';
import { buildBranchCode, mergeBranchNameSources, normalizeBranchName } from '@/lib/branchDirectory';
import { db } from '@/lib/db';
import { branchAllowedIps, branches, users, type Branch } from '@/lib/db/schema';

function serializeBranch(
  branch: Branch,
  counts?: {
    employees?: number;
    ipRules?: number;
  }
) {
  return {
    id: branch.id,
    name: branch.name,
    code: branch.code,
    address: branch.address,
    is_active: Boolean(branch.isActive),
    created_at: branch.createdAt,
    updated_at: branch.updatedAt,
    employee_count: counts?.employees ?? 0,
    ip_rule_count: counts?.ipRules ?? 0,
  };
}

function normalizeBranchCode(value: string) {
  return value.trim().replace(/\s+/g, '-').replace(/[^a-zA-Z0-9-]/g, '').toUpperCase().slice(0, 64);
}

async function ensureUniqueCode(baseCode: string) {
  let code = baseCode || `BRANCH-${randomUUID().slice(0, 8).toUpperCase()}`;
  let suffix = 2;

  while (true) {
    const existing = await db
      .select({ id: branches.id })
      .from(branches)
      .where(eq(branches.code, code))
      .limit(1);

    if (!existing[0]) return code;

    const suffixText = `-${suffix}`;
    code = `${baseCode.slice(0, Math.max(1, 64 - suffixText.length))}${suffixText}`;
    suffix += 1;
  }
}

export async function GET(request: NextRequest) {
  try {
    const auth = await isAdmin(request);
    if (!auth.authorized) {
      return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
    }

    const activeOnly = request.nextUrl.searchParams.get('active') === 'true';
    const branchRows = await db
      .select()
      .from(branches)
      .where(activeOnly ? eq(branches.isActive, 1) : undefined)
      .orderBy(asc(branches.name));

    const [employeeRows, ipRows] = await Promise.all([
      db
        .select({ branchId: users.branchId, branchName: users.branch })
        .from(users)
        .where(eq(users.role, 'employee')),
      db.select({ branchId: branchAllowedIps.branchId, branchName: branchAllowedIps.branchName }).from(branchAllowedIps),
    ]);

    const employeeCounts = new Map<string, number>();
    const ipCounts = new Map<string, number>();
    for (const branch of branchRows) {
      const employees = employeeRows.filter(
        (employee) =>
          employee.branchId === branch.id ||
          (!employee.branchId && normalizeBranchName(employee.branchName) === branch.name)
      ).length;
      const ipRules = ipRows.filter(
        (rule) =>
          rule.branchId === branch.id ||
          (!rule.branchId && normalizeBranchName(rule.branchName) === branch.name)
      ).length;
      employeeCounts.set(branch.id, employees);
      ipCounts.set(branch.id, ipRules);
    }

    return NextResponse.json({
      success: true,
      data: branchRows.map((branch) =>
        serializeBranch(branch, {
          employees: employeeCounts.get(branch.id),
          ipRules: ipCounts.get(branch.id),
        })
      ),
    });
  } catch (error) {
    console.error('Get branches error:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await isAdmin(request);
    if (!auth.authorized) {
      return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
    }

    const body = ((await request.json()) ?? {}) as Record<string, unknown>;
    const name = normalizeBranchName(typeof body.name === 'string' ? body.name : '');
    const explicitCode = typeof body.code === 'string' ? normalizeBranchCode(body.code) : '';
    const address = typeof body.address === 'string' ? body.address.trim() : '';
    const isActive = body.is_active === undefined ? true : Boolean(body.is_active);

    if (!name) {
      return NextResponse.json({ success: false, error: 'Branch name is required' }, { status: 400 });
    }

    const existingRows = await db
      .select({ id: branches.id })
      .from(branches)
      .where(or(eq(branches.name, name), eq(branches.code, explicitCode || buildBranchCode(name))))
      .limit(1);

    if (existingRows[0]) {
      return NextResponse.json({ success: false, error: 'Branch already exists' }, { status: 409 });
    }

    const id = randomUUID();
    const code = await ensureUniqueCode(explicitCode || buildBranchCode(name));
    await db.insert(branches).values({
      id,
      name,
      code,
      address: address || null,
      isActive: isActive ? 1 : 0,
    });

    const rows = await db.select().from(branches).where(eq(branches.id, id)).limit(1);
    return NextResponse.json({ success: true, data: rows[0] ? serializeBranch(rows[0]) : { id } });
  } catch (error) {
    console.error('Create branch error:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const auth = await isAdmin(request);
    if (!auth.authorized) {
      return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
    }

    const [userBranchRows, ipBranchRows] = await Promise.all([
      db.select({ branchName: users.branch }).from(users),
      db.select({ branchName: branchAllowedIps.branchName }).from(branchAllowedIps),
    ]);
    const names = mergeBranchNameSources([
      userBranchRows.map((row) => row.branchName),
      ipBranchRows.map((row) => row.branchName),
      [...DEFAULT_BRANCH_NAMES],
    ]);

    for (const name of names) {
      const existing = await db.select({ id: branches.id }).from(branches).where(eq(branches.name, name)).limit(1);
      if (existing[0]) continue;

      await db.insert(branches).values({
        id: randomUUID(),
        name,
        code: await ensureUniqueCode(buildBranchCode(name)),
      });
    }

    return GET(request);
  } catch (error) {
    console.error('Backfill branches error:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
