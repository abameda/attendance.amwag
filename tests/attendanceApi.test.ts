import assert from 'node:assert/strict';
import test, { mock } from 'node:test';

import { createCheckInHandler } from '../src/app/api/attendance/check-in/handler';
import { createCheckOutHandler } from '../src/app/api/attendance/check-out/handler';
import { createAttendanceSummaryHandler } from '../src/app/api/attendance/summary/handler';
import { createMarkAbsentForEndedShifts } from '../src/lib/attendanceFinalization';

type AttendanceRow = {
  id: string;
  userId: string;
  date: Date;
  checkInTime: Date | null;
  checkOutTime: Date | null;
  ipAddress?: string | null;
  status: 'present' | 'late' | 'absent' | 'missing_checkout';
  lateMinutes: number;
};

const employee = {
  id: 'employee-1',
  email: 'employee@example.com',
  passwordHash: 'hash',
  fullName: 'Test Employee',
  role: 'employee' as const,
  branch: 'HQ',
  jobTitle: null,
  offDay: null,
  shiftStart: '09:00',
  shiftEnd: '17:00',
  overtimeEnabled: 1,
  mustChangePassword: 0,
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedAt: new Date('2026-01-01T00:00:00.000Z'),
};

const settings = {
  early_checkin_minutes: 60,
  late_grace_minutes: 10,
  checkout_window_minutes: 60,
  max_overtime_minutes: 180,
};

function request(url: string, init?: RequestInit) {
  return new Request(url, {
    ...init,
    headers: {
      'x-real-ip': '10.0.0.45',
      ...(init?.headers ?? {}),
    },
  }) as never;
}

function withClock<T>(isoNow: string, run: () => Promise<T>): Promise<T> {
  mock.timers.enable({ apis: ['Date'], now: new Date(isoNow) });
  return run().finally(() => mock.timers.reset());
}

function createQueuedDb(selectResponses: unknown[][], options: { affectedRows?: number } = {}) {
  const inserts: unknown[] = [];
  const updates: unknown[] = [];

  return {
    inserts,
    updates,
    db: {
      select() {
        const rows = selectResponses.shift() ?? [];
        return {
          from() {
            return {
              where() {
                return {
                  limit() {
                    return Promise.resolve(rows);
                  },
                  then(resolve: (value: unknown[]) => void) {
                    return Promise.resolve(rows).then(resolve);
                  },
                };
              },
              then(resolve: (value: unknown[]) => void) {
                return Promise.resolve(rows).then(resolve);
              },
            };
          },
        };
      },
      insert() {
        return {
          values(value: unknown) {
            inserts.push(value);
            return Promise.resolve({ affectedRows: 1 });
          },
        };
      },
      update() {
        return {
          set(value: unknown) {
            updates.push(value);
            return {
              where() {
                return Promise.resolve({ affectedRows: options.affectedRows ?? 1 });
              },
            };
          },
        };
      },
    },
  };
}

test('POST /api/attendance/check-in records a late check-in using the mocked clock', async () => {
  await withClock('2026-07-01T06:25:00.000Z', async () => {
    const fake = createQueuedDb([[{ branchName: 'HQ' }], []]);
    const post = createCheckInHandler({
      db: fake.db as never,
      getCurrentUser: async () => employee,
      getGlobalSettings: async () => settings,
    });

    const response = await post(request('http://localhost/api/attendance/check-in'));
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.equal(body.success, true);
    assert.equal(body.data.status, 'late');
    assert.equal(body.data.late_minutes, 25);
    assert.equal(body.data.check_in_time, '2026-07-01T06:25:00.000Z');
    const inserted = fake.inserts[0] as { id: string };
    assert.match(inserted.id, /^[0-9a-f-]{36}$/);
    assert.deepEqual({ ...inserted, id: 'generated-id' }, {
      id: 'generated-id',
      userId: 'employee-1',
      date: new Date('2026-07-01T00:00:00.000Z'),
      checkInTime: new Date('2026-07-01T06:25:00.000Z'),
      ipAddress: '10.0.0.45',
      checkInLocation: 'HQ',
      lateMinutes: 25,
      status: 'late',
    });
  });
});

