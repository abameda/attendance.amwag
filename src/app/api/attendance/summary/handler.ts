import { and, eq, gte, lt } from 'drizzle-orm';
import { NextRequest, NextResponse } from 'next/server';

import { isAdminOrAccountant } from '@/lib/auth';
import {
  buildDailyAttendanceSummary,
  buildMonthlyAttendanceSummary,
  getMonthDates,
} from '@/lib/attendanceSummary';
import { db } from '@/lib/db';
import { attendance, users } from '@/lib/db/schema';
import {
  getEgyptDate,
  getEgyptMonth,
  isValidISODateString,
  isValidISOMonthString,
} from '@/lib/timezone';
import type { AttendanceRecord } from '@/types';

type EmployeeSummaryProfile = {
  id: string;
  fullName: string | null;
  branch: string | null;
  offDay: string | null;
};

type AttendanceSummaryDependencies = {
  db: Pick<typeof db, 'select'>;
  isAdminOrAccountant: typeof isAdminOrAccountant;
};

function parseIsoDate(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}

export function createAttendanceSummaryHandler(dependencies: AttendanceSummaryDependencies) {
  return async function GET(request: NextRequest) {
    try {
      const auth = await dependencies.isAdminOrAccountant(request);
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

      const [employeesData, attendanceData] = await Promise.all([
        dependencies.db
          .select({
            id: users.id,
            fullName: users.fullName,
            branch: users.branch,
            offDay: users.offDay,
          })
          .from(users)
          .where(eq(users.role, 'employee')),
        isDaySummary
          ? dependencies.db
            .select({
              userId: attendance.userId,
              status: attendance.status,
              date: attendance.date,
              earlyDepartureMinutes: attendance.earlyDepartureMinutes,
              overtimeMinutes: attendance.overtimeMinutes,
            })
            .from(attendance)
            .where(eq(attendance.date, parseIsoDate(date)))
          : dependencies.db
            .select({
              userId: attendance.userId,
              status: attendance.status,
              date: attendance.date,
              earlyDepartureMinutes: attendance.earlyDepartureMinutes,
              overtimeMinutes: attendance.overtimeMinutes,
            })
            .from(attendance)
            .where(
              and(
                gte(attendance.date, parseIsoDate(`${month}-01`)),
                lt(attendance.date, parseIsoDate(getNextMonth(month)))
              ),
            ),
      ]);

      const employees = employeesData as EmployeeSummaryProfile[];
      const attendanceRows = attendanceData as Array<{
        userId: string;
        status: Exclude<AttendanceRecord['status'], 'pending'>;
        date: Date;
        earlyDepartureMinutes: number;
        overtimeMinutes: number;
      }>;

      const summary = isDaySummary
        ? buildDailyAttendanceSummary({
            date,
            employees,
            attendanceRows,
          })
        : buildMonthlyAttendanceSummary({
            month,
            employees,
            attendanceRows,
            dates: getMonthDates(month, month >= getEgyptMonth() ? getEgyptDate() : undefined),
          });

      return NextResponse.json({
        success: true,
        data: summary,
      });
    } catch (error) {
      console.error('Attendance summary error:', error);
      return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
    }
  };
}

function getNextMonth(month: string): string {
  const [year, monthIndex] = month.split('-').map(Number);
  const nextMonthDate = new Date(Date.UTC(year, monthIndex, 1));
  return nextMonthDate.toISOString().slice(0, 10);
}
