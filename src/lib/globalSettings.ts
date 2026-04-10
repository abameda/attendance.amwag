import { eq } from 'drizzle-orm';

import { db } from '@/lib/db';
import { globalSettings } from '@/lib/db/schema';

export interface GlobalSettings {
  early_checkin_minutes: number;
  late_grace_minutes: number;
  checkout_window_minutes: number;
  max_overtime_minutes: number;
}

const DEFAULTS: GlobalSettings = {
  early_checkin_minutes: 60,
  late_grace_minutes: 0,
  checkout_window_minutes: 60,
  max_overtime_minutes: 180,
};

export async function getGlobalSettings(): Promise<GlobalSettings> {
  try {
    const rows = await db.select().from(globalSettings).where(eq(globalSettings.id, 1)).limit(1);
    const row = rows[0];

    if (!row) {
      return DEFAULTS;
    }

    return {
      early_checkin_minutes: row.earlyCheckinMinutes,
      late_grace_minutes: row.lateGraceMinutes,
      checkout_window_minutes: row.checkoutWindowMinutes,
      max_overtime_minutes: row.maxOvertimeMinutes,
    };
  } catch (error) {
    console.error('getGlobalSettings failed, using defaults:', error);
    return DEFAULTS;
  }
}
