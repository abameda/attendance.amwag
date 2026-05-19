import { randomUUID } from 'node:crypto';

import { desc, eq } from 'drizzle-orm';
import { NextRequest, NextResponse } from 'next/server';

import { isAdmin } from '@/lib/auth';
import { db } from '@/lib/db';
import { branchAllowedIps, branches, type BranchIp } from '@/lib/db/schema';
import { normalizeIpRule, type IpRuleType } from '@/lib/ipValidation';

function serializeRule(rule: BranchIp) {
  return {
    id: rule.id,
    branch_name: rule.branchName,
    branch_id: rule.branchId,
    rule_type: rule.ruleType,
    value: rule.ipNetwork,
    label: rule.description ?? '',
    is_active: Boolean(rule.isActive),
    created_by: rule.createdBy,
    created_at: rule.createdAt,
    updated_at: rule.updatedAt,
  };
}

function parseRuleBody(body: Record<string, unknown>) {
  const branchId = typeof body.branch_id === 'string' ? body.branch_id.trim() : '';
  const branchName = typeof body.branch_name === 'string' ? body.branch_name.trim() : '';
  const ruleType = body.rule_type === 'cidr' ? 'cidr' : body.rule_type === 'exact_ip' ? 'exact_ip' : null;
  const value = typeof body.value === 'string' ? body.value.trim() : '';
  const label = typeof body.label === 'string' ? body.label.trim() : '';
  const isActive = body.is_active === undefined ? true : Boolean(body.is_active);

  return {
    branchId,
    branchName,
    ruleType: ruleType as IpRuleType | null,
    value,
    label,
    isActive,
  };
}

async function resolveRuleBranch(input: { branchId: string; branchName: string }) {
  if (input.branchId) {
    const rows = await db.select().from(branches).where(eq(branches.id, input.branchId)).limit(1);
    const branch = rows[0];
    if (!branch || !branch.isActive) {
      return { ok: false as const, error: 'Choose a valid branch' };
    }
    return { ok: true as const, branchId: branch.id, branchName: branch.name };
  }

  if (input.branchName) {
    const rows = await db.select().from(branches).where(eq(branches.name, input.branchName)).limit(1);
    const branch = rows[0];
    return {
      ok: true as const,
      branchId: branch?.isActive ? branch.id : null,
      branchName: input.branchName,
    };
  }

  return { ok: false as const, error: 'Choose a valid branch' };
}

export async function GET(request: NextRequest) {
  try {
    const auth = await isAdmin(request);
    if (!auth.authorized) {
      return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
    }

    const branch = request.nextUrl.searchParams.get('branch')?.trim();
    const branchRows = await db.select().from(branches).where(eq(branches.isActive, 1));
    const legacyBranchRows = await db
      .select({ branchName: branchAllowedIps.branchName })
      .from(branchAllowedIps);
    const branchNames = Array.from(
      new Set([...branchRows.map((row) => row.name), ...legacyBranchRows.map((row) => row.branchName).filter(Boolean)])
    );

    const rows = await db
      .select()
      .from(branchAllowedIps)
      .where(branch ? eq(branchAllowedIps.branchName, branch) : undefined)
      .orderBy(desc(branchAllowedIps.createdAt));

    return NextResponse.json({
      success: true,
      data: rows.map(serializeRule),
      branches: branchNames,
      branch_options: branchRows.map((row) => ({
        id: row.id,
        name: row.name,
        code: row.code,
        is_active: Boolean(row.isActive),
      })),
    });
  } catch (error) {
    console.error('Get branch IP rules error:', error);
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
      return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
    }

    const parsed = parseRuleBody((await request.json()) ?? {});

    const branchAssignment = await resolveRuleBranch(parsed);
    if (!branchAssignment.ok) {
      return NextResponse.json(
        { success: false, error: branchAssignment.error },
        { status: 400 }
      );
    }

    if (!parsed.ruleType) {
      return NextResponse.json(
        { success: false, error: 'Choose a valid rule type' },
        { status: 400 }
      );
    }

    const normalized = normalizeIpRule(parsed.ruleType, parsed.value);
    if (!normalized.ok) {
      return NextResponse.json({ success: false, error: normalized.error }, { status: 400 });
    }

    const id = randomUUID();
    await db.insert(branchAllowedIps).values({
      id,
      branchName: branchAssignment.branchName,
      branchId: branchAssignment.branchId,
      ruleType: parsed.ruleType,
      ipNetwork: normalized.value,
      description: parsed.label || null,
      isActive: parsed.isActive ? 1 : 0,
      createdBy: auth.userId ?? null,
    });

    const rows = await db.select().from(branchAllowedIps).where(eq(branchAllowedIps.id, id)).limit(1);

    return NextResponse.json({
      success: true,
      data: rows[0] ? serializeRule(rows[0]) : { id },
    });
  } catch (error) {
    console.error('Create branch IP rule error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
