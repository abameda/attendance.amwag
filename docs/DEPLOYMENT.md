# Production Deployment Guide

**Stack:** CyberPanel · LiteSpeed Enterprise · Node.js 20 LTS · MySQL / MariaDB · PM2

This guide assumes a fresh CyberPanel installation on Ubuntu or AlmaLinux with LiteSpeed Enterprise licensed, MariaDB available, and a domain pointed at the VPS.

---

## Table of Contents

1. [Node.js 20](#1-nodejs-20)
2. [Database Setup](#2-database-setup)
3. [Get the Code](#3-get-the-code)
4. [Environment Variables](#4-environment-variables)
5. [Build the App](#5-build-the-app)
6. [Migrations and Admin Seed](#6-migrations-and-admin-seed)
7. [Start the App (PM2)](#7-start-the-app-pm2)
8. [LiteSpeed Reverse Proxy](#8-litespeed-reverse-proxy)
9. [Block Direct Access to Port 3000](#9-block-direct-access-to-port-3000)
10. [Cron Jobs](#10-cron-jobs)
11. [Server Timezone](#11-server-timezone)
12. [SSL Certificate](#12-ssl-certificate)
13. [Smoke Test](#13-smoke-test)
14. [Upgrades](#14-upgrades)
15. [Troubleshooting](#15-troubleshooting)

---

## 1. Node.js 20

Next.js 15 requires **Node.js 20 LTS**. Install it before anything else.

**AlmaLinux / RHEL:**

```bash
curl -fsSL https://rpm.nodesource.com/setup_20.x | sudo bash -
sudo yum install -y nodejs
```

**Ubuntu:**

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo bash -
sudo apt install -y nodejs
```

Verify:

```bash
node --version   # must print v20.x.x
npm --version
```

---

## 2. Database Setup

Connect to MariaDB as root:

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

Replace `<strong-password>` with a long random password. Keep a copy — you will need it for the `DATABASE_URL` environment variable.

---

## 3. Get the Code

```bash
cd /home/<user>
git clone https://github.com/abameda/attendance.amwag amwag-attendance
cd amwag-attendance
```

Or upload the project folder via SFTP / CyberPanel File Manager to `/home/<user>/amwag-attendance`.

---

## 4. Environment Variables

Create `/home/<user>/amwag-attendance/.env.local`:

```env
DATABASE_URL=mysql://amwag:<strong-password>@127.0.0.1:3306/amwag_attendance
APP_URL=https://your-domain.example
INTERNAL_SCHEDULER_SECRET=<64-char random — see below>
BACKUP_ENCRYPTION_KEY=<different 64-hex-character random value — see below>
SESSION_COOKIE_NAME=amwag_session
SESSION_TTL_DAYS=30
TRUST_X_FORWARDED_FOR=true
NODE_ENV=production
```

Generate the scheduler secret and backup encryption key (keep a copy of both; the scheduler secret is also needed for cron jobs):

```bash
openssl rand -hex 32
openssl rand -hex 32
```

Use different values for `INTERNAL_SCHEDULER_SECRET` and `BACKUP_ENCRYPTION_KEY`. `BACKUP_ENCRYPTION_KEY` must be exactly 64 hexadecimal characters; generate it with `openssl rand -hex 32`.

> `APP_URL` must be your public HTTPS origin, for example `https://attendance.example.com`.

> Set `TRUST_X_FORWARDED_FOR=true` only when the app is behind a trusted LiteSpeed reverse proxy and direct internet access to port 3000 is blocked. With this flag enabled, the app reads the real client IP from `X-Forwarded-For`; with it disabled, spoofed `X-Forwarded-For` headers are ignored and `X-Real-IP` is preferred.

Production runtime validates this environment at startup and fails fast when required values are missing or invalid. `DATABASE_URL` must be a real database URL in production; the build placeholder URL is reserved for tests and `next build` only.

---

## 5. Build the App

```bash
cd /home/<user>/amwag-attendance
npm ci                  # install all dependencies including devDependencies (needed for build)
npm run build           # compile Next.js — takes 1–3 minutes
npm prune --production  # optional: remove dev packages to save disk space after build
```

---

## 6. Migrations and Admin Seed

Before running migrations on an existing production database:

- Create and download a fresh database backup from the admin backup page or with `mysqldump`.
- Confirm the backup can be read before changing schema.
- Run migrations from the server only after the new code has been uploaded and dependencies are installed.
- Do not run `npm run db:push` in production; it is for development only.
- Do not continue a failed migration by editing production tables manually unless you have a rollback plan and a backup.

Required production checks before branch-related migrations or repair scripts:

```sql
SELECT COUNT(*) AS users_without_branch_id
FROM users
WHERE role = 'employee'
  AND branch IS NOT NULL
  AND TRIM(branch) <> ''
  AND branch_id IS NULL;

SELECT COUNT(*) AS ip_rules_without_branch_id
FROM branch_allowed_ips
WHERE branch_name IS NOT NULL
  AND TRIM(branch_name) <> ''
  AND branch_id IS NULL;
```

Both counts must be `0` before relying on production check-in/check-out. If either count is not `0`, run `npm run db:repair` during a maintenance window, re-run the checks, then smoke test branch IP validation.

```bash
cd /home/<user>/amwag-attendance
npm run db:migrate
npm run db:seed
```

`db:seed` is **interactive** — it will ask three questions in the terminal:

```
Admin email:
Admin password (min 8 chars):
Full name:
```

Enter the credentials for the first admin account. These are what you will use to log in after deployment.

You can re-run `npm run db:seed` at any time to reset an admin password without losing any data.

---

## 7. Start the App (PM2)

**Install PM2 globally:**

```bash
npm install -g pm2
```

**Start the app:**

```bash
cd /home/<user>/amwag-attendance
pm2 start "npm start" --name amwag
pm2 save
pm2 startup
```

Follow the command printed by `pm2 startup` to register PM2 as a system service so the app survives server reboots.

**Useful PM2 commands:**

```bash
pm2 status              # check if the app is running
pm2 logs amwag          # tail application logs
pm2 restart amwag       # restart the app (after config changes, etc.)
pm2 stop amwag          # stop the app
```

---

## 8. LiteSpeed Reverse Proxy

In CyberPanel, go to **Websites → Manage → vHost Conf**. Add an external app and context:

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

Save the configuration, remove any default WordPress or PHP rewrite rules that conflict with proxying, then restart LiteSpeed from **Server → Restart**.

---

## 9. Block Direct Access to Port 3000

LiteSpeed proxies all traffic — port 3000 should not be reachable from the internet.

**Ubuntu (ufw):**

```bash
sudo ufw deny 3000
```

**AlmaLinux (firewalld):**

```bash
sudo firewall-cmd --permanent --remove-port=3000/tcp
sudo firewall-cmd --reload
```

---

## 10. Cron Jobs

Copy the value of `INTERNAL_SCHEDULER_SECRET` from your `.env.local` before setting up cron jobs. Do not put the real value in this repository, documentation, or a shell profile.

In CyberPanel, go to **Websites → Manage → Cron Jobs**. Add two separate cron jobs (paste each line as one complete command, replacing `YOUR_SECRET_HERE` with your actual secret value):

### Hourly — attendance finalization (mark absent + missing checkout)

Schedule:
```
0 * * * *
```

Command:
```
curl -fsS -X POST -H "Authorization: Bearer YOUR_SECRET_HERE" http://127.0.0.1:3000/api/internal/attendance/finalize
```

### Daily at 03:00 — clean up expired sessions

Schedule:
```
0 3 * * *
```

Command:
```
curl -fsS -X POST -H "Authorization: Bearer YOUR_SECRET_HERE" http://127.0.0.1:3000/api/internal/maintenance/cleanup-sessions
```

> **Note:** CyberPanel's cron UI accepts the schedule and command separately. Do **not** add a `SECRET=` variable line — it will be ignored. Inline the secret directly in each command as shown above.

### What the finalization endpoint does

Each hourly run:
- Loops through all employees.
- Skips employees whose off day matches the target date.
- If shift end has passed and no attendance record exists → inserts an `absent` record.
- If the employee checked in but not out and the checkout window expired → updates the record to `missing_checkout`.
- Uses a MySQL named lock so concurrent cron overlaps are safe (returns `409` if another run is active).

The endpoint is idempotent — running it multiple times for the same date does not create duplicate records.

---

## 11. Server Timezone

Set the server timezone to Egypt so cron timing aligns with the app's attendance logic:

```bash
sudo timedatectl set-timezone Africa/Cairo
```

Verify:

```bash
timedatectl status
```

---

## 12. SSL Certificate

In CyberPanel, go to **Websites → Manage → Issue SSL**. CyberPanel will use Let's Encrypt to issue and auto-renew the certificate for your domain.

After SSL is issued, LiteSpeed will automatically serve the site over HTTPS.

---

## 13. Smoke Test

```bash
# Check the site loads
curl -I https://your-domain/
curl -I https://your-domain/ar/login

# Test the finalization endpoint manually (replace secret)
curl -X POST \
  -H "Authorization: Bearer YOUR_SECRET_HERE" \
  http://127.0.0.1:3000/api/internal/attendance/finalize
```

Expected `200` finalization response:

```json
{
  "success": true,
  "data": {
    "success": true,
    "message": "Marked 0 absent, 0 missing checkout",
    "markedAbsent": 0,
    "markedMissingCheckout": 0,
    "alreadyRecorded": 5,
    "skippedShiftNotEnded": 2,
    "currentTime": "2025-01-15 08:00:00",
    "currentDate": "2025-01-15",
    "dayOfWeek": "wednesday",
    "absentEmployees": [],
    "missingCheckoutEmployees": []
  }
}
```

Test session cleanup:

```bash
curl -X POST \
  -H "Authorization: Bearer YOUR_SECRET_HERE" \
  http://127.0.0.1:3000/api/internal/maintenance/cleanup-sessions
```

Expected response:

```json
{ "success": true, "data": { "removed": 0 } }
```

The `removed` value will be greater than zero when expired sessions exist.

---

## 14. Upgrades

For production upgrades, take a fresh backup and run the branch ID checks from [Migrations and Admin Seed](#6-migrations-and-admin-seed) before restarting the app.

```bash
cd /home/<user>/amwag-attendance
git pull
npm ci
npm run db:migrate
npm run build
pm2 restart amwag
```

If CyberPanel manages the Node.js app, use its **Restart** action instead of `pm2 restart`.

---

## 15. Troubleshooting

### App not starting

```bash
pm2 logs amwag
```

Check for `MODULE_NOT_FOUND` (run `npm ci`) or missing env vars (check `.env.local`).

### Branch IP validation rejecting all check-ins

- Confirm `TRUST_X_FORWARDED_FOR=true` is set in `.env.local`.
- Confirm LiteSpeed is forwarding the `X-Forwarded-For` header.
- Check the app logs: `pm2 logs amwag` — the check-in handler logs the resolved IP and matched rules on each rejected attempt.

### Cron endpoint returning 401 or 403

- The `Authorization: Bearer` header is not being sent by curl, or the secret does not match.
- Copy the exact value from `.env.local` — no trailing spaces or newlines.
- Test manually with curl from the server before relying on CyberPanel cron.

### Cron endpoint returning 409

A previous finalization run is still active (the MySQL lock is held). This is safe — the lock times out automatically when the connection drops. If it persists, check for stuck database connections.

### Database connection refused

- Confirm MariaDB is running: `sudo systemctl status mariadb`
- Confirm the `DATABASE_URL` host matches where the DB is listening (`127.0.0.1` not `localhost` if using TCP).
- Confirm the user has the right grants: `SHOW GRANTS FOR 'amwag'@'127.0.0.1';`

### Migration fails

```bash
npm run db:migrate
```

Check the error message. If the schema is already applied, migrations are idempotent and will skip applied files. If you see a column conflict, the database may have been modified outside of migrations.
