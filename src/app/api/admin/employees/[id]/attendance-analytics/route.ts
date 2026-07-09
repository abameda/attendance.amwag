import { and, eq, gte, lte, sql, type SQL } from 'drizzle-orm';
import { NextRequest, NextResponse } from 'next/server';

import { isAdminOrAccountant } from '@/lib/auth';
import { db } from '@/lib/db';
import { attendance, users, type User } from '@/lib/db/schema';
import {
  buildAnalyticsComparisonAggregate,
  buildEmployeeAttendanceAnalytics,
  resolveAnalyticsDateRange,
  type AnalyticsAttendanceRow,
  type AnalyticsComparisonEmployee,
  type AnalyticsDateRange,
  type AnalyticsEmployee,
} from '@/lib/employeeAttendanceAnalytics';
import { getEgyptDate, isValidISODateString } from '@/lib/timezone';

type AttendanceAnalyticsRow = AnalyticsAttendanceRow;

function parseIsoDate(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}

function toIsoDate(value: Date): string {
  return value.toISOString().slice(0, 10);
}

function addIsoDays(value: string, days: number): string {
  const date = new Date(`${value}T12:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function dateSpanDays(from: string, to: string): number {
  const fromTime = parseIsoDate(from).getTime();
  const toTime = parseIsoDate(to).getTime();
  return Math.max(1, Math.floor((toTime - fromTime) / 86_400_000) + 1);
}

function serializeEmployee(user: User): AnalyticsEmployee {
  return {
    id: user.id,
    email: user.email,
    fullName: user.fullName,
    branch: user.branch,
    jobTitle: user.jobTitle,
    shiftStart: user.shiftStart,
    shiftEnd: user.shiftEnd,
    offDay: user.offDay,
    overtimeEnabled: user.overtimeEnabled,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

function buildDatePredicate(range: Pick<AnalyticsDateRange, 'from' | 'to'>): SQL {
  return range.from
    ? and(gte(attendance.date, parseIsoDate(range.from)), lte(attendance.date, parseIsoDate(range.to)))!
    : lte(attendance.date, parseIsoDate(range.to));
}

async function fetchEmployee(id: string) {
  const rows = await db
    .select()
    .from(users)
    .where(and(eq(users.id, id), eq(users.role, 'employee')))
    .limit(1);

  return rows[0] ?? null;
}

async function fetchAttendanceRows(whereClause: SQL): Promise<AttendanceAnalyticsRow[]> {
  return db
    .select({
      id: attendance.id,
      userId: attendance.userId,
      date: attendance.date,
      checkInTime: attendance.checkInTime,
      checkOutTime: attendance.checkOutTime,
      ipAddress: attendance.ipAddress,
      checkOutIp: attendance.checkOutIp,
      checkInLocation: attendance.checkInLocation,
      checkOutLocation: attendance.checkOutLocation,
      status: attendance.status,
      lateMinutes: attendance.lateMinutes,
      earlyDepartureMinutes: attendance.earlyDepartureMinutes,
      overtimeMinutes: attendance.overtimeMinutes,
      createdAt: attendance.createdAt,
    })
    .from(attendance)
    .where(whereClause);
}

async function fetchComparisonEmployees(branch?: string | null): Promise<AnalyticsComparisonEmployee[]> {
  const query = db
    .select({
      id: users.id,
      offDay: users.offDay,
      createdAt: users.createdAt,
    })
    .from(users);

  const rows = branch
    ? await query.where(and(eq(users.role, 'employee'), eq(users.branch, branch)))
    : await query.where(eq(users.role, 'employee'));

  return rows;
}

async function fetchPresentAttendanceDays(whereClause: SQL): Promise<number> {
  const rows = await db
    .select({
      presentDays:
        sql<number>`sum(case when ${attendance.status} <> 'absent' then 1 else 0 end)`.mapWith(Number),
    })
    .from(attendance)
    .leftJoin(users, eq(attendance.userId, users.id))
    .where(whereClause);

  return rows[0]?.presentDays ?? 0;
}

function previousRange(range: AnalyticsDateRange): Pick<AnalyticsDateRange, 'from' | 'to'> | null {
  if (!range.from) {
    return null;
  }

  const span = dateSpanDays(range.from, range.to);
  const to = addIsoDays(range.from, -1);
  const from = addIsoDays(to, -(span - 1));
  return { from, to };
}

function normalizeRangeForEmployee(range: AnalyticsDateRange, employee: AnalyticsEmployee): AnalyticsDateRange {
  if (range.preset !== 'all' || range.from) {
    return range;
  }

  return {
    ...range,
    from: toIsoDate(employee.createdAt),
  };
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await isAdminOrAccountant(request);
    if (!auth.authorized) {
      return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
    }

    const { id } = await params;
    const employeeRow = await fetchEmployee(id);
    if (!employeeRow) {
      return NextResponse.json({ success: false, error: 'Employee not found' }, { status: 404 });
    }

    const { searchParams } = new URL(request.url);
    const preset = searchParams.get('preset') ?? 'this_month';
    const from = searchParams.get('from');
    const to = searchParams.get('to');

    if ((from && !isValidISODateString(from)) || (to && !isValidISODateString(to))) {
      return NextResponse.json({ success: false, error: 'Invalid date format' }, { status: 400 });
    }

    const employee = serializeEmployee(employeeRow);
    const range = normalizeRangeForEmployee(
      resolveAnalyticsDateRange({ preset, from, to, today: getEgyptDate() }),
      employee
    );
    const currentPredicate = buildDatePredicate(range);
    const currentEmployeePredicate = and(eq(attendance.userId, id), currentPredicate)!;
    const branchPredicate =
      employee.branch === null
        ? null
        : and(eq(users.branch, employee.branch), eq(users.role, 'employee'))!;
    const previous = previousRange(range);

    const [
      rows,
      previousRows,
      branchPresentDays,
      companyPresentDays,
      branchEmployees,
      companyEmployees,
    ] = await Promise.all([
      fetchAttendanceRows(currentEmployeePredicate),
      previous ? fetchAttendanceRows(and(eq(attendance.userId, id), buildDatePredicate(previous))!) : Promise.resolve([]),
      branchPredicate
        ? fetchPresentAttendanceDays(and(currentPredicate, branchPredicate)!)
        : Promise.resolve(0),
      fetchPresentAttendanceDays(and(currentPredicate, eq(users.role, 'employee'))!),
      employee.branch ? fetchComparisonEmployees(employee.branch) : Promise.resolve([]),
      fetchComparisonEmployees(),
    ]);

    const analytics = buildEmployeeAttendanceAnalytics({
      employee,
      rows,
      previousRows,
      range,
      branchComparison: employee.branch
        ? buildAnalyticsComparisonAggregate({
            employees: branchEmployees,
            presentDays: branchPresentDays,
            range,
          })
        : undefined,
      companyComparison: buildAnalyticsComparisonAggregate({
        employees: companyEmployees,
        presentDays: companyPresentDays,
        range,
      }),
      branchEmployees,
      companyEmployees,
      today: getEgyptDate(),
    });

    return NextResponse.json({ success: true, data: analytics });
  } catch (error) {
    console.error('Employee attendance analytics error:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
