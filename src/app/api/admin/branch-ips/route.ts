import { randomUUID } from 'node:crypto';

import { desc, eq } from 'drizzle-orm';
import { NextRequest, NextResponse } from 'next/server';

import { isAdmin } from '@/lib/auth';
import { BRANCHES } from '@/lib/branches';
import { db } from '@/lib/db';
import { branchAllowedIps, type BranchIp } from '@/lib/db/schema';
import { normalizeIpRule, type IpRuleType } from '@/lib/ipValidation';

function serializeRule(rule: BranchIp) {
  return {
    id: rule.id,
    branch_name: rule.branchName,
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
  const branchName = typeof body.branch_name === 'string' ? body.branch_name.trim() : '';
  const ruleType = body.rule_type === 'cidr' ? 'cidr' : body.rule_type === 'exact_ip' ? 'exact_ip' : null;
  const value = typeof body.value === 'string' ? body.value.trim() : '';
  const label = typeof body.label === 'string' ? body.label.trim() : '';
  const isActive = body.is_active === undefined ? true : Boolean(body.is_active);

  return {
    branchName,
    ruleType: ruleType as IpRuleType | null,
    value,
    label,
    isActive,
  };
}

export async function GET(request: NextRequest) {
  try {
    const auth = await isAdmin(request);
    if (!auth.authorized) {
      return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
    }

    const branch = request.nextUrl.searchParams.get('branch')?.trim();
    const branchRows = await db
      .select({ branchName: branchAllowedIps.branchName })
      .from(branchAllowedIps);
    const branches = Array.from(
      new Set([...BRANCHES, ...branchRows.map((row) => row.branchName).filter(Boolean)])
    );

    const rows = await db
      .select()
      .from(branchAllowedIps)
      .where(branch ? eq(branchAllowedIps.branchName, branch) : undefined)
      .orderBy(desc(branchAllowedIps.createdAt));

    return NextResponse.json({
      success: true,
      data: rows.map(serializeRule),
      branches,
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

    if (!parsed.branchName) {
      return NextResponse.json(
        { success: false, error: 'Choose a valid branch' },
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
      branchName: parsed.branchName,
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
