# Amwag Attendance — Supabase → MariaDB Migration Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace Supabase (Postgres + Auth + RLS + pg_cron + Vercel cron) with a self-hosted stack on a CyberPanel + LiteSpeed Enterprise VPS — MariaDB + bcrypt + DB-backed sessions + Drizzle ORM + Linux cron HTTP endpoints.

**Architecture:** Big-bang rewrite on a `feat/mariadb-migration` branch. Clean slate (no data migration). All Supabase code removed, ~21 touchpoints rewritten to Drizzle. DB-backed opaque session tokens in httpOnly cookies. Cron endpoints under `/api/internal/*` triggered by Linux cron via `curl` + bearer token.

**Tech Stack:** Next.js 15, MariaDB 10.x, Drizzle ORM, `mysql2/promise`, `bcrypt`, Linux cron, CyberPanel + LiteSpeed Enterprise.

**Reference spec:** `docs/superpowers/specs/2026-04-07-mariadb-migration-design.md`

---

## File Structure

### New files

| Path                                                         | Purpose                                                        |
| ------------------------------------------------------------ | -------------------------------------------------------------- |
| `drizzle.config.ts`                                          | Drizzle Kit config (schema path, migration output dir, driver) |
| `src/lib/db/client.ts`                                       | mysql2 pool + drizzle instance singleton                       |
| `src/lib/db/schema.ts`                                       | All 5 table definitions + inferred types                       |
| `src/lib/db/index.ts`                                        | Barrel re-export                                               |
| `drizzle/migrations/0000_initial.sql`                        | Generated initial schema migration                             |
| `scripts/seed-admin.mjs`                                     | One-shot script to create the first admin user                 |
| `src/lib/auth/password.ts`                                   | bcrypt hash/verify                                             |
| `src/lib/auth/session.ts`                                    | create/get/destroy session helpers                             |
| `src/lib/auth/cookies.ts`                                    | read/set/clear `amwag_session` cookie                          |
| `src/app/api/auth/login/route.ts`                            | POST login: verify + create session + set cookie               |
| `src/app/api/auth/logout/route.ts`                           | POST logout: destroy session + clear cookie                    |
| `src/app/api/auth/change-password/route.ts`                  | POST change password: verify old + bcrypt new + clear flag     |
| `src/app/[locale]/change-password/page.tsx`                  | Forced password-change screen                                  |
| `src/app/api/employees/[id]/reset-password/route.ts`         | Admin resets an employee's password                            |
| `src/app/api/internal/attendance/mark-absent/route.ts`       | Cron endpoint: insert absent rows for no-shows                 |
| `src/app/api/internal/maintenance/cleanup-sessions/route.ts` | Cron endpoint: delete expired sessions                         |
| `docs/DEPLOYMENT.md`                                         | CyberPanel + LSWS + MariaDB + cron setup instructions          |

### Rewritten files

| Path                                                | Change                                                    |
| --------------------------------------------------- | --------------------------------------------------------- |
| `src/lib/auth.ts`                                   | `isAdmin()` reads session cookie + joined Drizzle query   |
| `src/lib/globalSettings.ts`                         | Drizzle query instead of Supabase admin client            |
| `src/lib/attendanceFinalization.ts`                 | All Supabase calls → Drizzle                              |
| `src/middleware.ts`                                 | Session lookup + role routing + must_change_password gate |
| `src/app/api/attendance/route.ts`                   | GET with Drizzle + filter/search/virtualization           |
| `src/app/api/attendance/summary/route.ts`           | Drizzle aggregates                                        |
| `src/app/api/attendance/check-in/route.ts`          | Drizzle queries throughout                                |
| `src/app/api/attendance/check-out/route.ts`         | Drizzle queries throughout                                |
| `src/app/api/attendance/mark-absent/route.ts`       | Consolidated into internal route (deleted if redundant)   |
| `src/app/api/employees/route.ts`                    | bcrypt-based user creation (no Supabase admin API)        |
| `src/app/api/employees/[id]/route.ts`               | Drizzle update/delete                                     |
| `src/app/api/employees/bulk-import/route.ts`        | bcrypt + Drizzle batch insert                             |
| `src/app/api/settings/route.ts`                     | Drizzle upsert on singleton row                           |
| `src/app/api/internal/attendance/finalize/route.ts` | Swap internals to Drizzle via rewritten lib               |
| `src/app/[locale]/page.tsx`                         | Remove direct Supabase client usage                       |
| `src/app/[locale]/login/page.tsx`                   | POST to `/api/auth/login`                                 |
| `src/app/[locale]/employee/page.tsx`                | Fetch session via API; no direct Supabase                 |
| `src/app/[locale]/admin/layout.tsx`                 | Same                                                      |
| `src/app/[locale]/admin/employees/page.tsx`         | Same                                                      |
| `package.json`                                      | Add Drizzle/mysql2/bcrypt, remove `@supabase/*`           |
| `.env.local`                                        | `DATABASE_URL` + session env, remove Supabase vars        |

### Deleted files

- `src/lib/supabase/client.ts`
- `src/lib/supabase/server.ts`
- `src/app/auth/callback/route.ts`
- `supabase-schema.sql`
- `migrations/*.sql` (all — replaced by `drizzle/migrations/`)
- `migrations/20260324100000_fix_attendance_finalization 2.sql` (stray duplicate)
- `migrations/20260327000000_global_settings 2.sql` (stray duplicate)
- `vercel.json`

---

## Task 0: Create feature branch

**Files:**

- No code changes

- [x] **Step 1: Create and switch to branch**

```bash
cd "/Users/elshorbagy/Desktop/amwag attendence v2/amwag-attendance"
git checkout -b feat/mariadb-migration
```

Expected output: `Switched to a new branch 'feat/mariadb-migration'`

- [x] **Step 2: Confirm clean working tree**

```bash
git status
```

Expected output: `nothing to commit, working tree clean` (or only the already-committed spec file and untracked files from the session start). If there are stray uncommitted files you don't own, stash them: `git stash -u`.

---

## Task 1: Install dependencies, remove Supabase

**Files:**

- Modify: `package.json`

- [x] **Step 1: Remove Supabase packages**

```bash
npm uninstall @supabase/ssr @supabase/supabase-js
```

Expected: removal, no errors. `package.json` no longer has those deps.

- [x] **Step 2: Install MariaDB stack**

```bash
npm install drizzle-orm mysql2 bcrypt
npm install -D drizzle-kit @types/bcrypt tsx
```

