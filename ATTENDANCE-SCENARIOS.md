# Amwag Attendance System - Complete Scenarios Document

## System Architecture Overview

| Component | Role | Frequency |
|-----------|------|-----------|
| **pg_cron** (Supabase) | Primary automation - runs `mark_absent_employees()` inside the database | Every 15 minutes |
| **Vercel Cron** | Backup safety net - calls the API endpoint | Daily at 3 AM Egypt time |
| **Check-in API** | Employee clocks in via company WiFi | On-demand |
| **Check-out API** | Employee clocks out via company WiFi | On-demand |
| **Admin Manual Trigger** | Admin can force-run finalization from dashboard | On-demand |

---

## Status Definitions

| Status | Meaning |
|--------|---------|
| `present` | Employee checked in on time (within shift window) |
| `late` | Employee checked in after shift_start |
| `absent` | Employee never checked in - marked automatically after shift ended |
| `missing_checkout` | Employee checked in but never checked out - marked automatically after shift ended |
| `pending` | Virtual status shown in admin dashboard for employees whose shift hasn't ended yet |

---

## Scenario 1: Normal Day - On Time

**Setup:** Shift 09:00-17:00, Employee arrives at 08:45

| Time | Event | System Action |
|------|-------|---------------|
| 08:45 | Employee opens app and clicks Check In | check-in window is [08:00-17:00], employee is on time |
| 08:45 | Check-in recorded | Record created: `date=today, status=present, late_minutes=0` |
| 17:00 | Employee clicks Check Out | System calculates: no early departure, no overtime |
| 17:00 | Check-out recorded | Record updated: `check_out_time=17:00, early_departure_minutes=0, overtime_minutes=0` |

**Result:** `status=present`, complete record.

---

## Scenario 2: Late Arrival

**Setup:** Shift 09:00-17:00, Employee arrives at 09:25

| Time | Event | System Action |
|------|-------|---------------|
| 09:25 | Employee checks in | late_minutes = 25 (09:25 - 09:00) |
| 09:25 | Record created | `status=late, late_minutes=25` |
| 17:00 | Employee checks out | Normal check-out |

**Result:** `status=late, late_minutes=25`

---

## Scenario 3: Early Departure

**Setup:** Shift 09:00-17:00, Employee leaves at 16:30

| Time | Event | System Action |
|------|-------|---------------|
| 08:55 | Check in | `status=present, late_minutes=0` |
| 16:30 | Check out | early_departure_minutes = 30 (17:00 - 16:30) |

**Result:** `status=present, early_departure_minutes=30`

---

## Scenario 4: Overtime (overtime_enabled=true)

**Setup:** Shift 09:00-17:00, overtime enabled, Employee stays until 19:00

| Time | Event | System Action |
|------|-------|---------------|
| 08:50 | Check in | `status=present` |
| 19:00 | Check out | overtime_minutes = min(120, 180) = 120 minutes (2 hours) |

**Result:** `status=present, overtime_minutes=120`

**Note:** Overtime is capped at 180 minutes (3 hours) maximum.

---

## Scenario 5: Full Absent - Never Clocked In

**Setup:** Shift 09:00-17:00, Employee never shows up

| Time | Event | System Action |
|------|-------|---------------|
| 17:00+ | pg_cron runs (every 15 min) | Checks: shift ended? YES. Any attendance record? NO. |
| 17:00+ | Auto-insert | Creates record: `status=absent, date=today` |

**For overtime-enabled employees:**

| Time | Event | System Action |
|------|-------|---------------|
| 17:00-20:00 | pg_cron runs | Checks: shift ended? NO (grace period: 17:00 + 180min = 20:00) |
| 20:00+ | pg_cron runs | Checks: shift ended? YES. No record? INSERT `status=absent` |

**Result:** `status=absent` - created automatically, no manual action needed.

---

## Scenario 6: Forgot to Clock Out (Missing Checkout)

**Setup:** Shift 09:00-17:00, Employee checks in but forgets to check out

| Time | Event | System Action |
|------|-------|---------------|
| 08:50 | Check in | `status=present, late_minutes=0` |
| 17:00+ | pg_cron runs | Checks: record exists with check_in but NO check_out. Shift ended? YES. |
| 17:00+ | Auto-update | `status=missing_checkout` |

**For overtime-enabled employees:** Same flow but shift_ended is only true after shift_end + 180 minutes.

**Result:** `status=missing_checkout`

---

## Scenario 7: Missing Checkout - Late Recovery

