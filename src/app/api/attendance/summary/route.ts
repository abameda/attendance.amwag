import { and, eq, gte, lt } from 'drizzle-orm';
import { NextRequest, NextResponse } from 'next/server';

import { isAdminOrAccountant } from '@/lib/auth';
import { db } from '@/lib/db';
import { attendance, users } from '@/lib/db/schema';
import {
  getEgyptDayNameFromISODate,
  getEgyptMonth,
  isValidISODateString,
  isValidISOMonthString,
} from '@/lib/timezone';
import type { AttendanceRecord } from '@/types';
import { buildDashboardSummary } from '@/lib/utils';

type EmployeeSummaryProfile = {
  id: string;
  branch: string | null;
  offDay: string | null;
};

function parseIsoDate(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}

function toIsoDate(value: Date): string {
  return value.toISOString().slice(0, 10);
}

export async function GET(request: NextRequest) {
  try {
    const auth = await isAdminOrAccountant(request);
    if (!auth.authorized) {
      return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
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

    const periodLabel = isDaySummary ? date : month;

    const employeesData = await db
      .select({
        id: users.id,
        branch: users.branch,
        offDay: users.offDay,
      })
      .from(users)
      .where(eq(users.role, 'employee'));

    const attendanceData = isDaySummary
      ? await db
          .select({
            userId: attendance.userId,
            status: attendance.status,
            date: attendance.date,
          })
          .from(attendance)
          .where(eq(attendance.date, parseIsoDate(date)))
      : await db
          .select({
            userId: attendance.userId,
            status: attendance.status,
            date: attendance.date,
          })
          .from(attendance)
          .where(
            and(
              gte(attendance.date, parseIsoDate(`${month}-01`)),
              lt(attendance.date, parseIsoDate(getNextMonth(month)))
            )
          );

    const employees = employeesData as EmployeeSummaryProfile[];
    const attendanceRows = attendanceData as Array<{
      userId: string;
      status: Exclude<AttendanceRecord['status'], 'pending'>;
      date: Date;
    }>;

    const branchMetrics = new Map<
      string,
      { expectedEmployees: number; presentCount: number; lateCount: number }
    >();

    let expectedEmployees = 0;
    let presentCount = 0;
    let lateCount = 0;
    let missingCheckoutCount = 0;
    let absentCount = 0;

    if (isDaySummary) {
      const attendanceByKey = new Map(
        attendanceRows.map((record) => [`${toIsoDate(record.date)}:${record.userId}`, record.status])
      );
      const dayOfWeek = getEgyptDayNameFromISODate(date);

      for (const employee of employees) {
        if (employee.offDay && employee.offDay === dayOfWeek) {
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

        const recordStatus = attendanceByKey.get(`${date}:${employee.id}`);
        if (recordStatus === 'present') {
          presentCount += 1;
          branchMetric.presentCount += 1;
        } else if (recordStatus === 'late') {
          lateCount += 1;
          branchMetric.lateCount += 1;
        } else if (recordStatus === 'missing_checkout') {
          missingCheckoutCount += 1;
        } else {
          absentCount += 1;
        }

        branchMetrics.set(branchName, branchMetric);
      }
    } else {
      const attendanceByUser = new Map<string, Set<AttendanceRecord['status']>>();

      for (const record of attendanceRows) {
        const statuses = attendanceByUser.get(record.userId) ?? new Set<AttendanceRecord['status']>();
        statuses.add(record.status);
        attendanceByUser.set(record.userId, statuses);
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
          statuses?.has('present') || statuses?.has('late') || statuses?.has('missing_checkout');

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
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}

function getNextMonth(month: string): string {
  const [year, monthIndex] = month.split('-').map(Number);
  const nextMonthDate = new Date(Date.UTC(year, monthIndex, 1));
  return nextMonthDate.toISOString().slice(0, 10);
}
