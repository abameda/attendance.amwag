import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test, { mock } from 'node:test';

import { createCheckInHandler } from '../src/app/api/attendance/check-in/handler';
import { createCheckOutHandler } from '../src/app/api/attendance/check-out/handler';
import { createCurrentUserAttendanceHandler } from '../src/app/api/attendance/me/handler';
import { createAttendanceSummaryHandler } from '../src/app/api/attendance/summary/handler';
import { createMarkAbsentForEndedShifts } from '../src/lib/attendanceFinalization';
import { normalizeAttendancePagination } from '../src/lib/attendancePagination';

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
  branchId: 'branch-hq-1',
  jobTitle: null,
  offDay: null,
  shiftStart: '09:00',
  shiftEnd: '17:00',
  overtimeEnabled: 1,
  mustChangePassword: 0,
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedAt: new Date('2026-01-01T00:00:00.000Z'),
};

const admin = {
  ...employee,
  id: 'admin-1',
  email: 'admin@example.com',
  fullName: 'Test Admin',
  role: 'admin' as const,
};

const accountant = {
  ...employee,
  id: 'accountant-1',
  email: 'accountant@example.com',
  fullName: 'Test Accountant',
  role: 'accountant' as const,
};

const settings = {
  early_checkin_minutes: 60,
  late_grace_minutes: 10,
  checkout_window_minutes: 60,
  max_overtime_minutes: 180,
};

test('legacy mark-absent endpoint delegates to the locked finalization flow', () => {
  const source = readFileSync(
    'src/app/api/internal/attendance/mark-absent/route.ts',
    'utf8'
  );

  assert.ok(
    source.includes('executeAttendanceFinalization'),
    'legacy route should call the same locked finalization flow as /finalize'
  );
  assert.ok(
    !source.includes('markAbsentForEndedShifts'),
    'legacy route must not bypass the finalization lock'
  );
});

test('normalizeAttendancePagination caps normal requests and preserves explicit export requests', () => {
  assert.deepEqual(
    normalizeAttendancePagination({
      page: '2',
      pageSize: '50000',
      exportMode: false,
    }),
    {
      page: 2,
      pageSize: 100,
      offset: 100,
    }
  );

  assert.deepEqual(
    normalizeAttendancePagination({
      page: '1',
      pageSize: '50000',
      exportMode: true,
    }),
    {
      page: 1,
      pageSize: 50000,
      offset: 0,
    }
  );
});

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

