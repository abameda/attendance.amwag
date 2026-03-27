import { createClient as createSupabaseAdminClient } from '@supabase/supabase-js';

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

/**
 * Fetches global attendance settings from the database.
 * Falls back to safe defaults if the table doesn't exist or query fails.
 * Uses the service role key so it works from any server context.
 */
export async function getGlobalSettings(): Promise<GlobalSettings> {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!url || !key) return DEFAULTS;

    const supabase = createSupabaseAdminClient(url, key);
    const { data, error } = await supabase
        .from('global_settings')
        .select('early_checkin_minutes, late_grace_minutes, checkout_window_minutes, max_overtime_minutes')
        .eq('id', 1)
        .single();

    if (error || !data) return DEFAULTS;

    return {
        early_checkin_minutes: data.early_checkin_minutes ?? DEFAULTS.early_checkin_minutes,
        late_grace_minutes: data.late_grace_minutes ?? DEFAULTS.late_grace_minutes,
        checkout_window_minutes: data.checkout_window_minutes ?? DEFAULTS.checkout_window_minutes,
        max_overtime_minutes: data.max_overtime_minutes ?? DEFAULTS.max_overtime_minutes,
    };
}