(`tsx` is used to run the seed script as a TypeScript-flavored ESM file if we want; we'll actually keep the seed script as plain `.mjs` to avoid a TS runtime dep.)

- [x] **Step 3: Verify `package.json`**

```bash
cat package.json
```

Expected: `dependencies` contains `drizzle-orm`, `mysql2`, `bcrypt`; `devDependencies` contains `drizzle-kit`, `@types/bcrypt`. No `@supabase/*` entries remain.

- [x] **Step 4: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore(deps): add drizzle-orm mysql2 bcrypt; remove @supabase/*"
```

---

## Task 2: Drizzle schema + client

**Files:**

- Create: `src/lib/db/schema.ts`
- Create: `src/lib/db/client.ts`
- Create: `src/lib/db/index.ts`
- Create: `drizzle.config.ts`

- [x] **Step 1: Write schema**

Create `src/lib/db/schema.ts`:

```ts
import {
  mysqlTable,
  char,
  varchar,
  mysqlEnum,
  tinyint,
  int,
  datetime,
  date,
  time,
  text,
  uniqueIndex,
  index,
} from "drizzle-orm/mysql-core";
import { sql, type InferSelectModel, type InferInsertModel } from "drizzle-orm";

export const users = mysqlTable(
  "users",
  {
    id: char("id", { length: 36 }).primaryKey(),
    email: varchar("email", { length: 255 }).notNull().unique(),
    passwordHash: varchar("password_hash", { length: 72 }).notNull(),
    fullName: varchar("full_name", { length: 255 }).notNull(),
    role: mysqlEnum("role", ["admin", "accountant", "employee"])
      .notNull()
      .default("employee"),
    branch: varchar("branch", { length: 255 }),
    jobTitle: varchar("job_title", { length: 255 }),
    shiftStart: time("shift_start"),
    shiftEnd: time("shift_end"),
    offDay: varchar("off_day", { length: 20 }),
    overtimeEnabled: tinyint("overtime_enabled").notNull().default(1),
    mustChangePassword: tinyint("must_change_password").notNull().default(1),
    createdAt: datetime("created_at", { fsp: 3 })
      .notNull()
      .default(sql`CURRENT_TIMESTAMP(3)`),
    updatedAt: datetime("updated_at", { fsp: 3 })
      .notNull()
      .default(sql`CURRENT_TIMESTAMP(3)`),
  },
  (t) => ({
    roleIdx: index("idx_users_role").on(t.role),
    branchIdx: index("idx_users_branch").on(t.branch),
  }),
);

export const sessions = mysqlTable(
  "sessions",
  {
    id: char("id", { length: 64 }).primaryKey(),
    userId: char("user_id", { length: 36 }).notNull(),
    createdAt: datetime("created_at", { fsp: 3 })
      .notNull()
      .default(sql`CURRENT_TIMESTAMP(3)`),
    expiresAt: datetime("expires_at", { fsp: 3 }).notNull(),
    userAgent: varchar("user_agent", { length: 500 }),
    ipAddress: varchar("ip_address", { length: 45 }),
  },
  (t) => ({
    userIdx: index("idx_sessions_user_id").on(t.userId),
    expiresIdx: index("idx_sessions_expires_at").on(t.expiresAt),
  }),
);

export const attendance = mysqlTable(
  "attendance",
  {
    id: char("id", { length: 36 }).primaryKey(),
    userId: char("user_id", { length: 36 }).notNull(),
    date: date("date").notNull(),
    checkInTime: datetime("check_in_time", { fsp: 3 }),
    checkOutTime: datetime("check_out_time", { fsp: 3 }),
    ipAddress: varchar("ip_address", { length: 45 }),
    checkOutIp: varchar("check_out_ip", { length: 45 }),
    checkInLocation: text("check_in_location"),
    checkOutLocation: text("check_out_location"),
    status: mysqlEnum("status", [
      "present",
      "late",
      "absent",
      "missing_checkout",
    ])
      .notNull()
      .default("present"),
    lateMinutes: int("late_minutes").notNull().default(0),
    earlyDepartureMinutes: int("early_departure_minutes").notNull().default(0),
    overtimeMinutes: int("overtime_minutes").notNull().default(0),
    createdAt: datetime("created_at", { fsp: 3 })
      .notNull()
      .default(sql`CURRENT_TIMESTAMP(3)`),
  },
  (t) => ({
    userDateUnique: uniqueIndex("uk_user_date").on(t.userId, t.date),
    userIdx: index("idx_attendance_user_id").on(t.userId),
    dateIdx: index("idx_attendance_date").on(t.date),
    dashIdx: index("idx_attendance_user_date_status").on(
      t.userId,
      t.date,
      t.status,
    ),
  }),
);

export const branchAllowedIps = mysqlTable(
  "branch_allowed_ips",
  {
    id: char("id", { length: 36 }).primaryKey(),
    branchName: varchar("branch_name", { length: 255 }).notNull(),
    ipNetwork: varchar("ip_network", { length: 45 }).notNull(),
    description: text("description"),
    isActive: tinyint("is_active").notNull().default(1),
    createdAt: datetime("created_at", { fsp: 3 })
      .notNull()
      .default(sql`CURRENT_TIMESTAMP(3)`),
  },
  (t) => ({
    networkIdx: index("idx_branch_allowed_ips_network").on(t.ipNetwork),
  }),
);

export const globalSettings = mysqlTable("global_settings", {
  id: tinyint("id").primaryKey().default(1),
  earlyCheckinMinutes: int("early_checkin_minutes").notNull().default(60),
  lateGraceMinutes: int("late_grace_minutes").notNull().default(0),
  checkoutWindowMinutes: int("checkout_window_minutes").notNull().default(60),
  maxOvertimeMinutes: int("max_overtime_minutes").notNull().default(180),
  updatedAt: datetime("updated_at", { fsp: 3 })
    .notNull()
    .default(sql`CURRENT_TIMESTAMP(3)`),
});

// Inferred types for call sites
export type User = InferSelectModel<typeof users>;
export type NewUser = InferInsertModel<typeof users>;
export type Session = InferSelectModel<typeof sessions>;
export type NewSession = InferInsertModel<typeof sessions>;
export type Attendance = InferSelectModel<typeof attendance>;
export type NewAttendance = InferInsertModel<typeof attendance>;
export type BranchIp = InferSelectModel<typeof branchAllowedIps>;
export type GlobalSettings = InferSelectModel<typeof globalSettings>;
```

- [x] **Step 2: Write client**

Create `src/lib/db/client.ts`:

```ts
import mysql from "mysql2/promise";
import { drizzle } from "drizzle-orm/mysql2";
import * as schema from "./schema";

const databaseUrl = process.env.DATABASE_URL;

// Build-time guard: if DATABASE_URL is missing we let Next.js build proceed by
// creating a pool against an obviously unreachable host. Runtime queries will
// fail loudly, which is what we want.
const pool = mysql.createPool({
  uri: databaseUrl ?? "mysql://build:build@127.0.0.1:1/build_placeholder",
  connectionLimit: 10,
  timezone: "Z", // store everything UTC
  dateStrings: false,
  supportBigNumbers: true,
});

export const db = drizzle(pool, { schema, mode: "default" });
export { pool };
```

- [x] **Step 3: Write barrel**

Create `src/lib/db/index.ts`:

```ts
export { db, pool } from "./client";
export * from "./schema";
```

- [x] **Step 4: Write drizzle config**

Create `drizzle.config.ts` at repo root:

```ts
import type { Config } from "drizzle-kit";

export default {
  schema: "./src/lib/db/schema.ts",
  out: "./drizzle/migrations",
  dialect: "mysql",
  dbCredentials: {
    url:
      process.env.DATABASE_URL ??
      "mysql://root@127.0.0.1:3306/amwag_attendance",
  },
  verbose: true,
  strict: true,
} satisfies Config;
```

- [x] **Step 5: Update `.env.local`**

Replace the three Supabase lines with:

```env
DATABASE_URL=mysql://amwag:amwag@127.0.0.1:3306/amwag_attendance
INTERNAL_SCHEDULER_SECRET=local-dev-secret-change-in-prod
SESSION_COOKIE_NAME=amwag_session
SESSION_TTL_DAYS=30
```

(Use whatever local MariaDB credentials you've set up for dev. The old Supabase keys are now dead — rotate them in the Supabase dashboard as a follow-up.)

- [x] **Step 6: Type-check**

```bash
npx tsc --noEmit
```

Expected: no errors related to `src/lib/db/*`. There WILL still be errors in the rest of the codebase because Supabase imports are broken — that's fine, we fix them in later tasks.

- [x] **Step 7: Commit**

```bash
git add src/lib/db drizzle.config.ts .env.local
git commit -m "feat(db): drizzle client, schema, and config for mariadb"
```

---

## Task 3: Generate initial migration + seed admin script

**Files:**

- Create: `drizzle/migrations/0000_initial.sql` (generated)
- Create: `scripts/seed-admin.mjs`
- Modify: `package.json` (scripts section)

- [x] **Step 1: Generate the initial migration**

```bash
npx drizzle-kit generate
```

Expected: `drizzle/migrations/0000_*.sql` file is created containing `CREATE TABLE` statements for all 5 tables. Verify:

```bash
ls drizzle/migrations/
```

- [x] **Step 2: Add `global_settings` seed row**

Open the generated SQL file and append at the end:

```sql
INSERT INTO `global_settings` (`id`) VALUES (1);
```

- [x] **Step 3: Add db scripts to `package.json`**

Inside `"scripts"`:

```json
"db:generate": "drizzle-kit generate",
"db:migrate": "drizzle-kit migrate",
"db:push": "drizzle-kit push",
"db:seed": "node scripts/seed-admin.mjs"
```

- [x] **Step 4: Create seed script**

Create `scripts/seed-admin.mjs`:

```js
import "dotenv/config";
import readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { randomUUID } from "node:crypto";
import mysql from "mysql2/promise";
import bcrypt from "bcrypt";

const rl = readline.createInterface({ input, output });

const email = (await rl.question("Admin email: ")).trim().toLowerCase();
const password = (await rl.question("Admin password (min 8 chars): ")).trim();
const fullName = (await rl.question("Full name: ")).trim();
rl.close();

if (!email || !password || password.length < 8 || !fullName) {
  console.error(
    "Invalid input. Email, password (8+ chars), and full name are required.",
  );
  process.exit(1);
}

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is not set. Put it in .env.local.");
  process.exit(1);
}

const hash = await bcrypt.hash(password, 12);
const id = randomUUID();

const pool = mysql.createPool({ uri: process.env.DATABASE_URL });
try {
  await pool.query(
    `INSERT INTO users (id, email, password_hash, full_name, role, must_change_password)
     VALUES (?, ?, ?, ?, 'admin', 0)
     ON DUPLICATE KEY UPDATE password_hash = VALUES(password_hash), full_name = VALUES(full_name), role = 'admin', must_change_password = 0`,
    [id, email, hash, fullName],
  );
  console.log(`Admin user ready: ${email}`);
} catch (err) {
  console.error("Seed failed:", err.message);
  process.exit(1);
} finally {
  await pool.end();
}
```

Note: We use `dotenv/config` so the script reads `.env.local`. Install it:

```bash
npm install -D dotenv
```

- [x] **Step 5: Run migration against local MariaDB**

(You need a local MariaDB running and the `amwag_attendance` database created. On macOS: `brew install mariadb && brew services start mariadb && mysql -u root -e "CREATE DATABASE amwag_attendance; CREATE USER 'amwag'@'localhost' IDENTIFIED BY 'amwag'; GRANT ALL ON amwag_attendance.* TO 'amwag'@'localhost'; FLUSH PRIVILEGES;"`)

```bash
npm run db:migrate
```

Expected: migration applies, no errors.

- [x] **Step 6: Run seed**

```bash
npm run db:seed
```

Expected: prompts, then `Admin user ready: <email>`.

- [x] **Step 7: Commit**

```bash
git add drizzle scripts package.json package-lock.json
git commit -m "feat(db): initial drizzle migration and admin seed script"
```

---

## Task 4: Auth helpers (password, session, cookies)

**Files:**

- Create: `src/lib/auth/password.ts`
- Create: `src/lib/auth/session.ts`
- Create: `src/lib/auth/cookies.ts`

- [x] **Step 1: Password helpers**

Create `src/lib/auth/password.ts`:

```ts
import bcrypt from "bcrypt";

const BCRYPT_COST = 12;

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, BCRYPT_COST);
}

export async function verifyPassword(
  plain: string,
  hash: string,
): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

export function generateTempPassword(): string {
  // 12-char alphanumeric, biased toward readable chars (no 0/O/1/l/I)
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  const bytes = new Uint8Array(12);
  crypto.getRandomValues(bytes);
  let out = "";
  for (let i = 0; i < 12; i++) {
    out += alphabet[bytes[i] % alphabet.length];
  }
  return out;
}
```

- [x] **Step 2: Session helpers**

Create `src/lib/auth/session.ts`:

```ts
import { randomBytes } from "node:crypto";
import { and, eq, gt, lt, ne } from "drizzle-orm";
import { db } from "@/lib/db";
import { sessions, users } from "@/lib/db/schema";
import type { User, Session } from "@/lib/db/schema";

const SESSION_TTL_DAYS = Number(process.env.SESSION_TTL_DAYS ?? 30);

function generateSessionId(): string {
  // 48 bytes → 64 base64url chars
  return randomBytes(48).toString("base64url");
}

function ttlDate(): Date {
  return new Date(Date.now() + SESSION_TTL_DAYS * 24 * 60 * 60 * 1000);
}

export interface SessionWithUser {
  session: Session;
  user: User;
}

export async function createSession(
  userId: string,
  metadata: { userAgent?: string; ipAddress?: string } = {},
): Promise<{ id: string; expiresAt: Date }> {
  const id = generateSessionId();
  const expiresAt = ttlDate();
  await db.insert(sessions).values({
    id,
    userId,
    expiresAt,
    userAgent: metadata.userAgent?.slice(0, 500) ?? null,
    ipAddress: metadata.ipAddress ?? null,
  });
  return { id, expiresAt };
}

export async function getSessionByToken(
  token: string,
): Promise<SessionWithUser | null> {
  if (!token) return null;
  const now = new Date();
  const rows = await db
    .select({
      session: sessions,
      user: users,
    })
    .from(sessions)
    .innerJoin(users, eq(sessions.userId, users.id))
    .where(and(eq(sessions.id, token), gt(sessions.expiresAt, now)))
    .limit(1);
  return rows[0] ?? null;
}

export async function destroySession(token: string): Promise<void> {
  if (!token) return;
  await db.delete(sessions).where(eq(sessions.id, token));
}

export async function destroyAllUserSessions(
  userId: string,
  exceptToken?: string,
): Promise<void> {
  const predicate = exceptToken
    ? and(eq(sessions.userId, userId), ne(sessions.id, exceptToken))
    : eq(sessions.userId, userId);
  await db.delete(sessions).where(predicate);
}

export async function cleanupExpiredSessions(): Promise<number> {
  const result = await db
    .delete(sessions)
    .where(lt(sessions.expiresAt, new Date()));
  // mysql2 returns affectedRows; drizzle exposes it via `result.rowsAffected` or similar depending on version
  // For simplicity, re-query:
  // (Not critical; the return value is only used for logging)
  return (result as unknown as { affectedRows?: number }).affectedRows ?? 0;
}
```

- [x] **Step 3: Cookie helpers**

Create `src/lib/auth/cookies.ts`:

```ts
import type { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

const COOKIE_NAME = process.env.SESSION_COOKIE_NAME ?? "amwag_session";

const BASE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
};

export function cookieName(): string {
  return COOKIE_NAME;
}

/** Used from API route handlers via `cookies()` from next/headers. */
export async function setSessionCookie(
  token: string,
  expiresAt: Date,
): Promise<void> {
  const store = await cookies();
  store.set(COOKIE_NAME, token, {
    ...BASE_OPTIONS,
    expires: expiresAt,
  });
}

/** Used from API route handlers. */
export async function clearSessionCookie(): Promise<void> {
  const store = await cookies();
  store.set(COOKIE_NAME, "", {
    ...BASE_OPTIONS,
    expires: new Date(0),
  });
}

/** Used from Server Components and API routes. */
export async function readSessionCookie(): Promise<string | null> {
  const store = await cookies();
  return store.get(COOKIE_NAME)?.value ?? null;
}

/** Used from middleware (NextRequest) where `cookies()` from next/headers is unavailable. */
export function readSessionCookieFromRequest(req: NextRequest): string | null {
  return req.cookies.get(COOKIE_NAME)?.value ?? null;
}

/** Used from middleware to set the cookie on an outgoing NextResponse. */
export function setSessionCookieOnResponse(
  res: NextResponse,
  token: string,
  expiresAt: Date,
): void {
  res.cookies.set(COOKIE_NAME, token, {
    ...BASE_OPTIONS,
    expires: expiresAt,
  });
}

export function clearSessionCookieOnResponse(res: NextResponse): void {
  res.cookies.set(COOKIE_NAME, "", {
    ...BASE_OPTIONS,
    expires: new Date(0),
  });
}
```

- [x] **Step 4: Type-check**

```bash
npx tsc --noEmit 2>&1 | grep -E "src/lib/auth/(password|session|cookies)" | head
```

Expected: no output (no errors in these three files). Errors elsewhere are still expected.

- [x] **Step 5: Commit**

```bash
git add src/lib/auth
git commit -m "feat(auth): password/session/cookies helpers"
```

---

## Task 5: Rewrite `isAdmin()` in `src/lib/auth.ts`

**Files:**

- Modify: `src/lib/auth.ts`

- [x] **Step 1: Replace file contents**

Overwrite `src/lib/auth.ts`:

```ts
import { timingSafeEqual } from "node:crypto";
import type { NextRequest } from "next/server";
import { getSessionByToken } from "@/lib/auth/session";
import { readSessionCookieFromRequest } from "@/lib/auth/cookies";

export interface AdminCheckResult {
  authorized: boolean;
  userId?: string;
  role?: "admin" | "accountant" | "employee";
  error?: string;
  status?: number;
}

export interface InternalAuthResult {
  authorized: boolean;
  error?: string;
  status?: number;
}

/**
 * Returns `{ authorized: true, userId, role }` when the request has a valid
 * session cookie AND the session's user has role === 'admin'. Call sites can
 * treat the returned `status` as the HTTP status to return on failure.
 */
export async function isAdmin(request: NextRequest): Promise<AdminCheckResult> {
  const token = readSessionCookieFromRequest(request);
  if (!token) {
    return { authorized: false, error: "Unauthorized", status: 401 };
  }

  const result = await getSessionByToken(token);
  if (!result) {
    return { authorized: false, error: "Unauthorized", status: 401 };
  }

  if (result.user.role !== "admin") {
    return { authorized: false, error: "Forbidden", status: 403 };
  }

  return { authorized: true, userId: result.user.id, role: result.user.role };
}

/**
 * Variant for routes that should allow `admin` OR `accountant`. Used by the
 * attendance-viewing endpoints.
 */
export async function isAdminOrAccountant(
  request: NextRequest,
): Promise<AdminCheckResult> {
  const token = readSessionCookieFromRequest(request);
  if (!token) return { authorized: false, error: "Unauthorized", status: 401 };

  const result = await getSessionByToken(token);
  if (!result) return { authorized: false, error: "Unauthorized", status: 401 };

  if (result.user.role !== "admin" && result.user.role !== "accountant") {
    return { authorized: false, error: "Forbidden", status: 403 };
  }

  return { authorized: true, userId: result.user.id, role: result.user.role };
}

/**
 * Retrieves the current logged-in user for employee-facing routes. Returns
 * null when unauthenticated. Caller decides the HTTP response.
 */
export async function getCurrentUser(request: NextRequest) {
  const token = readSessionCookieFromRequest(request);
  if (!token) return null;
  const result = await getSessionByToken(token);
  return result?.user ?? null;
}

export function authorizeInternalScheduler(
  request: NextRequest,
): InternalAuthResult {
  const expectedToken = process.env.INTERNAL_SCHEDULER_SECRET;
  if (!expectedToken) {
    return {
      authorized: false,
      error: "Internal scheduler secret is not configured",
      status: 500,
    };
  }

  const authorizationHeader = request.headers.get("authorization")?.trim();
  if (!authorizationHeader?.startsWith("Bearer ")) {
    return { authorized: false, error: "Unauthorized", status: 401 };
  }

  const providedToken = authorizationHeader.slice("Bearer ".length);
  const expectedBuffer = Buffer.from(expectedToken);
  const providedBuffer = Buffer.from(providedToken);

  if (
    expectedBuffer.length !== providedBuffer.length ||
    !timingSafeEqual(expectedBuffer, providedBuffer)
  ) {
    return { authorized: false, error: "Forbidden", status: 403 };
  }

  return { authorized: true };
}
```

Note the two additions: `isAdminOrAccountant()` for shared attendance-viewing routes, and `getCurrentUser()` for employee routes. These replace the pattern of calling `supabase.auth.getUser()` in every route.

- [x] **Step 2: Commit**

```bash
git add src/lib/auth.ts
git commit -m "refactor(auth): rewrite isAdmin() on session cookies + drizzle"
```

---

## Task 6: Rewrite middleware

**Files:**

- Modify: `src/middleware.ts`

- [x] **Step 1: Overwrite middleware**

Replace `src/middleware.ts` entirely:

```ts
import { NextResponse, type NextRequest } from "next/server";
import createMiddleware from "next-intl/middleware";
import { getSessionByToken } from "@/lib/auth/session";
import { readSessionCookieFromRequest } from "@/lib/auth/cookies";

const intlMiddleware = createMiddleware({
  locales: ["en", "ar"],
  defaultLocale: "ar",
  localePrefix: "always",
});

export async function middleware(request: NextRequest) {
  // 1. Let next-intl handle locale routing first
  const response = intlMiddleware(request);

  const pathname = request.nextUrl.pathname;
  const localeMatch = pathname.match(/^\/(en|ar)(\/|$)/);
  const locale = localeMatch ? localeMatch[1] : "ar";
  const pathWithoutLocale = pathname.replace(/^\/(en|ar)/, "") || "/";

  const publicRoutes = ["/login"];
  const isPublicRoute = publicRoutes.some((r) =>
    pathWithoutLocale.startsWith(r),
  );

  const token = readSessionCookieFromRequest(request);
  const sessionData = token ? await getSessionByToken(token) : null;

  // Unauthenticated trying to access a protected route
  if (!sessionData && !isPublicRoute) {
    const url = request.nextUrl.clone();
    url.pathname = `/${locale}/login`;
    return NextResponse.redirect(url);
  }

  if (sessionData) {
    const { user } = sessionData;
    const role = user.role;

    // Force password change on first login
    const needsChange = user.mustChangePassword === 1;
    const isChangePasswordRoute = pathWithoutLocale === "/change-password";

    if (needsChange && !isChangePasswordRoute) {
      const url = request.nextUrl.clone();
      url.pathname = `/${locale}/change-password`;
      return NextResponse.redirect(url);
    }

    // Authenticated user hitting /login → bounce to their landing page
    if (pathWithoutLocale === "/login") {
      const url = request.nextUrl.clone();
      if (role === "admin") {
        url.pathname = `/${locale}/admin`;
      } else if (role === "accountant") {
        url.pathname = `/${locale}/admin/attendance`;
      } else {
        url.pathname = `/${locale}/employee`;
      }
      return NextResponse.redirect(url);
    }

    // Accountant: can only see /admin/attendance
    if (role === "accountant") {
      if (
        pathWithoutLocale.startsWith("/admin") &&
        !pathWithoutLocale.startsWith("/admin/attendance")
      ) {
        const url = request.nextUrl.clone();
        url.pathname = `/${locale}/admin/attendance`;
        return NextResponse.redirect(url);
      }
      if (pathWithoutLocale.startsWith("/employee")) {
        const url = request.nextUrl.clone();
        url.pathname = `/${locale}/admin/attendance`;
        return NextResponse.redirect(url);
      }
    }

    // Only admin/accountant may access /admin/*
    if (
      pathWithoutLocale.startsWith("/admin") &&
      role !== "admin" &&
      role !== "accountant"
    ) {
      const url = request.nextUrl.clone();
      url.pathname = `/${locale}/employee`;
      return NextResponse.redirect(url);
    }

    // Admins shouldn't use /employee
    if (pathWithoutLocale.startsWith("/employee") && role === "admin") {
      const url = request.nextUrl.clone();
      url.pathname = `/${locale}/admin`;
      return NextResponse.redirect(url);
    }
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|auth/callback|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
```

- [x] **Step 2: Commit**

```bash
git add src/middleware.ts
git commit -m "refactor(middleware): session-based auth + must_change_password gate"
```

---

## Task 7: Auth API routes

**Files:**

- Create: `src/app/api/auth/login/route.ts`
- Create: `src/app/api/auth/logout/route.ts`
- Create: `src/app/api/auth/change-password/route.ts`

- [x] **Step 1: Login route**

Create `src/app/api/auth/login/route.ts`:

```ts
import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { verifyPassword } from "@/lib/auth/password";
import { createSession } from "@/lib/auth/session";
import { setSessionCookie } from "@/lib/auth/cookies";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null);
    if (
      !body ||
      typeof body.email !== "string" ||
      typeof body.password !== "string"
    ) {
      return NextResponse.json(
        { success: false, error: "Invalid request" },
        { status: 400 },
      );
    }

    const email = body.email.trim().toLowerCase();
    const password = body.password;

    const found = await db
      .select()
      .from(users)
      .where(eq(users.email, email))
      .limit(1);
    const user = found[0];

    // Generic message to avoid user enumeration
    const fail = () =>
      NextResponse.json(
        { success: false, error: "Invalid email or password" },
        { status: 401 },
      );

    if (!user) return fail();

    const ok = await verifyPassword(password, user.passwordHash);
    if (!ok) return fail();

    const userAgent = request.headers.get("user-agent") ?? undefined;
    const ipAddress =
      request.headers.get("x-real-ip") ??
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      undefined;

    const { id, expiresAt } = await createSession(user.id, {
      userAgent,
      ipAddress,
    });
    await setSessionCookie(id, expiresAt);

    return NextResponse.json({
      success: true,
      data: {
        role: user.role,
        mustChangePassword: user.mustChangePassword === 1,
      },
    });
  } catch (err) {
    console.error("Login error:", err);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 },
    );
  }
}
```

- [x] **Step 2: Logout route**

Create `src/app/api/auth/logout/route.ts`:

```ts
import { NextResponse } from "next/server";
import { destroySession } from "@/lib/auth/session";
import { clearSessionCookie, readSessionCookie } from "@/lib/auth/cookies";

