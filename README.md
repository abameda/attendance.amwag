# Amwag Attendance System

A modern, production-ready employee attendance and branch-based workforce management system built with Next.js 15. Designed for multi-branch companies that need reliable shift tracking, IP-based network validation, and automated absence finalization.

![Next.js](https://img.shields.io/badge/Next.js-15-black?logo=next.js)
![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?logo=typescript)
![MySQL](https://img.shields.io/badge/MySQL%2FMariaDB-8%2B-orange?logo=mysql)
![Tailwind CSS](https://img.shields.io/badge/Tailwind-v4-38bdf8?logo=tailwindcss)
![Node.js](https://img.shields.io/badge/Node.js-20%20LTS-green?logo=node.js)

---

## Table of Contents

- [Features](#features)
- [Tech Stack](#tech-stack)
- [User Roles](#user-roles)
- [How Attendance Works](#how-attendance-works)
- [Automatic Absence Finalization](#automatic-absence-finalization)
- [Prerequisites](#prerequisites)
- [Getting Started](#getting-started)
- [Environment Variables](#environment-variables)
- [Available Scripts](#available-scripts)
- [Database Schema](#database-schema)
- [API Reference](#api-reference)
- [Testing](#testing)
- [Production Build](#production-build)
- [Deployment](#deployment)
- [Project Structure](#project-structure)

---

## Features

| Feature | Description |
|---|---|
| **Employee Check-In / Check-Out** | Employees check in and out via their dashboard. Shift window enforcement prevents out-of-window submissions. |
| **Branch-Based IP Validation** | Attendance is only accepted from IP addresses (exact or CIDR) registered for the employee's branch. |
| **Multi-Branch Management** | Create and manage branches with name, code, and address. Assign employees to specific branches. |
| **Role-Based Access** | Three roles: `admin`, `accountant`, and `employee`. Each sees only what they are authorized for. |
| **Admin Dashboard** | Real-time stats: present today, late, absent, total employees, plus quick-access tables. |
| **Employee Analytics** | Per-employee attendance breakdown showing present, late, absent, and missing-checkout rates over time. |
| **Attendance Reports** | Admin-side paginated and filterable attendance records across all employees and branches. |
| **PDF Export** | Attendance reports can be exported as formatted PDF files. |
| **Late / Overtime / Early Departure** | Each check-in/out is evaluated against the employee's shift. Minutes late, minutes early, and overtime are stored per record. |
| **Missing Checkout Detection** | If an employee checks in but not out before the checkout window closes, the record is flagged as `missing_checkout`. |
| **Automatic Absence Marking** | A scheduler endpoint runs hourly and marks employees absent or flags missing checkouts after their shift ends. |
| **Session Cleanup** | A maintenance endpoint removes expired database sessions. |
| **Bulk Employee Import** | Admins can import employees via CSV with name, email, job title, branch, shift times, and off day. |
| **Bilingual UI (EN / AR)** | Full Arabic and English support with proper RTL layout switching. |
| **Global Attendance Settings** | Admin-configurable: early check-in window, late grace period, checkout window, and max overtime cap. |
| **Database Backups** | Admin can trigger and download database backups directly from the dashboard. |
| **Forced Password Change** | Admin-created accounts can be flagged to require a password change on first login. |

---

## Tech Stack

| Layer | Technology |
|---|---|
| **Framework** | Next.js 15 (App Router, standalone output) |
| **Language** | TypeScript 5 |
| **UI** | React 19, Tailwind CSS v4, Framer Motion |
| **Database** | MySQL 8+ / MariaDB 10.6+ |
| **ORM** | Drizzle ORM (mysql dialect) |
| **Auth** | Custom session-based auth (bcrypt + cookie) |
| **i18n** | next-intl (English + Arabic, RTL) |
| **PDF** | @react-pdf/renderer, jspdf |
| **Charts** | Recharts |
| **3D Background** | Three.js (GLSL shader background) |
| **Icons** | Lucide React |

---

## User Roles

| Role | Access |
|---|---|
| `admin` | Full access: employees, branches, IP rules, attendance reports, PDF export, settings, backups, analytics |
| `accountant` | Read-only access to attendance reports (no employee or branch management) |
| `employee` | Own dashboard only: check in/out, view own attendance history and summary |

---

## How Attendance Works

1. **Employee logs in** using their email and password.
2. **Employee opens their dashboard** and sees their current shift and today's attendance status.
3. **Employee clicks Check In.** The server:
   - Resolves the client's IP address from request headers.
   - Looks up the IP rules registered for the employee's branch.
   - Rejects the request if the IP is not on the allowlist (exact IP or CIDR match).
   - Checks the employee is within their allowed check-in window (shift start minus early check-in buffer).
   - Calculates late minutes against the shift start time and grace period.
   - Saves the attendance record with status `present` or `late`.
4. **Employee clicks Check Out.** The server:
   - Confirms an open check-in exists for the current work date.
   - Validates the IP again.
   - Calculates early departure minutes and overtime minutes.
   - Updates the attendance record and sets check-out time.
5. **Admin reviews reports** via the attendance dashboard, filtering by date range, branch, or employee.
6. **Absences and missing checkouts are finalized automatically** via the scheduler endpoint (see below).

> Night-shift support: work dates are calculated in Egypt timezone (`Africa/Cairo`). Shifts that cross midnight (e.g. 22:00–06:00) are handled correctly — check-ins after midnight are still attributed to the previous work date.

---

## Automatic Absence Finalization

The finalization logic lives in `src/lib/attendanceFinalization.ts` and is exposed at:

```
POST /api/internal/attendance/finalize
```

**What it does on each run:**
- Iterates every employee with role `employee`.
- Checks today and (where relevant) yesterday against each employee's shift times.
- Skips the employee's configured off day.
- If the shift end time has passed and no attendance record exists → inserts an `absent` record.
- If the employee checked in but never checked out and the checkout window has expired → updates the record to `missing_checkout`.
- Uses a MySQL named lock (`GET_LOCK`) to ensure only one run executes at a time. Concurrent calls return `409`.

**This endpoint must be triggered by your server's cron daemon.** It does not run automatically on its own.

### Recommended cron schedule

Run every hour, all day:

```bash
0 * * * * curl -fsS -X POST \
  -H "Authorization: Bearer YOUR_SECRET_HERE" \
  http://127.0.0.1:3000/api/internal/attendance/finalize
```

### Session cleanup

Run nightly to prune expired sessions from the database:

```bash
0 3 * * * curl -fsS -X POST \
  -H "Authorization: Bearer YOUR_SECRET_HERE" \
  http://127.0.0.1:3000/api/internal/maintenance/cleanup-sessions
```

Both endpoints require the `Authorization: Bearer <INTERNAL_SCHEDULER_SECRET>` header. The secret is validated using a constant-time comparison to prevent timing attacks.

> See [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) for the full CyberPanel cron setup.

---

## Prerequisites

- **Node.js 20 LTS** or higher
- **MySQL 8+** or **MariaDB 10.6+**
- **npm** (bundled with Node.js)

---

## Getting Started

### 1. Clone the repository

```bash
git clone https://github.com/abameda/attendance.amwag amwag-attendance
cd amwag-attendance
```

### 2. Install dependencies

```bash
npm install
```

### 3. Configure environment

Copy the example file and fill in your values:

```bash
cp .env.example .env.local
```

At minimum you need `DATABASE_URL` and `INTERNAL_SCHEDULER_SECRET`. See [Environment Variables](#environment-variables) for the full reference.

### 4. Create the database

Connect to your MySQL/MariaDB server and create the database:

```sql
CREATE DATABASE amwag_attendance CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'amwag'@'127.0.0.1' IDENTIFIED BY 'strong-password';
GRANT ALL PRIVILEGES ON amwag_attendance.* TO 'amwag'@'127.0.0.1';
FLUSH PRIVILEGES;
```

Then update `DATABASE_URL` in `.env.local`:

```
DATABASE_URL=mysql://amwag:strong-password@127.0.0.1:3306/amwag_attendance
```

### 5. Run migrations

```bash
npm run db:migrate
```

This applies all Drizzle migrations from `drizzle/migrations/` and creates the tables.

If you are using an older local development database and login fails with a missing
`branch_id` column, run the idempotent branch schema repair once:

```bash
npm run db:repair
```

### 6. Seed the first admin account

```bash
npm run db:seed
```

The script will prompt you interactively:

```
Admin email:
Admin password (min 8 chars):
Full name:
```

Enter the credentials for your first admin user. You can re-run this command at any time to update the admin's password without losing data (uses `ON DUPLICATE KEY UPDATE`).

### 7. Start the development server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). The app redirects to `/en/login` by default.

> **IP validation in development:** when `NODE_ENV=development`, check-ins from `127.0.0.1` (localhost) are allowed even if no IP rules are configured. This only applies locally.

---

## Environment Variables

Create a `.env.local` file in the project root (never commit real secrets):

| Variable | Required | Default | Description |
|---|---|---|---|
| `DATABASE_URL` | Yes | — | MySQL/MariaDB connection URL: `mysql://user:pass@host:port/db` |
| `APP_URL` | Yes in production | `http://localhost:3000` | Public app origin used by middleware for internal auth lookups, for example `https://attendance.example.com`. |
| `INTERNAL_SCHEDULER_SECRET` | Yes | — | Bearer token that protects `/api/internal/*` endpoints. Generate with `openssl rand -hex 32`. |
| `BACKUP_ENCRYPTION_KEY` | Yes in production | — | 64-hex-character secret used to encrypt admin-created backup files. Generate a different value with `openssl rand -hex 32`. |
| `SESSION_COOKIE_NAME` | No | `amwag_session` | Name of the HTTP-only session cookie. |
| `SESSION_TTL_DAYS` | No | `30` | How many days a session stays valid. |
| `TRUST_X_FORWARDED_FOR` | No | `false` | Set to `true` behind a trusted reverse proxy (LiteSpeed / Nginx) so real client IPs are used for branch validation. |
| `NODE_ENV` | No | `development` | Set to `production` in production environments. |

### Generating secrets

```bash
# 64-character random hex secret
openssl rand -hex 32
```

---

## Available Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start the Next.js development server with hot reload |
| `npm run build` | Compile the production build (outputs to `.next/`) |
| `npm start` | Start the production server (requires `npm run build` first) |
| `npm test` | Run the test suite using Node.js built-in test runner via `tsx` |
| `npm run lint` | Run ESLint across the codebase |
| `npm run db:generate` | Generate new Drizzle migration files after schema changes |
| `npm run db:migrate` | Apply all pending migrations to the database |
| `npm run db:push` | Push schema directly without migrations (development only) |
| `npm run db:repair` | Repair older local databases missing branch-management schema objects |
| `npm run db:seed` | Create or update the first admin account (interactive) |

---

## Database Schema

| Table | Purpose |
|---|---|
| `users` | All system users (admin, accountant, employee). Stores shift times, branch assignment, job title, and off day. |
| `branches` | Company branches with name, code, and address. |
| `branch_allowed_ips` | IP allowlist per branch. Supports exact IP and CIDR rules. |
| `attendance` | One record per employee per work date. Stores check-in/out times, IP addresses, status, and deviation minutes. |
| `sessions` | Active login sessions. Stores token, user ID, expiry, user-agent, and IP. |
| `global_settings` | Single-row table with system-wide attendance tuning values. |

### Attendance statuses

| Status | Meaning |
|---|---|
| `present` | Checked in on time |
| `late` | Checked in after shift start + grace period |
| `absent` | No check-in recorded after shift end has passed |
| `missing_checkout` | Checked in but did not check out before the checkout window closed |

---

## API Reference

### Auth

| Method | Path | Auth | Description |
|---|---|---|---|
| `POST` | `/api/auth/login` | Public | Log in, sets session cookie |
| `POST` | `/api/auth/logout` | Session | Destroy session and clear cookie |
| `GET` | `/api/auth/me` | Session | Return current user profile |
| `POST` | `/api/auth/change-password` | Session | Change own password |

### Employee Attendance

| Method | Path | Auth | Description |
|---|---|---|---|
| `POST` | `/api/attendance/check-in` | Employee | Record check-in (IP validated) |
| `POST` | `/api/attendance/check-out` | Employee | Record check-out (IP validated) |
| `GET` | `/api/attendance/me` | Employee | Own attendance history |
| `GET` | `/api/attendance/summary` | Employee | Own attendance summary stats |

### Admin Attendance

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/api/attendance` | Admin/Accountant | All attendance records (paginated, filterable) |
| `POST` | `/api/admin/attendance/export-pdf` | Admin | Export attendance report as PDF |

### Employee Management

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET/POST` | `/api/employees` | Admin | List or create employees |
| `GET/PUT/DELETE` | `/api/employees/[id]` | Admin | Get, update, or delete employee |
| `POST` | `/api/employees/[id]/reset-password` | Admin | Reset employee password |
| `POST` | `/api/employees/bulk-import` | Admin | Bulk import employees via CSV |
| `GET` | `/api/admin/employees/[id]/attendance-analytics` | Admin | Per-employee analytics |

### Branch Management

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET/POST` | `/api/admin/branches` | Admin | List or create branches |
| `GET/PUT/DELETE` | `/api/admin/branches/[id]` | Admin | Get, update, or delete branch |
| `GET/POST` | `/api/admin/branch-ips` | Admin | List or create IP rules |
| `PUT/DELETE` | `/api/admin/branch-ips/[id]` | Admin | Update or delete an IP rule |

### Settings & Backups

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET/PUT` | `/api/settings` | Admin | Read or update global attendance settings |
| `GET` | `/api/admin/backups` | Admin | List available backups |
| `POST` | `/api/admin/backups/create` | Admin | Trigger a new backup |
| `GET` | `/api/admin/backups/[id]/download` | Admin | Download a backup file |
| `DELETE` | `/api/admin/backups/[id]` | Admin | Delete a backup |

### Internal Scheduler (requires `Authorization: Bearer <INTERNAL_SCHEDULER_SECRET>`)

| Method | Path | Description |
|---|---|---|
| `POST` | `/api/internal/attendance/finalize` | Mark absent + missing checkout (idempotent, lock-protected) |
| `POST` | `/api/internal/maintenance/cleanup-sessions` | Delete expired database sessions |

---

## Testing

```bash
npm test
```

Tests are located in the `tests/` directory and run with Node.js built-in test runner via `tsx`. They cover:

- Attendance calculations (late minutes, overtime, shift window logic)
- IP validation (exact IP, CIDR, IPv6 normalization)
- Attendance API handlers
- Admin dashboard operations
- Employee directory and analytics
- i18n message completeness
- PDF report layout
- Backup logic

---

## Production Build

```bash
# Install all dependencies (including devDependencies needed for the build)
npm ci

# Compile the Next.js app
npm run build

# Optional: remove dev packages after build to save disk space
npm prune --production

# Start the production server
npm start
```

The app uses Next.js `output: 'standalone'` mode. The compiled output in `.next/` is self-contained.

---

## Deployment

A full production deployment guide for **CyberPanel + LiteSpeed Enterprise + VPS** is available in:

```
docs/DEPLOYMENT.md
```

It covers:

- Node.js 20 installation (AlmaLinux / Ubuntu)
- MySQL/MariaDB database and user setup
- Environment variable configuration
- Building and running the app with **PM2**
- LiteSpeed reverse proxy configuration
- Firewall rules to block direct access to port 3000
- CyberPanel cron job setup for attendance finalization and session cleanup
- Server timezone configuration (`Africa/Cairo`)
- SSL certificate issuance
- Upgrade procedure

---

## Project Structure

```
amwag-attendance/
├── src/
│   ├── app/
│   │   ├── [locale]/              # Locale-prefixed UI pages (en/ar)
│   │   │   ├── login/             # Login page
│   │   │   ├── employee/          # Employee dashboard
│   │   │   ├── change-password/   # Forced password change
│   │   │   └── admin/             # Admin section
│   │   │       ├── page.tsx       # Admin dashboard (stats)
│   │   │       ├── employees/     # Employee list + analytics
│   │   │       ├── branches/      # Branch management
│   │   │       ├── branch-ips/    # IP allowlist management
│   │   │       ├── attendance/    # Attendance report
│   │   │       ├── backups/       # Database backups
│   │   │       └── settings/      # Global settings
│   │   └── api/                   # Next.js API routes
│   │       ├── auth/              # Login, logout, me, change-password
│   │       ├── attendance/        # Check-in, check-out, me, summary
│   │       ├── employees/         # Employee CRUD + bulk import
│   │       ├── admin/             # Admin-only endpoints
│   │       └── internal/          # Scheduler + maintenance endpoints
│   ├── components/
│   │   ├── ui/                    # Design system components
│   │   ├── layout/                # Admin shell and sidebar
│   │   ├── employee/              # Employee dashboard components
│   │   └── pdf/                   # PDF report renderer
│   ├── lib/
│   │   ├── db/                    # Drizzle client and schema
│   │   ├── auth/                  # Session, cookie, and password helpers
│   │   ├── attendanceFinalization.ts  # Core absence/missing-checkout logic
│   │   ├── attendanceCalculations.ts  # Shift window and deviation math
│   │   ├── ipValidation.ts            # IP/CIDR matching and normalization
│   │   └── timezone.ts                # Egypt timezone helpers
│   ├── types/                     # Shared TypeScript types
│   └── middleware.ts              # Auth + locale routing middleware
├── messages/
│   ├── en.json                    # English translations
│   └── ar.json                    # Arabic translations
├── drizzle/
│   └── migrations/                # Auto-generated SQL migrations
├── scripts/
│   └── seed-admin.mjs             # Interactive admin seed script
├── tests/                         # Test suite
├── docs/
│   └── DEPLOYMENT.md              # Full production deployment guide
├── drizzle.config.ts              # Drizzle ORM configuration
├── next.config.ts                 # Next.js configuration
└── .env.example                   # Environment variable template
```

---

## License

Private. All rights reserved.
