import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdir, readdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { gzip, gunzip } from 'node:zlib';
import { promisify } from 'node:util';

import { db } from '@/lib/db';
import { attendance, branchAllowedIps, globalSettings, users } from '@/lib/db/schema';

const gzipAsync = promisify(gzip);
const gunzipAsync = promisify(gunzip);

export const INCLUDED_BACKUP_TABLES = [
  'users',
  'attendance',
  'branch_allowed_ips',
  'global_settings',
] as const;

export const EXCLUDED_BACKUP_TABLES = ['sessions'] as const;

export type IncludedBackupTable = (typeof INCLUDED_BACKUP_TABLES)[number];
export type BackupTableExporters = Record<IncludedBackupTable, () => Promise<unknown[]>>;

export type BackupStatus = 'ready';

export interface BackupMetadata {
  appName: 'Amwag Attendance System';
  backupName: string;
  backupVersion: 1;
  generatedAt: string;
  generatedBy: string;
  createdAt: string;
  createdBy: string;
  databaseType: 'mysql';
  includedTables: IncludedBackupTable[];
  excludedTables: string[];
  rowCounts: Record<IncludedBackupTable, number>;
  encrypted: boolean;
  checksum: string;
  status: BackupStatus;
}

export interface BackupPayload {
  'metadata.json': BackupMetadata;
  tables: Record<IncludedBackupTable, unknown[]>;
}

export interface BackupRecord extends BackupMetadata {
  id: string;
  fileName: string;
  name: string;
  fileSize: number;
}

export interface BackupDownload {
  fileName: string;
  fileSize: number;
  contentType: string;
  buffer: Buffer;
}

export interface CreateSystemBackupOptions {
  backupDir?: string;
  encryptionKey?: string;
  generatedBy: string;
  nodeEnv?: string;
  now?: Date;
  tableExporters?: BackupTableExporters;
}

export interface BackupStorageOptions {
  backupDir?: string;
  encryptionKey?: string;
}

export class BackupError extends Error {
  constructor(
    message: string,
    public readonly status = 500
  ) {
    super(message);
    this.name = 'BackupError';
  }
}

const BACKUP_FILE_PATTERN =
  /^backup-amwag-attendance-\d{4}-\d{2}-\d{2}-\d{2}-\d{2}-\d{2}\.json\.gz(?:\.enc)?$/;

const defaultTableExporters: BackupTableExporters = {
  users: async () => db.select().from(users),
  attendance: async () => db.select().from(attendance),
  branch_allowed_ips: async () => db.select().from(branchAllowedIps),
  global_settings: async () => db.select().from(globalSettings),
};

export function resolveBackupDirectory(backupDir = path.join(process.cwd(), 'storage', 'backups')) {
  return path.resolve(backupDir);
}

function assertSafeBackupId(id: string) {
  const decoded = decodeURIComponent(id);
  if (!BACKUP_FILE_PATTERN.test(decoded) || path.basename(decoded) !== decoded) {
    throw new BackupError('Invalid backup id', 400);
  }
  return decoded;
}

function backupPath(backupDir: string, id: string) {
  const safeId = assertSafeBackupId(id);
  const resolvedDir = resolveBackupDirectory(backupDir);
  const resolvedPath = path.resolve(resolvedDir, safeId);

  if (!resolvedPath.startsWith(`${resolvedDir}${path.sep}`)) {
    throw new BackupError('Invalid backup id', 400);
  }

  return resolvedPath;
}

function metadataPath(filePath: string) {
  return `${filePath}.metadata.json`;
}

function timestampForFile(date: Date) {
  return date.toISOString().replace(/\.\d{3}Z$/, '').replace('T', '-').replaceAll(':', '-');
}

function normalizeForJson(value: unknown): unknown {
  if (value instanceof Date) {
    return value.toISOString();
  }

  if (typeof value === 'bigint') {
    return value.toString();
  }

  if (Array.isArray(value)) {
    return value.map((item) => normalizeForJson(item));
  }

  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, normalizeForJson(item)])
    );
  }

  return value;
}

