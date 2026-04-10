# Deployment - CyberPanel + LiteSpeed Enterprise

This guide assumes a fresh CyberPanel installation on Ubuntu or AlmaLinux with LiteSpeed Enterprise licensed, MariaDB available, and a domain pointed at the VPS.

## 1. Node.js

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

## 2. Database Setup

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

## 3. Get The Code

```bash
cd /home/<user>
git clone <ttps://github.com/abameda/attendance.amwag amwag-attendance
cd amwag-attendance
```

Or upload the project folder via SFTP / CyberPanel File Manager to `/home/<user>/amwag-attendance`.

## 4. Environment Variables

Create `/home/<user>/amwag-attendance/.env.local`:

```env
DATABASE_URL=mysql://amwag:<strong-password>@127.0.0.1:3306/amwag_attendance
INTERNAL_SCHEDULER_SECRET=<64-char random — see below>
SESSION_COOKIE_NAME=amwag_session
SESSION_TTL_DAYS=30
NODE_ENV=production
```

Generate the scheduler secret and keep a copy — you will need it again for cron jobs:

```bash
openssl rand -hex 32
```

## 5. Build The App

```bash
cd /home/<user>/amwag-attendance
npm ci                  # install all dependencies including devDependencies (needed for build)
npm run build           # compile Next.js — takes 1-3 minutes
npm prune --production  # optional: remove dev packages to save disk space after build
```

## 6. Migrations And Admin Seed

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

Enter the credentials you want for the first admin account. These are what you will use to log in after deployment.

## 7. Start The App

**Option A — pm2 (recommended):**

```bash
npm install -g pm2
cd /home/<user>/amwag-attendance
pm2 start "npm start" --name amwag
pm2 save
pm2 startup
```

Follow the command printed by `pm2 startup` to enable auto-start on reboot.

**Option B — CyberPanel Node.js screen:**

- Go to Websites → Manage → Node.js.
- Set the app path to `/home/<user>/amwag-attendance`.
- Set the startup command to `npm start`.
- Set the port to `3000`.

## 8. LiteSpeed Reverse Proxy

In CyberPanel, go to Websites → Manage → vHost Conf. Add an external app and context:

```text
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

Save, remove any default WordPress or PHP rewrite rules that conflict with proxying, then restart LiteSpeed.

Issue SSL from CyberPanel with the Issue SSL action.

## 9. Block Direct Access To Port 3000

LiteSpeed proxies all traffic — port 3000 should not be reachable from the internet.

```bash
# Ubuntu (ufw)
sudo ufw deny 3000

# AlmaLinux (firewalld)
sudo firewall-cmd --permanent --remove-port=3000/tcp
sudo firewall-cmd --reload
```

## 10. Cron Jobs

First, copy the value of `INTERNAL_SCHEDULER_SECRET` from your `.env.local`.

In CyberPanel, go to Websites → Manage → Cron Jobs. Add **three separate jobs** — paste each line as one complete command (replace `YOUR_SECRET_HERE` with your actual secret value each time):

**Every 15 minutes — mark absent / missing checkout:**

```
*/15 * * * *
```

```
curl -fsS -X POST -H "Authorization: Bearer YOUR_SECRET_HERE" http://127.0.0.1:3000/api/internal/attendance/mark-absent
```

**Daily at 00:05 — finalize attendance:**

```
5 0 * * *
```

```
curl -fsS -X POST -H "Authorization: Bearer YOUR_SECRET_HERE" http://127.0.0.1:3000/api/internal/attendance/finalize
```

**Daily at 03:00 — clean up expired sessions:**

```
0 3 * * *
```

```
curl -fsS -X POST -H "Authorization: Bearer YOUR_SECRET_HERE" http://127.0.0.1:3000/api/internal/maintenance/cleanup-sessions
```

> Note: CyberPanel's cron UI accepts the schedule and command separately. Do **not** add a `SECRET=` variable line — it will be ignored. Inline the secret directly in each command as shown above.

## 11. Timezone

```bash
sudo timedatectl set-timezone Africa/Cairo
```

This keeps cron timing aligned with the app's Egypt attendance logic.

## 12. Smoke Test

```bash
curl -I https://your-domain/
curl -I https://your-domain/ar/login

# Test cron endpoint manually (replace secret):
curl -X POST -H "Authorization: Bearer YOUR_SECRET_HERE" \
  https://your-domain/api/internal/maintenance/cleanup-sessions
```

Expected cleanup response:

```json
{ "success": true, "data": { "removed": 0 } }
```

The `removed` value can be greater than zero when expired sessions exist.

## 13. Upgrades

```bash
cd /home/<user>/amwag-attendance
git pull
npm ci
npm run db:migrate
npm run build
pm2 restart amwag
```

If CyberPanel manages the Node.js app, use its Restart action instead of `pm2 restart`.
