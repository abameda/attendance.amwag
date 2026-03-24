# Amwag Attendance

Next.js attendance management app for Amwag with Supabase-backed employee, attendance, and admin workflows.

## Development

```bash
npm install
npm run dev
```

## Environment

Required app variables:

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
INTERNAL_SCHEDULER_SECRET=
```

`INTERNAL_SCHEDULER_SECRET` protects the internal attendance finalization endpoint used by server-side schedulers.

## Attendance Finalization

The app now centralizes end-of-shift finalization in the `mark_absent_employees()` Postgres function and exposes two execution paths:

1. Admin manual trigger: `POST /api/attendance/mark-absent`
2. Internal scheduler trigger: `POST /api/internal/attendance/finalize`

The internal route requires:

```http
Authorization: Bearer <INTERNAL_SCHEDULER_SECRET>
```

Example `systemd` service command:

```bash
curl -X POST \
  -H "Authorization: Bearer ${INTERNAL_SCHEDULER_SECRET}" \
  https://your-domain.example/api/internal/attendance/finalize
```

Recommended `systemd` timer cadence: every 15 minutes, matching the SQL `pg_cron` schedule.

## Validation

```bash
npm run lint
```