function checksum(value: unknown) {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

function encryptionKeyToBytes(encryptionKey: string) {
  return createHash('sha256').update(encryptionKey).digest();
}

function encryptBuffer(buffer: Buffer, encryptionKey: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', encryptionKeyToBytes(encryptionKey), iv);
  const ciphertext = Buffer.concat([cipher.update(buffer), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return Buffer.from(
    JSON.stringify({
      algorithm: 'aes-256-gcm',
      iv: iv.toString('base64'),
      authTag: authTag.toString('base64'),
      ciphertext: ciphertext.toString('base64'),
    })
  );
}

function decryptBuffer(buffer: Buffer, encryptionKey: string) {
  const envelope = JSON.parse(buffer.toString('utf8')) as {
    algorithm: string;
    iv: string;
    authTag: string;
    ciphertext: string;
  };

  if (envelope.algorithm !== 'aes-256-gcm') {
    throw new BackupError('Unsupported backup encryption algorithm', 400);
  }

  const decipher = createDecipheriv(
    'aes-256-gcm',
    encryptionKeyToBytes(encryptionKey),
    Buffer.from(envelope.iv, 'base64')
  );
  decipher.setAuthTag(Buffer.from(envelope.authTag, 'base64'));

  return Buffer.concat([
    decipher.update(Buffer.from(envelope.ciphertext, 'base64')),
    decipher.final(),
  ]);
}

async function collectTables(tableExporters: BackupTableExporters) {
  const entries = await Promise.all(
    INCLUDED_BACKUP_TABLES.map(async (tableName) => {
      const rows = await tableExporters[tableName]();
      return [tableName, normalizeForJson(rows)] as const;
    })
  );

  return Object.fromEntries(entries) as Record<IncludedBackupTable, unknown[]>;
}

export async function createSystemBackup(options: CreateSystemBackupOptions): Promise<BackupRecord> {
  const backupDir = resolveBackupDirectory(options.backupDir);
  const nodeEnv = options.nodeEnv ?? process.env.NODE_ENV ?? 'development';
  const encryptionKey = options.encryptionKey ?? process.env.BACKUP_ENCRYPTION_KEY ?? '';
  const encrypted = Boolean(encryptionKey);

  if (nodeEnv === 'production' && !encrypted) {
    throw new BackupError(
      'BACKUP_ENCRYPTION_KEY is required to create backups in production',
      500
    );
  }

  await mkdir(backupDir, { recursive: true, mode: 0o700 });

  const generatedAt = options.now ?? new Date();
  const fileName = `backup-amwag-attendance-${timestampForFile(generatedAt)}.json.gz${
    encrypted ? '.enc' : ''
  }`;
  const filePath = backupPath(backupDir, fileName);
  const tables = await collectTables(options.tableExporters ?? defaultTableExporters);
  const rowCounts = Object.fromEntries(
    INCLUDED_BACKUP_TABLES.map((tableName) => [tableName, tables[tableName].length])
  ) as Record<IncludedBackupTable, number>;

  const metadataWithoutChecksum = {
    appName: 'Amwag Attendance System' as const,
    backupName: fileName,
    backupVersion: 1 as const,
    generatedAt: generatedAt.toISOString(),
    generatedBy: options.generatedBy,
    createdAt: generatedAt.toISOString(),
    createdBy: options.generatedBy,
    databaseType: 'mysql' as const,
    includedTables: [...INCLUDED_BACKUP_TABLES],
    excludedTables: [...EXCLUDED_BACKUP_TABLES],
    rowCounts,
    encrypted,
    status: 'ready' as const,
  };

  const metadata: BackupMetadata = {
    ...metadataWithoutChecksum,
    checksum: checksum({ metadata: metadataWithoutChecksum, tables }),
  };

  const payload: BackupPayload = {
    'metadata.json': metadata,
    tables,
  };

  const gzipped = await gzipAsync(Buffer.from(JSON.stringify(payload)));
  const storedBuffer = encrypted ? encryptBuffer(gzipped, encryptionKey) : gzipped;
  await writeFile(filePath, storedBuffer, { mode: 0o600 });

  const fileStats = await stat(filePath);
  const record: BackupRecord = {
    ...metadata,
    id: fileName,
    fileName,
    name: fileName,
    fileSize: fileStats.size,
  };
  await writeFile(metadataPath(filePath), JSON.stringify(record, null, 2), { mode: 0o600 });

  console.info('System backup created', {
    backupName: fileName,
    createdBy: options.generatedBy,
    encrypted,
  });

  return record;
}

export async function listBackups(options: BackupStorageOptions = {}): Promise<BackupRecord[]> {
  const backupDir = resolveBackupDirectory(options.backupDir);
  await mkdir(backupDir, { recursive: true, mode: 0o700 });

  const entries = await readdir(backupDir);
  const backups = await Promise.all(
    entries
      .filter((entry) => BACKUP_FILE_PATTERN.test(entry))
      .map(async (entry) => {
        const filePath = backupPath(backupDir, entry);
        const fileStats = await stat(filePath);
        const sidecarPath = metadataPath(filePath);

        if (existsSync(sidecarPath)) {
          const metadata = JSON.parse(await readFile(sidecarPath, 'utf8')) as BackupRecord;
          return {
            ...metadata,
            fileSize: fileStats.size,
          };
        }

        return {
          id: entry,
          fileName: entry,
          name: entry,
          fileSize: fileStats.size,
          appName: 'Amwag Attendance System' as const,
          backupName: entry,
          backupVersion: 1 as const,
          generatedAt: fileStats.birthtime.toISOString(),
          generatedBy: 'unknown',
          createdAt: fileStats.birthtime.toISOString(),
          createdBy: 'unknown',
          databaseType: 'mysql' as const,
          includedTables: [...INCLUDED_BACKUP_TABLES],
          excludedTables: [...EXCLUDED_BACKUP_TABLES],
          rowCounts: {
            users: 0,
            attendance: 0,
            branch_allowed_ips: 0,
            global_settings: 0,
          },
          encrypted: entry.endsWith('.enc'),
          checksum: '',
          status: 'ready' as const,
        };
      })
  );

  return backups.sort(
    (left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime()
  );
}

export async function getBackupForDownload(
  id: string,
  options: BackupStorageOptions = {}
): Promise<BackupDownload> {
  const backupDir = resolveBackupDirectory(options.backupDir);
  const filePath = backupPath(backupDir, id);

  if (!existsSync(filePath)) {
    throw new BackupError('Backup not found', 404);
  }

  const fileStats = await stat(filePath);
  const buffer = await readFile(filePath);
  const fileName = path.basename(filePath);

  return {
    fileName,
    fileSize: fileStats.size,
    contentType: fileName.endsWith('.enc') ? 'application/octet-stream' : 'application/gzip',
    buffer,
  };
}

export async function deleteBackup(id: string, options: BackupStorageOptions = {}): Promise<void> {
  const backupDir = resolveBackupDirectory(options.backupDir);
  const filePath = backupPath(backupDir, id);

  if (!existsSync(filePath)) {
    throw new BackupError('Backup not found', 404);
  }

  await rm(filePath);
  await rm(metadataPath(filePath), { force: true });
}

export async function readBackupPayloadForTests(
  id: string,
  options: BackupStorageOptions = {}
): Promise<BackupPayload> {
  const download = await getBackupForDownload(id, options);
  let buffer = download.buffer;

  if (download.fileName.endsWith('.enc')) {
    if (!options.encryptionKey) {
      throw new BackupError('Encryption key is required to read encrypted backup', 400);
    }

    buffer = decryptBuffer(buffer, options.encryptionKey);
  }

  return JSON.parse((await gunzipAsync(buffer)).toString('utf8')) as BackupPayload;
}
