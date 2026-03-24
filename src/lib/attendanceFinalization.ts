import { createClient as createSupabaseAdminClient } from '@supabase/supabase-js';
import type { InternalFinalizationResult } from '@/types';

function getSupabaseAdmin() {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!url || !key) {
        throw new Error('Missing Supabase service role configuration');
    }

    return createSupabaseAdminClient(url, key);
}

export async function executeAttendanceFinalization(): Promise<{
    status: number;
    body: InternalFinalizationResult | { success: false; error: string };
}> {
    const supabaseAdmin = getSupabaseAdmin();
    const { data, error } = await supabaseAdmin.rpc('mark_absent_employees');

    if (error) {
        console.error('Error calling mark_absent_employees RPC:', error);
        return {
            status: 500,
            body: { success: false, error: 'Failed to execute attendance finalization' },
        };
    }

    const rpcResult = data as (Partial<InternalFinalizationResult> & { skipped?: boolean }) | null;

    if (rpcResult?.skipped) {
        return {
            status: 409,
            body: { success: false, error: 'Another attendance finalization run is already active' },
        };
    }

    return {
        status: 200,
        body: {
            success: true,
            message: rpcResult?.message ?? 'Attendance finalization completed',
            markedAbsent: rpcResult?.markedAbsent ?? 0,
            markedMissingCheckout: rpcResult?.markedMissingCheckout ?? 0,
            alreadyRecorded: rpcResult?.alreadyRecorded ?? 0,
            skippedShiftNotEnded: rpcResult?.skippedShiftNotEnded ?? 0,
            currentTime: rpcResult?.currentTime ?? '',
            currentDate: rpcResult?.currentDate ?? '',
            dayOfWeek: rpcResult?.dayOfWeek ?? '',
            absentEmployees: rpcResult?.absentEmployees ?? [],
            missingCheckoutEmployees: rpcResult?.missingCheckoutEmployees ?? [],
        },
    };
}
