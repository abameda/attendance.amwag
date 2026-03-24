import { NextRequest, NextResponse } from 'next/server';
import { isAdmin } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import {
    getEgyptDayNameFromISODate,
    getEgyptMonth,
    isValidISODateString,
    isValidISOMonthString,
} from '@/lib/timezone';
import { buildDashboardSummary } from '@/lib/utils';
import type { AttendanceRecord } from '@/types';

type EmployeeSummaryProfile = {
    id: string;
    branch: string | null;
    off_day: string | null;
};

export async function GET(request: NextRequest) {
    try {
        const auth = await isAdmin(request);
        if (!auth.authorized) {
            return NextResponse.json(
                { success: false, error: auth.error },
                { status: auth.status }
            );
        }

        const { searchParams } = new URL(request.url);
        const date = searchParams.get('date')?.trim() ?? '';
        const month = searchParams.get('month')?.trim() ?? getEgyptMonth();
        const isDaySummary = Boolean(date);

        if (date && !isValidISODateString(date)) {
            return NextResponse.json(
                { success: false, error: 'Invalid date format' },
                { status: 400 }
            );
        }

        if (!date && !isValidISOMonthString(month)) {
            return NextResponse.json(
                { success: false, error: 'Invalid month format' },
                { status: 400 }
            );
        }

        const supabase = await createClient();
        const periodLabel = isDaySummary ? date : month;
        const { data: employeesData, error: employeesError } = await supabase
            .from('profiles')
            .select('id, branch, off_day')
            .eq('role', 'employee');

        if (employeesError) {
            throw employeesError;
        }

        let attendanceQuery = supabase
            .from('attendance')
            .select('user_id, status, date');

        if (isDaySummary) {
            attendanceQuery = attendanceQuery.eq('date', date);
        } else {
            attendanceQuery = attendanceQuery
                .gte('date', `${month}-01`)
                .lt('date', getNextMonth(month));
        }

        const { data: attendanceData, error: attendanceError } = await attendanceQuery;
        if (attendanceError) {
            throw attendanceError;
        }

        const employees = (employeesData ?? []) as EmployeeSummaryProfile[];
        const attendance = (attendanceData ?? []) as Pick<AttendanceRecord, 'user_id' | 'status' | 'date'>[];
        const branchMetrics = new Map<string, { expectedEmployees: number; presentCount: number; lateCount: number }>();

        let expectedEmployees = 0;
        let presentCount = 0;
        let lateCount = 0;
        let missingCheckoutCount = 0;
        let absentCount = 0;

        if (isDaySummary) {
            const attendanceByKey = new Map(attendance.map((record) => [`${record.date}:${record.user_id}`, record.status]));
            const dayOfWeek = getEgyptDayNameFromISODate(date);

            for (const employee of employees) {
                if (employee.off_day && employee.off_day === dayOfWeek) {
                    continue;
                }

                expectedEmployees += 1;
                const branchName = employee.branch?.trim() || 'Unassigned';
                const branchMetric = branchMetrics.get(branchName) ?? {
                    expectedEmployees: 0,
                    presentCount: 0,
                    lateCount: 0,
                };
                branchMetric.expectedEmployees += 1;

                const status = attendanceByKey.get(`${date}:${employee.id}`);
                if (status === 'present') {
                    presentCount += 1;
                    branchMetric.presentCount += 1;
                } else if (status === 'late') {
                    lateCount += 1;
                    branchMetric.lateCount += 1;
                } else if (status === 'missing_checkout') {
                    missingCheckoutCount += 1;
                } else {
                    absentCount += 1;
                }

                branchMetrics.set(branchName, branchMetric);
            }
        } else {
            const attendanceByUser = new Map<string, Set<AttendanceRecord['status']>>();

            for (const record of attendance) {
                const statuses = attendanceByUser.get(record.user_id) ?? new Set<AttendanceRecord['status']>();
                statuses.add(record.status);
                attendanceByUser.set(record.user_id, statuses);
            }

            for (const employee of employees) {
                expectedEmployees += 1;
                const branchName = employee.branch?.trim() || 'Unassigned';
                const branchMetric = branchMetrics.get(branchName) ?? {
                    expectedEmployees: 0,
                    presentCount: 0,
                    lateCount: 0,
                };
                branchMetric.expectedEmployees += 1;

                const statuses = attendanceByUser.get(employee.id);
                const hasAttendance =
                    statuses?.has('present') ||
                    statuses?.has('late') ||
                    statuses?.has('missing_checkout');

                if (hasAttendance) {
                    presentCount += 1;
                    branchMetric.presentCount += 1;
                } else {
                    absentCount += 1;
                }

                if (statuses?.has('late')) {
                    lateCount += 1;
                    branchMetric.lateCount += 1;
                }

                if (statuses?.has('missing_checkout')) {
                    missingCheckoutCount += 1;
                }

                branchMetrics.set(branchName, branchMetric);
            }
        }

        const summary = buildDashboardSummary({
            date: periodLabel,
            expectedEmployees,
            presentCount,
            lateCount,
            absentCount,
            missingCheckoutCount,
            branchMetrics: Array.from(branchMetrics.entries()).map(([branch, metric]) => ({
                branch,
                ...metric,
            })),
        });

        return NextResponse.json({
            success: true,
            data: summary,
        });
    } catch (error) {
        console.error('Attendance summary error:', error);
        return NextResponse.json(
            { success: false, error: 'Internal server error' },
            { status: 500 }
        );
    }
}

function getNextMonth(month: string): string {
    const [year, monthIndex] = month.split('-').map(Number);
    const nextMonthDate = new Date(Date.UTC(year, monthIndex, 1));
    return nextMonthDate.toISOString().slice(0, 10);
}
