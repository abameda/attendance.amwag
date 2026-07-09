import { and, desc, eq, gte, isNull, like, lte, ne, or, sql, type SQL } from 'drizzle-orm';
import { NextRequest, NextResponse } from 'next/server';

import { isAdminOrAccountant } from '@/lib/auth';
import { normalizeAttendancePagination } from '@/lib/attendancePagination';
import { db } from '@/lib/db';
import { attendance, users } from '@/lib/db/schema';
import { getEgyptDate, isValidISODateString } from '@/lib/timezone';
import type { AttendanceRecord } from '@/types';

const VALID_STATUSES: AttendanceRecord['status'][] = [
  'present',
  'late',
  'absent',
  'missing_checkout',
  'pending',
];

type AttendanceListRow = {
  id: string;
  userId: string;
  date: Date;
  checkInTime: Date | null;
  checkOutTime: Date | null;
  ipAddress: string | null;
  checkOutIp: string | null;
  checkInLocation: string | null;
  checkOutLocation: string | null;
  status: 'present' | 'late' | 'absent' | 'missing_checkout';
  lateMinutes: number;
  earlyDepartureMinutes: number;
  overtimeMinutes: number;
  createdAt: Date;
  fullName: string | null;
  email: string | null;
  branch: string | null;
  jobTitle: string | null;
  shiftStart: string | null;
  shiftEnd: string | null;
};

type VirtualEmployeeRow = {
  id: string;
  email: string;
  fullName: string;
  role: 'admin' | 'accountant' | 'employee';
  branch: string | null;
  jobTitle: string | null;
  shiftStart: string | null;
  shiftEnd: string | null;
  offDay: string | null;
  overtimeEnabled: number;
  createdAt: Date;
  updatedAt: Date;
};

type AttendanceSummaryCounts = {
  totalRecords: number;
  present: number;
  absent: number;
  late: number;
  earlyLeave: number;
  missingCheckout: number;
  overtime: number;
};

function combinePredicates(predicates: SQL[]): SQL | undefined {
  if (predicates.length === 0) {
    return undefined;
  }

  if (predicates.length === 1) {
    return predicates[0];
  }

  return and(...predicates);
}

function toIsoString(value: Date | null): string | null {
  return value ? value.toISOString() : null;
}

function toIsoDate(value: Date): string {
  return value.toISOString().slice(0, 10);
}

function parseIsoDate(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}

function mapAttendanceRow(row: AttendanceListRow): AttendanceRecord {
  return {
    id: row.id,
    user_id: row.userId,
    date: toIsoDate(row.date),
    check_in_time: toIsoString(row.checkInTime),
    check_out_time: toIsoString(row.checkOutTime),
    ip_address: row.ipAddress,
    check_out_ip: row.checkOutIp,
    check_in_location: row.checkInLocation,
    check_out_location: row.checkOutLocation,
    status: row.status,
    late_minutes: row.lateMinutes,
    early_departure_minutes: row.earlyDepartureMinutes,
    overtime_minutes: row.overtimeMinutes,
    created_at: row.createdAt.toISOString(),
    profiles: {
      full_name: row.fullName ?? '',
      email: row.email ?? '',
      branch: row.branch,
      job_title: row.jobTitle,
      shift_start: row.shiftStart,
      shift_end: row.shiftEnd,
    } as AttendanceRecord['profiles'],
  };
}

function mapVirtualRecord(employee: VirtualEmployeeRow, date: string): AttendanceRecord {
  return {
    id: `virtual-${employee.id}`,
    user_id: employee.id,
    date,
    check_in_time: null,
    check_out_time: null,
    ip_address: null,
    check_out_ip: null,
    check_in_location: null,
    check_out_location: null,
    status: 'pending',
    late_minutes: 0,
    early_departure_minutes: 0,
    overtime_minutes: 0,
    created_at: new Date().toISOString(),
    profiles: {
      id: employee.id,
      email: employee.email,
      full_name: employee.fullName,
      role: employee.role,
      branch: employee.branch,
      job_title: employee.jobTitle,
      shift_start: employee.shiftStart,
      shift_end: employee.shiftEnd,
      off_day: employee.offDay,
      overtime_enabled: Boolean(employee.overtimeEnabled),
      created_at: employee.createdAt.toISOString(),
      updated_at: employee.updatedAt.toISOString(),
    },
  };
}

