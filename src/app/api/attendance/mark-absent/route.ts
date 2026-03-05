import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';
import { isAdmin } from '@/lib/auth';
import { getEgyptDate, getEgyptNow, TIMEZONE } from '@/lib/timezone';

function getSupabaseAdmin() {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) {
        throw new Error('Missing Supabase service role configuration');
    }
    return createClient(url, key);
}

interface Employee {
    id: string;
    full_name: string;
    off_day: string | null;
    shift_start: string | null;
    shift_end: string | null;
}

interface AttendanceRecord {
    user_id: string;
    check_in_time: string | null;
    check_out_time: string | null;
}

/**
 * Determines if an employee's shift has ended for the day.
 * Handles both regular day shifts and overnight shifts.
 *
 * @param shiftStart - Shift start time in HH:MM format (e.g., "09:00" or "22:00")
 * @param shiftEnd - Shift end time in HH:MM format (e.g., "17:00" or "06:00")
 * @param egyptTotalMinutes - Current total minutes in Egypt time (hours*60 + minutes)
 * @returns true if the shift has ended and employee should be marked absent if not checked in
 */
function hasShiftEnded(shiftStart: string | null, shiftEnd: string | null, egyptTotalMinutes: number): boolean {
    // If no shift times defined, default to considering shift ended (mark absent at midnight)
    if (!shiftStart || !shiftEnd) {
        return true;
    }

    const [endH, endM] = shiftEnd.split(':').map(Number);
    const [startH, startM] = shiftStart.split(':').map(Number);
    const endMinutes = endH * 60 + endM;
    const startMinutes = startH * 60 + startM;

    // Overnight shift (e.g., 22:00 - 06:00): shift_end < shift_start
    if (endMinutes < startMinutes) {
        // For overnight shifts, the shift ends NEXT DAY
        // Only mark absent if we're AFTER the end time (next day morning)
        // AND BEFORE the start time (evening)
        // This means: if current time is between shift_end and shift_start, shift has ended
        return egyptTotalMinutes >= endMinutes && egyptTotalMinutes < startMinutes;
    }

    // Regular day shift (e.g., 09:00 - 17:00): shift_end > shift_start
    // Mark absent if current time is after shift end
    return egyptTotalMinutes >= endMinutes;
}

/**
 * Gets the correct date to mark as absent based on shift type.
 * For overnight shifts checked at morning (e.g., 7AM), we need to mark YESTERDAY as absent.
 *
 * @param shiftStart - Shift start time in HH:MM format
 * @param shiftEnd - Shift end time in HH:MM format
 * @param egyptTotalMinutes - Current total minutes in Egypt time
 * @param egyptDate - Current date string in Egypt time (YYYY-MM-DD)
 * @returns Target date string (YYYY-MM-DD)
 */
function getTargetDateForEmployee(
    shiftStart: string | null,
    shiftEnd: string | null,
    egyptTotalMinutes: number,
    egyptDate: string,
): string {
    if (!shiftStart || !shiftEnd) {
        return egyptDate;
    }

    const [endH, endM] = shiftEnd.split(':').map(Number);
    const [startH, startM] = shiftStart.split(':').map(Number);
    const endMinutes = endH * 60 + endM;
    const startMinutes = startH * 60 + startM;

    // Overnight shift and we're checking in the morning hours (after midnight, before shift start)
    if (endMinutes < startMinutes && egyptTotalMinutes >= endMinutes && egyptTotalMinutes < startMinutes) {
        // The shift that ended was from YESTERDAY
        const now = new Date();
        const yesterday = new Date(now);
        yesterday.setDate(yesterday.getDate() - 1);
        return getEgyptDate(yesterday);
    }

    return egyptDate;
}

