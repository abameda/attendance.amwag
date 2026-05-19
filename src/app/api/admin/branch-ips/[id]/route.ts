import { eq } from 'drizzle-orm';
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
    const existingRows = await db
      .select()
      .from(branchAllowedIps)
      .where(eq(branchAllowedIps.id, id))
      .limit(1);

    const existing = existingRows[0];
    if (!existing) {
      return NextResponse.json({ success: false, error: 'Branch IP rule not found' }, { status: 404 });
    }

    const body = ((await request.json()) ?? {}) as Record<string, unknown>;
    const keys = Object.keys(body);
    const statusOnlyUpdate = keys.length === 1 && keys[0] === 'is_active';
    if (statusOnlyUpdate && body.is_active === false) {
      await db
        .update(branchAllowedIps)
        .set({ isActive: 0, updatedAt: new Date() })
        .where(eq(branchAllowedIps.id, id));

      const rows = await db.select().from(branchAllowedIps).where(eq(branchAllowedIps.id, id)).limit(1);

      return NextResponse.json({
        success: true,
        data: rows[0] ? serializeRule(rows[0]) : null,
      });
    }

    const nextBranchName =
      typeof body.branch_name === 'string' ? body.branch_name.trim() : existing.branchName;
    const nextBranchId =
      typeof body.branch_id === 'string' ? body.branch_id.trim() : existing.branchId ?? '';
    const nextRuleType =
      body.rule_type === 'cidr' || body.rule_type === 'exact_ip'
        ? (body.rule_type as IpRuleType)
        : existing.ruleType;
    const nextValue = typeof body.value === 'string' ? body.value.trim() : existing.ipNetwork;
    const nextLabel =
      typeof body.label === 'string' ? body.label.trim() : existing.description ?? '';
    const nextIsActive =
      body.is_active === undefined ? Boolean(existing.isActive) : Boolean(body.is_active);

    const branchAssignment = await resolveRuleBranch({ branchId: nextBranchId, branchName: nextBranchName });
    if (!branchAssignment.ok) {
      return NextResponse.json(
        { success: false, error: branchAssignment.error },
        { status: 400 }
      );
    }

    const normalized = normalizeIpRule(nextRuleType, nextValue);
    if (!normalized.ok) {
      return NextResponse.json({ success: false, error: normalized.error }, { status: 400 });
    }

    await db
      .update(branchAllowedIps)
      .set({
        branchName: branchAssignment.branchName,
        branchId: branchAssignment.branchId,
        ruleType: nextRuleType,
        ipNetwork: normalized.value,
        description: nextLabel || null,
        isActive: nextIsActive ? 1 : 0,
        updatedAt: new Date(),
      })
      .where(eq(branchAllowedIps.id, id));

    const rows = await db.select().from(branchAllowedIps).where(eq(branchAllowedIps.id, id)).limit(1);

    return NextResponse.json({
      success: true,
      data: rows[0] ? serializeRule(rows[0]) : null,
    });
  } catch (error) {
    console.error('Update branch IP rule error:', error);
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
      return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
    }

    const { id } = await params;
    await db.delete(branchAllowedIps).where(eq(branchAllowedIps.id, id));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete branch IP rule error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
