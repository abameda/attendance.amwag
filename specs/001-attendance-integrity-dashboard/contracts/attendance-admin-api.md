# Contract: Attendance Admin API

## Purpose

Defines the expected admin-facing interfaces for date-scoped dashboard insights and attendance log retrieval.

## 1. Attendance Logs Query

- Method: `GET`
- Path: `/api/attendance`

### Query Parameters

- `date`: required for record retrieval in this feature
- `page`: optional, default `1`
- `pageSize`: optional, default implementation-defined
- `status`: optional
- `search`: optional
- `includeExpected`: optional, only meaningful for selected date workflows

### Behavior

- If `date` is omitted, the endpoint returns an empty dataset and zero total rather than fetching attendance history.
- If `date` is present, the endpoint returns only records scoped to that date.
- Invalid `status` values return `400`.

### Response Shape

```json
{
  "success": true,
  "data": [
    {
      "id": "attendance-id",
      "user_id": "employee-id",
      "date": "2026-03-24",
      "check_in_time": "2026-03-24T06:03:00.000Z",
      "check_out_time": null,
      "status": "missing_checkout",
      "late_minutes": 0,
      "early_departure_minutes": 0,
      "overtime_minutes": 0,
      "profiles": {
        "full_name": "Employee Name",
        "email": "employee@company.com",
        "branch": "Alexandria",
        "job_title": "Driver"
      }
    }
  ],
  "total": 1,
  "page": 1,
  "pageSize": 10
}
```

## 2. Dashboard Insights Query

- Method: `GET`
- Path: `/api/attendance/summary`

### Query Parameters

- `date`: required

### Behavior

- If `date` is omitted, return `400` or an explicit empty-state contract based on implementation choice, but do not compute summary metrics.
- If `date` is present, return one aggregate payload for that date only.

### Response Shape

```json
{
  "success": true,
  "data": {
    "date": "2026-03-24",
    "expectedEmployees": 120,
    "presentCount": 96,
    "lateCount": 8,
    "absentCount": 10,
    "missingCheckoutCount": 6,
    "attendanceRate": 86.67,
    "departureCompletionRate": 95.0,
    "topBranch": {
      "name": "Cairo",
      "attendanceRate": 93.75
    }
  }
}
```

## 3. Export Policy

- CSV export: removed from admin UI for this feature.
- Excel export: removed from admin UI for this feature.
- PDF export: unchanged unless a later feature changes reporting scope.
