import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { gunzip } from 'node:zlib';
import { promisify } from 'node:util';

import {
  createSystemBackup,
  deleteBackup,
  readBackupPayloadForTests,
  readBackupPayload,
  restoreBackup,
  type BackupRecord,
  type BackupRestoreAdapter,
  type IncludedBackupTable,
  type BackupTableExporters,
} from '../src/lib/backups';
import {
  createCreateBackupHandler,
  createDeleteBackupHandler,
  createDownloadBackupHandler,
  createListBackupsHandler,
} from '../src/app/api/admin/backups/handlers';

const gunzipAsync = promisify(gunzip);

const fixedNow = new Date('2026-05-20T10:15:30.000Z');
const backupFileNamePattern =
  /^backup-amwag-attendance-2026-05-20-10-15-30-[a-f0-9]{12}\.json\.gz$/;
const encryptedBackupFileNamePattern =
  /^backup-amwag-attendance-2026-05-20-10-15-30-[a-f0-9]{12}\.json\.gz\.enc$/;
const backupEncryptionKey = 'a'.repeat(64);

const tableExporters: BackupTableExporters = {
  branches: async () => [
    {
      id: 'branch-1',
      name: 'Head Office',
      code: 'HQ',
      address: 'Main campus',
      isActive: 1,
    },
  ],
  users: async () => [
    {
      id: 'admin-1',
      email: 'admin@example.com',
      fullName: 'Admin User',
      role: 'admin',
      passwordHash: 'hash',
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
    },
  ],
  attendance: async () => [
    {
      id: 'attendance-1',
      userId: 'employee-1',
      date: '2026-05-20',
      status: 'present',
    },
  ],
  branch_allowed_ips: async () => [
    {
      id: 'branch-ip-1',
      branchName: 'HQ',
      ruleType: 'cidr',
      ipNetwork: '10.0.0.0/24',
      isActive: 1,
    },
  ],
  global_settings: async () => [
    {
      id: 1,
      earlyCheckinMinutes: 60,
      lateGraceMinutes: 0,
      checkoutWindowMinutes: 60,
      maxOvertimeMinutes: 180,
    },
  ],
};

async function withTempBackupDir<T>(run: (backupDir: string) => Promise<T>) {
  const backupDir = await mkdtemp(path.join(tmpdir(), 'amwag-backups-test-'));
  try {
    return await run(backupDir);
  } finally {
    await rm(backupDir, { force: true, recursive: true });
  }
}

function request(url = 'http://localhost/api/admin/backups', init?: RequestInit) {
  return new Request(url, init) as never;
}

function createMemoryRestoreAdapter(
  target: Record<IncludedBackupTable, unknown[]>
): BackupRestoreAdapter {
  return {
    transaction: async (restore) => {
      const draft = Object.fromEntries(
        Object.entries(target).map(([tableName, rows]) => [tableName, [...rows]])
      ) as Record<IncludedBackupTable, unknown[]>;

      const result = await restore({
        clearTable: async (tableName) => {
          draft[tableName] = [];
        },
        insertRows: async (tableName, rows) => {
          draft[tableName] = rows.map((row) =>
            row && typeof row === 'object' ? { ...row } : row
          );
        },
      });

      for (const tableName of Object.keys(target) as IncludedBackupTable[]) {
        target[tableName] = draft[tableName];
      }

      return result;
    },
  };
}

test('createSystemBackup rejects unencrypted production backups when BACKUP_ENCRYPTION_KEY is missing', async () => {
  await withTempBackupDir(async (backupDir) => {
    await assert.rejects(
      () =>
        createSystemBackup({
          backupDir,
          encryptionKey: '',
          generatedBy: 'admin-1',
          nodeEnv: 'production',
          now: fixedNow,
          tableExporters,
        }),
      /BACKUP_ENCRYPTION_KEY is required/
    );
  });
});

test('createSystemBackup rejects invalid BACKUP_ENCRYPTION_KEY values', async () => {
  await withTempBackupDir(async (backupDir) => {
    await assert.rejects(
      () =>
        createSystemBackup({
          backupDir,
          encryptionKey: 'test encryption key',
          generatedBy: 'admin-1',
          nodeEnv: 'production',
          now: fixedNow,
          tableExporters,
        }),
      /64 hexadecimal characters/
    );
  });
});