export async function POST() {
  const token = await readSessionCookie();
  if (token) {
    await destroySession(token);
  }
  await clearSessionCookie();
  return NextResponse.json({ success: true });
}
```

- [x] **Step 3: Change-password route**

Create `src/app/api/auth/change-password/route.ts`:

```ts
import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { destroyAllUserSessions, getSessionByToken } from "@/lib/auth/session";
import { readSessionCookie } from "@/lib/auth/cookies";

export async function POST(request: NextRequest) {
  try {
    const token = await readSessionCookie();
    if (!token) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 },
      );
    }

    const sessionData = await getSessionByToken(token);
    if (!sessionData) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 },
      );
    }

    const body = await request.json().catch(() => null);
    const currentPassword = body?.currentPassword;
    const newPassword = body?.newPassword;

    if (
      typeof currentPassword !== "string" ||
      typeof newPassword !== "string"
    ) {
      return NextResponse.json(
        { success: false, error: "Invalid request" },
        { status: 400 },
      );
    }
    if (newPassword.length < 8) {
      return NextResponse.json(
        { success: false, error: "New password must be at least 8 characters" },
        { status: 400 },
      );
    }

    const ok = await verifyPassword(
      currentPassword,
      sessionData.user.passwordHash,
    );
    if (!ok) {
      return NextResponse.json(
        { success: false, error: "Current password is incorrect" },
        { status: 400 },
      );
    }

    const newHash = await hashPassword(newPassword);
    await db
      .update(users)
      .set({
        passwordHash: newHash,
        mustChangePassword: 0,
        updatedAt: new Date(),
      })
      .where(eq(users.id, sessionData.user.id));

    // Log out all other devices but keep this one
    await destroyAllUserSessions(sessionData.user.id, token);

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Change-password error:", err);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 },
    );
  }
}
```

- [x] **Step 4: Commit**

```bash
git add src/app/api/auth
git commit -m "feat(auth): login, logout, change-password API routes"
```

---

## Task 8: Change-password page + login page rewrite

**Files:**

- Create: `src/app/[locale]/change-password/page.tsx`
- Modify: `src/app/[locale]/login/page.tsx`

- [x] **Step 1: Read the existing login page**

```bash
cat "src/app/[locale]/login/page.tsx"
```

Note its current shape so your rewrite preserves layout/styling. The only change is swapping `supabase.auth.signInWithPassword({ email, password })` for a `fetch('/api/auth/login', ...)` call, then handling the response:

- On success, read `data.role` + `data.mustChangePassword` and redirect:
  - `mustChangePassword` → `router.push('/${locale}/change-password')`
  - `role === 'admin'` → `router.push('/${locale}/admin')`
  - `role === 'accountant'` → `router.push('/${locale}/admin/attendance')`
  - else → `router.push('/${locale}/employee')`
- On failure, show the error message from the response JSON.

Remove all Supabase imports from the file.

- [x] **Step 2: Apply the rewrite**

Replace the form submission handler in `src/app/[locale]/login/page.tsx`:

```tsx
const handleLogin = async (e: React.FormEvent) => {
  e.preventDefault();
  setError(null);
  setLoading(true);
  try {
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const json = await res.json();
    if (!res.ok || !json.success) {
      setError(json.error ?? "Login failed");
      setLoading(false);
      return;
    }
    const { role, mustChangePassword } = json.data as {
      role: "admin" | "accountant" | "employee";
      mustChangePassword: boolean;
    };
    if (mustChangePassword) {
      router.push(`/${locale}/change-password`);
    } else if (role === "admin") {
      router.push(`/${locale}/admin`);
    } else if (role === "accountant") {
      router.push(`/${locale}/admin/attendance`);
    } else {
      router.push(`/${locale}/employee`);
    }
  } catch {
    setError("Network error");
    setLoading(false);
  }
};
```

Delete any `import { createClient } from '@/lib/supabase/client'` line and any `createClient()` calls. Keep all markup/styling identical.

- [x] **Step 3: Create change-password page**

Create `src/app/[locale]/change-password/page.tsx`:

```tsx
"use client";