function createQueuedDb(
  selectResponses: unknown[][],
  options: { affectedRows?: number; insertError?: unknown } = {}
) {
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
                  orderBy() {
                    return {
                      limit() {
                        return Promise.resolve(rows);
                      },
                      then(resolve: (value: unknown[]) => void) {
                        return Promise.resolve(rows).then(resolve);
                      },
                    };
                  },
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
            if (options.insertError) {
              return Promise.reject(options.insertError);
            }
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
    const fake = createQueuedDb([
      [{ branchName: 'HQ', ruleType: 'cidr', ipNetwork: '10.0.0.0/24', isActive: 1 }],
      [],
    ]);
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

test('POST /api/attendance/check-in rejects unauthenticated requests', async () => {
  const fake = createQueuedDb([]);
  const post = createCheckInHandler({
    db: fake.db as never,
    getCurrentUser: async () => null,
    getGlobalSettings: async () => settings,
  });

  const response = await post(request('http://localhost/api/attendance/check-in'));
  const body = await response.json();

  assert.equal(response.status, 401);
  assert.equal(body.success, false);
  assert.equal(body.error, 'Unauthorized');
  assert.equal(fake.inserts.length, 0);
});

test('POST /api/attendance/check-in rejects admin self-service attendance', async () => {
  await withClock('2026-07-01T06:25:00.000Z', async () => {
    const fake = createQueuedDb([
      [{ branchName: 'HQ', ruleType: 'cidr', ipNetwork: '10.0.0.0/24', isActive: 1 }],
      [],
    ]);
    const post = createCheckInHandler({
      db: fake.db as never,
      getCurrentUser: async () => admin,
      getGlobalSettings: async () => settings,
    });

    const response = await post(request('http://localhost/api/attendance/check-in'));
    const body = await response.json();

    assert.equal(response.status, 403);
    assert.equal(body.success, false);
    assert.equal(body.error, 'Forbidden');
    assert.equal(fake.inserts.length, 0);
  });
});

test('POST /api/attendance/check-in rejects accountant self-service attendance', async () => {
  await withClock('2026-07-01T06:25:00.000Z', async () => {
    const fake = createQueuedDb([
      [{ branchName: 'HQ', ruleType: 'cidr', ipNetwork: '10.0.0.0/24', isActive: 1 }],
      [],
    ]);
    const post = createCheckInHandler({
      db: fake.db as never,
      getCurrentUser: async () => accountant,
      getGlobalSettings: async () => settings,
    });

    const response = await post(request('http://localhost/api/attendance/check-in'));
    const body = await response.json();

    assert.equal(response.status, 403);
    assert.equal(body.success, false);
    assert.equal(body.error, 'Forbidden');
    assert.equal(fake.inserts.length, 0);
  });
});

test('POST /api/attendance/check-in returns conflict when a concurrent check-in wins the insert race', async () => {
  await withClock('2026-07-01T06:25:00.000Z', async () => {
    const fake = createQueuedDb(
      [
        [{ branchName: 'HQ', ruleType: 'cidr', ipNetwork: '10.0.0.0/24', isActive: 1 }],
        [],
      ],
      {
        insertError: Object.assign(new Error('Duplicate entry'), {
          code: 'ER_DUP_ENTRY',
          errno: 1062,
          sqlState: '23000',
        }),
      }
    );
    const post = createCheckInHandler({
      db: fake.db as never,
      getCurrentUser: async () => employee,
      getGlobalSettings: async () => settings,
    });

    const response = await post(request('http://localhost/api/attendance/check-in'));
    const body = await response.json();

    assert.equal(response.status, 409);
    assert.equal(body.success, false);
    assert.equal(body.error, 'Duplicate check-in is not allowed for the same work date');
  });
});

test('POST /api/attendance/check-out records early checkout using the mocked clock', async () => {
  await withClock('2026-07-01T13:30:00.000Z', async () => {
    const fake = createQueuedDb([
      [{ branchName: 'HQ', ruleType: 'cidr', ipNetwork: '10.0.0.0/24', isActive: 1 }],
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

test('POST /api/attendance/check-out rejects unauthenticated requests', async () => {
  const fake = createQueuedDb([]);
  const post = createCheckOutHandler({
    db: fake.db as never,
    getCurrentUser: async () => null,
    getGlobalSettings: async () => settings,
  });

  const response = await post(request('http://localhost/api/attendance/check-out'));
  const body = await response.json();

  assert.equal(response.status, 401);
  assert.equal(body.success, false);
  assert.equal(body.error, 'Unauthorized');
  assert.equal(fake.updates.length, 0);
});

test('POST /api/attendance/check-out rejects admin self-service attendance', async () => {
  await withClock('2026-07-01T13:30:00.000Z', async () => {
    const fake = createQueuedDb([
      [{ branchName: 'HQ', ruleType: 'cidr', ipNetwork: '10.0.0.0/24', isActive: 1 }],
      [
        {
          id: 'attendance-1',
          userId: 'admin-1',
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
      getCurrentUser: async () => admin,
      getGlobalSettings: async () => settings,
    });

    const response = await post(request('http://localhost/api/attendance/check-out'));
    const body = await response.json();

    assert.equal(response.status, 403);
    assert.equal(body.success, false);
    assert.equal(body.error, 'Forbidden');
    assert.equal(fake.updates.length, 0);
  });
});

test('POST /api/attendance/check-out rejects accountant self-service attendance', async () => {
  await withClock('2026-07-01T13:30:00.000Z', async () => {
    const fake = createQueuedDb([
      [{ branchName: 'HQ', ruleType: 'cidr', ipNetwork: '10.0.0.0/24', isActive: 1 }],
      [
        {
          id: 'attendance-1',
          userId: 'accountant-1',
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
      getCurrentUser: async () => accountant,
      getGlobalSettings: async () => settings,
    });

    const response = await post(request('http://localhost/api/attendance/check-out'));
    const body = await response.json();

    assert.equal(response.status, 403);
    assert.equal(body.success, false);
    assert.equal(body.error, 'Forbidden');
    assert.equal(fake.updates.length, 0);
  });
});

test('GET /api/attendance/me returns fresh records using the stored work date', async () => {
  const fake = createQueuedDb([
    [
      {
        id: 'attendance-1',
        userId: 'employee-1',
        date: new Date('2026-07-08T00:00:00.000+03:00'),
        checkInTime: new Date('2026-07-08T06:00:00.000Z'),
        checkOutTime: null,
        ipAddress: '10.0.0.45',
        checkOutIp: null,
        checkInLocation: 'HQ',
        checkOutLocation: null,
        status: 'present',
        lateMinutes: 0,
        earlyDepartureMinutes: 0,
        overtimeMinutes: 0,
        createdAt: new Date('2026-07-08T06:00:00.000Z'),
      },
    ],
  ]);
  const get = createCurrentUserAttendanceHandler({
    db: fake.db as never,
    getCurrentUser: async () => employee,
  });

  const response = await get(request('http://localhost/api/attendance/me'));
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.equal(body.success, true);
  assert.equal(body.data[0].date, '2026-07-08');
  assert.equal(body.data[0].check_in_time, '2026-07-08T06:00:00.000Z');
});

test('GET /api/attendance/me rejects unauthenticated requests', async () => {
  const fake = createQueuedDb([]);
  const get = createCurrentUserAttendanceHandler({
    db: fake.db as never,
    getCurrentUser: async () => null,
  });

  const response = await get(request('http://localhost/api/attendance/me'));
  const body = await response.json();

  assert.equal(response.status, 401);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.equal(body.success, false);
  assert.equal(body.error, 'Unauthorized');
});

test('GET /api/attendance/me rejects admin self-service attendance reads', async () => {
  const fake = createQueuedDb([
    [
      {
        id: 'attendance-1',
        userId: 'admin-1',
        date: new Date('2026-07-08T00:00:00.000+03:00'),
        checkInTime: new Date('2026-07-08T06:00:00.000Z'),
        checkOutTime: null,
        ipAddress: '10.0.0.45',
        checkOutIp: null,
        checkInLocation: 'HQ',
        checkOutLocation: null,
        status: 'present',
        lateMinutes: 0,
        earlyDepartureMinutes: 0,
        overtimeMinutes: 0,
        createdAt: new Date('2026-07-08T06:00:00.000Z'),
      },
    ],
  ]);
  const get = createCurrentUserAttendanceHandler({
    db: fake.db as never,
    getCurrentUser: async () => admin,
  });

  const response = await get(request('http://localhost/api/attendance/me'));
  const body = await response.json();

  assert.equal(response.status, 403);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.equal(body.success, false);
  assert.equal(body.error, 'Forbidden');
});

test('GET /api/attendance/me rejects accountant self-service attendance reads', async () => {
  const fake = createQueuedDb([
    [
      {
        id: 'attendance-1',
        userId: 'accountant-1',
        date: new Date('2026-07-08T00:00:00.000+03:00'),
        checkInTime: new Date('2026-07-08T06:00:00.000Z'),
        checkOutTime: null,
        ipAddress: '10.0.0.45',
        checkOutIp: null,
        checkInLocation: 'HQ',
        checkOutLocation: null,
        status: 'present',
        lateMinutes: 0,
        earlyDepartureMinutes: 0,
        overtimeMinutes: 0,
        createdAt: new Date('2026-07-08T06:00:00.000Z'),
      },
    ],
  ]);
  const get = createCurrentUserAttendanceHandler({
    db: fake.db as never,
    getCurrentUser: async () => accountant,
  });

  const response = await get(request('http://localhost/api/attendance/me'));
  const body = await response.json();

  assert.equal(response.status, 403);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.equal(body.success, false);
  assert.equal(body.error, 'Forbidden');
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
    const fake = createQueuedDb([
      [{ branchName: 'HQ', ruleType: 'cidr', ipNetwork: '10.0.0.0/24', isActive: 1 }],
      [],
    ]);
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

test('POST /api/attendance/check-in rejects neighboring IP when branch rule is exact', async () => {
  await withClock('2026-07-01T06:25:00.000Z', async () => {
    const fake = createQueuedDb([
      [{ branchName: 'HQ', ruleType: 'exact_ip', ipNetwork: '10.0.0.45', isActive: 1 }],
    ]);
    const post = createCheckInHandler({
      db: fake.db as never,
      getCurrentUser: async () => employee,
      getGlobalSettings: async () => settings,
    });

    const response = await post(
      request('http://localhost/api/attendance/check-in', {
        headers: { 'x-real-ip': '10.0.0.46' },
      })
    );
    const body = await response.json();

    assert.equal(response.status, 403);
    assert.equal(body.success, false);
    assert.equal(fake.inserts.length, 0);
  });
});

test('POST /api/attendance/check-in accepts client IP inside branch CIDR', async () => {
  await withClock('2026-07-01T06:25:00.000Z', async () => {
    const fake = createQueuedDb([
      [{ branchName: 'HQ', ruleType: 'cidr', ipNetwork: '10.0.0.0/24', isActive: 1 }],
      [],
    ]);
    const post = createCheckInHandler({
      db: fake.db as never,
      getCurrentUser: async () => employee,
      getGlobalSettings: async () => settings,
    });

    const response = await post(request('http://localhost/api/attendance/check-in'));
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.equal(body.success, true);
    assert.equal(body.data.check_in_location, 'HQ');
  });
});

test('POST /api/attendance/check-in rejects when no IP rules are configured for the employee branch', async () => {
  await withClock('2026-07-01T06:25:00.000Z', async () => {
    // With branchId-filtered DB queries, another branch's rules are never returned.
    // An empty result means the employee's branch has no IP rules configured.
    const fake = createQueuedDb([[]]);
    const post = createCheckInHandler({
      db: fake.db as never,
      getCurrentUser: async () => employee,
      getGlobalSettings: async () => settings,
    });

    const response = await post(request('http://localhost/api/attendance/check-in'));
    const body = await response.json();

    assert.equal(response.status, 403);
    assert.equal(body.success, false);
    assert.equal(fake.inserts.length, 0);
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