function buildAttendanceWhere(params: {
  date: string;
  dateFrom: string;
  dateTo: string;
  status: string;
  searchPattern: string;
  employeeId: string;
  branch: string;
}): SQL | undefined {
  const predicates: SQL[] = [];

  if (params.date) {
    predicates.push(eq(attendance.date, parseIsoDate(params.date)));
  } else {
    if (params.dateFrom) {
      predicates.push(gte(attendance.date, parseIsoDate(params.dateFrom)));
    }

    if (params.dateTo) {
      predicates.push(lte(attendance.date, parseIsoDate(params.dateTo)));
    }
  }

  if (params.status && params.status !== 'pending') {
    predicates.push(
      eq(attendance.status, params.status as Exclude<AttendanceRecord['status'], 'pending'>)
    );
  }

  if (params.employeeId) {
    predicates.push(eq(attendance.userId, params.employeeId));
  }

  if (params.branch) {
    predicates.push(eq(users.branch, params.branch));
  }

  if (params.searchPattern) {
    predicates.push(
      or(
        like(users.fullName, params.searchPattern),
        like(users.email, params.searchPattern),
        like(users.branch, params.searchPattern)
      )!
    );
  }

  return combinePredicates(predicates);
}

async function fetchAttendanceRows(whereClause?: SQL, limit?: number, offset?: number) {
  const baseQuery = db
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
      fullName: users.fullName,
      email: users.email,
      branch: users.branch,
      jobTitle: users.jobTitle,
      shiftStart: users.shiftStart,
      shiftEnd: users.shiftEnd,
    })
    .from(attendance)
    .leftJoin(users, eq(attendance.userId, users.id));

  const orderedQuery = whereClause
    ? baseQuery.where(whereClause).orderBy(desc(attendance.date), desc(attendance.checkInTime))
    : baseQuery.orderBy(desc(attendance.date), desc(attendance.checkInTime));

  if (typeof limit === 'number' && typeof offset === 'number') {
    return orderedQuery.limit(limit).offset(offset);
  }

  return orderedQuery;
}

async function fetchAttendanceSummary(whereClause?: SQL): Promise<AttendanceSummaryCounts> {
  const summaryQuery = db
    .select({
      totalRecords: sql<number>`count(*)`.mapWith(Number),
      present: sql<number>`sum(case when ${attendance.status} = 'present' then 1 else 0 end)`.mapWith(Number),
      absent: sql<number>`sum(case when ${attendance.status} = 'absent' then 1 else 0 end)`.mapWith(Number),
      late: sql<number>`sum(case when ${attendance.status} = 'late' then 1 else 0 end)`.mapWith(Number),
      earlyLeave: sql<number>`sum(case when ${attendance.earlyDepartureMinutes} > 0 then 1 else 0 end)`.mapWith(Number),
      missingCheckout:
        sql<number>`sum(case when ${attendance.status} = 'missing_checkout' then 1 else 0 end)`.mapWith(Number),
      overtime: sql<number>`sum(case when ${attendance.overtimeMinutes} > 0 then 1 else 0 end)`.mapWith(Number),
    })
    .from(attendance)
    .leftJoin(users, eq(attendance.userId, users.id));

  const rows = whereClause ? await summaryQuery.where(whereClause) : await summaryQuery;
  const row = rows[0];

  return {
    totalRecords: row?.totalRecords ?? 0,
    present: row?.present ?? 0,
    absent: row?.absent ?? 0,
    late: row?.late ?? 0,
    earlyLeave: row?.earlyLeave ?? 0,
    missingCheckout: row?.missingCheckout ?? 0,
    overtime: row?.overtime ?? 0,
  };
}

function addPendingToSummary(summary: AttendanceSummaryCounts, pendingCount: number): AttendanceSummaryCounts {
  if (pendingCount <= 0) return summary;
  return {
    ...summary,
    totalRecords: summary.totalRecords + pendingCount,
  };
}