test('POST /api/attendance/check-out records early checkout using the mocked clock', async () => {
  await withClock('2026-07-01T13:30:00.000Z', async () => {
    const fake = createQueuedDb([
      [{ branchName: 'HQ' }],
      [
        {
          id: 'attendance-1',
          userId: 'employee-1',
          date: new Date('2026-07-01T00:00:00.000Z'),
          checkInTime: new Date('2026-07-01T06:00:00.000Z'),
          checkOutTime: null,
          ipAddress: '10.0.0.45',
          status: 'present',
          lateMinutes: 0,
        } satisfies AttendanceRow,
      ],
    ]);
    const post = createCheckOutHandler({
      db: fake.db as never,
      getCurrentUser: async () => employee,
      getGlobalSettings: async () => settings,
    });

    const response = await post(request('http://localhost/api/attendance/check-out'));
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.equal(body.success, true);
    assert.equal(body.data.check_out_time, '2026-07-01T13:30:00.000Z');
    assert.equal(body.data.early_departure_minutes, 30);
    assert.equal(body.data.overtime_minutes, 0);
    assert.deepEqual(fake.updates[0], {
      checkOutTime: new Date('2026-07-01T13:30:00.000Z'),
      checkOutIp: '10.0.0.45',
      checkOutLocation: 'HQ',
      earlyDepartureMinutes: 30,
      overtimeMinutes: 0,
      status: 'present',
    });
  });
});

test('finalization marks a missing checkout after the configured checkout window expires', async () => {
  await withClock('2026-07-01T15:01:00.000Z', async () => {
    const fake = createQueuedDb([
      [
        {
          id: 'employee-1',
          fullName: 'Test Employee',
          offDay: null,
          shiftStart: '09:00',
          shiftEnd: '17:00',
        },
      ],
      [
        {
          id: 'attendance-yesterday',
          status: 'present',
          checkInTime: new Date('2026-06-30T06:00:00.000Z'),
          checkOutTime: new Date('2026-06-30T14:00:00.000Z'),
        },
      ],
      [
        {
          id: 'attendance-1',
          status: 'present',
          checkInTime: new Date('2026-07-01T06:00:00.000Z'),
          checkOutTime: null,
        },
      ],
    ]);
    const markAbsentForEndedShifts = createMarkAbsentForEndedShifts({
      db: fake.db as never,
      getGlobalSettings: async () => settings,
    });

    const result = await markAbsentForEndedShifts();

    assert.equal(result.markedMissingCheckout, 1);
    assert.equal(result.markedAbsent, 0);
    assert.deepEqual(fake.updates[0], {
      status: 'missing_checkout',
      checkOutTime: null,
    });
  });
});

test('POST /api/attendance/check-in assigns an after-midnight overnight check-in to the previous work date', async () => {
  await withClock('2026-07-01T21:30:00.000Z', async () => {
    const overnightEmployee = { ...employee, shiftStart: '22:00', shiftEnd: '06:00' };
    const fake = createQueuedDb([[{ branchName: 'HQ' }], []]);
    const post = createCheckInHandler({
      db: fake.db as never,
      getCurrentUser: async () => overnightEmployee,
      getGlobalSettings: async () => settings,
    });

    const response = await post(request('http://localhost/api/attendance/check-in'));
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.equal(body.success, true);
    assert.equal((fake.inserts[0] as { date: Date }).date.toISOString(), '2026-07-01T00:00:00.000Z');
    assert.equal(body.data.status, 'late');
    assert.equal(body.data.late_minutes, 150);
  });
});

test('GET /api/attendance/summary uses the mocked current month for the default monthly summary', async () => {
  await withClock('2026-07-02T09:00:00.000Z', async () => {
    const fake = createQueuedDb([
      [
        { id: 'employee-1', fullName: 'Test Employee', branch: 'HQ', offDay: null },
        { id: 'employee-2', fullName: 'Second Employee', branch: 'HQ', offDay: null },
      ],
      [
        { userId: 'employee-1', status: 'late', date: new Date('2026-07-01T00:00:00.000Z') },
        {
          userId: 'employee-2',
          status: 'missing_checkout',
          date: new Date('2026-07-01T00:00:00.000Z'),
        },
      ],
    ]);
    const get = createAttendanceSummaryHandler({
      db: fake.db as never,
      isAdminOrAccountant: async () => ({ authorized: true, userId: 'admin-1', role: 'admin' }),
    });

    const response = await get(request('http://localhost/api/attendance/summary'));
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.equal(body.success, true);
    assert.equal(body.data.expectedEmployees, 4);
    assert.equal(body.data.lateCount, 1);
    assert.equal(body.data.missingCheckoutCount, 1);
    assert.equal(body.data.absentCount, 2);
    assert.equal(body.data.attendanceRate, 50);
  });
});
