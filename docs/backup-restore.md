# Backup And Disaster Recovery Runbook

This runbook covers system backups created from the Amwag Attendance admin panel and the guarded restore script.

## Backup Prerequisites

- `DATABASE_URL` must point to the intended MySQL database.
- `NODE_ENV=production` must be set in production.
- Production must set `BACKUP_ENCRYPTION_KEY`; backup creation is blocked without it.
- `storage/backups` must be private server storage. Do not place backups under `public/`.
- Store downloaded backups and encryption keys in separate secure locations.

## Backup Encryption Key

`BACKUP_ENCRYPTION_KEY` is required for encrypted backups. It must be exactly 64 hexadecimal characters, representing 32 random bytes.

Generate it with:

```bash
openssl rand -hex 32
```

Set it in the runtime environment:

```bash
BACKUP_ENCRYPTION_KEY=<64-hex-character-value>
```

Do not use a password, phrase, UUID, base64 string, or shorter token. The app rejects invalid non-empty values. Never print the key in logs, tickets, screenshots, chat, or the UI.

## What Is Backed Up

Current backups include these tables:

- `branches`
- `users`
- `attendance`
- `branch_allowed_ips`
- `global_settings`

Backups intentionally exclude:

- `sessions`

Session tokens are not needed for disaster recovery and should not be restored.

## Backup Format

Unencrypted development backups use:

```text
backup-amwag-attendance-YYYY-MM-DD-HH-mm-ss-<random>.json.gz
```

Encrypted backups use:

```text
backup-amwag-attendance-YYYY-MM-DD-HH-mm-ss-<random>.json.gz.enc
```

The plaintext payload is gzip-compressed JSON containing:

- `metadata.json`
- `tables`

Encrypted backups are gzip-compressed first, then encrypted with AES-256-GCM using the 32-byte hex key.

## Creating A Backup

From the admin UI:

1. Sign in as an admin.
2. Open `/{locale}/admin/backups`.
3. Click create backup.
4. Confirm the status shows `ENCRYPTED` in production.
5. Download the file and store it in approved secure storage.

If a production backup shows `NOT ENCRYPTED`, treat it as a configuration problem: either the app was not running with `NODE_ENV=production`, or the backup was created outside production mode without `BACKUP_ENCRYPTION_KEY`.

## Verifying Backup Integrity

The app validates backups before restore:

- filename is restricted to the expected backup pattern
- encrypted backups require `BACKUP_ENCRYPTION_KEY`
- encrypted backups must decrypt with AES-256-GCM
- gzip payload must decompress
- JSON payload must parse
- `appName` must match this app
- `backupVersion` must be supported
- `databaseType` must be `mysql`
- `sessions` must be excluded and absent from table data
- all expected tables for the backup version must exist
- metadata row counts must match actual rows
- SHA-256 checksum must match the payload

For a manual smoke check on a staging machine:

```bash
npm run backup:restore -- <backup-file-name>
```

The command will refuse to run unless `RESTORE_CONFIRM` is set as described below, so it can be used to confirm that the file is visible and the restore guard is active.

## Restore Semantics

Restore is a replace operation, not a merge.

The restore script validates the backup, starts a database transaction, clears the backed-up tables, and inserts the backup rows. It does not restore `sessions`.

For backup version 2, restore replaces:

- `branches`
- `users`
- `attendance`
- `branch_allowed_ips`
- `global_settings`

For older backup version 1 files, restore replaces only:

- `users`
- `attendance`
- `branch_allowed_ips`
- `global_settings`

Because restore clears tables, run it only against a database that is safe to replace.

## Restore On Staging

1. Provision a clean staging or temporary MySQL database with the current schema.
2. Set `DATABASE_URL` to the staging database.
3. Copy the backup file into `storage/backups`, or set `BACKUP_DIR` to the directory containing it.
4. If the backup ends with `.enc`, set the same `BACKUP_ENCRYPTION_KEY` used when it was created.
5. Set the restore confirmation variable:

```bash
RESTORE_CONFIRM=RESTORE:<backup-file-name>
```

6. Run:

```bash
npm run backup:restore -- <backup-file-name>
```

7. Start the app against staging and verify:

- admin login
- employee records
- branch records
- attendance history
- branch IP rules
- global settings
- sample attendance report export

## Restore Encrypted Backup

Use the same key that created the backup:

```bash
DATABASE_URL=mysql://user:password@host:3306/amwag_staging
BACKUP_DIR=/secure/backups
BACKUP_ENCRYPTION_KEY=<64-hex-character-value>
RESTORE_CONFIRM=RESTORE:backup-amwag-attendance-YYYY-MM-DD-HH-mm-ss-<random>.json.gz.enc
npm run backup:restore -- backup-amwag-attendance-YYYY-MM-DD-HH-mm-ss-<random>.json.gz.enc
```

If the key is missing, invalid, or wrong, restore fails before any table is cleared.

## Restore Unencrypted `.json.gz` Backup

Unencrypted backups should only exist from development or non-production environments.

```bash
DATABASE_URL=mysql://user:password@host:3306/amwag_staging
BACKUP_DIR=/secure/backups
RESTORE_CONFIRM=RESTORE:backup-amwag-attendance-YYYY-MM-DD-HH-mm-ss-<random>.json.gz
npm run backup:restore -- backup-amwag-attendance-YYYY-MM-DD-HH-mm-ss-<random>.json.gz
```

Do not restore an unencrypted file into production unless the system owner explicitly accepts the risk and the file has been secured and validated on staging.

## Production Restore Procedure

Do not restore production from the admin UI. There is no restore API or admin UI action.

1. Stop write traffic to the app if possible.
2. Take a fresh emergency backup of the current corrupted production database with `mysqldump` or provider snapshot tooling.
3. Copy the emergency backup to secure storage.
4. Validate the selected application backup on staging using this runbook.
5. Confirm the staging data is correct with the system owner.
6. Set production `DATABASE_URL`.
7. Set `BACKUP_DIR` if the file is not in `storage/backups`.
8. Set `BACKUP_ENCRYPTION_KEY` for encrypted backups.
9. Set both restore guard variables:

```bash
RESTORE_CONFIRM=RESTORE:<backup-file-name>
RESTORE_PRODUCTION_CONFIRM=PRODUCTION_RESTORE_APPROVED
```

10. Run:

```bash
NODE_ENV=production npm run backup:restore -- <backup-file-name>
```

11. Restart the app.
12. Verify login, attendance, branch IP rules, reports, and settings.
13. Keep the emergency backup until the recovery is formally accepted.

## Rollback Plan

If production restore produces incorrect data:

1. Stop write traffic again.
2. Restore the emergency backup or provider snapshot taken immediately before the recovery attempt.
3. Restart the app.
4. Verify the app is back to the pre-restore state.
5. Investigate the failed backup on staging before attempting another restore.

## Missing Or Invalid Key Behavior

- Missing key in production backup creation: backup creation fails.
- Missing key in development backup creation: an unencrypted `.json.gz` backup may be created.
- Invalid non-empty key in any environment: backup creation fails.
- Missing key for encrypted restore: restore fails before mutation.
- Invalid or wrong key for encrypted restore: restore fails before mutation.

