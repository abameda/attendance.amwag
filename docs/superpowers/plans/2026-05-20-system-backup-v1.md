# System Backup V1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an admin-only manual disaster recovery backup feature for the Amwag Attendance System.

**Architecture:** Implement a server-only backup service that exports selected MySQL/Drizzle tables into a JSON payload, embeds `metadata.json` data in that payload, compresses it with gzip, and optionally encrypts it with AES-256-GCM when `BACKUP_ENCRYPTION_KEY` is configured. Admin API routes list, create, download, and delete backup files from `storage/backups`; the UI only calls those authenticated routes.

**Tech Stack:** Next.js App Router, TypeScript, Drizzle ORM, mysql2, Node `zlib`, Node `crypto`, Node test runner.

---

### File Structure

- Create `src/lib/backups.ts`: backup directory handling, JSON payload generation, gzip compression, optional AES-GCM encryption, metadata listing, safe download/delete helpers.
- Create `src/app/api/admin/backups/route.ts`: `GET` list route with `isAdmin`.
- Create `src/app/api/admin/backups/create/route.ts`: `POST` create route with `isAdmin`.
- Create `src/app/api/admin/backups/[id]/download/route.ts`: `GET` authenticated download route.
- Create `src/app/api/admin/backups/[id]/route.ts`: `DELETE` safe delete route.
- Create `src/app/[locale]/admin/backups/page.tsx`: admin page with create, history table, download, delete, and sensitivity warning.
- Modify `src/app/[locale]/admin/layout.tsx`: add the Backup nav item for admins only.
- Modify `messages/en.json` and `messages/ar.json`: sidebar label and backup UI strings.
- Modify `.gitignore`: ignore `/storage/backups/`.
- Create `docs/backup-restore.md`: staging-only manual restore guidance, no production restore UI.
- Create `tests/backups.test.ts`: focused tests for service behavior and API auth.

### Task 1: Backup Service Tests

**Files:**
- Create: `tests/backups.test.ts`
- Create later: `src/lib/backups.ts`

- [ ] **Step 1: Write failing tests**

Add tests that assert:
- production create fails without `BACKUP_ENCRYPTION_KEY`
- development create writes `.json.gz` with `metadata.encrypted = false`
- encrypted create writes `.json.gz.enc`
- backup contents include `users`, `attendance`, `branch_allowed_ips`, `global_settings`
- backup contents exclude `sessions`
- path-safe delete rejects unsafe IDs

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/backups.test.ts`

Expected: FAIL because `src/lib/backups.ts` does not exist yet.

- [ ] **Step 3: Implement minimal service**

Implement typed helpers:
- `createSystemBackup(options)`
- `listBackups(options)`
- `getBackupForDownload(id, options)`
- `deleteBackup(id, options)`
- `resolveBackupDirectory()`

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- tests/backups.test.ts`

Expected: PASS.

### Task 2: Admin API Tests And Routes

**Files:**
- Modify: `tests/backups.test.ts`
- Create: API route files under `src/app/api/admin/backups`

- [ ] **Step 1: Write failing API tests**

Add tests for route factories or route handlers proving:
- admin can list/create/download/delete
- employee receives `403`
- unauthenticated receives `401`

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/backups.test.ts`

Expected: FAIL because backup API routes do not exist yet.

- [ ] **Step 3: Implement minimal API routes**

Each route calls `isAdmin(request)` before backup service functions. Download streams the server-side file through `NextResponse` with attachment headers.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- tests/backups.test.ts`

Expected: PASS.

### Task 3: Admin UI And Navigation

**Files:**
- Create: `src/app/[locale]/admin/backups/page.tsx`
- Modify: `src/app/[locale]/admin/layout.tsx`
- Modify: `messages/en.json`
- Modify: `messages/ar.json`

- [ ] **Step 1: Build the page using existing admin UI patterns**

Add a restrained product UI with:
- sensitivity warning
- Create Backup button
- loading skeleton
- backup history table/cards
- Download and Delete actions
- visible encrypted/plain status

- [ ] **Step 2: Add admin-only nav item**

Add `/admin/backups` to `navItemsConfig` with `DatabaseBackup` or `Archive` icon and `adminOnly: true`.

- [ ] **Step 3: Run lint/build checks**

Run: `npm run lint` and `npm run build`.

Expected: no new backup-related lint or build errors.

### Task 4: Docs And Final Verification

**Files:**
- Modify: `.gitignore`
- Create: `docs/backup-restore.md`

- [ ] **Step 1: Ignore backup storage**

Add `/storage/backups/` to `.gitignore`.

- [ ] **Step 2: Write restore documentation**

Document staging-only manual restore validation steps and state that V1 has no production restore UI.

- [ ] **Step 3: Run full verification**

Run:
- `npm test`
- `npm run lint`
- `npm run build`

Expected: tests, lint, and build complete or any pre-existing unrelated failure is clearly identified with evidence.
