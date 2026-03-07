import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';
import { isAdmin } from '@/lib/auth';

function getSupabaseAdmin() {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) {
        throw new Error('Missing Supabase service role configuration');
    }
    return createClient(url, key);
}

/**
 * POST: Execute mark_absent_employees() via Supabase RPC.
 * All shift/timezone/overnight logic lives in the PL/pgSQL function.
 * This endpoint is the manual trigger (admin dashboard button).
 * The same function also runs automatically every 15 min via pg_cron.
 */
export async function POST(request: NextRequest) {
    try {
        const auth = await isAdmin(request);
        if (!auth.authorized) {
            return NextResponse.json({ error: auth.error }, { status: auth.status });
        }

        const supabaseAdmin = getSupabaseAdmin();

        const { data, error } = await supabaseAdmin.rpc('mark_absent_employees');

        if (error) {
            console.error('Error calling mark_absent_employees RPC:', error);
            return NextResponse.json(
                { success: false, error: 'Failed to execute mark-absent function' },
                { status: 500 },
            );
        }

        const rpcResult = data as Record<string, unknown> | null;

        if (rpcResult?.skipped) {
            return NextResponse.json(
                { success: false, error: 'Another execution is already running. Try again shortly.' },
                { status: 409 },
            );
        }

        return NextResponse.json({
            success: true,
            message: rpcResult?.message ?? 'Completed',
            markedAbsent: rpcResult?.markedAbsent ?? 0,
            markedMissingCheckout: rpcResult?.markedMissingCheckout ?? 0,
            alreadyRecorded: rpcResult?.alreadyRecorded ?? 0,
            skippedShiftNotEnded: rpcResult?.skippedShiftNotEnded ?? 0,
            currentTime: rpcResult?.currentTime ?? '',
            absentEmployees: rpcResult?.absentEmployees ?? [],
            missingCheckoutEmployees: rpcResult?.missingCheckoutEmployees ?? [],
        });
    } catch (error) {
        console.error('Error in mark-absent:', error);
        return NextResponse.json(
            { success: false, error: 'Internal server error' },
            { status: 500 },
        );
    }
}

/**
 * GET: Dry-run preview — shows who would be marked absent.
 * Calls the same RPC but wraps it in a transaction that gets rolled back.
 * Since Supabase RPC doesn't support savepoints, we re-implement the
 * read-only preview logic here for the admin dashboard.
 */
