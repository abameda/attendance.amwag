import { eq } from 'drizzle-orm';
import { NextRequest, NextResponse } from 'next/server';

import { isAdmin } from '@/lib/auth';
import { db } from '@/lib/db';
import { globalSettings, type GlobalSettings } from '@/lib/db/schema';

function serializeSettings(settings?: GlobalSettings) {
  return {
    early_checkin_minutes: settings?.earlyCheckinMinutes ?? 60,
    late_grace_minutes: settings?.lateGraceMinutes ?? 0,
    checkout_window_minutes: settings?.checkoutWindowMinutes ?? 60,
    max_overtime_minutes: settings?.maxOvertimeMinutes ?? 180,
    updated_at: settings?.updatedAt ?? null,
  };
}

function parseSettings(body: Record<string, unknown>) {
  return {
    earlyCheckinMinutes: Number(body.early_checkin_minutes),
    lateGraceMinutes: Number(body.late_grace_minutes),
    checkoutWindowMinutes: Number(body.checkout_window_minutes),
    maxOvertimeMinutes: Number(body.max_overtime_minutes),
  };
}

function isValidSettings(settings: ReturnType<typeof parseSettings>) {
  return (
    Number.isFinite(settings.earlyCheckinMinutes) &&
    settings.earlyCheckinMinutes >= 0 &&
    settings.earlyCheckinMinutes <= 180 &&
    Number.isFinite(settings.lateGraceMinutes) &&
    settings.lateGraceMinutes >= 0 &&
    settings.lateGraceMinutes <= 60 &&
    Number.isFinite(settings.checkoutWindowMinutes) &&
    settings.checkoutWindowMinutes >= 0 &&
    settings.checkoutWindowMinutes <= 300 &&
    Number.isFinite(settings.maxOvertimeMinutes) &&
    settings.maxOvertimeMinutes >= 0 &&
    settings.maxOvertimeMinutes <= 480
  );
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
      .from(globalSettings)
      .where(eq(globalSettings.id, 1))
      .limit(1);

    return NextResponse.json({
      success: true,
      data: serializeSettings(rows[0]),
    });
  } catch (error) {
    console.error('Get settings error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const auth = await isAdmin(request);
    if (!auth.authorized) {
      return NextResponse.json(
        { success: false, error: auth.error },
        { status: auth.status }
      );
    }

    const body = await request.json();
    const parsed = parseSettings(body ?? {});

    if (!isValidSettings(parsed)) {
      return NextResponse.json(
        { success: false, error: 'Invalid settings values. Check ranges.' },
        { status: 400 }
      );
    }

    await db
      .update(globalSettings)
      .set({
        ...parsed,
        updatedAt: new Date(),
      })
      .where(eq(globalSettings.id, 1));

    const rows = await db
      .select()
      .from(globalSettings)
      .where(eq(globalSettings.id, 1))
      .limit(1);

    return NextResponse.json({
      success: true,
      data: serializeSettings(rows[0]),
    });
  } catch (error) {
    console.error('Update settings error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
