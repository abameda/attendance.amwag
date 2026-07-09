import { config } from 'dotenv';

import { pool } from '../src/lib/db';
import { BackupError, restoreBackup } from '../src/lib/backups';

config({ path: '.env.local' });

const backupId = process.argv[2]?.trim();
const backupDir = process.env.BACKUP_DIR;
const nodeEnv = process.env.NODE_ENV ?? 'development';

if (!backupId) {
  console.error('Usage: npm run backup:restore -- <backup-file-name>');
  process.exit(1);
}

const expectedRestoreConfirm = `RESTORE:${backupId}`;
if (process.env.RESTORE_CONFIRM !== expectedRestoreConfirm) {
  console.error(`Set RESTORE_CONFIRM=${expectedRestoreConfirm} before running restore.`);
  process.exit(1);
}

if (nodeEnv === 'production' && process.env.RESTORE_PRODUCTION_CONFIRM !== 'PRODUCTION_RESTORE_APPROVED') {
  console.error(
    'Production restore is blocked. Set RESTORE_PRODUCTION_CONFIRM=PRODUCTION_RESTORE_APPROVED only after staging validation and a fresh emergency backup.'
  );
  process.exit(1);
}

try {
  const result = await restoreBackup(backupId, {
    backupDir,
    encryptionKey: process.env.BACKUP_ENCRYPTION_KEY,
  });

  console.info('Restore completed', {
    backupName: result.backupName,
    backupVersion: result.backupVersion,
    restoredTables: result.restoredTables,
    rowCounts: result.rowCounts,
  });
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  const status = error instanceof BackupError ? ` (${error.status})` : '';
  console.error(`Restore failed${status}: ${message}`);
  process.exitCode = 1;
} finally {
  await pool.end();
}