import { useState } from "react";
import { useRouter, useParams } from "next/navigation";

export default function ChangePasswordPage() {
  const router = useRouter();
  const params = useParams<{ locale: string }>();
  const locale = params.locale ?? "ar";

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (newPassword !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }
    if (newPassword.length < 8) {
      setError("New password must be at least 8 characters");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        setError(json.error ?? "Update failed");
        setLoading(false);
        return;
      }
      // After success, middleware will no longer redirect here. Push to /employee
      // and middleware will bounce admins/accountants to their own home.
      router.push(`/${locale}/employee`);
      router.refresh();
    } catch {
      setError("Network error");
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <form onSubmit={submit} className="w-full max-w-md space-y-4">
        <h1 className="text-2xl font-semibold">Change password</h1>
        <p className="text-sm opacity-70">
          You must set a new password before continuing.
        </p>
        <input
          type="password"
          placeholder="Current password"
          value={currentPassword}
          onChange={(e) => setCurrentPassword(e.target.value)}
          className="w-full p-3 rounded border"
          required
        />
        <input
          type="password"
          placeholder="New password"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          className="w-full p-3 rounded border"
          required
        />
        <input
          type="password"
          placeholder="Confirm new password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          className="w-full p-3 rounded border"
          required
        />
        {error && <p className="text-red-500 text-sm">{error}</p>}
        <button
          type="submit"
          disabled={loading}
          className="w-full p-3 rounded bg-primary text-primary-foreground disabled:opacity-50"
        >
          {loading ? "Updating..." : "Update password"}
        </button>
      </form>
    </div>
  );
}
```

(Styling kept minimal on purpose — reuse `Button`/`Input` from `src/components/ui/` to match the design system after the page works. Swap the raw `<input>` and `<button>` for the custom components and remove the inline classes.)

- [x] **Step 4: Commit**

```bash
git add "src/app/[locale]/login/page.tsx" "src/app/[locale]/change-password/page.tsx"
git commit -m "feat(auth): rewrite login page + add change-password page"
```

---

## Task 9: Rewrite `src/lib/globalSettings.ts`

**Files:**

- Modify: `src/lib/globalSettings.ts`

- [x] **Step 1: Replace file contents**

Overwrite `src/lib/globalSettings.ts`:

```ts
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { globalSettings } from "@/lib/db/schema";

