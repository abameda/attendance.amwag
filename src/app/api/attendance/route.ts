import { and, desc, eq, isNull, like, ne, or, sql, type SQL } from 'drizzle-orm';
import { NextRequest, NextResponse } from 'next/server';

import { isAdminOrAccountant } from '@/lib/auth';
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
  status: string;
  searchPattern: string;
}): SQL | undefined {
  const predicates: SQL[] = [];

  if (params.date) {
    predicates.push(eq(attendance.date, parseIsoDate(params.date)));
  }

  if (params.status && params.status !== 'pending') {
    predicates.push(
      eq(attendance.status, params.status as Exclude<AttendanceRecord['status'], 'pending'>)
    );
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

async function fetchAttendanceCount(whereClause?: SQL) {
  const countQuery = db
    .select({
      total: sql<number>`count(*)`.mapWith(Number),
    })
    .from(attendance)
    .leftJoin(users, eq(attendance.userId, users.id));

  const rows = whereClause ? await countQuery.where(whereClause) : await countQuery;
  return rows[0]?.total ?? 0;
}

export async function GET(request: NextRequest) {
  try {
    const auth = await isAdminOrAccountant(request);
    if (!auth.authorized) {
      return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
    }

    const { searchParams } = new URL(request.url);

    const parsedPage = Number.parseInt(searchParams.get('page') ?? '1', 10);
    const parsedPageSize = Number.parseInt(searchParams.get('pageSize') ?? '10', 10);

    const page = Number.isNaN(parsedPage) || parsedPage < 1 ? 1 : parsedPage;
    const pageSize = Number.isNaN(parsedPageSize) || parsedPageSize < 1 ? 10 : parsedPageSize;

    const date = searchParams.get('date')?.trim() ?? '';
    const status = searchParams.get('status')?.trim() ?? '';
    const search = searchParams.get('search')?.trim() ?? '';
    const includeExpected = searchParams.get('includeExpected') === 'true';

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

    const from = (page - 1) * pageSize;
    const escapedSearch = search.replace(/[\\%_]/g, '\\$&');
    const searchPattern = search ? `%${escapedSearch}%` : '';

    const egyptToday = getEgyptDate();
    const isViewingToday = date === egyptToday;
    const shouldVirtualize = includeExpected && isViewingToday && (!status || status === 'pending');

    if (status === 'pending' && !shouldVirtualize) {
      return NextResponse.json({
        success: true,
        data: [],
        total: 0,
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
          page,
          pageSize,
        });
      }

      const whereClause = buildAttendanceWhere({ date, status, searchPattern });
      const realRows = await fetchAttendanceRows(whereClause);
      const realRecords = realRows.map(mapAttendanceRow);
      const combined = [...virtualRecords, ...realRecords];

      return NextResponse.json({
        success: true,
        data: combined.slice(from, from + pageSize),
        total: combined.length,
        page,
        pageSize,
      });
    }

    const whereClause = buildAttendanceWhere({ date, status, searchPattern });
    const [rows, total] = await Promise.all([
      fetchAttendanceRows(whereClause, pageSize, from),
      fetchAttendanceCount(whereClause),
    ]);

    return NextResponse.json({
      success: true,
      data: rows.map(mapAttendanceRow),
      total,
      page,
      pageSize,
    });
  } catch (error) {
    console.error('Get attendance error:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