**Setup:** Employee was marked missing_checkout, comes back next morning to check out

| Time | Event | System Action |
|------|-------|---------------|
| Day 1, 09:00 | Check in | `status=present` |
| Day 1, 20:00 | pg_cron marks | `status=missing_checkout` (no check-out detected) |
| Day 2, 08:00 | Employee opens app, clicks Check Out | System checks today: no check-in. Falls back to yesterday's record. Finds unchecked-out record. |
| Day 2, 08:00 | Session validation | Duration = ~23 hours. Max allowed = max(14h, 8h+5h) = 14h. **REJECTED - session timed out.** |

**Result:** Check-out is rejected. `status=missing_checkout` remains. Admin must handle manually.

**Note:** The session timeout protection prevents unrealistic check-outs. Maximum allowed session = max(14 hours, shift_duration + 5 hours).

---

## Scenario 8: Overnight/Cross-Midnight Shift

**Setup:** Shift 22:00-06:00 (next day)

### 8a: Normal overnight shift

| Time | Event | System Action |
|------|-------|---------------|
| Mon 21:05 | Check in | Window: [21:00-06:00]. `date=Monday, status=present` |
| Tue 06:00 | Check out | System: no check-in today, checks yesterday (Monday). Finds record. Updates Monday's record. |

**Result:** Monday's record: `status=present`, complete.

### 8b: Late overnight check-in

| Time | Event | System Action |
|------|-------|---------------|
| Mon 22:30 | Check in | late_minutes=30 (22:30-22:00). `date=Monday, status=late` |
| Tue 06:15 | Check out | Updates Monday's record. overtime_minutes=15 |

**Result:** Monday's record: `status=late, late_minutes=30, overtime_minutes=15`

### 8c: Overnight no-show

| Time | Event | System Action |
|------|-------|---------------|
| Mon 22:00 | Shift starts, employee absent | No record created |
| Tue 06:00+ | pg_cron runs | shift_end=06:00. cairo_time >= 06:00 AND < 22:00 → shift ended. target_date = Monday (yesterday). |
| Tue 06:00+ | Auto-insert | `date=Monday, status=absent` |

**For overtime-enabled:** pg_cron waits until Tue 09:00 (06:00 + 180min grace).

### 8d: Overnight forgot checkout

| Time | Event | System Action |
|------|-------|---------------|
| Mon 22:00 | Check in | `date=Monday, status=present` |
| Tue 09:00+ | pg_cron runs | Finds Monday record with check_in, no check_out. Shift ended. |
| Tue 09:00+ | Auto-update | `status=missing_checkout` on Monday's record |

---

## Scenario 9: Off Day

**Setup:** Employee's off_day = 'friday'

| Day | Event | System Action |
|-----|-------|---------------|
| Friday | pg_cron runs | Employee's off_day matches today → **completely skipped** |
| Friday | Employee tries to check in | Check-in window validation may block (depends on shift times) |

**Result:** No absent record created on off days. Employee excluded from expected count in dashboard.

---

## Scenario 10: Check-in From Outside Company Network

**Setup:** Employee tries to check in from personal phone on mobile data

| Step | System Action |
|------|---------------|
| Employee clicks Check In | API extracts client IP address |
| IP validation | Compares first 3 octets against `branch_allowed_ips` table |
| No match found | **403 Forbidden**: "You must be connected to the company network" |

**Result:** Check-in rejected. Employee must connect to company WiFi.

---

## Scenario 11: Double Check-in Attempt

**Setup:** Employee already checked in, tries again

| Step | System Action |
|------|---------------|
| First check-in at 09:00 | Record created: `status=present` |
| Second check-in at 09:15 | System finds existing record with check_in_time |
| | **409 Conflict**: "You have already checked in today" |

**Result:** Duplicate prevented by database UNIQUE constraint on (user_id, date).

---

## Scenario 12: Check-in Outside Shift Window

**Setup:** Shift 09:00-17:00, Employee tries at 07:30

| Step | System Action |
|------|---------------|
| 07:30 check-in attempt | Window = [08:00-17:00] (shift_start minus 1 hour) |
| Validation fails | **400 Bad Request**: "Check-in is not available at this time" |

**Result:** Employee must wait until 1 hour before shift start.

---

## Scenario 13: Check-in After Already Marked Absent

**Setup:** pg_cron already marked employee absent, employee tries to check in late

