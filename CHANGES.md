# Amwag Attendance System — Changes Summary

## Overview

Comprehensive modernization, optimization, and edge-case hardening of the Amwag Attendance & Departure tracking system. All changes maintain backward compatibility with existing data and require no frontend/backend deployment ordering.

---

## Wave 1 — Foundation (Shared Utilities)

### New Files

- **`src/lib/timezone.ts`** — Centralized Egypt timezone utilities using `Intl.DateTimeFormat` (no external dependencies). Exports `TIMEZONE`, `getEgyptDate()`, `getEgyptTime()`, `getEgyptNow()`, and `isWithinTimeWindow()`. Replaces scattered `toLocaleString('en-US', { timeZone })` calls across all API routes.

- **`src/lib/auth.ts`** — Shared admin authorization helper. `isAdmin(request)` returns `{ authorized, userId, error, status }` instead of each route implementing its own auth check with inconsistent error handling.

- **`src/lib/branches.ts`** — Single source of truth for the 9 Arabic branch names. Exports `BRANCHES` const array and `Branch` type. Eliminates hardcoded arrays in UI components.

- **`migrations/20260125000000_add_missing_checkout_status.sql`** — Database migration that extends the `attendance_status_check` constraint to accept `'missing_checkout'` status and adds the `off_day` column to `profiles`.

### Modified Files

- **`src/app/[locale]/admin/employees/page.tsx`** — Replaced hardcoded branch array with `BRANCHES` import.

---

## Wave 2 — Critical Bug Fixes

### Timezone Correctness

All API routes previously used `new Date().toLocaleString('en-US', { timeZone: 'Africa/Cairo' })` which is unreliable across runtimes. Replaced with `getEgyptNow()` and `getEgyptDate()` from the shared timezone module.

**Affected routes:**
- `src/app/api/attendance/check-in/route.ts`
- `src/app/api/attendance/check-out/route.ts`
- `src/app/api/attendance/mark-absent/route.ts`

### Race Condition Guards

- **Check-in**: Uses upsert with `ignoreDuplicates: true` to prevent TOCTOU (time-of-check-time-of-use) race conditions when two rapid check-in requests arrive simultaneously.

- **Check-out**: Adds `.is('check_out_time', null)` filter to the update query. If two check-out requests race, only the first succeeds; the second gets a 400 response instead of overwriting.

### Night Shift Support

- **Check-out**: If no attendance record is found for today, falls back to yesterday's record. This handles employees who checked in before midnight and check out after midnight.

### Missing Checkout Detection

- **Mark-absent**: Fully rewritten (409 lines). Now flags records with a check-in but no check-out as `'missing_checkout'` status instead of overwriting them as `'absent'`. Admin resolves these manually.

### Auth Consolidation

- **`src/app/api/employees/route.ts`** — Removed local `isAdmin` function; uses shared `isAdmin` from `@/lib/auth` in both GET and POST handlers.

- **`src/app/api/employees/[id]/route.ts`** — Same auth consolidation. PUT handler now accepts `off_day` and `overtime_enabled` fields. DELETE handler now properly calls `supabaseAdmin.auth.admin.deleteUser(id)` to remove the auth user.

---

## Wave 3 — Performance & Quality

### Middleware Optimization

- **`src/middleware.ts`** — Consolidated 2 separate `profiles.select('role')` Supabase queries into 1 single query per request. This halves the database round-trips on every authenticated page load.

### CSV Injection Prevention

- **`src/lib/utils.ts`** — `exportToCSV()` now sanitizes cell values that start with `=`, `+`, `-`, or `@` by prefixing with a single quote. Prevents formula injection when users open exported CSVs in Excel.

### Missing Checkout Consumers

- **`src/lib/utils.ts`** — `getStatusColor()` returns orange for `'missing_checkout'` status.
- **`src/types/index.ts`** — Both `AttendanceStatus` and `AttendanceRecord['status']` union types include `'missing_checkout'`.
- **`messages/en.json`** / **`messages/ar.json`** — Added `"missingCheckout"` translation key.
- **`src/app/[locale]/admin/attendance/page.tsx`** — Status filter dropdown includes `missing_checkout` option.

### Dashboard Timezone Fix

- **`src/app/[locale]/admin/page.tsx`** — Dashboard `today` variable changed from `new Date().toISOString().split('T')[0]` (UTC) to Egypt-timezone date using `Intl.DateTimeFormat`. Prevents the dashboard from showing wrong-day stats between 00:00–02:00 UTC.

### Bulk Import Cleanup

- **`src/app/api/employees/bulk-import/route.ts`** — Removed local `isAdmin`, uses shared version. Added environment variable guard before creating admin client. Removed unused `createClient` import.

---

## Wave 4 — Server-Side Pagination & Frontend Fixes

### New API Route

- **`src/app/api/attendance/route.ts`** (140 lines) — Server-side paginated attendance API:
  - Admin guard via `isAdmin(request)`
  - Query params: `page`, `pageSize`, `date`, `status`, `search`
  - Uses `profiles!inner` join for name/email search with `foreignTable` filter
  - Fallback to in-memory filtering if joined query fails
  - Returns `{ success, data, total, page, pageSize }`

### Attendance Page Refactor

