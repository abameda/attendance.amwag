# Backup And Restore Guide

This document covers V1 manual recovery handling for the Amwag Attendance System.

## What V1 Creates

Admins can create a backup from `/{locale}/admin/backups`.

The backup contains a gzip-compressed JSON payload with:

- `metadata.json`
- `tables.users`
- `tables.attendance`
- `tables.branch_allowed_ips`
- `tables.global_settings`

The `sessions` table is intentionally excluded. Session tokens are not required for disaster recovery and should not be restored.

Backup files are stored on the server in:

```text
storage/backups
```

This directory is private server storage and must not be copied into `public/`.

## Encryption

If `BACKUP_ENCRYPTION_KEY` is configured, backups are encrypted with AES-256-GCM after gzip compression and use the `.json.gz.enc` extension.

Production requires `BACKUP_ENCRYPTION_KEY`. Creating an unencrypted production backup is blocked.

Development may create unencrypted `.json.gz` backups for local testing. Those backups have `metadata.encrypted = false`.

Never print, store, or share `BACKUP_ENCRYPTION_KEY` in logs, tickets, screenshots, or the UI.

## Staging Restore Validation Only

V1 does not include a production restore UI. Do not restore directly into production from the admin interface.

Use a staging database when validating a backup:

1. Download the backup as an admin from `/{locale}/admin/backups`.
2. Copy the file to a secure staging machine.
3. If the file ends with `.enc`, decrypt it using the same `BACKUP_ENCRYPTION_KEY` in a controlled script or secure recovery shell.
4. Gunzip the decrypted `.json.gz` payload.
5. Inspect `metadata.json`:
   - confirm `appName`
   - confirm `backupVersion`
   - confirm `includedTables`
   - confirm `excludedTables` contains `sessions`
   - confirm row counts look reasonable
   - confirm the checksum matches your recovery script validation
6. Load the JSON table data into a clean staging database with the current schema.
7. Run the application against staging.
8. Verify login, employee records, attendance history, branch IP rules, and global settings.
9. Export sample attendance reports from staging to confirm reporting still works.

Only after staging validation should a production recovery plan be reviewed by the system owner and database administrator.

## V2 Candidates

- Scheduled backups.
- Retention rules such as keep last 7 backups or keep last 30 days.
- Dedicated audit log table for backup events.
- A tested restore CLI for staging.
- Automated checksum verification command.