export interface GlobalSettings {
  early_checkin_minutes: number;
  late_grace_minutes: number;
  checkout_window_minutes: number;
  max_overtime_minutes: number;
}

const DEFAULTS: GlobalSettings = {
  early_checkin_minutes: 60,
  late_grace_minutes: 0,
  checkout_window_minutes: 60,
  max_overtime_minutes: 180,
};

export async function getGlobalSettings(): Promise<GlobalSettings> {
  try {
    const rows = await db
      .select()
      .from(globalSettings)
      .where(eq(globalSettings.id, 1))
      .limit(1);
    const row = rows[0];
    if (!row) return DEFAULTS;
    return {
      early_checkin_minutes: row.earlyCheckinMinutes,
      late_grace_minutes: row.lateGraceMinutes,
      checkout_window_minutes: row.checkoutWindowMinutes,
      max_overtime_minutes: row.maxOvertimeMinutes,
    };
  } catch (err) {
    console.error("getGlobalSettings failed, using defaults:", err);
    return DEFAULTS;
  }
}
```

The shape returned is unchanged, so all call sites keep working without edits.

- [x] **Step 2: Commit**

```bash
git add src/lib/globalSettings.ts
git commit -m "refactor(settings): rewrite getGlobalSettings on drizzle"
```

---

## Task 10: Rewrite attendance API routes

**Files:**

- Modify: `src/app/api/attendance/check-in/route.ts`
- Modify: `src/app/api/attendance/check-out/route.ts`
- Modify: `src/app/api/attendance/route.ts`
- Modify: `src/app/api/attendance/summary/route.ts`

This is the biggest task — four files with overlapping rewrite patterns. Do them one at a time and commit between each to keep diff reviews sane.

### Rewrite pattern (applies to all four files)

```ts
// BEFORE (Supabase)
import { createClient } from "@/lib/supabase/server";
const supabase = await createClient();
const {
  data: { user },
  error: authError,
} = await supabase.auth.getUser();
if (authError || !user) return 401;
const { data: profile } = await supabase
  .from("profiles")
  .select("shift_start, shift_end")
  .eq("id", user.id)
  .single();

// AFTER (Drizzle + session)
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { users, attendance, branchAllowedIps } from "@/lib/db/schema";
import { and, eq, desc } from "drizzle-orm";

const user = await getCurrentUser(request);
if (!user) {
  return NextResponse.json(
    { success: false, error: "Unauthorized" },
    { status: 401 },
  );
}
// shift_start / shift_end are already on the user object — no extra query needed
```

Query translation cheat sheet:

| Supabase                                                                                                                    | Drizzle                                                                                                                                                                                                                                                                                                                                           |
| --------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `.from('branch_allowed_ips').select('branch_name').eq('ip_network', x).eq('is_active', true).single()`                      | `db.select({ branchName: branchAllowedIps.branchName }).from(branchAllowedIps).where(and(eq(branchAllowedIps.ipNetwork, x), eq(branchAllowedIps.isActive, 1))).limit(1).then(r => r[0])`                                                                                                                                                          |
| `.from('attendance').select('id, status, check_in_time, check_out_time').eq('user_id', id).eq('date', today).maybeSingle()` | `db.select().from(attendance).where(and(eq(attendance.userId, id), eq(attendance.date, today))).limit(1).then(r => r[0] ?? null)`                                                                                                                                                                                                                 |
| `.from('attendance').insert({ user_id, date, check_in_time, ip_address, check_in_location, late_minutes, status })`         | `db.insert(attendance).values({ id: crypto.randomUUID(), userId, date, checkInTime: now, ipAddress, checkInLocation, lateMinutes, status })`                                                                                                                                                                                                      |
| `.from('attendance').update({ check_out_time }).eq('id', rowId)`                                                            | `db.update(attendance).set({ checkOutTime }).where(eq(attendance.id, rowId))`                                                                                                                                                                                                                                                                     |
| `.from('attendance').select('*, profiles(full_name, email, branch, job_title)').eq('date', d)`                              | `db.select({ ...attendanceColumns, fullName: users.fullName, email: users.email, branch: users.branch, jobTitle: users.jobTitle }).from(attendance).leftJoin(users, eq(attendance.userId, users.id)).where(eq(attendance.date, d))` — shape the response to `{ ...row, profiles: { full_name, email, branch, job_title } }` for API compatibility |

**Important:** existing client code expects the `profiles: { ... }` nested shape in API responses. When rewriting GET endpoints, map Drizzle's flat rows back into that shape so the frontend doesn't need to change:

```ts
const data = rows.map((r) => ({
  id: r.id,
  user_id: r.userId,
  date: r.date,
  check_in_time: r.checkInTime,
  check_out_time: r.checkOutTime,
  ip_address: r.ipAddress,
  check_out_ip: r.checkOutIp,
  check_in_location: r.checkInLocation,
  check_out_location: r.checkOutLocation,
  status: r.status,
  late_minutes: r.lateMinutes,
  early_departure_minutes: r.earlyDepartureMinutes,
  overtime_minutes: r.overtimeMinutes,
  created_at: r.createdAt,
  profiles: {
    full_name: r.fullName,
    email: r.email,
    branch: r.branch,
    job_title: r.jobTitle,
  },
}));
```

- [x] **Step 1: Rewrite `check-in/route.ts`**

Full translation of the existing file. The logic is unchanged — only the DB calls swap. Read the current file end-to-end, then replace all Supabase calls per the cheat sheet. Key points:

- Replace `supabase.auth.getUser()` with `await getCurrentUser(request)` (returns a `User` or `null`)
- `user.shift_start` / `user.shift_end` become `user.shiftStart` / `user.shiftEnd` (Drizzle camelCases)
- `maybeSingle()` becomes `.limit(1).then(r => r[0] ?? null)`
- Keep all date/time math, IP parsing, and error messages identical

Run `npx tsc --noEmit` after editing. Fix any resulting type mismatches.

- [x] **Step 2: Rewrite `check-out/route.ts`**

Same pattern. Read the file first, then translate. Watch for:

- Update statements use `.set({ ... }).where(...)` in Drizzle (no chained `.eq()`)
- Overtime/early-departure calculations stay identical

- [x] **Step 3: Rewrite `attendance/route.ts` (GET)**

This is the most complex — ~290 lines with filtering, search, count, and virtualization. Translate in this order:

1. Replace the top `isAdmin()` call (signature is the same).
2. Replace `dataQuery`/`countQuery` Supabase builders with Drizzle. Use `sql\`COUNT(\*)\`.mapWith(Number)`or`db.$count(...)` for the count.
3. Search translation — Drizzle uses `like(users.fullName, \`%${q}%\`)`combined with`or()`. Escape `%`and`\_` in the search term beforehand.
4. The "virtualization" block (injecting pending rows for today) — the Supabase `.or('off_day.is.null,off_day.neq.\${dayOfWeek}')` becomes:
   ```ts
   const employees = await db
     .select()
     .from(users)
     .where(
       and(
         eq(users.role, "employee"),
         or(isNull(users.offDay), ne(users.offDay, dayOfWeek)),
       ),
     );
   ```
5. Keep the response shape identical (wrap in `profiles: { ... }` for frontend compatibility).
6. Remove the fallback path (`if (dataResponse.error || countResponse.error)`) — in Drizzle, errors throw, so the `try/catch` block catches them.

- [x] **Step 4: Rewrite `attendance/summary/route.ts`**

Typically this file does monthly/range aggregates. Use Drizzle's `sql` template for `SUM(late_minutes) AS total_late` etc.:

```ts
import { sql } from "drizzle-orm";
const rows = await db
  .select({
    totalLate: sql<number>`SUM(${attendance.lateMinutes})`.mapWith(Number),
    totalOvertime: sql<number>`SUM(${attendance.overtimeMinutes})`.mapWith(
      Number,
    ),
    presentCount:
      sql<number>`SUM(CASE WHEN ${attendance.status} = 'present' THEN 1 ELSE 0 END)`.mapWith(
        Number,
      ),
    // ...
  })
  .from(attendance)
  .where(/* date range */)
  .groupBy(attendance.userId);
```

Preserve the existing response shape.

- [x] **Step 5: Verify build**

```bash
npx tsc --noEmit 2>&1 | grep "src/app/api/attendance" | head
```

Expected: no errors.

- [x] **Step 6: Commit** (one commit for all four files)

```bash
git add "src/app/api/attendance"
git commit -m "refactor(api): rewrite attendance routes on drizzle"
```

---

## Task 11: Rewrite employees API routes

**Files:**

- Modify: `src/app/api/employees/route.ts`
- Modify: `src/app/api/employees/[id]/route.ts`
- Modify: `src/app/api/employees/bulk-import/route.ts`
- Create: `src/app/api/employees/[id]/reset-password/route.ts`

- [x] **Step 1: Overwrite `employees/route.ts`**