export async function GET(request: NextRequest) {
  try {
    const auth = await isAdminOrAccountant(request);
    if (!auth.authorized) {
      return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
    }

    const { searchParams } = new URL(request.url);

    const date = searchParams.get('date')?.trim() ?? '';
    const dateFrom = searchParams.get('dateFrom')?.trim() ?? '';
    const dateTo = searchParams.get('dateTo')?.trim() ?? '';
    const status = searchParams.get('status')?.trim() ?? '';
    const search = searchParams.get('search')?.trim() ?? '';
    const employeeId = searchParams.get('employeeId')?.trim() ?? '';
    const branch = searchParams.get('branch')?.trim() ?? '';
    const includeExpected = searchParams.get('includeExpected') === 'true';
    const exportMode = searchParams.get('export') === 'true';
    const { page, pageSize, offset: from } = normalizeAttendancePagination({
      page: searchParams.get('page'),
      pageSize: searchParams.get('pageSize'),
      exportMode,
    });

    if (status && !VALID_STATUSES.includes(status as AttendanceRecord['status'])) {
      return NextResponse.json(
        { success: false, error: 'Invalid status filter' },
        { status: 400 }
      );
    }

    if (date && !isValidISODateString(date)) {
      return NextResponse.json(
        { success: false, error: 'Invalid date format' },
        { status: 400 }
      );
    }

    if (dateFrom && !isValidISODateString(dateFrom)) {
      return NextResponse.json(
        { success: false, error: 'Invalid dateFrom format' },
        { status: 400 }
      );
    }

    if (dateTo && !isValidISODateString(dateTo)) {
      return NextResponse.json(
        { success: false, error: 'Invalid dateTo format' },
        { status: 400 }
      );
    }

    if (dateFrom && dateTo && dateFrom > dateTo) {
      return NextResponse.json(
        { success: false, error: 'dateFrom must be before or equal to dateTo' },
        { status: 400 }
      );
    }

    const escapedSearch = search.replace(/[\\%_]/g, '\\$&');
    const searchPattern = search ? `%${escapedSearch}%` : '';

    const egyptToday = getEgyptDate();
    const isViewingToday = date === egyptToday || (!date && dateFrom === egyptToday && dateTo === egyptToday);
    const shouldVirtualize = includeExpected && isViewingToday && (!status || status === 'pending');

    if (status === 'pending' && !shouldVirtualize) {
      return NextResponse.json({
        success: true,
        data: [],
        total: 0,
        summary: {
          totalRecords: 0,
          present: 0,
          absent: 0,
          late: 0,
          earlyLeave: 0,
          missingCheckout: 0,
          overtime: 0,
        },
        page,
        pageSize,
      });
    }

    if (shouldVirtualize) {
      const dayOfWeek = new Intl.DateTimeFormat('en-US', {
        timeZone: 'Africa/Cairo',
        weekday: 'long',
      })
        .format(new Date())
        .toLowerCase();

      const employeeRows = await db
        .select({
          id: users.id,
          email: users.email,
          fullName: users.fullName,
          role: users.role,
          branch: users.branch,
          jobTitle: users.jobTitle,
          shiftStart: users.shiftStart,
          shiftEnd: users.shiftEnd,
          offDay: users.offDay,
          overtimeEnabled: users.overtimeEnabled,
          createdAt: users.createdAt,
          updatedAt: users.updatedAt,
        })
        .from(users)
        .where(and(eq(users.role, 'employee'), or(isNull(users.offDay), ne(users.offDay, dayOfWeek))));

      const todayAttendanceRows = await db
        .select({
          userId: attendance.userId,
        })
        .from(attendance)
        .where(eq(attendance.date, parseIsoDate(egyptToday)));

      const checkedInIds = new Set(todayAttendanceRows.map((row) => row.userId));

      let virtualRecords = employeeRows
        .filter((employee) => !checkedInIds.has(employee.id))
        .map((employee) => mapVirtualRecord(employee, egyptToday));

      if (employeeId) {
        virtualRecords = virtualRecords.filter((record) => record.user_id === employeeId);
      }

      if (branch) {
        virtualRecords = virtualRecords.filter((record) => record.profiles?.branch === branch);
      }

      if (search) {
        const normalizedSearch = search.toLowerCase();
        virtualRecords = virtualRecords.filter((record) => {
          const profile = record.profiles;
          return (
            profile?.full_name?.toLowerCase().includes(normalizedSearch) ||
            profile?.email?.toLowerCase().includes(normalizedSearch) ||
            profile?.branch?.toLowerCase().includes(normalizedSearch)
          );
        });
      }

      if (status === 'pending') {
        return NextResponse.json({
          success: true,
          data: virtualRecords.slice(from, from + pageSize),
          total: virtualRecords.length,
          summary: {
            totalRecords: virtualRecords.length,
            present: 0,
            absent: 0,
            late: 0,
            earlyLeave: 0,
            missingCheckout: 0,
            overtime: 0,
          },
          page,
          pageSize,
        });
      }

      const whereClause = buildAttendanceWhere({ date, dateFrom, dateTo, status, searchPattern, employeeId, branch });
      const virtualPage = virtualRecords.slice(from, from + pageSize);
      const remainingPageSize = pageSize - virtualPage.length;
      const realOffset = Math.max(0, from - virtualRecords.length);
      const [realRows, realSummary] = await Promise.all([
        remainingPageSize > 0
          ? fetchAttendanceRows(whereClause, remainingPageSize, realOffset)
          : Promise.resolve([]),
        fetchAttendanceSummary(whereClause),
      ]);

      return NextResponse.json({
        success: true,
        data: [...virtualPage, ...realRows.map(mapAttendanceRow)],
        total: virtualRecords.length + realSummary.totalRecords,
        summary: addPendingToSummary(realSummary, virtualRecords.length),
        page,
        pageSize,
      });
    }

    const whereClause = buildAttendanceWhere({ date, dateFrom, dateTo, status, searchPattern, employeeId, branch });
    const [rows, summary] = await Promise.all([
      fetchAttendanceRows(whereClause, pageSize, from),
      fetchAttendanceSummary(whereClause),
    ]);

    return NextResponse.json({
      success: true,
      data: rows.map(mapAttendanceRow),
      total: summary.totalRecords,
      summary,
      page,
      pageSize,
    });
  } catch (error) {
    console.error('Get attendance error:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