- **`src/app/[locale]/admin/attendance/page.tsx`** — Switched from client-side Supabase queries to the new `/api/attendance` endpoint:
  - Removed direct `createClient` usage
  - `fetchAttendance` wrapped in `useCallback` with proper dependency tracking
  - Debounced search input (300ms) to reduce API calls
  - Server-driven pagination (no more fetching all records client-side)
  - Export (CSV/Excel) fetches all matching records via `pageSize=10000` parameter

### Employee Page Fixes

- **`src/app/[locale]/admin/employees/page.tsx`** — `fetchEmployees` wrapped in `useCallback` for correct `useEffect` dependencies. Delete now routes through `DELETE /api/employees/${id}` instead of direct Supabase call (ensures auth user is also deleted).

### Environment Guards

- **`src/app/api/employees/route.ts`** — POST handler validates `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` before use (no more `!` non-null assertions).

### Orphan Cleanup

- **`src/app/employee/`** — Removed orphaned directory (duplicate of `src/app/[locale]/employee/`).

---

## Wave 5 — Build Cleanup

### Build Configuration

- **`next.config.ts`** — Removed `typescript: { ignoreBuildErrors: true }`. The build now fails on TypeScript errors, ensuring type safety is enforced in CI/CD.

### Bug Fix

- **`src/app/api/attendance/check-out/route.ts`** — Reordered error/data checks to fix TypeScript narrowing issue (`error.message` on type `never`). Error check now comes before `!updatedRecord` check.

### Unused Import Cleanup

Removed unused imports across 6 files to eliminate all ESLint warnings:
- `CardHeader`, `CardTitle`, `Filter` from attendance page
- `CardHeader`, `CardTitle` from employees page
- `Button` from admin dashboard and employee portal
- `getEgyptDate` from check-in route
- Unused `supabase` variable from employees POST handler

### ESLint Configuration

- **`eslint.config.mjs`** — Added `argsIgnorePattern: "^_"` and `varsIgnorePattern: "^_"` to `@typescript-eslint/no-unused-vars` rule. Parameters prefixed with `_` (e.g., `_request` in Next.js API routes) no longer trigger warnings.

### Dependency Fix

- **`lucide-react`** — Reinstalled to fix corrupted package (1024 icons were missing from `dist/esm/icons/`). The `circle-alert`, `x`, `calendar`, `clipboard-list`, and `clock` icons are now properly available.

---

## Edge Cases Addressed

### Missing Check-out

**Problem**: Employees who forget to check out have no record of departure.

**Solution**: The nightly `mark-absent` job detects records with `check_in_time IS NOT NULL` and `check_out_time IS NULL` and sets their status to `'missing_checkout'` (orange badge). The admin can then manually resolve these records. The check-out time is intentionally left NULL — no auto-close.

### Rapid Actions (Race Conditions)

**Problem**: Double-clicking check-in/check-out buttons or network retries can create duplicate records or overwrite data.

**Solution**:
- **Check-in**: Upsert with `ignoreDuplicates: true` on the `UNIQUE(user_id, date)` constraint. Second request is silently ignored.
- **Check-out**: Update query includes `.is('check_out_time', null)`. If the record was already checked out (by a prior request), the update matches zero rows and returns a 400 error.

### Night Shifts (Cross-Midnight)

**Problem**: An employee checks in at 23:00 on day N and checks out at 07:00 on day N+1. The check-out looks for today's record (day N+1) but finds nothing.

**Solution**: Check-out route falls back to yesterday's date if no record is found for today. It queries for a record from the previous day with `check_out_time IS NULL`.

### Timezone Drift

**Problem**: Server running in UTC creates dates like `2026-01-25` at 01:00 AM Cairo time (23:00 UTC on Jan 24), resulting in wrong-day records.

**Solution**: All date/time operations use `Intl.DateTimeFormat` with `timeZone: 'Africa/Cairo'` via the centralized `src/lib/timezone.ts` module. No `new Date()` is used for date-string generation.

### CSV Injection

**Problem**: Exported CSV data could contain cells starting with `=`, `+`, `-`, `@` that Excel interprets as formulas — a security risk.

**Solution**: `exportToCSV()` prefixes such cells with a single quote (`'`) which Excel treats as a text indicator.

---

## Files Changed (Complete List)

### Created
- `src/lib/timezone.ts`
- `src/lib/auth.ts`
- `src/lib/branches.ts`
- `src/app/api/attendance/route.ts`
- `migrations/20260125000000_add_missing_checkout_status.sql`
- `CHANGES.md`

### Modified
- `src/middleware.ts`
- `src/lib/utils.ts`
- `src/types/index.ts`
- `src/app/api/attendance/check-in/route.ts`
- `src/app/api/attendance/check-out/route.ts`
- `src/app/api/attendance/mark-absent/route.ts`
- `src/app/api/employees/route.ts`
- `src/app/api/employees/[id]/route.ts`
- `src/app/api/employees/bulk-import/route.ts`
- `src/app/[locale]/admin/page.tsx`
- `src/app/[locale]/admin/attendance/page.tsx`
- `src/app/[locale]/admin/employees/page.tsx`
- `src/app/[locale]/employee/page.tsx`
- `messages/en.json`
- `messages/ar.json`
- `next.config.ts`
- `eslint.config.mjs`

### Deleted
- `src/app/employee/` (orphaned duplicate)