test('createSystemBackup writes a development json.gz backup with metadata and default table contents', async () => {
  await withTempBackupDir(async (backupDir) => {
    const backup = await createSystemBackup({
      backupDir,
      encryptionKey: '',
      generatedBy: 'admin-1',
      nodeEnv: 'development',
      now: fixedNow,
      tableExporters,
    });

    assert.match(backup.fileName, backupFileNamePattern);
    assert.equal(backup.encrypted, false);
    assert.ok(existsSync(path.join(backupDir, backup.fileName)));
    assert.ok(existsSync(path.join(backupDir, `${backup.fileName}.metadata.json`)));

    const payload = JSON.parse(
      (await gunzipAsync(await readFile(path.join(backupDir, backup.fileName)))).toString('utf8')
    );

    assert.deepEqual(payload['metadata.json'].includedTables, [
      'branches',
      'users',
      'attendance',
      'branch_allowed_ips',
      'global_settings',
    ]);
    assert.deepEqual(payload['metadata.json'].excludedTables, ['sessions']);
    assert.equal(payload['metadata.json'].encrypted, false);
    assert.equal(payload['metadata.json'].generatedBy, 'admin-1');
    assert.equal(payload['metadata.json'].databaseType, 'mysql');
    assert.equal(payload['metadata.json'].backupVersion, 2);
    assert.match(payload['metadata.json'].checksum, /^[a-f0-9]{64}$/);
    assert.equal(payload.tables.branches.length, 1);
    assert.equal(payload.tables.users.length, 1);
    assert.equal(payload.tables.attendance.length, 1);
    assert.equal(payload.tables.branch_allowed_ips.length, 1);
    assert.equal(payload.tables.global_settings.length, 1);
    assert.equal(payload.tables.sessions, undefined);
    assert.deepEqual(payload['metadata.json'].rowCounts, {
      branches: 1,
      users: 1,
      attendance: 1,
      branch_allowed_ips: 1,
      global_settings: 1,
    });
  });
});

test('createSystemBackup reads backup tables in batches while preserving payload shape', async () => {
  await withTempBackupDir(async (backupDir) => {
    const attendanceRows = Array.from({ length: 5 }, (_, index) => ({
      id: `attendance-${index + 1}`,
      userId: `employee-${index + 1}`,
      date: '2026-05-20',
      status: 'present',
    }));
    const attendancePages: Array<{ limit: number; offset: number }> = [];

    const backup = await createSystemBackup({
      backupDir,
      encryptionKey: '',
      generatedBy: 'admin-1',
      nodeEnv: 'development',
      now: fixedNow,
      tableBatchSize: 2,
      tableExporters: {
        branches: async ({ limit, offset, tableName }) =>
          tableExporters.branches({ limit, offset, tableName }).then((rows) =>
            rows.slice(offset, offset + limit)
          ),
        users: async ({ limit, offset, tableName }) =>
          tableExporters.users({ limit, offset, tableName }).then((rows) => rows.slice(offset, offset + limit)),
        attendance: async ({ limit, offset }) => {
          attendancePages.push({ limit, offset });
          return attendanceRows.slice(offset, offset + limit);
        },
        branch_allowed_ips: async ({ limit, offset }) =>
          tableExporters
            .branch_allowed_ips({ limit, offset, tableName: 'branch_allowed_ips' })
            .then((rows) => rows.slice(offset, offset + limit)),
        global_settings: async ({ limit, offset }) =>
          tableExporters
            .global_settings({ limit, offset, tableName: 'global_settings' })
            .then((rows) => rows.slice(offset, offset + limit)),
      },
    });

    const payload = JSON.parse(
      (await gunzipAsync(await readFile(path.join(backupDir, backup.fileName)))).toString('utf8')
    );

    assert.deepEqual(attendancePages, [
      { limit: 2, offset: 0 },
      { limit: 2, offset: 2 },
      { limit: 2, offset: 4 },
      { limit: 2, offset: 6 },
    ]);
    assert.equal(payload.tables.attendance.length, 5);
    assert.equal(payload.tables.attendance[4].id, 'attendance-5');
    assert.equal(payload['metadata.json'].rowCounts.attendance, 5);
    assert.equal(payload['metadata.json'].checksum, backup.checksum);
    assert.deepEqual(Object.keys(payload), ['metadata.json', 'tables']);
  });
});

test('createSystemBackup removes staged table json when export fails', async () => {
  await withTempBackupDir(async (backupDir) => {
    await assert.rejects(
      () =>
        createSystemBackup({
          backupDir,
          encryptionKey: '',
          generatedBy: 'admin-1',
          nodeEnv: 'development',
          now: fixedNow,
          tableExporters: {
            ...tableExporters,
            attendance: async () => {
              throw new Error('attendance export failed');
            },
          },
        }),
      /attendance export failed/
    );

    const entries = await readdir(backupDir);
    assert.deepEqual(
      entries.filter((entry) => entry.endsWith('.tmp')),
      []
    );
  });
});

