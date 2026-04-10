# Deployment - CyberPanel + LiteSpeed Enterprise

This guide assumes a fresh CyberPanel installation on Ubuntu or AlmaLinux with LiteSpeed Enterprise licensed, MariaDB available, and a domain pointed at the VPS.

## 1. Database Setup

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

## 2. App Deployment

Deploy the built Next.js app to `/home/<user>/amwag-attendance`.

You can use CyberPanel's Node.js Apps screen:

- Go to Websites -> Manage -> Node.js.
- Set the app path to `/home/<user>/amwag-attendance`.
- Set the startup command to `npm start`.
- Set the port to `3000`.

Or run it manually with pm2:

```bash
cd /home/<user>/amwag-attendance
npm ci --production
npm run build
pm2 start "npm start" --name amwag
pm2 save
pm2 startup
```

Follow the command printed by `pm2 startup`.

## 3. Environment Variables

Create `/home/<user>/amwag-attendance/.env.local`:

```env
DATABASE_URL=mysql://amwag:<strong-password>@127.0.0.1:3306/amwag_attendance
INTERNAL_SCHEDULER_SECRET=<64-char random from openssl rand -hex 32>
SESSION_COOKIE_NAME=amwag_session
SESSION_TTL_DAYS=30
NODE_ENV=production
```

Generate the scheduler secret:

```bash
openssl rand -hex 32
```

## 4. Migrations And Admin Seed

```bash
cd /home/<user>/amwag-attendance
npm run db:migrate
npm run db:seed
```

The seed command creates the first admin user.

## 5. LiteSpeed Reverse Proxy

In CyberPanel, go to Websites -> Manage -> vHost Conf. Add an external app and context:

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

## 6. Cron Jobs

In CyberPanel, go to Websites -> Manage -> Cron Jobs. Add:

```cron
SECRET=<same value as INTERNAL_SCHEDULER_SECRET>
*/15 * * * * curl -fsS -X POST -H "Authorization: Bearer $SECRET" http://127.0.0.1:3000/api/internal/attendance/mark-absent > /dev/null
5 0 * * * curl -fsS -X POST -H "Authorization: Bearer $SECRET" http://127.0.0.1:3000/api/internal/attendance/finalize > /dev/null
0 3 * * * curl -fsS -X POST -H "Authorization: Bearer $SECRET" http://127.0.0.1:3000/api/internal/maintenance/cleanup-sessions > /dev/null
```

Use the same secret that is stored in `.env.local`.

## 7. Timezone

```bash
sudo timedatectl set-timezone Africa/Cairo
```

This keeps cron timing aligned with the app's Egypt attendance logic.

## 8. Smoke Test

```bash
curl -I https://your-domain/
curl -I https://your-domain/ar/login
curl -X POST -H "Authorization: Bearer $SECRET" \
  https://your-domain/api/internal/maintenance/cleanup-sessions
```

Expected cleanup response:

```json
{"success":true,"data":{"removed":0}}
```

The `removed` value can be greater than zero when expired sessions exist.

## 9. Upgrades

```bash
git pull
npm ci --production
npm run db:migrate
npm run build
pm2 restart amwag
```

If CyberPanel manages the Node.js app, use its Restart action instead of `pm2 restart`.
