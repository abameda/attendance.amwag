import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { gunzip } from 'node:zlib';
import { promisify } from 'node:util';

import {
  createSystemBackup,
  deleteBackup,
  readBackupPayloadForTests,
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

const tableExporters: BackupTableExporters = {
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

    assert.equal(backup.fileName, 'backup-amwag-attendance-2026-05-20-10-15-30.json.gz');
    assert.equal(backup.encrypted, false);
    assert.ok(existsSync(path.join(backupDir, backup.fileName)));
    assert.ok(existsSync(path.join(backupDir, `${backup.fileName}.metadata.json`)));

    const payload = JSON.parse(
      (await gunzipAsync(await readFile(path.join(backupDir, backup.fileName)))).toString('utf8')
    );

    assert.deepEqual(payload['metadata.json'].includedTables, [
      'users',
      'attendance',
      'branch_allowed_ips',
      'global_settings',
    ]);
    assert.deepEqual(payload['metadata.json'].excludedTables, ['sessions']);
    assert.equal(payload['metadata.json'].encrypted, false);
    assert.equal(payload['metadata.json'].generatedBy, 'admin-1');
    assert.equal(payload['metadata.json'].databaseType, 'mysql');
    assert.match(payload['metadata.json'].checksum, /^[a-f0-9]{64}$/);
    assert.equal(payload.tables.users.length, 1);
    assert.equal(payload.tables.attendance.length, 1);
    assert.equal(payload.tables.branch_allowed_ips.length, 1);
    assert.equal(payload.tables.global_settings.length, 1);
    assert.equal(payload.tables.sessions, undefined);
    assert.deepEqual(payload['metadata.json'].rowCounts, {
      users: 1,
      attendance: 1,
      branch_allowed_ips: 1,
      global_settings: 1,
    });
  });
});

test('createSystemBackup writes an encrypted json.gz.enc backup when BACKUP_ENCRYPTION_KEY is present', async () => {
  await withTempBackupDir(async (backupDir) => {
    const backup = await createSystemBackup({
      backupDir,
      encryptionKey: 'test encryption key',
      generatedBy: 'admin-1',
      nodeEnv: 'production',
      now: fixedNow,
      tableExporters,
    });

    assert.equal(backup.fileName, 'backup-amwag-attendance-2026-05-20-10-15-30.json.gz.enc');
    assert.equal(backup.encrypted, true);

    const encryptedText = await readFile(path.join(backupDir, backup.fileName), 'utf8');
    assert.match(encryptedText, /"algorithm":"aes-256-gcm"/);

    const payload = await readBackupPayloadForTests(backup.fileName, {
      backupDir,
      encryptionKey: 'test encryption key',
    });

    assert.equal(payload['metadata.json'].encrypted, true);
    assert.equal(payload.tables.sessions, undefined);
    assert.equal(payload.tables.users[0].email, 'admin@example.com');
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
        id: 'backup-amwag-attendance-2026-05-20-10-15-30.json.gz',
        fileName: 'backup-amwag-attendance-2026-05-20-10-15-30.json.gz',
        name: 'backup-amwag-attendance-2026-05-20-10-15-30.json.gz',
        createdAt: '2026-05-20T10:15:30.000Z',
        createdBy: 'admin-1',
        fileSize: 123,
        status: 'ready',
        includedTables: ['users'],
        excludedTables: ['sessions'],
        rowCounts: { users: 1 },
        encrypted: false,
        checksum: 'a'.repeat(64),
        databaseType: 'mysql',
        backupVersion: 1,
      };
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