| Step | System Action |
|------|---------------|
| 20:00 | pg_cron marks employee absent (no record existed, now `status=absent`) |
| 20:30 | Employee tries to check in |
| | System finds existing record for today |
| | **409 Conflict**: Record already finalized |

**Result:** Check-in rejected. The absent record exists and blocks new check-ins for that date.

---

## Scenario 14: Overtime Cap

**Setup:** Shift 09:00-17:00, overtime_enabled=true, Employee stays until 21:30

| Time | Event | Calculation |
|------|-------|-------------|
| 09:00 | Check in | `status=present` |
| 21:30 | Check out | Raw overtime = 270 min (4.5 hours). Capped at 180 min (3 hours). |

**Result:** `overtime_minutes=180` (maximum), not 270.

---

## Scenario 15: Employee with No Shift Times Configured

**Setup:** shift_start=NULL, shift_end=NULL

| Behavior | Details |
|----------|---------|
| pg_cron | `shift_ended = true` immediately. Employee will be marked absent if no record exists. |
| Check-in | May fail due to shift window validation (no window calculable) |

**Action needed:** Admin must configure shift times for all employees.

---

## Scenario 16: Simultaneous pg_cron Executions

**Setup:** Two pg_cron triggers overlap (unlikely but possible)

| Step | System Action |
|------|---------------|
| Execution 1 starts | Acquires advisory lock `pg_try_advisory_lock(20240601)` → success |
| Execution 2 starts | Tries advisory lock → **fails**, returns immediately with `"skipped"` status |
| Execution 1 completes | Releases lock |

**Result:** Only one execution runs at a time. No duplicate records. Safe.

---

## Scenario 17: DST Transition (Egypt Daylight Saving)

**Setup:** Clock changes in Egypt

| Aspect | Handling |
|--------|----------|
| Time source | `AT TIME ZONE 'Africa/Cairo'` in PostgreSQL automatically handles DST |
| Check-in/out | `getEgyptNow()` uses `Intl.DateTimeFormat` with `Africa/Cairo` timezone |
| Shift times | Stored as HH:MM strings, interpreted relative to Cairo time |

**Result:** DST is handled automatically by both PostgreSQL and JavaScript timezone APIs.

---

## Automation Timing Summary

For a standard shift ending at 00:00 (midnight) Egypt time:

| Employee Type | Marked Absent/Missing At | By |
|---------------|-------------------------|-----|
| overtime_enabled=false | 00:00 (next pg_cron run after midnight) | pg_cron |
| overtime_enabled=true | 03:00 (midnight + 180min grace, next pg_cron run) | pg_cron |
| All employees (safety net) | 03:00 AM Egypt daily | Vercel Cron |

---

## Status Transition Diagram

```
[No Record]
    │
    ├── Employee checks in on time ──→ [present]
    ├── Employee checks in late ─────→ [late]
    └── pg_cron: shift ended, no record → [absent] ──→ (FINAL, no check-in possible)

[present] or [late]
    │
    ├── Employee checks out ──→ [present/late] (with check_out_time filled)
    └── pg_cron: no check-out ──→ [missing_checkout]
                                      │
                                      └── Employee checks out (within session limit) ──→ [present/late] (resolved)
                                      └── Session expired ──→ [missing_checkout] (FINAL, admin must handle)
```

---

## IP Whitelisting Rules

| Rule | Details |
|------|---------|
| Match method | First 3 octets of IP (e.g., `192.168.1`) |
| Check applies to | Both check-in AND check-out |
| Branch mapping | IP maps to branch name, stored as check_in_location / check_out_location |
| Multiple branches | Employee can check in from any whitelisted branch |

---

## Admin Capabilities

| Action | How |
|--------|-----|
| View who would be marked absent | GET `/api/attendance/mark-absent` (dry-run preview) |
| Manually trigger finalization | POST `/api/attendance/mark-absent` (from dashboard) |
| View attendance records | Admin attendance page with filters (date, status, search) |
| Export to PDF | Export button on attendance page |
| Manage employees | Create, edit, delete, bulk CSV import |

---

## Database Constraints & Safety

| Constraint | Purpose |
|-----------|---------|
| `UNIQUE(user_id, date)` | Prevents duplicate attendance records per day |
| `ON CONFLICT DO NOTHING` | Absent insertion is idempotent (safe to run multiple times) |
| `AND status <> 'missing_checkout'` | Prevents redundant updates |
| `pg_try_advisory_lock` | Prevents concurrent pg_cron executions |
| Session timeout check | Prevents unrealistic late check-outs |