test('createSystemBackup uses distinct staging and output paths for concurrent runs', async () => {
  await withTempBackupDir(async (backupDir) => {
    const [firstBackup, secondBackup] = await Promise.all([
      createSystemBackup({
        backupDir,
        encryptionKey: backupEncryptionKey,
        generatedBy: 'admin-1',
        nodeEnv: 'production',
        now: fixedNow,
        tableExporters,
      }),
      createSystemBackup({
        backupDir,
        encryptionKey: backupEncryptionKey,
        generatedBy: 'admin-1',
        nodeEnv: 'production',
        now: fixedNow,
        tableExporters,
      }),
    ]);

    assert.notEqual(firstBackup.fileName, secondBackup.fileName);
    assert.match(firstBackup.fileName, encryptedBackupFileNamePattern);
    assert.match(secondBackup.fileName, encryptedBackupFileNamePattern);

    const entries = await readdir(backupDir);
    assert.deepEqual(
      entries.filter((entry) => entry.endsWith('.tmp')),
      []
    );
  });
});

test('createSystemBackup writes an encrypted json.gz.enc backup when BACKUP_ENCRYPTION_KEY is present', async () => {
  await withTempBackupDir(async (backupDir) => {
    const backup = await createSystemBackup({
      backupDir,
      encryptionKey: backupEncryptionKey,
      generatedBy: 'admin-1',
      nodeEnv: 'production',
      now: fixedNow,
      tableExporters,
    });

    assert.match(backup.fileName, encryptedBackupFileNamePattern);
    assert.equal(backup.encrypted, true);

    const encryptedText = await readFile(path.join(backupDir, backup.fileName), 'utf8');
    assert.match(encryptedText, /"algorithm":"aes-256-gcm"/);
    assert.match(encryptedText, /"keyDerivation":"hex"/);

    const payload = await readBackupPayloadForTests(backup.fileName, {
      backupDir,
      encryptionKey: backupEncryptionKey,
    });

    assert.equal(payload['metadata.json'].encrypted, true);
    const tables = payload.tables as Record<string, Array<{ email?: string }> | undefined>;
    assert.equal(tables.sessions, undefined);
    assert.equal(tables.users?.[0]?.email, 'admin@example.com');
  });
});

test('restoreBackup replaces backed-up tables on an isolated temporary restore target', async () => {
  await withTempBackupDir(async (backupDir) => {
    const backup = await createSystemBackup({
      backupDir,
      encryptionKey: '',
      generatedBy: 'admin-1',
      nodeEnv: 'development',
      now: fixedNow,
      tableExporters,
    });
    const target: Record<IncludedBackupTable, unknown[]> = {
      branches: [{ id: 'stale-branch' }],
      users: [{ id: 'stale-user' }],
      attendance: [{ id: 'stale-attendance' }],
      branch_allowed_ips: [{ id: 'stale-ip' }],
      global_settings: [{ id: 1, lateGraceMinutes: 99 }],
    };

    const result = await restoreBackup(backup.fileName, {
      backupDir,
      adapter: createMemoryRestoreAdapter(target),
    });

    assert.deepEqual(result.restoredTables, [
      'branches',
      'users',
      'attendance',
      'branch_allowed_ips',
      'global_settings',
    ]);
    assert.deepEqual(result.rowCounts, {
      branches: 1,
      users: 1,
      attendance: 1,
      branch_allowed_ips: 1,
      global_settings: 1,
    });
    assert.equal((target.branches[0] as { id: string }).id, 'branch-1');
    assert.equal((target.users[0] as { email: string }).email, 'admin@example.com');
    assert.equal((target.attendance[0] as { id: string }).id, 'attendance-1');
    assert.equal((target.branch_allowed_ips[0] as { id: string }).id, 'branch-ip-1');
    assert.equal((target.global_settings[0] as { lateGraceMinutes: number }).lateGraceMinutes, 0);
  });
});

test('restoreBackup refuses invalid or corrupt backup files before mutating restore target', async () => {
  await withTempBackupDir(async (backupDir) => {
    const corruptBackupName = 'backup-amwag-attendance-2026-05-20-10-15-30-deadbeefcafe.json.gz';
    await writeFile(path.join(backupDir, corruptBackupName), 'not a gzip backup', {
      mode: 0o600,
    });
    const target: Record<IncludedBackupTable, unknown[]> = {
      branches: [{ id: 'existing-branch' }],
      users: [{ id: 'existing-user' }],
      attendance: [],
      branch_allowed_ips: [],
      global_settings: [],
    };

    await assert.rejects(
      () =>
        restoreBackup(corruptBackupName, {
          backupDir,
          adapter: createMemoryRestoreAdapter(target),
        }),
      /Invalid or corrupt backup file/
    );
    await assert.rejects(
      () => readBackupPayload(corruptBackupName, { backupDir }),
      /Invalid or corrupt backup file/
    );
    assert.deepEqual(target.branches, [{ id: 'existing-branch' }]);
    assert.deepEqual(target.users, [{ id: 'existing-user' }]);
  });
});

