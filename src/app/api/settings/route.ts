import { NextRequest, NextResponse } from 'next/server';
import { createClient as createSupabaseAdminClient } from '@supabase/supabase-js';
import { isAdmin } from '@/lib/auth';

function getSupabaseAdmin() {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) throw new Error('Missing Supabase service role configuration');
    return createSupabaseAdminClient(url, key);
}

/** GET: Read global settings (admin only) */
export async function GET(request: NextRequest) {
    try {
        const auth = await isAdmin(request);
        if (!auth.authorized) {
            return NextResponse.json({ error: auth.error }, { status: auth.status });
        }

        const supabaseAdmin = getSupabaseAdmin();
        const { data, error } = await supabaseAdmin
            .from('global_settings')
            .select('early_checkin_minutes, late_grace_minutes, checkout_window_minutes, max_overtime_minutes, updated_at')
            .eq('id', 1)
            .single();

        if (error) {
            return NextResponse.json(
                { success: false, error: 'Failed to fetch settings' },
                { status: 500 }
            );
        }

        return NextResponse.json({ success: true, data });
    } catch (error) {
        console.error('Error fetching settings:', error);
        return NextResponse.json(
            { success: false, error: 'Internal server error' },
            { status: 500 }
        );
    }
}

/** PUT: Update global settings (admin only) */
export async function PUT(request: NextRequest) {
    try {
        const auth = await isAdmin(request);
        if (!auth.authorized) {
            return NextResponse.json({ error: auth.error }, { status: auth.status });
        }

        const body = await request.json();
        const { early_checkin_minutes, late_grace_minutes, checkout_window_minutes, max_overtime_minutes } = body;

        // Validate inputs
        if (
            typeof early_checkin_minutes !== 'number' || early_checkin_minutes < 0 || early_checkin_minutes > 180 ||
            typeof late_grace_minutes !== 'number' || late_grace_minutes < 0 || late_grace_minutes > 60 ||
            typeof checkout_window_minutes !== 'number' || checkout_window_minutes < 0 || checkout_window_minutes > 300 ||
            typeof max_overtime_minutes !== 'number' || max_overtime_minutes < 0 || max_overtime_minutes > 480
        ) {
            return NextResponse.json(
                { success: false, error: 'Invalid settings values. Check ranges.' },
                { status: 400 }
            );
        }

        const supabaseAdmin = getSupabaseAdmin();
        const { data, error } = await supabaseAdmin
            .from('global_settings')
            .update({
                early_checkin_minutes,
                late_grace_minutes,
                checkout_window_minutes,
                max_overtime_minutes,
                updated_at: new Date().toISOString(),
            })
            .eq('id', 1)
            .select('early_checkin_minutes, late_grace_minutes, checkout_window_minutes, max_overtime_minutes, updated_at')
            .single();

        if (error) {
            return NextResponse.json(
                { success: false, error: 'Failed to update settings' },
                { status: 500 }
            );
        }

        return NextResponse.json({ success: true, data });
    } catch (error) {
        console.error('Error updating settings:', error);
        return NextResponse.json(
            { success: false, error: 'Internal server error' },
            { status: 500 }
        );
    }
}