export async function GET(request: NextRequest) {
    try {
        const auth = await isAdmin(request);
        if (!auth.authorized) {
            return NextResponse.json({ error: auth.error }, { status: auth.status });
        }

        const supabaseAdmin = getSupabaseAdmin();

        const egyptNow = new Date();
        const egyptDate = new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Cairo' }).format(egyptNow);

        const timeParts = new Intl.DateTimeFormat('en-US', {
            timeZone: 'Africa/Cairo',
            hour: 'numeric',
            minute: 'numeric',
            hour12: false,
        }).formatToParts(egyptNow);

        const hours = parseInt(timeParts.find((p) => p.type === 'hour')?.value ?? '0', 10);
        const minutes = parseInt(timeParts.find((p) => p.type === 'minute')?.value ?? '0', 10);
        const egyptTotalMinutes = hours * 60 + minutes;

        const dayOfWeek = new Intl.DateTimeFormat('en-US', {
            timeZone: 'Africa/Cairo',
            weekday: 'long',
        }).format(egyptNow).toLowerCase();

        const { data: employees, error: employeesError } = await supabaseAdmin
            .from('profiles')
            .select('id, full_name, off_day, shift_start, shift_end, overtime_enabled')
            .eq('role', 'employee')
            .or(`off_day.is.null,off_day.neq.${dayOfWeek}`);

        if (employeesError) {
            return NextResponse.json(
                { success: false, error: 'Failed to fetch employees' },
                { status: 500 },
            );
        }

        type Employee = { id: string; full_name: string; off_day: string | null; shift_start: string | null; shift_end: string | null; overtime_enabled: boolean };
        const typedEmployees = (employees ?? []) as Employee[];

        const hasShiftEnded = (shiftStart: string | null, shiftEnd: string | null, overtimeEnabled: boolean): boolean => {
            if (!shiftStart || !shiftEnd) return true;
            const endMin = parseInt(shiftEnd.split(':')[0], 10) * 60 + parseInt(shiftEnd.split(':')[1], 10);
            const startMin = parseInt(shiftStart.split(':')[0], 10) * 60 + parseInt(shiftStart.split(':')[1], 10);
            const graceMin = overtimeEnabled ? 180 : 0;

            if (endMin < startMin) {
                return egyptTotalMinutes >= (endMin + graceMin) && egyptTotalMinutes < startMin;
            }
            return egyptTotalMinutes >= (endMin + graceMin);
        };

        const getTargetDate = (shiftStart: string | null, shiftEnd: string | null): string => {
            if (!shiftStart || !shiftEnd) return egyptDate;
            const endMin = parseInt(shiftEnd.split(':')[0], 10) * 60 + parseInt(shiftEnd.split(':')[1], 10);
            const startMin = parseInt(shiftStart.split(':')[0], 10) * 60 + parseInt(shiftStart.split(':')[1], 10);
            if (endMin < startMin && egyptTotalMinutes < startMin) {
                const yesterday = new Date(egyptNow);
                yesterday.setDate(yesterday.getDate() - 1);
                return new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Cairo' }).format(yesterday);
            }
            return egyptDate;
        };

        const shiftEnded = typedEmployees.filter((e) => hasShiftEnded(e.shift_start, e.shift_end, e.overtime_enabled));
        const shiftNotEnded = typedEmployees.filter((e) => !hasShiftEnded(e.shift_start, e.shift_end, e.overtime_enabled));

        const employeesByDate = new Map<string, Employee[]>();
        for (const emp of shiftEnded) {
            const targetDate = getTargetDate(emp.shift_start, emp.shift_end);
            if (!employeesByDate.has(targetDate)) employeesByDate.set(targetDate, []);
            employeesByDate.get(targetDate)!.push(emp);
        }

        const result: {
            date: string;
            wouldBeMarkedAbsent: number;
            wouldBeMarkedMissingCheckout: number;
            employees: string[];
            missingCheckoutEmployees: string[];
            alreadyRecorded: number;
        }[] = [];

        for (const [targetDate, dateEmployees] of employeesByDate) {
            const employeeIds = dateEmployees.map((e) => e.id);

            const { data: existingAttendance } = await supabaseAdmin
                .from('attendance')
                .select('user_id, check_in_time, check_out_time')
                .eq('date', targetDate)
                .in('user_id', employeeIds);

            type AttRec = { user_id: string; check_in_time: string | null; check_out_time: string | null };
            const existingMap = new Map<string, AttRec>();
            for (const rec of (existingAttendance ?? []) as AttRec[]) {
                existingMap.set(rec.user_id, rec);
            }

            const missingCheckout = dateEmployees.filter((e) => {
                const rec = existingMap.get(e.id);
                return rec && rec.check_in_time && !rec.check_out_time;
            });
            const trulyAbsent = dateEmployees.filter((e) => !existingMap.get(e.id));
            const alreadyFullyRecorded = dateEmployees.filter((e) => {
                const rec = existingMap.get(e.id);
                return rec && rec.check_in_time && rec.check_out_time;
            });

            result.push({
                date: targetDate,
                wouldBeMarkedAbsent: trulyAbsent.length,
                wouldBeMarkedMissingCheckout: missingCheckout.length,
                employees: trulyAbsent.map((e) => `${e.full_name} (shift: ${e.shift_start || 'N/A'}-${e.shift_end || 'N/A'})`),
                missingCheckoutEmployees: missingCheckout.map((e) => `${e.full_name} (shift: ${e.shift_start || 'N/A'}-${e.shift_end || 'N/A'})`),
                alreadyRecorded: alreadyFullyRecorded.length,
            });
        }

        return NextResponse.json({
            success: true,
            currentTime: egyptDate,
            dayOfWeek,
            totalEmployees: typedEmployees.length,
            shiftEndedCount: shiftEnded.length,
            shiftNotEndedCount: shiftNotEnded.length,
            shiftNotEndedEmployees: shiftNotEnded.map((e) =>
                `${e.full_name} (shift: ${e.shift_start || 'N/A'}-${e.shift_end || 'N/A'})`,
            ),
            byDate: result,
        });
    } catch (error) {
        console.error('Error in mark-absent GET:', error);
        return NextResponse.json(
            { success: false, error: 'Internal server error' },
            { status: 500 },
        );
    }
}
