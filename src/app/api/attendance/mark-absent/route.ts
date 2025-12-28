import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

// Map day numbers to day names
const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

// Create admin client inside handlers to avoid build-time errors
function getSupabaseAdmin() {
    return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
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
}

/**
 * Determines if an employee's shift has ended for the day.
 * Handles both regular day shifts and overnight shifts.
 * 
 * @param shiftStart - Shift start time in HH:MM format (e.g., "09:00" or "22:00")
 * @param shiftEnd - Shift end time in HH:MM format (e.g., "17:00" or "06:00")
 * @param now - Current time
 * @returns true if the shift has ended and employee should be marked absent if not checked in
 */
function hasShiftEnded(shiftStart: string | null, shiftEnd: string | null, now: Date): boolean {
    // If no shift times defined, default to considering shift ended (mark absent at midnight)
    if (!shiftStart || !shiftEnd) {
        return true;
    }

    const currentMinutes = now.getHours() * 60 + now.getMinutes();
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
        return currentMinutes >= endMinutes && currentMinutes < startMinutes;
    }

    // Regular day shift (e.g., 09:00 - 17:00): shift_end > shift_start
    // Mark absent if current time is after shift end
    return currentMinutes >= endMinutes;
}

/**
 * Gets the correct date to mark as absent based on shift type.
 * For overnight shifts checked at morning (e.g., 7AM), we need to mark YESTERDAY as absent.
 */
function getTargetDateForEmployee(
    shiftStart: string | null,
    shiftEnd: string | null,
    now: Date
): string {
    if (!shiftStart || !shiftEnd) {
        return now.toISOString().split('T')[0];
    }

    const [endH, endM] = shiftEnd.split(':').map(Number);
    const [startH, startM] = shiftStart.split(':').map(Number);
    const endMinutes = endH * 60 + endM;
    const startMinutes = startH * 60 + startM;
    const currentMinutes = now.getHours() * 60 + now.getMinutes();

    // Overnight shift and we're checking in the morning hours (after midnight, before shift start)
    if (endMinutes < startMinutes && currentMinutes >= endMinutes && currentMinutes < startMinutes) {
        // The shift that ended was from YESTERDAY
        const yesterday = new Date(now);
        yesterday.setDate(yesterday.getDate() - 1);
        return yesterday.toISOString().split('T')[0];
    }

    return now.toISOString().split('T')[0];
}

export async function POST(request: Request) {
    try {
        const supabaseAdmin = getSupabaseAdmin();

        // Get current time in Cairo timezone (UTC+2)
        const now = new Date();
        // Adjust for Cairo timezone if server is in UTC
        const cairoOffset = 2 * 60; // Cairo is UTC+2
        const cairoTime = new Date(now.getTime() + (cairoOffset + now.getTimezoneOffset()) * 60000);

        // Get target date from query params or calculate based on current time
        const { searchParams } = new URL(request.url);
        const overrideDate = searchParams.get('date');

        // Get current day of week
        const dayOfWeek = dayNames[cairoTime.getDay()];

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
                { status: 500 }
            );
        }

        const typedEmployees = employees as Employee[] | null;

        if (!typedEmployees || typedEmployees.length === 0) {
            return NextResponse.json({
                success: true,
                message: 'No employees to process',
                markedAbsent: 0,
                alreadyRecorded: 0,
                skippedShiftNotEnded: 0,
            });
        }

        // Filter employees whose shift has ended
        const employeesWithEndedShift = typedEmployees.filter((emp) =>
            hasShiftEnded(emp.shift_start, emp.shift_end, cairoTime)
        );

        const skippedCount = typedEmployees.length - employeesWithEndedShift.length;

        if (employeesWithEndedShift.length === 0) {
            return NextResponse.json({
                success: true,
                message: 'No employees with ended shifts to process',
                markedAbsent: 0,
                alreadyRecorded: 0,
                skippedShiftNotEnded: skippedCount,
            });
        }

        // Group employees by their target date (handles overnight shifts)
        const employeesByDate: Map<string, Employee[]> = new Map();
        for (const emp of employeesWithEndedShift) {
            const targetDate = overrideDate || getTargetDateForEmployee(emp.shift_start, emp.shift_end, cairoTime);
            if (!employeesByDate.has(targetDate)) {
                employeesByDate.set(targetDate, []);
            }
            employeesByDate.get(targetDate)!.push(emp);
        }

        let totalMarkedAbsent = 0;
        let totalAlreadyRecorded = 0;
        const allAbsentEmployees: string[] = [];

        // Process each date group
        for (const [targetDate, dateEmployees] of employeesByDate) {
            const employeeIds = dateEmployees.map((e) => e.id);

            // Fetch existing attendance records for this date
            const { data: existingAttendance, error: attendanceError } = await supabaseAdmin
                .from('attendance')
                .select('user_id')
                .eq('date', targetDate)
                .in('user_id', employeeIds);

            if (attendanceError) {
                console.error('Error fetching attendance:', attendanceError);
                continue;
            }

            const typedAttendance = existingAttendance as AttendanceRecord[] | null;
            const employeesWithRecords = new Set(typedAttendance?.map((a) => a.user_id) || []);
            const employeesToMarkAbsent = dateEmployees.filter((e) => !employeesWithRecords.has(e.id));

            totalAlreadyRecorded += employeesWithRecords.size;

            if (employeesToMarkAbsent.length === 0) {
                continue;
            }

            // Create absent records for employees without attendance
            const absentRecords = employeesToMarkAbsent.map((employee) => ({
                user_id: employee.id,
                date: targetDate,
                status: 'absent',
                check_in_time: null,
                check_out_time: null,
                late_minutes: 0,
            }));

            const { error: insertError } = await supabaseAdmin
                .from('attendance')
                .insert(absentRecords);

            if (insertError) {
                console.error('Error inserting absent records:', insertError);
                continue;
            }

            totalMarkedAbsent += employeesToMarkAbsent.length;
            allAbsentEmployees.push(...employeesToMarkAbsent.map((e) => e.full_name));
        }

        return NextResponse.json({
            success: true,
            message: `Marked ${totalMarkedAbsent} employee(s) as absent`,
            markedAbsent: totalMarkedAbsent,
            alreadyRecorded: totalAlreadyRecorded,
            skippedShiftNotEnded: skippedCount,
            currentTime: cairoTime.toISOString(),
            absentEmployees: allAbsentEmployees,
        });
    } catch (error) {
        console.error('Error in mark-absent:', error);
        return NextResponse.json(
            { success: false, error: 'Internal server error' },
            { status: 500 }
        );
    }
}

