# Design: Amwag Attendance — Supabase → MariaDB Migration

**Date:** 2026-04-07
**Branch target:** `feat/mariadb-migration` (off `main`)
**Status:** Approved for implementation planning

## Goal

Replace Supabase (Postgres + Auth + RLS + pg_cron + Vercel cron) with a self-hosted stack on a CyberPanel + LiteSpeed Enterprise VPS: **MariaDB** for data, **bcrypt** for password hashing, **database-backed sessions** for auth, **Drizzle ORM** for queries, and **Linux cron → HTTP endpoints** for scheduled jobs.

## Context & constraints

- The app was delivered to Amwag on 2026-03-26 but there is **no production data to migrate** — clean slate is acceptable (answered during brainstorming).
- The only users at cutover are seeded by an admin script; employees receive temporary passwords and are forced to change them on first login.
- Deployment target is a single VPS running **CyberPanel + LiteSpeed Enterprise**. MariaDB is bundled with CyberPanel; LSWS reverse-proxies HTTPS to Next.js on `127.0.0.1:3000`. Cron jobs are added through CyberPanel's Cron Jobs GUI (which writes to the system crontab).
- **No** OAuth, **no** email-based password reset, **no** Docker, **no** RLS equivalents (all authorization enforced at the app layer in middleware + API routes).
- No existing Vercel deployment is kept; `vercel.json` is deleted.

## 1. Architecture & runtime topology

```
                 ┌─────────────────────────────────────────┐
 Browser ──TLS──▶│  LiteSpeed Enterprise (LSWS)  :443      │
                 │  (reverse proxy, configured via          │
                 │   CyberPanel vHost Conf)                 │
                 └──────────────┬──────────────────────────┘
                                │ proxy_pass
                                ▼
                 ┌─────────────────────────────────────────┐
                 │  Next.js 15 (next start)   :3000        │
                 │  managed by pm2 or CyberPanel Node App  │
                 └──────┬────────────────────┬─────────────┘
                        │                    │
                        │ mysql2/drizzle     │ bearer-token
                        ▼                    ▼
                 ┌──────────────┐     ┌──────────────┐
                 │  MariaDB     │     │  Linux cron  │
                 │  10.x        │◀────│  (CyberPanel │
                 │  127.0.0.1   │ curl│   Cron Jobs) │
                 │  :3306       │     └──────────────┘
                 └──────────────┘
```

- Single process for Next.js (no clustering required at this scale).
- MariaDB connection is localhost-only; no public port exposure.
- All cron traffic is localhost-only (`127.0.0.1:3000`); bearer-token auth guards the endpoints regardless.
- Timezone on the VPS must be `Africa/Cairo` so cron schedules align with "midnight Egypt time."

## 2. Database schema (MariaDB 10.x)

All tables owned by the application DB user. Engine `InnoDB`, charset `utf8mb4`, collation `utf8mb4_unicode_ci`.

Primary key strategy: **`CHAR(36)` UUIDs** generated in Node via `crypto.randomUUID()`. Chosen over `BIGINT AUTO_INCREMENT` to keep the shape of the existing code (which references UUIDs everywhere) and to avoid key exposure in URLs.

### 2.1 `users`
Merges Supabase `auth.users` and `public.profiles` into one row per person.

| Column | Type | Notes |
|---|---|---|
| `id` | `CHAR(36)` PK | app-generated UUID v4 |
| `email` | `VARCHAR(255) UNIQUE NOT NULL` | login identifier |
| `password_hash` | `VARCHAR(72) NOT NULL` | bcrypt output; 60 chars + headroom |
| `full_name` | `VARCHAR(255) NOT NULL` | |
| `role` | `ENUM('admin','accountant','employee') NOT NULL DEFAULT 'employee'` | replaces Postgres CHECK constraint |
| `branch` | `VARCHAR(255)` NULL | |
| `job_title` | `VARCHAR(255)` NULL | |
| `shift_start` | `TIME` NULL | |
| `shift_end` | `TIME` NULL | computed from start + duration on write |
| `off_day` | `VARCHAR(20)` NULL | e.g., `friday` |
| `overtime_enabled` | `TINYINT(1) NOT NULL DEFAULT 1` | |
| `must_change_password` | `TINYINT(1) NOT NULL DEFAULT 1` | new field — forces first-login rotation |
| `created_at` | `DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)` | UTC |
| `updated_at` | `DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3)` | UTC |

Indexes: `idx_users_role (role)`, `idx_users_branch (branch)`. `email` is unique by constraint.

### 2.2 `sessions` (new)
Opaque server-side session tokens. No JWT.