```ts
import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { hashPassword } from "@/lib/auth/password";
import { isAdmin } from "@/lib/auth";

export async function GET(request: NextRequest) {
  try {
    const auth = await isAdmin(request);
    if (!auth.authorized) {
      return NextResponse.json(
        { success: false, error: auth.error },
        { status: auth.status },
      );
    }

    const rows = await db
      .select({
        id: users.id,
        email: users.email,
        full_name: users.fullName,
        role: users.role,
        branch: users.branch,
        job_title: users.jobTitle,
        shift_start: users.shiftStart,
        shift_end: users.shiftEnd,
        off_day: users.offDay,
        overtime_enabled: users.overtimeEnabled,
        must_change_password: users.mustChangePassword,
        created_at: users.createdAt,
        updated_at: users.updatedAt,
      })
      .from(users)
      .where(eq(users.role, "employee"))
      .orderBy(desc(users.createdAt));

    return NextResponse.json({ success: true, data: rows });
  } catch (err) {
    console.error("Get employees error:", err);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await isAdmin(request);
    if (!auth.authorized) {
      return NextResponse.json(
        { success: false, error: auth.error },
        { status: auth.status },
      );
    }

    const body = await request.json();
    const {
      email,
      password,
      full_name,
      branch,
      job_title,
      shift_start,
      shift_end,
      off_day,
      overtime_enabled,
    } = body ?? {};

    if (!email || !password || !full_name) {
      return NextResponse.json(
        {
          success: false,
          error: "Email, password, and full name are required",
        },
        { status: 400 },
      );
    }
    if (typeof password !== "string" || password.length < 8) {
      return NextResponse.json(
        { success: false, error: "Password must be at least 8 characters" },
        { status: 400 },
      );
    }

    const normalizedEmail = String(email).trim().toLowerCase();

    const existing = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, normalizedEmail))
      .limit(1);
    if (existing[0]) {
      return NextResponse.json(
        { success: false, error: "Email already in use" },
        { status: 409 },
      );
    }

    const passwordHash = await hashPassword(password);
    const id = randomUUID();

    await db.insert(users).values({
      id,
      email: normalizedEmail,
      passwordHash,
      fullName: full_name,
      role: "employee",
      branch: branch ?? null,
      jobTitle: job_title ?? null,
      shiftStart: shift_start ?? null,
      shiftEnd: shift_end ?? null,
      offDay: off_day ?? null,
      overtimeEnabled: overtime_enabled === false ? 0 : 1,
      mustChangePassword: 1,
    });

    return NextResponse.json({
      success: true,
      data: { id, email: normalizedEmail },
    });
  } catch (err) {
    console.error("Create employee error:", err);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 },
    );
  }
}
```

- [x] **Step 2: Rewrite `[id]/route.ts`**

Read the current file first, then translate. It should have PUT and DELETE handlers. Replace:

- `supabase.from('profiles').update({ ... }).eq('id', id)` → `db.update(users).set({ ... }).where(eq(users.id, id))`
- `supabase.from('profiles').delete().eq('id', id)` → `db.delete(users).where(eq(users.id, id))` (cascade will remove attendance rows)
- Supabase admin delete of `auth.users` → no longer needed; the `users` row IS the auth record now

All camelCase conversions: `full_name` → `fullName`, `shift_start` → `shiftStart`, etc.

- [x] **Step 3: Rewrite `bulk-import/route.ts`**

Read the current file. Pattern:

1. Parse CSV (keep existing parsing logic)
2. For each row: validate, hash password with `bcrypt`, insert via Drizzle
3. Use `db.transaction(async (tx) => { ... })` to wrap all inserts so a bad row rolls back the batch
4. Return `{ success: true, data: { inserted: N, failed: M, errors: [...] } }` in the same shape the frontend expects

Example:

```ts
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { hashPassword } from "@/lib/auth/password";
import { randomUUID } from "node:crypto";

await db.transaction(async (tx) => {
  for (const row of parsedRows) {
    const hash = await hashPassword(row.password);
    await tx.insert(users).values({
      id: randomUUID(),
      email: row.email.toLowerCase(),
      passwordHash: hash,
      fullName: row.full_name,
      role: "employee",
      branch: row.branch ?? null,
      jobTitle: row.job_title ?? null,
      shiftStart: row.shift_start ?? null,
      shiftEnd: row.shift_end ?? null,
      offDay: row.off_day ?? null,
      overtimeEnabled: 1,
      mustChangePassword: 1,
    });
  }
});
```

- [x] **Step 4: Create admin reset-password endpoint**

Create `src/app/api/employees/[id]/reset-password/route.ts`:

```ts
import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { generateTempPassword, hashPassword } from "@/lib/auth/password";
import { destroyAllUserSessions } from "@/lib/auth/session";
import { isAdmin } from "@/lib/auth";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await isAdmin(request);
    if (!auth.authorized) {
      return NextResponse.json(
        { success: false, error: auth.error },
        { status: auth.status },
      );
    }

    const { id } = await params;

    const rows = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.id, id))
      .limit(1);
    if (!rows[0]) {
      return NextResponse.json(
        { success: false, error: "Employee not found" },
        { status: 404 },
      );
    }

    const tempPassword = generateTempPassword();
    const hash = await hashPassword(tempPassword);

    await db
      .update(users)
      .set({
        passwordHash: hash,
        mustChangePassword: 1,
        updatedAt: new Date(),
      })
      .where(eq(users.id, id));

    await destroyAllUserSessions(id);

    return NextResponse.json({
      success: true,
      data: { tempPassword },
    });
  } catch (err) {
    console.error("Reset password error:", err);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 },
    );
  }
}
```

- [x] **Step 5: Commit**

```bash
git add src/app/api/employees
git commit -m "refactor(api): rewrite employees routes on drizzle + bcrypt"
```

---

## Task 12: Rewrite settings route

**Files:**

- Modify: `src/app/api/settings/route.ts`

- [x] **Step 1: Read the current file**

```bash
cat src/app/api/settings/route.ts
```

- [x] **Step 2: Overwrite**

```ts
import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { globalSettings } from "@/lib/db/schema";
import { isAdmin } from "@/lib/auth";

export async function GET(request: NextRequest) {
  try {
    const auth = await isAdmin(request);
    if (!auth.authorized) {
      return NextResponse.json(
        { success: false, error: auth.error },
        { status: auth.status },
      );
    }

    const rows = await db
      .select()
      .from(globalSettings)
      .where(eq(globalSettings.id, 1))
      .limit(1);

    const row = rows[0];
    return NextResponse.json({
      success: true,
      data: {
        early_checkin_minutes: row?.earlyCheckinMinutes ?? 60,
        late_grace_minutes: row?.lateGraceMinutes ?? 0,
        checkout_window_minutes: row?.checkoutWindowMinutes ?? 60,
        max_overtime_minutes: row?.maxOvertimeMinutes ?? 180,
      },
    });
  } catch (err) {
    console.error("Get settings error:", err);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 },
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const auth = await isAdmin(request);
    if (!auth.authorized) {
      return NextResponse.json(
        { success: false, error: auth.error },
        { status: auth.status },
      );
    }

    const body = await request.json();
    const patch = {
      earlyCheckinMinutes: Number(body?.early_checkin_minutes ?? 60),
      lateGraceMinutes: Number(body?.late_grace_minutes ?? 0),
      checkoutWindowMinutes: Number(body?.checkout_window_minutes ?? 60),
      maxOvertimeMinutes: Number(body?.max_overtime_minutes ?? 180),
      updatedAt: new Date(),
    };

    // Upsert: the row with id=1 always exists (seeded in initial migration),
    // so a plain UPDATE is enough.
    await db.update(globalSettings).set(patch).where(eq(globalSettings.id, 1));

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Update settings error:", err);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 },
    );
  }
}
```

- [x] **Step 3: Commit**

```bash
git add src/app/api/settings
git commit -m "refactor(api): rewrite settings route on drizzle"
```

---

## Task 13: Rewrite `attendanceFinalization.ts` + finalize endpoint

**Files:**

- Modify: `src/lib/attendanceFinalization.ts`
- Modify: `src/app/api/internal/attendance/finalize/route.ts` (path may differ — confirm by reading)

- [x] **Step 1: Read existing finalization lib**

```bash
cat src/lib/attendanceFinalization.ts
```

Note every query. This file typically does two things:

1. Mark employees as `absent` who never checked in and whose shift has ended
2. Auto-close `missing_checkout` rows where the employee checked in but never checked out

- [x] **Step 2: Translate function by function**

For each function in the file:

- Replace the Supabase client parameter with importing `db` from `@/lib/db`
- Replace every `.from('profiles')` with `.from(users)` and the camelCase columns (`shiftStart`, `shiftEnd`, `offDay`)
- Replace every `.from('attendance')` with the `attendance` table from the schema
- For complex `NOT EXISTS` subqueries use Drizzle's `notExists(db.select().from(attendance).where(...))`
- For shift-end time math in SQL, prefer computing the cutoff in TypeScript (using `getEgyptNow()` from `src/lib/timezone.ts`) and passing it as a parameter — easier to reason about and avoids MySQL-specific time functions

Example skeleton:

```ts
import { and, eq, lt, isNull, notExists } from "drizzle-orm";
import { db } from "@/lib/db";
import { users, attendance } from "@/lib/db/schema";
import { randomUUID } from "node:crypto";
import { getEgyptNow } from "@/lib/timezone";

export async function markAbsentForEndedShifts() {
  const { date: today, totalMinutes: nowMinutes } = getEgyptNow();
  const dayOfWeek = new Intl.DateTimeFormat("en-US", {
    timeZone: "Africa/Cairo",
    weekday: "long",
  })
    .format(new Date())
    .toLowerCase();

  // Find all employees whose shift has ended today and who have no attendance row
  const candidates = await db
    .select({
      id: users.id,
      shiftEnd: users.shiftEnd,
      offDay: users.offDay,
    })
    .from(users)
    .where(eq(users.role, "employee"));

  let inserted = 0;
  for (const emp of candidates) {
    if (emp.offDay && emp.offDay.toLowerCase() === dayOfWeek) continue;
    if (!emp.shiftEnd) continue;
    const [h, m] = emp.shiftEnd.split(":").map(Number);
    const endMinutes = h * 60 + m;
    if (nowMinutes < endMinutes) continue; // shift still ongoing

    // Does a row already exist for today?
    const existing = await db
      .select({ id: attendance.id })
      .from(attendance)
      .where(and(eq(attendance.userId, emp.id), eq(attendance.date, today)))
      .limit(1);
    if (existing[0]) continue;

    await db.insert(attendance).values({
      id: randomUUID(),
      userId: emp.id,
      date: today,
      status: "absent",
    });
    inserted++;
  }
  return { inserted };
}

export async function closeMissingCheckouts() {
  const { date: today } = getEgyptNow();
  const result = await db
    .update(attendance)
    .set({ status: "missing_checkout" })
    .where(
      and(
        lt(attendance.date, today),
        isNull(attendance.checkOutTime),
        // Only flip rows that were present/late (not already absent or missing_checkout)
        // Add a raw condition if needed
      ),
    );
  return {
    closed: (result as unknown as { affectedRows?: number }).affectedRows ?? 0,
  };
}
```

Adapt the above to match the actual functions exported from the existing file. Keep function names and return shapes identical.

- [x] **Step 3: Rewrite the finalize endpoint**

Read and overwrite `src/app/api/internal/attendance/finalize/route.ts` to import and call the rewritten lib functions. Keep the `authorizeInternalScheduler(request)` guard at the top. Response shape stays `{ success: true, data: { ... } }`.

- [x] **Step 4: Commit**

```bash
git add src/lib/attendanceFinalization.ts src/app/api/internal/attendance/finalize
git commit -m "refactor(cron): rewrite attendance finalization on drizzle"
```

---

## Task 14: New mark-absent cron endpoint + consolidate old route

**Files:**

- Create: `src/app/api/internal/attendance/mark-absent/route.ts`
- Delete: `src/app/api/attendance/mark-absent/route.ts` (if redundant — see step 1)

- [x] **Step 1: Inspect the old mark-absent route**

```bash
cat src/app/api/attendance/mark-absent/route.ts
```

Decide:

- If it's only called by cron/internal scheduler → **delete it** and use the new internal route exclusively
- If it has unique logic (e.g., an admin-triggered "mark someone absent manually") → **keep it** but rewrite it on Drizzle

- [x] **Step 2: Create new internal cron endpoint**

Create `src/app/api/internal/attendance/mark-absent/route.ts`:

```ts
import { NextRequest, NextResponse } from "next/server";
import { authorizeInternalScheduler } from "@/lib/auth";
import { markAbsentForEndedShifts } from "@/lib/attendanceFinalization";

export async function POST(request: NextRequest) {
  const guard = authorizeInternalScheduler(request);
  if (!guard.authorized) {
    return NextResponse.json(
      { success: false, error: guard.error },
      { status: guard.status },
    );
  }
  try {
    const result = await markAbsentForEndedShifts();
    return NextResponse.json({ success: true, data: result });
  } catch (err) {
    console.error("mark-absent cron error:", err);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 },
    );
  }
}
```

- [x] **Step 3: Delete or rewrite the old route**

If deleting:

```bash
rm src/app/api/attendance/mark-absent/route.ts
rmdir src/app/api/attendance/mark-absent
```

If keeping: translate it to Drizzle following the pattern from Task 10.

- [x] **Step 4: Commit**

```bash
git add src/app/api/internal/attendance/mark-absent src/app/api/attendance/mark-absent 2>/dev/null
git commit -m "feat(cron): add internal mark-absent endpoint; consolidate old route"
```

---

## Task 15: Cleanup-sessions cron endpoint

**Files:**

- Create: `src/app/api/internal/maintenance/cleanup-sessions/route.ts`

- [x] **Step 1: Create the endpoint**

```ts
import { NextRequest, NextResponse } from "next/server";
import { authorizeInternalScheduler } from "@/lib/auth";
import { cleanupExpiredSessions } from "@/lib/auth/session";

export async function POST(request: NextRequest) {
  const guard = authorizeInternalScheduler(request);
  if (!guard.authorized) {
    return NextResponse.json(
      { success: false, error: guard.error },
      { status: guard.status },
    );
  }
  try {
    const removed = await cleanupExpiredSessions();
    return NextResponse.json({ success: true, data: { removed } });
  } catch (err) {
    console.error("cleanup-sessions cron error:", err);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 },
    );
  }
}
```

- [x] **Step 2: Commit**

```bash
git add src/app/api/internal/maintenance
git commit -m "feat(cron): session cleanup endpoint"
```

---

## Task 16: Rewrite frontend pages (remove direct Supabase client usage)

**Files:**

- Modify: `src/app/[locale]/page.tsx`
- Modify: `src/app/[locale]/employee/page.tsx`
- Modify: `src/app/[locale]/admin/layout.tsx`
- Modify: `src/app/[locale]/admin/employees/page.tsx`

These are the client-component pages that import `@/lib/supabase/client`. The fix is identical in all of them: replace Supabase queries/auth with `fetch()` calls to the API routes.

- [x] **Step 1: `page.tsx` (landing)**

```bash
cat "src/app/[locale]/page.tsx"
```

If it's a pure marketing page, just delete any Supabase import. If it reads the user for a "Continue to dashboard" link, replace with a call to a new `GET /api/auth/me` endpoint (create it if needed — see step 5).

- [x] **Step 2: `employee/page.tsx`**

This page fetches the current user and their attendance. Pattern:

```tsx
// BEFORE
const supabase = createClient();
const {
  data: { user },
} = await supabase.auth.getUser();
const { data: profile } = await supabase
  .from("profiles")
  .select("*")
  .eq("id", user.id)
  .single();

// AFTER
const res = await fetch("/api/auth/me", { credentials: "include" });
const { data: user } = await res.json();
```

For attendance history, if it was querying directly, add a `GET /api/attendance/me` endpoint that returns the current user's attendance history (scoped by session) — don't expose the admin listing endpoint to employees.

- [x] **Step 3: `admin/layout.tsx`**

Usually just reads the current user to decide whether to render admin chrome. Replace with `fetch('/api/auth/me')`. If it's a Server Component (not a client), use `getCurrentUser(request)` from `@/lib/auth` + `headers()` inside the RSC.

- [x] **Step 4: `admin/employees/page.tsx`**

Replace direct Supabase queries with `fetch('/api/employees')` (which already exists after Task 11). CRUD operations POST/PUT/DELETE to the same API.

- [x] **Step 5: Create `GET /api/auth/me` endpoint**

If it doesn't exist yet, create `src/app/api/auth/me/route.ts`:

```ts
import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";

export async function GET(request: NextRequest) {
  const user = await getCurrentUser(request);
  if (!user) {
    return NextResponse.json(
      { success: false, error: "Unauthorized" },
      { status: 401 },
    );
  }
  return NextResponse.json({
    success: true,
    data: {
      id: user.id,
      email: user.email,
      full_name: user.fullName,
      role: user.role,
      branch: user.branch,
      job_title: user.jobTitle,
      shift_start: user.shiftStart,
      shift_end: user.shiftEnd,
      off_day: user.offDay,
      overtime_enabled: user.overtimeEnabled === 1,
      must_change_password: user.mustChangePassword === 1,
    },
  });
}
```

- [x] **Step 6: Create `GET /api/attendance/me` for employee history**

Create `src/app/api/attendance/me/route.ts`:

```ts
import { NextRequest, NextResponse } from "next/server";
import { and, desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { attendance } from "@/lib/db/schema";
import { getCurrentUser } from "@/lib/auth";

export async function GET(request: NextRequest) {
  const user = await getCurrentUser(request);
  if (!user) {
    return NextResponse.json(
      { success: false, error: "Unauthorized" },
      { status: 401 },
    );
  }
  const rows = await db
    .select()
    .from(attendance)
    .where(eq(attendance.userId, user.id))
    .orderBy(desc(attendance.date))
    .limit(90);

  return NextResponse.json({ success: true, data: rows });
}
```

- [x] **Step 7: Verify `next build`**

```bash
npm run build
```

Expected: build succeeds. If there are errors, they should now be confined to syntax/type issues — no more `Cannot find module '@/lib/supabase/*'` errors.

- [x] **Step 8: Commit**

```bash
git add "src/app/[locale]" "src/app/api/auth/me" "src/app/api/attendance/me"
git commit -m "refactor(frontend): move client components from supabase to fetch()"
```

---

## Task 17: Delete Supabase files + vercel.json + old migrations

**Files:**

- Delete: `src/lib/supabase/client.ts`
- Delete: `src/lib/supabase/server.ts`
- Delete: `src/lib/supabase/` (directory)
- Delete: `src/app/auth/callback/route.ts`
- Delete: `src/app/auth/callback/` (directory)
- Delete: `src/app/auth/` (directory if empty)
- Delete: `supabase-schema.sql`
- Delete: `migrations/*.sql` (all files)
- Delete: `migrations/` (directory)
- Delete: `vercel.json`

- [x] **Step 1: Verify nothing still imports Supabase**

```bash

```

<br>

Use the Grep tool (not `grep`) for the actual check:

- Run Grep with pattern `@/lib/supabase` and `@supabase/` across `src/` — expect ZERO matches. If any remain, fix those files before deleting.

- [x] **Step 2: Delete files**

```bash
rm -r src/lib/supabase
rm -r src/app/auth
rm supabase-schema.sql
rm -r migrations
rm vercel.json
```

- [x] **Step 3: Rebuild to confirm**

```bash
npm run build
```

Expected: success.

- [x] **Step 4: Commit**

```bash
git add -A
git commit -m "chore: remove supabase sdk, callbacks, legacy migrations, vercel.json"
```

