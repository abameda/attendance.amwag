import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import { createReadStream, createWriteStream, existsSync } from 'node:fs';
import { mkdir, readdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { Readable, Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { createGzip, gunzip } from 'node:zlib';
import { promisify } from 'node:util';

import { db } from '@/lib/db';
import { attendance, branches, branchAllowedIps, globalSettings, users } from '@/lib/db/schema';
import { asc } from 'drizzle-orm';

const gunzipAsync = promisify(gunzip);

const DEFAULT_BACKUP_TABLE_BATCH_SIZE = 1000;
const MAX_BACKUP_TABLE_BATCH_SIZE = 5000;

export const INCLUDED_BACKUP_TABLES = [
  'branches',
  'users',
  'attendance',
  'branch_allowed_ips',
  'global_settings',
] as const;

export const EXCLUDED_BACKUP_TABLES = ['sessions'] as const;

export type IncludedBackupTable = (typeof INCLUDED_BACKUP_TABLES)[number];
export interface BackupTableExportPage {
  tableName: IncludedBackupTable;
  limit: number;
  offset: number;
}
export type BackupTableExporter = (page: BackupTableExportPage) => Promise<unknown[]>;
export type BackupTableExporters = Record<IncludedBackupTable, BackupTableExporter>;

export type BackupStatus = 'ready';

export interface BackupMetadata {
  appName: 'Amwag Attendance System';
  backupName: string;
  backupVersion: 1 | 2;
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
  maxRowsPerTable?: number;
  nodeEnv?: string;
  tableBatchSize?: number;
  now?: Date;
  tableExporters?: BackupTableExporters;
}

export interface BackupStorageOptions {
  backupDir?: string;
  encryptionKey?: string;
}

export interface BackupRestoreOptions extends BackupStorageOptions {
  adapter?: BackupRestoreAdapter;
}

export interface BackupRestoreTransaction {
  clearTable: (tableName: IncludedBackupTable) => Promise<void>;
  insertRows: (tableName: IncludedBackupTable, rows: unknown[]) => Promise<void>;
}

export interface BackupRestoreAdapter {
  transaction: <T>(restore: (transaction: BackupRestoreTransaction) => Promise<T>) => Promise<T>;
}

export interface BackupRestoreResult {
  backupName: string;
  backupVersion: 1 | 2;
  restoredTables: IncludedBackupTable[];
  rowCounts: Record<IncludedBackupTable, number>;
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
  /^backup-amwag-attendance-\d{4}-\d{2}-\d{2}-\d{2}-\d{2}-\d{2}(?:-[a-f0-9]{12})?\.json\.gz(?:\.enc)?$/;

const defaultTableExporters: BackupTableExporters = {
  branches: async ({ limit, offset }) =>
    db.select().from(branches).orderBy(asc(branches.id)).limit(limit).offset(offset),
  users: async ({ limit, offset }) =>
    db.select().from(users).orderBy(asc(users.id)).limit(limit).offset(offset),
  attendance: async ({ limit, offset }) =>
    db.select().from(attendance).orderBy(asc(attendance.id)).limit(limit).offset(offset),
  branch_allowed_ips: async ({ limit, offset }) =>
    db
      .select()
      .from(branchAllowedIps)
      .orderBy(asc(branchAllowedIps.id))
      .limit(limit)
      .offset(offset),
  global_settings: async ({ limit, offset }) =>
    db
      .select()
      .from(globalSettings)
      .orderBy(asc(globalSettings.id))
      .limit(limit)
      .offset(offset),
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

function randomFileSuffix() {
  return randomBytes(6).toString('hex');
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

const BACKUP_ENCRYPTION_KEY_PATTERN = /^[a-f0-9]{64}$/i;

export function normalizeBackupEncryptionKey(encryptionKey?: string) {
  const normalized = (encryptionKey ?? '').trim();

  if (!normalized) {
    return '';
  }

  if (!BACKUP_ENCRYPTION_KEY_PATTERN.test(normalized)) {
    throw new BackupError(
      'BACKUP_ENCRYPTION_KEY must be exactly 64 hexadecimal characters (32 bytes). Generate it with: openssl rand -hex 32',
      500
    );
  }

  return normalized.toLowerCase();
}

function encryptionKeyToBytes(encryptionKey: string) {
  return Buffer.from(normalizeBackupEncryptionKey(encryptionKey), 'hex');
}

function legacyEncryptionKeyToBytes(encryptionKey: string) {
  return createHash('sha256').update(encryptionKey).digest();
}

function decryptBuffer(buffer: Buffer, encryptionKey: string) {
  const envelope = JSON.parse(buffer.toString('utf8')) as {
    algorithm: string;
    keyDerivation?: string;
    iv: string;
    authTag: string;
    ciphertext: string;
  };

  if (envelope.algorithm !== 'aes-256-gcm') {
    throw new BackupError('Unsupported backup encryption algorithm', 400);
  }

  const normalizedKey = normalizeBackupEncryptionKey(encryptionKey);
  const candidateKeys =
    envelope.keyDerivation === 'hex'
      ? [encryptionKeyToBytes(normalizedKey)]
      : [encryptionKeyToBytes(normalizedKey), legacyEncryptionKeyToBytes(encryptionKey)];

  for (const candidateKey of candidateKeys) {
    try {
      const decipher = createDecipheriv(
        'aes-256-gcm',
        candidateKey,
        Buffer.from(envelope.iv, 'base64')
      );
      decipher.setAuthTag(Buffer.from(envelope.authTag, 'base64'));

      return Buffer.concat([
        decipher.update(Buffer.from(envelope.ciphertext, 'base64')),
        decipher.final(),
      ]);
    } catch {
      // Try the legacy derivation used before the envelope recorded keyDerivation.
    }
  }

  throw new BackupError('Unable to decrypt backup with BACKUP_ENCRYPTION_KEY', 400);
}

function normalizeTableBatchSize(value?: number) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 1) {
    return DEFAULT_BACKUP_TABLE_BATCH_SIZE;
  }

  return Math.min(MAX_BACKUP_TABLE_BATCH_SIZE, Math.trunc(value));
}

function assertRowLimit(tableName: IncludedBackupTable, rowCount: number, maxRowsPerTable?: number) {
  if (
    typeof maxRowsPerTable === 'number' &&
    Number.isFinite(maxRowsPerTable) &&
    maxRowsPerTable >= 0 &&
    rowCount > maxRowsPerTable
  ) {
    throw new BackupError(
      `Backup table "${tableName}" exceeded the configured row limit of ${maxRowsPerTable}`,
      413
    );
  }
}

async function* iterateTableRows(params: {
  tableName: IncludedBackupTable;
  exporter: BackupTableExporter;
  batchSize: number;
  maxRowsPerTable?: number;
}) {
  let offset = 0;
  let rowCount = 0;
  const supportsPaging = params.exporter.length > 0;

  while (true) {
    const rows = supportsPaging
      ? await params.exporter({
          tableName: params.tableName,
          limit: params.batchSize,
          offset,
        })
      : offset === 0
        ? await params.exporter({
            tableName: params.tableName,
            limit: params.batchSize,
            offset,
          })
        : [];

    if (!Array.isArray(rows)) {
      throw new BackupError(`Backup table "${params.tableName}" exporter returned invalid rows`);
    }

    if (rows.length === 0) {
      break;
    }

    for (const row of rows) {
      rowCount += 1;
      assertRowLimit(params.tableName, rowCount, params.maxRowsPerTable);
      yield normalizeForJson(row);
    }

    if (!supportsPaging) {
      break;
    }

    offset += params.batchSize;
  }
}

async function writeTablesJsonFile(params: {
  filePath: string;
  tableExporters: BackupTableExporters;
  batchSize: number;
  maxRowsPerTable?: number;
}) {
  const rowCounts = Object.fromEntries(
    INCLUDED_BACKUP_TABLES.map((tableName) => [tableName, 0])
  ) as Record<IncludedBackupTable, number>;

  async function* chunks() {
    yield '{';

    for (const [tableIndex, tableName] of INCLUDED_BACKUP_TABLES.entries()) {
      if (tableIndex > 0) {
        yield ',';
      }

      yield `${JSON.stringify(tableName)}:[`;

      let firstRow = true;
      for await (const row of iterateTableRows({
        tableName,
        exporter: params.tableExporters[tableName],
        batchSize: params.batchSize,
        maxRowsPerTable: params.maxRowsPerTable,
      })) {
        rowCounts[tableName] += 1;

        if (!firstRow) {
          yield ',';
        }
        firstRow = false;
        yield JSON.stringify(row);
      }

      yield ']';
    }

    yield '}';
  }

  await pipeline(Readable.from(chunks()), createWriteStream(params.filePath, { mode: 0o600 }));

  return rowCounts;
}

async function checksumBackupTables(metadataWithoutChecksum: Omit<BackupMetadata, 'checksum'>, tablesJsonPath: string) {
  const hash = createHash('sha256');
  hash.update('{"metadata":');
  hash.update(JSON.stringify(metadataWithoutChecksum));
  hash.update(',"tables":');

  for await (const chunk of createReadStream(tablesJsonPath)) {
    hash.update(chunk);
  }

  hash.update('}');
  return hash.digest('hex');
}

async function* payloadJsonChunks(metadata: BackupMetadata, tablesJsonPath: string) {
  yield '{"metadata.json":';
  yield JSON.stringify(metadata);
  yield ',"tables":';

  for await (const chunk of createReadStream(tablesJsonPath)) {
    yield chunk;
  }

  yield '}';
}

class Base64Encode extends Transform {
  private carry: Buffer<ArrayBufferLike> = Buffer.alloc(0);

  override _transform(
    chunk: Buffer | string,
    encoding: BufferEncoding,
    callback: (error?: Error | null) => void
  ) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk, encoding);
    const input = this.carry.length > 0 ? Buffer.concat([this.carry, buffer]) : buffer;
    const remainder = input.length % 3;
    const completeLength = input.length - remainder;

    if (completeLength > 0) {
      this.push(input.subarray(0, completeLength).toString('base64'));
    }

    this.carry = remainder > 0 ? input.subarray(completeLength) : Buffer.alloc(0);
    callback();
  }

  override _flush(callback: (error?: Error | null) => void) {
    if (this.carry.length > 0) {
      this.push(this.carry.toString('base64'));
      this.carry = Buffer.alloc(0);
    }

    callback();
  }
}

async function writeBackupFile(params: {
  filePath: string;
  metadata: BackupMetadata;
  tablesJsonPath: string;
  encryptionKey: string;
}) {
  if (!params.encryptionKey) {
    await pipeline(
      Readable.from(payloadJsonChunks(params.metadata, params.tablesJsonPath)),
      createGzip(),
      createWriteStream(params.filePath, { flags: 'wx', mode: 0o600 })
    );
    return;
  }

  const ciphertextPath = `${params.filePath}.${randomFileSuffix()}.ciphertext.tmp`;

  try {
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', encryptionKeyToBytes(params.encryptionKey), iv);

    await pipeline(
      Readable.from(payloadJsonChunks(params.metadata, params.tablesJsonPath)),
      createGzip(),
      cipher,
      new Base64Encode(),
      createWriteStream(ciphertextPath, { mode: 0o600 })
    );

    const envelopePrefix = `{"algorithm":"aes-256-gcm","keyDerivation":"hex","iv":${JSON.stringify(
      iv.toString('base64')
    )},"ciphertext":"`;
    const envelopeSuffix = `","authTag":${JSON.stringify(cipher.getAuthTag().toString('base64'))}}`;

    async function* envelopeChunks() {
      yield envelopePrefix;
      for await (const chunk of createReadStream(ciphertextPath)) {
        yield chunk;
      }
      yield envelopeSuffix;
    }

    await pipeline(
      Readable.from(envelopeChunks()),
      createWriteStream(params.filePath, { flags: 'wx', mode: 0o600 })
    );
  } finally {
    await rm(ciphertextPath, { force: true });
  }
}

export async function createSystemBackup(options: CreateSystemBackupOptions): Promise<BackupRecord> {
  const backupDir = resolveBackupDirectory(options.backupDir);
  const nodeEnv = options.nodeEnv ?? process.env.NODE_ENV ?? 'development';
  const encryptionKey = normalizeBackupEncryptionKey(
    options.encryptionKey ?? process.env.BACKUP_ENCRYPTION_KEY
  );
  const encrypted = Boolean(encryptionKey);

  if (nodeEnv === 'production' && !encrypted) {
    throw new BackupError(
      'BACKUP_ENCRYPTION_KEY is required to create backups in production',
      500
    );
  }

  await mkdir(backupDir, { recursive: true, mode: 0o700 });

  const generatedAt = options.now ?? new Date();
  const fileName = `backup-amwag-attendance-${timestampForFile(generatedAt)}-${randomFileSuffix()}.json.gz${
    encrypted ? '.enc' : ''
  }`;
  const filePath = backupPath(backupDir, fileName);
  const tablesJsonPath = `${filePath}.${randomFileSuffix()}.tables.tmp`;
  const batchSize = normalizeTableBatchSize(options.tableBatchSize);
  let rowCounts = Object.fromEntries(
    INCLUDED_BACKUP_TABLES.map((tableName) => [tableName, 0])
  ) as Record<IncludedBackupTable, number>;

  try {
    rowCounts = await writeTablesJsonFile({
      filePath: tablesJsonPath,
      tableExporters: options.tableExporters ?? defaultTableExporters,
      batchSize,
      maxRowsPerTable: options.maxRowsPerTable,
    });

    const metadataWithoutChecksum = {
      appName: 'Amwag Attendance System' as const,
      backupName: fileName,
      backupVersion: 2 as const,
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
      checksum: await checksumBackupTables(metadataWithoutChecksum, tablesJsonPath),
    };

    await writeBackupFile({
      filePath,
      metadata,
      tablesJsonPath,
      encryptionKey,
    });

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
  } finally {
    await rm(tablesJsonPath, { force: true });
  }
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
            branches: 0,
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

const BACKUP_V1_TABLES = [
  'users',
  'attendance',
  'branch_allowed_ips',
  'global_settings',
] as const satisfies readonly IncludedBackupTable[];

const DRIZZLE_BACKUP_TABLES: Record<IncludedBackupTable, unknown> = {
  branches,
  users,
  attendance,
  branch_allowed_ips: branchAllowedIps,
  global_settings: globalSettings,
};

function includedTablesForVersion(backupVersion: 1 | 2): readonly IncludedBackupTable[] {
  return backupVersion === 1 ? BACKUP_V1_TABLES : INCLUDED_BACKUP_TABLES;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function checksumPayload(metadata: BackupMetadata, tables: Record<string, unknown>) {
  const { checksum: _checksum, ...metadataWithoutChecksum } = metadata;
  const hash = createHash('sha256');

  hash.update('{"metadata":');
  hash.update(JSON.stringify(metadataWithoutChecksum));
  hash.update(',"tables":');
  hash.update(JSON.stringify(tables));
  hash.update('}');

  return hash.digest('hex');
}

export function validateBackupPayload(payload: unknown): BackupPayload {
  if (!isPlainObject(payload)) {
    throw new BackupError('Invalid backup payload', 400);
  }

  const metadata = payload['metadata.json'] as BackupMetadata | undefined;
  const tables = payload.tables as Record<string, unknown> | undefined;

  if (!isPlainObject(metadata) || !isPlainObject(tables)) {
    throw new BackupError('Invalid backup payload structure', 400);
  }

  if (metadata.appName !== 'Amwag Attendance System') {
    throw new BackupError('Backup was not created by this application', 400);
  }

  if (metadata.backupVersion !== 1 && metadata.backupVersion !== 2) {
    throw new BackupError('Unsupported backup version', 400);
  }

  if (metadata.databaseType !== 'mysql') {
    throw new BackupError('Unsupported backup database type', 400);
  }

  if (!Array.isArray(metadata.includedTables) || !Array.isArray(metadata.excludedTables)) {
    throw new BackupError('Invalid backup table metadata', 400);
  }

  if (!metadata.excludedTables.includes('sessions')) {
    throw new BackupError('Backup metadata must exclude sessions', 400);
  }

  if (Object.prototype.hasOwnProperty.call(tables, 'sessions')) {
    throw new BackupError('Backup payload must not include sessions', 400);
  }

  const expectedTables = includedTablesForVersion(metadata.backupVersion);
  for (const tableName of expectedTables) {
    if (!metadata.includedTables.includes(tableName)) {
      throw new BackupError(`Backup metadata is missing table "${tableName}"`, 400);
    }

    if (!Array.isArray(tables[tableName])) {
      throw new BackupError(`Backup payload is missing table "${tableName}"`, 400);
    }

    const expectedCount = metadata.rowCounts?.[tableName] ?? 0;
    if ((tables[tableName] as unknown[]).length !== expectedCount) {
      throw new BackupError(`Backup row count mismatch for table "${tableName}"`, 400);
    }
  }

  for (const tableName of Object.keys(tables)) {
    if (!(INCLUDED_BACKUP_TABLES as readonly string[]).includes(tableName)) {
      throw new BackupError(`Backup payload contains unsupported table "${tableName}"`, 400);
    }
  }

  if (!/^[a-f0-9]{64}$/.test(metadata.checksum) || checksumPayload(metadata, tables) !== metadata.checksum) {
    throw new BackupError('Backup checksum validation failed', 400);
  }

  return payload as unknown as BackupPayload;
}

export async function readBackupPayload(
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

  try {
    return validateBackupPayload(JSON.parse((await gunzipAsync(buffer)).toString('utf8')));
  } catch (error) {
    if (error instanceof BackupError) {
      throw error;
    }

    throw new BackupError('Invalid or corrupt backup file', 400);
  }
}

export async function readBackupPayloadForTests(
  id: string,
  options: BackupStorageOptions = {}
): Promise<BackupPayload> {
  return readBackupPayload(id, options);
}

export function createDrizzleBackupRestoreAdapter(database = db): BackupRestoreAdapter {
  return {
    transaction: async (restore) =>
      (database as never as { transaction: <T>(run: (tx: unknown) => Promise<T>) => Promise<T> }).transaction(
        async (tx) =>
          restore({
            clearTable: async (tableName) => {
              await (tx as never as { delete: (table: unknown) => Promise<unknown> }).delete(
                DRIZZLE_BACKUP_TABLES[tableName]
              );
            },
            insertRows: async (tableName, rows) => {
              if (rows.length === 0) {
                return;
              }

              await (
                tx as never as {
                  insert: (table: unknown) => {
                    values: (values: unknown[]) => Promise<unknown>;
                  };
                }
              )
                .insert(DRIZZLE_BACKUP_TABLES[tableName])
                .values(rows);
            },
          })
      ),
  };
}

export async function restoreBackupPayload(
  payload: BackupPayload,
  options: { adapter?: BackupRestoreAdapter } = {}
): Promise<BackupRestoreResult> {
  const validatedPayload = validateBackupPayload(payload);
  const metadata = validatedPayload['metadata.json'];
  const tables = validatedPayload.tables as Record<IncludedBackupTable, unknown[] | undefined>;
  const adapter = options.adapter ?? createDrizzleBackupRestoreAdapter();
  const restoreTables = [...includedTablesForVersion(metadata.backupVersion)];
  const rowCounts = Object.fromEntries(
    INCLUDED_BACKUP_TABLES.map((tableName) => [tableName, tables[tableName]?.length ?? 0])
  ) as Record<IncludedBackupTable, number>;

  await adapter.transaction(async (transaction) => {
    for (const tableName of [...restoreTables].reverse()) {
      await transaction.clearTable(tableName);
    }

    for (const tableName of restoreTables) {
      await transaction.insertRows(tableName, tables[tableName] ?? []);
    }
  });

  return {
    backupName: metadata.backupName,
    backupVersion: metadata.backupVersion,
    restoredTables: restoreTables,
    rowCounts,
  };
}

export async function restoreBackup(
  id: string,
  options: BackupRestoreOptions = {}
): Promise<BackupRestoreResult> {
  const payload = await readBackupPayload(id, options);
  return restoreBackupPayload(payload, { adapter: options.adapter });
}