export async function POST(request: NextRequest) {
    try {
        // Auth guard: admin only
        const auth = await isAdmin(request);
        if (!auth.authorized) {
            return NextResponse.json({ error: auth.error }, { status: auth.status });
        }

        const supabaseAdmin = getSupabaseAdmin();

        // Get current time in Egypt timezone (Africa/Cairo, handles DST)
        const { date: egyptDate, totalMinutes: egyptTotalMinutes } = getEgyptNow();
        const now = new Date();

        // Get target date from query params or calculate based on current time
        const { searchParams } = new URL(request.url);
        const overrideDate = searchParams.get('date');

        // Get current day of week in Egypt timezone
        const dayOfWeek = new Intl.DateTimeFormat('en-US', {
            timeZone: TIMEZONE,
            weekday: 'long',
        }).format(now).toLowerCase();

        // Fetch all employees who are NOT off today (including shift times)
        const { data: employees, error: employeesError } = await supabaseAdmin
            .from('profiles')
            .select('id, full_name, off_day, shift_start, shift_end')
            .eq('role', 'employee')
            .or(`off_day.is.null,off_day.neq.${dayOfWeek}`);

        if (employeesError) {
            console.error('Error fetching employees:', employeesError);
            return NextResponse.json(
                { success: false, error: 'Failed to fetch employees' },
                { status: 500 },
            );
        }

        const typedEmployees = employees as Employee[] | null;

        if (!typedEmployees || typedEmployees.length === 0) {
            return NextResponse.json({
                success: true,
                message: 'No employees to process',
                markedAbsent: 0,
                markedMissingCheckout: 0,
                alreadyRecorded: 0,
                skippedShiftNotEnded: 0,
            });
        }

        // Filter employees whose shift has ended
        const employeesWithEndedShift = typedEmployees.filter((emp) =>
            hasShiftEnded(emp.shift_start, emp.shift_end, egyptTotalMinutes),
        );

        const skippedCount = typedEmployees.length - employeesWithEndedShift.length;

        if (employeesWithEndedShift.length === 0) {
            return NextResponse.json({
                success: true,
                message: 'No employees with ended shifts to process',
                markedAbsent: 0,
                markedMissingCheckout: 0,
                alreadyRecorded: 0,
                skippedShiftNotEnded: skippedCount,
            });
        }

        // Group employees by their target date (handles overnight shifts)
        const employeesByDate: Map<string, Employee[]> = new Map();
        for (const emp of employeesWithEndedShift) {
            const targetDate = overrideDate || getTargetDateForEmployee(emp.shift_start, emp.shift_end, egyptTotalMinutes, egyptDate);
            if (!employeesByDate.has(targetDate)) {
                employeesByDate.set(targetDate, []);
            }
            employeesByDate.get(targetDate)!.push(emp);
        }

        let totalMarkedAbsent = 0;
        let totalMarkedMissingCheckout = 0;
        let totalAlreadyRecorded = 0;
        const allAbsentEmployees: string[] = [];
        const allMissingCheckoutEmployees: string[] = [];

        // Process each date group
        for (const [targetDate, dateEmployees] of employeesByDate) {
            const employeeIds = dateEmployees.map((e) => e.id);

            // Fetch existing attendance records for this date (with check_in/out info)
            const { data: existingAttendance, error: attendanceError } = await supabaseAdmin
                .from('attendance')
                .select('user_id, check_in_time, check_out_time')
                .eq('date', targetDate)
                .in('user_id', employeeIds);

            if (attendanceError) {
                console.error('Error fetching attendance:', attendanceError);
                continue;
            }

            const typedAttendance = existingAttendance as AttendanceRecord[] | null;
            const existingMap = new Map<string, AttendanceRecord>();
            for (const rec of typedAttendance ?? []) {
                existingMap.set(rec.user_id, rec);
            }

            // Split employees into categories:
            // 1. missing_checkout: checked in but never checked out
            // 2. truly absent: no record at all
            // 3. already fully recorded: has both check_in and check_out
            const missingCheckout = dateEmployees.filter((e) => {
                const rec = existingMap.get(e.id);
                return rec && rec.check_in_time && !rec.check_out_time;
            });

            const trulyAbsent = dateEmployees.filter((e) => !existingMap.get(e.id));

            const alreadyFullyRecorded = dateEmployees.filter((e) => {
                const rec = existingMap.get(e.id);
                return rec && rec.check_in_time && rec.check_out_time;
            });

            totalAlreadyRecorded += alreadyFullyRecorded.length;

            if (missingCheckout.length > 0) {
                const { error: updateError } = await supabaseAdmin
                    .from('attendance')
                    .update({ status: 'missing_checkout' })
                    .eq('date', targetDate)
                    .in('user_id', missingCheckout.map((e) => e.id));

                if (updateError) {
                    console.error('Error updating missing_checkout records:', updateError);
                } else {
                    totalMarkedMissingCheckout += missingCheckout.length;
                    allMissingCheckoutEmployees.push(...missingCheckout.map((e) => e.full_name));
                }
            }

            if (trulyAbsent.length > 0) {
                const absentRecords = trulyAbsent.map((employee) => ({
                    user_id: employee.id,
                    date: targetDate,
                    status: 'absent',
                    check_in_time: null,
                    check_out_time: null,
                    late_minutes: 0,
                }));

                const { error: insertError } = await supabaseAdmin
                    .from('attendance')
                    .upsert(absentRecords, { onConflict: 'user_id,date', ignoreDuplicates: true });

                if (insertError) {
                    console.error('Error inserting absent records:', insertError);
                    continue;
                }

                totalMarkedAbsent += trulyAbsent.length;
                allAbsentEmployees.push(...trulyAbsent.map((e) => e.full_name));
            }
        }

        return NextResponse.json({
            success: true,
            message: `Marked ${totalMarkedAbsent} employee(s) as absent, ${totalMarkedMissingCheckout} as missing checkout`,
            markedAbsent: totalMarkedAbsent,
            markedMissingCheckout: totalMarkedMissingCheckout,
            alreadyRecorded: totalAlreadyRecorded,
            skippedShiftNotEnded: skippedCount,
            currentTime: egyptDate,
            absentEmployees: allAbsentEmployees,
            missingCheckoutEmployees: allMissingCheckoutEmployees,
        });
    } catch (error) {
        console.error('Error in mark-absent:', error);
        return NextResponse.json(
            { success: false, error: 'Internal server error' },
            { status: 500 },
        );
    }
}