---

## Task 18: Write `docs/DEPLOYMENT.md`

**Files:**

- Create: `docs/DEPLOYMENT.md`

- [x] **Step 1: Write the deployment guide**

Create `docs/DEPLOYMENT.md`:

````markdown
# Deployment — CyberPanel + LiteSpeed Enterprise

This guide assumes a fresh CyberPanel installation on Ubuntu/AlmaLinux with LiteSpeed Enterprise licensed, MariaDB bundled, and a domain pointing at the VPS.

## 1. Database setup

```bash
sudo mysql -u root
```

```sql
CREATE DATABASE amwag_attendance CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'amwag'@'127.0.0.1' IDENTIFIED BY '<strong-password>';
GRANT ALL PRIVILEGES ON amwag_attendance.* TO 'amwag'@'127.0.0.1';
FLUSH PRIVILEGES;
EXIT;
```

## 2. App deployment

Deploy the built Next.js app to `/home/<user>/amwag-attendance`. Either:

- Use CyberPanel's **Node.js Apps** feature (Websites → Manage → Node.js) — set app path, entry point `npm start`, port `3000`
- Or run manually with pm2:
  ```bash
  cd /home/<user>/amwag-attendance
  npm ci --production
  npm run build
  pm2 start "npm start" --name amwag
  pm2 save
  pm2 startup  # follow the printed command
  ```

## 3. Environment variables

Create `/home/<user>/amwag-attendance/.env.local`:

```env
DATABASE_URL=mysql://amwag:<strong-password>@127.0.0.1:3306/amwag_attendance
INTERNAL_SCHEDULER_SECRET=<64-char random from `openssl rand -hex 32`>
SESSION_COOKIE_NAME=amwag_session
SESSION_TTL_DAYS=30
NODE_ENV=production
```

## 4. Run migrations + seed admin

```bash
cd /home/<user>/amwag-attendance
npm run db:migrate
npm run db:seed   # prompts for admin email, password, full name
```

## 5. LiteSpeed reverse proxy

In CyberPanel: Websites → Manage → vHost Conf. Add an external app and context:

```
extprocessor nodejs {
  type                    proxy
  address                 127.0.0.1:3000
  maxConns                200
  pcKeepAliveTimeout      60
  initTimeout             60
  retryTimeout            0
  respBuffer              0
}

context / {
  type                    proxy
  handler                 nodejs
  addDefaultCharset       off
}
```

Save. Click **Rewrite Rules** and remove any default WordPress/PHP rules. Restart LSWS.

Attach SSL via CyberPanel's **Issue SSL** button (uses Let's Encrypt).

## 6. Cron jobs

In CyberPanel: Websites → Manage → Cron Jobs. Add three entries:

```cron
*/15 * * * * curl -fsS -X POST -H "Authorization: Bearer $SECRET" http://127.0.0.1:3000/api/internal/attendance/mark-absent > /dev/null
5 0 * * * curl -fsS -X POST -H "Authorization: Bearer $SECRET" http://127.0.0.1:3000/api/internal/attendance/finalize > /dev/null
0 3 * * * curl -fsS -X POST -H "Authorization: Bearer $SECRET" http://127.0.0.1:3000/api/internal/maintenance/cleanup-sessions > /dev/null
```

The `$SECRET` variable must be exported for the cron shell. Simplest: before the three lines above, add:

```cron
SECRET=<the same 64-char value from .env.local>
```

CyberPanel's Cron Jobs editor accepts env-var assignments at the top of the file.

## 7. Timezone

```bash
sudo timedatectl set-timezone Africa/Cairo
```

This aligns cron schedules with "midnight Egypt time" for the finalize job.

## 8. Smoke test

```bash
curl -I https://your-domain/           # LSWS is proxying
curl -I https://your-domain/ar/login   # the app renders
curl -X POST -H "Authorization: Bearer $SECRET" \
  https://your-domain/api/internal/maintenance/cleanup-sessions
# expected: {"success":true,"data":{"removed":0}}
```

## 9. Upgrades

```bash
git pull
npm ci --production
npm run db:migrate
npm run build
pm2 restart amwag   # or use CyberPanel's Node.js Apps "Restart" button
```
````

- [x] **Step 2: Commit**

```bash
git add docs/DEPLOYMENT.md
git commit -m "docs: CyberPanel + LiteSpeed + MariaDB + cron deployment guide"
```

---

## Task 19: Local smoke test

**Files:**

- No code changes

- [x] **Step 1: Full clean build**

```bash
npm run build
```

Expected: success, no warnings about missing modules.

- [x] **Step 2: Start dev server**

```bash
npm run dev
```

(Run in a second terminal or background. Leave it up for the rest of the test.)

- [] **Step 3: Admin login**

- Visit `http://localhost:3000/ar/login`
- Log in with the seeded admin credentials
- Expected: redirect to `/ar/admin` (no forced password change because seed sets `must_change_password = 0`)

- [] **Step 4: Create an employee**

- Navigate to admin employees page
- Create a new employee with a temp password
- Expected: 200 response, employee appears in the list

- [] **Step 5: Employee forced password change**

- Log out (POST to `/api/auth/logout` or via UI)
- Log in as the new employee
- Expected: redirected to `/ar/change-password`
- Set a new password
- Expected: redirected to `/ar/employee`

- [] **Step 6: Clock in / clock out**

- From the employee page, clock in
- Expected: 200, row appears in DB (check via `mysql -u amwag -p amwag_attendance -e "SELECT * FROM attendance"`)
- Clock out
- Expected: 200, `check_out_time` populated

- [ ] **Step 7: Admin dashboard data**

- Log back in as admin
- Visit `/ar/admin/attendance`
- Expected: the employee's attendance row appears

- [ ] **Step 8: Bulk CSV import**

- Upload the existing test CSV (8 columns per the spec)
- Expected: all rows created, each user gets `must_change_password = 1`

- [ ] **Step 9: Settings read/write**

- Visit `/ar/admin/settings`
- Change `early_checkin_minutes` to `45`
- Reload
- Expected: value persisted

- [ ] **Step 10: Cron endpoints**

```bash
SECRET=$(grep INTERNAL_SCHEDULER_SECRET .env.local | cut -d= -f2)

curl -fsS -X POST -H "Authorization: Bearer $SECRET" \
  http://localhost:3000/api/internal/attendance/mark-absent
# expected: {"success":true,"data":{"inserted":<N>}}

curl -fsS -X POST -H "Authorization: Bearer $SECRET" \
  http://localhost:3000/api/internal/attendance/finalize
# expected: {"success":true,"data":{...}}

curl -fsS -X POST -H "Authorization: Bearer $SECRET" \
  http://localhost:3000/api/internal/maintenance/cleanup-sessions
# expected: {"success":true,"data":{"removed":<N>}}
```

- [x] **Step 11: Cron unauthorized check**

```bash
curl -i -X POST http://localhost:3000/api/internal/maintenance/cleanup-sessions
# expected: HTTP/1.1 401 Unauthorized
```

- [ ] **Step 12: Admin password reset flow**

- From admin employees page, click "Reset password" on an employee
- Expected: API returns a plaintext temp password in the response; the employee can log in with it and is forced to change it

- [ ] **Step 13: If all green, merge**

```bash
git checkout main
git merge --squash feat/mariadb-migration
git commit -m "$(cat <<'EOF'
feat: migrate from Supabase to self-hosted MariaDB

- Replace @supabase/* with drizzle-orm + mysql2 + bcrypt
- DB-backed sessions in httpOnly cookies (no JWT)
- Force first-login password change via must_change_password flag
- Linux cron → HTTP endpoints for mark-absent, finalize, cleanup-sessions
- Delete pg_cron SQL, supabase-schema.sql, vercel.json, auth/callback
- Add DEPLOYMENT.md for CyberPanel + LiteSpeed Enterprise

See docs/superpowers/specs/2026-04-07-mariadb-migration-design.md
EOF
)"
```

- [ ] **Step 14: Push**

```bash
git push origin main
```

- [ ] **Step 15: Rotate Supabase keys**

Log into the Supabase dashboard and either rotate the anon + service role keys (if the project must stay) or delete the project entirely. The old values are still in git history so treat them as compromised.

---

## Self-review checklist (plan author)

1. **Spec coverage:** every spec section maps to at least one task?
   - § Architecture → Tasks 0, 2, 18 (deployment)
   - § Schema → Tasks 2, 3
   - § Auth & sessions → Tasks 4, 5, 6, 7, 8
   - § Drizzle query layer → Tasks 2, 9, 10, 11, 12, 13
   - § Cron endpoints → Tasks 13, 14, 15
   - § Env vars → Tasks 2, 18
   - § Rollout plan → Tasks 0–19 (all ordered)
   - § Testing → Task 19
   - § Out of scope → explicitly not implemented ✓
   - § Risks & mitigations → handled inline in Tasks 10 (client coupling), 13 (finalization), 2 (tz), 14 (route consolidation)

2. **Placeholders:** none (`<strong-password>` and `<64-char random>` are intentional env-var placeholders filled by the operator at deploy time).

3. **Type consistency:** `users`, `sessions`, `attendance`, `branchAllowedIps`, `globalSettings` are the five table exports. `getCurrentUser()`, `isAdmin()`, `isAdminOrAccountant()` are the three auth helpers. `createSession`, `getSessionByToken`, `destroySession`, `destroyAllUserSessions`, `cleanupExpiredSessions` are the five session helpers. `hashPassword`, `verifyPassword`, `generateTempPassword` are the three password helpers. `readSessionCookie`/`setSessionCookie`/`clearSessionCookie` (for API routes) and `readSessionCookieFromRequest`/`setSessionCookieOnResponse`/`clearSessionCookieOnResponse` (for middleware) are the six cookie helpers. All referenced consistently across tasks.