| Column | Type | Notes |
|---|---|---|
| `id` | `CHAR(64)` PK | base64url of 48 random bytes (`crypto.randomBytes(48)`) |
| `user_id` | `CHAR(36) NOT NULL` | FK → `users(id)` ON DELETE CASCADE |
| `created_at` | `DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)` | |
| `expires_at` | `DATETIME(3) NOT NULL` | 30 days from creation by default |
| `user_agent` | `VARCHAR(500)` NULL | captured on login for audit |
| `ip_address` | `VARCHAR(45)` NULL | IPv6 max width |

Indexes: `idx_sessions_user_id (user_id)`, `idx_sessions_expires_at (expires_at)` (for cleanup sweeps).

### 2.3 `attendance`
Same shape as today with the full status ENUM and the location columns added in past migrations.

| Column | Type | Notes |
|---|---|---|
| `id` | `CHAR(36)` PK | |
| `user_id` | `CHAR(36) NOT NULL` | FK → `users(id)` ON DELETE CASCADE |
| `date` | `DATE NOT NULL` | employee's local date |
| `check_in_time` | `DATETIME(3)` NULL | UTC |
| `check_out_time` | `DATETIME(3)` NULL | UTC |
| `ip_address` | `VARCHAR(45)` NULL | check-in IP |
| `check_out_ip` | `VARCHAR(45)` NULL | |
| `check_in_location` | `TEXT` NULL | |
| `check_out_location` | `TEXT` NULL | |
| `status` | `ENUM('present','late','absent','missing_checkout') NOT NULL DEFAULT 'present'` | |
| `late_minutes` | `INT NOT NULL DEFAULT 0` | |
| `early_departure_minutes` | `INT NOT NULL DEFAULT 0` | |
| `overtime_minutes` | `INT NOT NULL DEFAULT 0` | |
| `created_at` | `DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)` | |

Constraints: `UNIQUE KEY uk_user_date (user_id, date)`.
Indexes: `idx_attendance_user_id`, `idx_attendance_date`, `idx_attendance_user_date_status (user_id, date, status)` for dashboard aggregates.

### 2.4 `branch_allowed_ips`
Ported from `migrations/20260123154200_add_branch_ips.sql`.

| Column | Type |
|---|---|
| `id` | `CHAR(36)` PK |
| `branch_name` | `VARCHAR(255) NOT NULL` |
| `ip_network` | `VARCHAR(45) NOT NULL` (e.g., `81.10.30`) |
| `description` | `TEXT` NULL |
| `is_active` | `TINYINT(1) NOT NULL DEFAULT 1` |
| `created_at` | `DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)` |

Index: `idx_branch_allowed_ips_network (ip_network)`.

### 2.5 `global_settings`
Single-row singleton, exact port of `migrations/20260327000000_global_settings.sql`.

| Column | Type |
|---|---|
| `id` | `TINYINT PRIMARY KEY` with `CHECK (id = 1)` |
| `early_checkin_minutes` | `INT NOT NULL DEFAULT 60` |
| `late_grace_minutes` | `INT NOT NULL DEFAULT 0` |
| `checkout_window_minutes` | `INT NOT NULL DEFAULT 60` |
| `max_overtime_minutes` | `INT NOT NULL DEFAULT 180` |
| `updated_at` | `DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3)` |

Seeded with the single row `id=1` in the initial migration.

### 2.6 Migration tooling
- Schema lives in `src/lib/db/schema.ts` as Drizzle model definitions.
- `drizzle.config.ts` at repo root points at the schema and `drizzle/migrations` output.
- `drizzle-kit generate` produces the initial migration SQL file.
- `npm run db:migrate` runs pending migrations.
- The old `migrations/*.sql` and `supabase-schema.sql` files are **deleted** in the same branch. The Drizzle migration history becomes the only source of truth for schema.

## 3. Auth & sessions

### 3.1 New files under `src/lib/auth/`
- `password.ts` — `hashPassword(plain: string): Promise<string>` and `verifyPassword(plain: string, hash: string): Promise<boolean>`. Uses `bcrypt` npm package with cost factor `12`.
- `session.ts` — functions:
  - `createSession(userId, req): Promise<{ id, expiresAt }>` (generates token, inserts row, captures UA + IP)
  - `getSessionByToken(token): Promise<{ session, user } | null>` (single joined query, filters on `expires_at > NOW()`)
  - `destroySession(token): Promise<void>`
  - `destroyAllUserSessions(userId, exceptToken?): Promise<void>` (used by admin "log out everywhere" and by password reset; `exceptToken` lets a user change their own password without logging themselves out of the current tab)
  - `cleanupExpiredSessions(): Promise<number>` (called by cron)