// GET method - returns info about who would be marked absent (dry run)
export async function GET(request: NextRequest) {
    try {
        // Auth guard: admin only
        const auth = await isAdmin(request);
        if (!auth.authorized) {
            return NextResponse.json({ error: auth.error }, { status: auth.status });
        }

        const supabaseAdmin = getSupabaseAdmin();

        // Get current time in Egypt timezone (Africa/Cairo, handles DST)
        const { date: egyptDate, totalMinutes: egyptTotalMinutes } = getEgyptNow();
        const now = new Date();

        const { searchParams } = new URL(request.url);
        const overrideDate = searchParams.get('date');

        // Get current day of week in Egypt timezone
        const dayOfWeek = new Intl.DateTimeFormat('en-US', {
            timeZone: TIMEZONE,
            weekday: 'long',
        }).format(now).toLowerCase();

        // Fetch employees not off today (with shift times)
        const { data: employees, error: employeesError } = await supabaseAdmin
            .from('profiles')
            .select('id, full_name, off_day, shift_start, shift_end')
            .eq('role', 'employee')
            .or(`off_day.is.null,off_day.neq.${dayOfWeek}`);

        if (employeesError) {
            return NextResponse.json(
                { success: false, error: 'Failed to fetch employees' },
                { status: 500 },
            );
        }

        const typedEmployees = employees as Employee[] | null;

        // Filter employees whose shift has ended
        const employeesWithEndedShift = (typedEmployees || []).filter((emp) =>
            hasShiftEnded(emp.shift_start, emp.shift_end, egyptTotalMinutes),
        );

        const employeesShiftNotEnded = (typedEmployees || []).filter((emp) =>
            !hasShiftEnded(emp.shift_start, emp.shift_end, egyptTotalMinutes),
        );

        // Group by target date
        const employeesByDate: Map<string, Employee[]> = new Map();
        for (const emp of employeesWithEndedShift) {
            const targetDate = overrideDate || getTargetDateForEmployee(emp.shift_start, emp.shift_end, egyptTotalMinutes, egyptDate);
            if (!employeesByDate.has(targetDate)) {
                employeesByDate.set(targetDate, []);
            }
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

            const typedAttendance = existingAttendance as AttendanceRecord[] | null;
            const existingMap = new Map<string, AttendanceRecord>();
            for (const rec of typedAttendance ?? []) {
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
            totalEmployees: typedEmployees?.length || 0,
            shiftEndedCount: employeesWithEndedShift.length,
            shiftNotEndedCount: employeesShiftNotEnded.length,
            shiftNotEndedEmployees: employeesShiftNotEnded.map((e) =>
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