// GET method - returns info about who would be marked absent (dry run)
export async function GET(request: Request) {
    try {
        const supabaseAdmin = getSupabaseAdmin();

        // Get current time in Cairo timezone
        const now = new Date();
        const cairoOffset = 2 * 60;
        const cairoTime = new Date(now.getTime() + (cairoOffset + now.getTimezoneOffset()) * 60000);

        const { searchParams } = new URL(request.url);
        const overrideDate = searchParams.get('date');

        const dayOfWeek = dayNames[cairoTime.getDay()];

        // Fetch employees not off today (with shift times)
        const { data: employees, error: employeesError } = await supabaseAdmin
            .from('profiles')
            .select('id, full_name, off_day, shift_start, shift_end')
            .eq('role', 'employee')
            .or(`off_day.is.null,off_day.neq.${dayOfWeek}`);

        if (employeesError) {
            return NextResponse.json(
                { success: false, error: 'Failed to fetch employees' },
                { status: 500 }
            );
        }

        const typedEmployees = employees as Employee[] | null;

        // Filter employees whose shift has ended
        const employeesWithEndedShift = (typedEmployees || []).filter((emp) =>
            hasShiftEnded(emp.shift_start, emp.shift_end, cairoTime)
        );

        const employeesShiftNotEnded = (typedEmployees || []).filter((emp) =>
            !hasShiftEnded(emp.shift_start, emp.shift_end, cairoTime)
        );

        // Group by target date
        const employeesByDate: Map<string, Employee[]> = new Map();
        for (const emp of employeesWithEndedShift) {
            const targetDate = overrideDate || getTargetDateForEmployee(emp.shift_start, emp.shift_end, cairoTime);
            if (!employeesByDate.has(targetDate)) {
                employeesByDate.set(targetDate, []);
            }
            employeesByDate.get(targetDate)!.push(emp);
        }

        const result: {
            date: string;
            wouldBeMarkedAbsent: number;
            employees: string[];
            alreadyRecorded: number;
        }[] = [];

        for (const [targetDate, dateEmployees] of employeesByDate) {
            const employeeIds = dateEmployees.map((e) => e.id);

            const { data: existingAttendance } = await supabaseAdmin
                .from('attendance')
                .select('user_id')
                .eq('date', targetDate)
                .in('user_id', employeeIds);

            const typedAttendance = existingAttendance as AttendanceRecord[] | null;
            const employeesWithRecords = new Set(typedAttendance?.map((a) => a.user_id) || []);
            const employeesToMarkAbsent = dateEmployees.filter((e) => !employeesWithRecords.has(e.id));

            result.push({
                date: targetDate,
                wouldBeMarkedAbsent: employeesToMarkAbsent.length,
                employees: employeesToMarkAbsent.map((e) => `${e.full_name} (shift: ${e.shift_start || 'N/A'}-${e.shift_end || 'N/A'})`),
                alreadyRecorded: employeesWithRecords.size,
            });
        }

        return NextResponse.json({
            success: true,
            currentTime: cairoTime.toISOString(),
            dayOfWeek,
            totalEmployees: typedEmployees?.length || 0,
            shiftEndedCount: employeesWithEndedShift.length,
            shiftNotEndedCount: employeesShiftNotEnded.length,
            shiftNotEndedEmployees: employeesShiftNotEnded.map((e) =>
                `${e.full_name} (shift: ${e.shift_start || 'N/A'}-${e.shift_end || 'N/A'})`
            ),
            byDate: result,
        });
    } catch (error) {
        console.error('Error in mark-absent GET:', error);
        return NextResponse.json(
            { success: false, error: 'Internal server error' },
            { status: 500 }
        );
    }
}
