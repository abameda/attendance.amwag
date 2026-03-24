# Contract: Internal Attendance Finalization Job

## Purpose

Defines the internal interface used by the free self-hosted scheduler to finalize unresolved attendance states.

## Trigger Options

- Database-native schedule via `pg_cron`, calling the SQL function directly.
- Company-server schedule via `systemd` timer or cron, calling one protected internal HTTP endpoint.

## Internal HTTP Contract

- Method: `POST`
- Path: `/api/internal/attendance/finalize`
- Authentication: Bearer token shared only with the server scheduler

### Headers

- `Authorization: Bearer <internal-secret>`

### Request Body

- Empty body

### Response Shape

```json
{
  "success": true,
  "message": "Marked 4 absent, 2 missing checkout",
  "markedAbsent": 4,
  "markedMissingCheckout": 2,
  "alreadyRecorded": 85,
  "skippedShiftNotEnded": 29,
  "currentTime": "2026-03-24 18:30:00",
  "currentDate": "2026-03-24",
  "dayOfWeek": "tuesday"
}
```

## Execution Rules

- Must use server-side Cairo time.
- Must acquire a lock to prevent overlapping runs.
- Must be idempotent.
- Must not create duplicate attendance rows for the same employee and work date.
- Must leave already-complete attendance records unchanged.

## Failure Modes

- `401` or `403` for invalid internal authorization.
- `409` when a previous finalization run is already active and the lock cannot be acquired.
- `500` for unexpected execution errors.