- `cookies.ts` — `setSessionCookie(res, token, expiresAt)` / `clearSessionCookie(res)` / `readSessionCookie(req)`. Cookie: name `amwag_session`, `httpOnly`, `secure` (true in production), `sameSite=lax`, `path=/`, `maxAge` matching session expiry (30 days).

### 3.2 Rewritten files
- `src/lib/auth.ts` — `isAdmin()` now reads `amwag_session` via `readSessionCookie`, calls `getSessionByToken`, checks the joined user's role. Returns existing `AdminCheckResult` shape so call sites don't change. `authorizeInternalScheduler()` stays as-is (it's bearer-token based and not Supabase-specific).
- `src/middleware.ts` — reads session cookie, does a single Drizzle join to get `{ user_id, role }`, enforces the same role-based routing that exists today (admin/accountant/employee branches). New behavior: if `user.must_change_password === 1` and the path is not `/[locale]/change-password` or `/api/auth/*`, redirect to `/[locale]/change-password`.

### 3.3 New API routes
- `POST /api/auth/login` — body `{ email, password }`. Verify via `verifyPassword`. On success: `createSession` → `setSessionCookie` → return `{ role, mustChangePassword }`. On failure: 401 with generic message (no user-enumeration).
- `POST /api/auth/logout` — read cookie, `destroySession`, `clearSessionCookie`, 204.
- `POST /api/auth/change-password` — body `{ currentPassword, newPassword }`. Verify current, hash new, update user row, set `must_change_password = 0`, call `destroyAllUserSessions(userId, currentToken)` so other devices are forced to re-auth while the user's current tab stays logged in.
- `POST /api/employees/[id]/reset-password` — admin-only. Generate a 12-char random temp password, bcrypt it, update user, set `must_change_password = 1`, `destroyAllUserSessions(userId)`. Return the plaintext temp password in the response body so the admin UI can display it once to the admin.

### 3.4 New page
- `src/app/[locale]/change-password/page.tsx` — minimal forced-change screen (uses existing UI components). Posts to `/api/auth/change-password`. Accessible only when `must_change_password = 1`; middleware redirects here otherwise.

### 3.5 Login page rewrite
`src/app/[locale]/login/page.tsx` — replace Supabase `supabase.auth.signInWithPassword` with `fetch('/api/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) })`. On success, use `response.role` + `response.mustChangePassword` to decide the redirect target (change-password page if forced, else the existing role-based destinations).

## 4. Drizzle query layer

### 4.1 Structure
```
src/lib/db/
  client.ts      # mysql2 pool + drizzle instance (singleton)
  schema.ts      # all 5 tables + InferSelectModel / InferInsertModel exports
  index.ts       # re-exports for ergonomic imports
drizzle.config.ts
drizzle/migrations/
  0000_initial.sql  # generated by drizzle-kit
```

### 4.2 `client.ts` contract
- Reads `DATABASE_URL` from env (`mysql://user:pass@127.0.0.1:3306/amwag_attendance`).
- Creates a `mysql2/promise` pool with sensible defaults (connectionLimit: 10, timezone: 'Z' for UTC).
- Exports `db = drizzle(pool, { schema, mode: 'default' })`.
- Falls back to a no-op when `DATABASE_URL` is missing (so `next build` doesn't crash at CI time), mirroring the pattern already in `src/lib/supabase/server.ts`.

### 4.3 Mechanical rewrite pattern
Existing call sites are converted one-for-one. Examples:

| Supabase (before) | Drizzle (after) |
|---|---|
| `supabase.from('profiles').select('role').eq('id', id).single()` | `db.select({ role: users.role }).from(users).where(eq(users.id, id)).limit(1).then(r => r[0])` |
| `supabase.from('attendance').insert({ user_id, date, ... })` | `db.insert(attendance).values({ id: crypto.randomUUID(), userId, date, ... })` |
| `supabase.from('attendance').update({ check_out_time }).eq('id', id)` | `db.update(attendance).set({ checkOutTime }).where(eq(attendance.id, id))` |
| `.from('attendance').select('*, profiles(full_name)').eq(...)` | `db.select({...}).from(attendance).leftJoin(users, eq(attendance.userId, users.id)).where(...)` |

All 21 files that currently import `@/lib/supabase/*` get rewritten in this branch. Full list (captured during context exploration):

- Server/API: `src/lib/auth.ts`, `src/lib/globalSettings.ts`, `src/lib/attendanceFinalization.ts`, `src/app/api/attendance/route.ts`, `src/app/api/attendance/summary/route.ts`, `src/app/api/attendance/check-in/route.ts`, `src/app/api/attendance/check-out/route.ts`, `src/app/api/attendance/mark-absent/route.ts`, `src/app/api/employees/route.ts`, `src/app/api/employees/[id]/route.ts`, `src/app/api/employees/bulk-import/route.ts`, `src/app/api/settings/route.ts`
- Middleware/pages (client or server components): `src/middleware.ts`, `src/app/[locale]/page.tsx`, `src/app/[locale]/login/page.tsx`, `src/app/[locale]/employee/page.tsx`, `src/app/[locale]/admin/layout.tsx`, `src/app/[locale]/admin/employees/page.tsx`
- To delete: `src/lib/supabase/server.ts`, `src/lib/supabase/client.ts`, `src/app/auth/callback/route.ts`

**Client components that currently import `@/lib/supabase/client`** must stop querying the DB directly (impossible in the new world — no client-side DB driver). They are converted to call existing or new API routes via `fetch()`. This is the largest mechanical change in the frontend layer and is expected to touch the four page files listed above.

## 5. Cron endpoints

### 5.1 Endpoints (all under `src/app/api/internal/`)
All three are POST, gated by `authorizeInternalScheduler()` which already exists in `src/lib/auth.ts`.

1. **`POST /api/internal/attendance/mark-absent`** — port of `migrations/20260305000000_pg_cron_mark_absent.sql` to TypeScript + Drizzle. Finds users whose shift window has ended today and who have no attendance row, inserts rows with `status='absent'`. Respects `off_day` (skip if today matches). **Note on duplication:** the pre-existing `src/app/api/attendance/mark-absent/route.ts` predates pg_cron and should be consolidated with this new internal route during commit 14 — read the old file, decide whether to move its logic into `/api/internal/attendance/mark-absent` or delete it if redundant. Do not keep two routes that do the same thing.
2. **`POST /api/internal/attendance/finalize`** — already exists, swap internals from Supabase to Drizzle. Closes `missing_checkout` shifts at midnight Egypt time (called from cron at 00:05 Africa/Cairo).
3. **`POST /api/internal/maintenance/cleanup-sessions`** — new. Calls `cleanupExpiredSessions()` from `src/lib/auth/session.ts`. Runs daily.

### 5.2 Crontab lines (to paste into CyberPanel → Cron Jobs)
```cron
# Amwag attendance — mark-absent runs every 15 minutes
*/15 * * * * curl -fsS -X POST -H "Authorization: Bearer $INTERNAL_SCHEDULER_SECRET" http://127.0.0.1:3000/api/internal/attendance/mark-absent > /dev/null

# Amwag attendance — finalize at 00:05 Africa/Cairo
5 0 * * * curl -fsS -X POST -H "Authorization: Bearer $INTERNAL_SCHEDULER_SECRET" http://127.0.0.1:3000/api/internal/attendance/finalize > /dev/null

# Amwag attendance — purge expired sessions at 03:00 Africa/Cairo
0 3 * * * curl -fsS -X POST -H "Authorization: Bearer $INTERNAL_SCHEDULER_SECRET" http://127.0.0.1:3000/api/internal/maintenance/cleanup-sessions > /dev/null
```

Notes:
- The VPS must have `TZ=Africa/Cairo` (CyberPanel usually sets this per-website cron, or system-wide via `timedatectl`).
- `$INTERNAL_SCHEDULER_SECRET` is expanded by the shell that runs cron. CyberPanel's Cron Jobs UI doesn't source `.env.local`; the secret should be set in `/etc/environment` or exported in the crontab line directly (documented in `docs/DEPLOYMENT.md`).

## 6. Environment variables

`.env.local` (and production env) — final shape after migration:

```env
# Database
DATABASE_URL=mysql://amwag:<password>@127.0.0.1:3306/amwag_attendance

# Sessions
SESSION_COOKIE_NAME=amwag_session          # optional override
SESSION_TTL_DAYS=30                        # optional override

# Cron
INTERNAL_SCHEDULER_SECRET=<64-char random> # reused from today

# Remove:
# NEXT_PUBLIC_SUPABASE_URL
# NEXT_PUBLIC_SUPABASE_ANON_KEY
# SUPABASE_SERVICE_ROLE_KEY
```

**Security note for implementation:** the current `.env.local` has live Supabase keys committed to disk. After the migration ships, the developer should rotate those keys in the Supabase dashboard and then delete the Supabase project (or leave it orphaned).

## 7. Rollout plan (branch `feat/mariadb-migration`)

Commits, in order:

1. `chore(deps): add drizzle-orm mysql2 bcrypt + drizzle-kit (dev); remove @supabase/ssr @supabase/supabase-js`
2. `feat(db): drizzle client, schema, drizzle.config.ts; DATABASE_URL in .env.local`
3. `feat(db): generate initial migration; add scripts/seed-admin.mjs` (interactive: prompts for email/password, inserts admin with `must_change_password = 0`)
4. `feat(auth): password/session/cookies helpers under src/lib/auth/`
5. `refactor(auth): rewrite isAdmin() on top of sessions`
6. `refactor(middleware): rewrite middleware.ts on sessions + must_change_password gate`
7. `feat(auth): /api/auth/{login,logout,change-password} routes; rewrite login page`
8. `feat(auth): /[locale]/change-password page`
9. `refactor(api): rewrite src/app/api/attendance/* on drizzle`
10. `refactor(api): rewrite src/app/api/employees/* on drizzle (incl. bulk-import)`
11. `refactor(api): rewrite src/app/api/settings/* on drizzle`
12. `feat(api): /api/employees/[id]/reset-password (admin temp-password flow)`
13. `refactor(frontend): move client components from supabase client to fetch() against API routes`
14. `feat(cron): /api/internal/attendance/mark-absent (TS port of pg_cron logic)`
15. `refactor(cron): swap finalize endpoint internals to drizzle; add cleanup-sessions endpoint`
16. `chore: delete src/lib/supabase/, src/app/auth/callback, supabase-schema.sql, migrations/*.sql, vercel.json`
17. `docs: DEPLOYMENT.md (CyberPanel + LSWS + MariaDB setup + crontab + TZ + env vars)`
18. Squash-merge to `main`.

### 7.1 Smoke test checklist (before merge)
- [ ] `npm run db:migrate` on a fresh local MariaDB succeeds
- [ ] `node scripts/seed-admin.mjs` creates the first admin
- [ ] `next build` passes with no warnings from deleted Supabase imports
- [ ] Admin can log in, is not forced to change password (because seed sets `must_change_password = 0`)
- [ ] Admin creates an employee via UI → employee logs in → forced to change password → redirected after change
- [ ] Employee clocks in and clocks out → attendance row written correctly
- [ ] Admin dashboard loads attendance data and charts
- [ ] Bulk CSV import writes correct `users` rows
- [ ] Settings page reads and writes `global_settings`
- [ ] Manual `curl` to each of the 3 cron endpoints with the bearer token returns 200 and writes expected side effects
- [ ] Manual `curl` without bearer returns 401/403

## 8. Testing strategy

Scope is intentionally limited to manual smoke tests (the project has no existing test suite). No new unit/integration tests are added in this migration — adding a test suite is a separate initiative. The rollout leans on:

1. The smoke-test checklist above, executed locally before merge
2. Drizzle's type-safety catching schema/query mismatches at compile time
3. `next build` catching import/type errors across the whole app

## 9. Out of scope (explicitly NOT in this migration)

- OAuth / social login (Supabase `auth/callback` route is deleted)
- Email-based self-serve password reset (admin-reset only)
- Docker / docker-compose
- RLS equivalents (authorization lives in middleware + API route checks only)
- Data migration from Supabase (clean slate)
- LSWS vhost configuration files (user manages via CyberPanel UI)
- SSL / certbot (CyberPanel handles this)
- Test suite (separate initiative)
- Rate limiting on `/api/auth/login` (separate security initiative; worth a follow-up issue)

## 10. Risks & mitigations

| Risk | Mitigation |
|---|---|
| Client components currently query Supabase directly; moving to `fetch()` may expose hidden coupling | Identify all client usages during commit 13; if any component is deeply coupled to Supabase's response shape, normalize the API response to match before rewriting the component |
| `attendanceFinalization.ts` has the most complex queries; Drizzle translation could introduce subtle bugs | Read the file carefully during commit 15, translate one function at a time, verify on seeded fixture data before moving on |
| Time-zone handling differs between Postgres (`timestamptz`) and MariaDB (`DATETIME` with no TZ) | Store all `DATETIME` columns as UTC; set mysql2 pool option `timezone: 'Z'`; continue using `src/lib/timezone.ts` helpers for display conversions |
| bcrypt cost 12 may be slow on a small VPS during login bursts | Acceptable for internal app (~dozens of logins/day); if it becomes a problem, drop to 11 |
| Cron bearer secret leaks if crontab is world-readable | Store secret in `/etc/environment` with `600` perms, or use a wrapper script that `source`s an env file with `600` |
| `must_change_password` loop bug could lock users out | Middleware allows `/api/auth/*` and `/[locale]/change-password` through even when the flag is set — tested in the smoke checklist |