test('deleteBackup only deletes safe backup filenames inside the backup directory', async () => {
  await withTempBackupDir(async (backupDir) => {
    const backup = await createSystemBackup({
      backupDir,
      encryptionKey: '',
      generatedBy: 'admin-1',
      nodeEnv: 'development',
      now: fixedNow,
      tableExporters,
    });

    await assert.rejects(
      () => deleteBackup('../unsafe.json.gz', { backupDir }),
      /Invalid backup id/
    );

    assert.ok(existsSync(path.join(backupDir, backup.fileName)));

    await deleteBackup(backup.fileName, { backupDir });

    assert.equal(existsSync(path.join(backupDir, backup.fileName)), false);
    assert.equal(existsSync(path.join(backupDir, `${backup.fileName}.metadata.json`)), false);
  });
});

test('GET /api/admin/backups rejects employees before listing backups', async () => {
  let listed = false;
  const get = createListBackupsHandler({
    isAdmin: async () => ({ authorized: false, error: 'Forbidden', status: 403 }),
    listBackups: async () => {
      listed = true;
      return [];
    },
  });

  const response = await get(request());
  const body = await response.json();

  assert.equal(response.status, 403);
  assert.equal(body.success, false);
  assert.equal(listed, false);
});

test('POST /api/admin/backups/create allows admin and passes creator id to the service', async () => {
  let generatedBy = '';
  const post = createCreateBackupHandler({
    isAdmin: async () => ({ authorized: true, userId: 'admin-1', role: 'admin' }),
    createSystemBackup: async (options) => {
      generatedBy = options.generatedBy;
      return {
        appName: 'Amwag Attendance System',
        backupName: 'backup-amwag-attendance-2026-05-20-10-15-30.json.gz',
        id: 'backup-amwag-attendance-2026-05-20-10-15-30.json.gz',
        fileName: 'backup-amwag-attendance-2026-05-20-10-15-30.json.gz',
        name: 'backup-amwag-attendance-2026-05-20-10-15-30.json.gz',
        generatedAt: '2026-05-20T10:15:30.000Z',
        generatedBy: 'admin-1',
        createdAt: '2026-05-20T10:15:30.000Z',
        createdBy: 'admin-1',
        fileSize: 123,
        status: 'ready',
        includedTables: ['branches', 'users', 'attendance', 'branch_allowed_ips', 'global_settings'],
        excludedTables: ['sessions'],
        rowCounts: {
          branches: 0,
          users: 1,
          attendance: 0,
          branch_allowed_ips: 0,
          global_settings: 0,
        },
        encrypted: false,
        checksum: 'a'.repeat(64),
        databaseType: 'mysql',
        backupVersion: 2,
      } satisfies BackupRecord;
    },
  });

  const response = await post(request('http://localhost/api/admin/backups/create', { method: 'POST' }));
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.success, true);
  assert.equal(body.data.createdBy, 'admin-1');
  assert.equal(generatedBy, 'admin-1');
});

test('GET /api/admin/backups/[id]/download rejects unauthenticated users before reading file', async () => {
  let read = false;
  const get = createDownloadBackupHandler({
    isAdmin: async () => ({ authorized: false, error: 'Unauthorized', status: 401 }),
    getBackupForDownload: async () => {
      read = true;
      throw new Error('should not read');
    },
  });

  const response = await get(request(), {
    params: Promise.resolve({ id: 'backup-amwag-attendance-2026-05-20-10-15-30.json.gz' }),
  });
  const body = await response.json();

  assert.equal(response.status, 401);
  assert.equal(body.success, false);
  assert.equal(read, false);
});

test('DELETE /api/admin/backups/[id] rejects employees before deleting file', async () => {
  let deleted = false;
  const del = createDeleteBackupHandler({
    isAdmin: async () => ({ authorized: false, error: 'Forbidden', status: 403 }),
    deleteBackup: async () => {
      deleted = true;
    },
  });

  const response = await del(request(), {
    params: Promise.resolve({ id: 'backup-amwag-attendance-2026-05-20-10-15-30.json.gz' }),
  });
  const body = await response.json();

  assert.equal(response.status, 403);
  assert.equal(body.success, false);
  assert.equal(deleted, false);
});
