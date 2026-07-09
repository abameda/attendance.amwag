# Amwag Attendance System - Complete Scenarios Document

## System Architecture Overview

| Component | Role | Frequency |
|-----------|------|-----------|
| **CyberPanel/Cron** | Calls `/api/internal/attendance/finalize` on the Node.js app | Hourly |
| **MySQL named lock** | Prevents overlapping finalization runs with `GET_LOCK` | Every finalization request |
| **Check-in API** | Employee clocks in via company WiFi | On-demand |
| **Check-out API** | Employee clocks out via company WiFi | On-demand |
| **Legacy internal endpoint** | `/api/internal/attendance/mark-absent` delegates to the same locked finalization flow | On-demand / compatibility only |

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
| 17:00+ | Scheduler calls `/api/internal/attendance/finalize` | Checks: shift ended? YES. Any attendance record? NO. |
| 17:00+ | Auto-insert | Creates record: `status=absent, date=today` |

**Note:** `overtime_enabled` affects overtime calculation at checkout. It does not delay absence finalization for employees who never checked in.

**Result:** `status=absent` - created automatically, no manual action needed.

---

## Scenario 6: Forgot to Clock Out (Missing Checkout)

**Setup:** Shift 09:00-17:00, Employee checks in but forgets to check out

| Time | Event | System Action |
|------|-------|---------------|
| 08:50 | Check in | `status=present, late_minutes=0` |
| 17:00+ checkout window | Scheduler calls `/api/internal/attendance/finalize` | Checks: record exists with check_in but NO check_out. Shift ended? YES. Checkout window expired? YES. |
| 17:00+ checkout window | Auto-update | `status=missing_checkout` |

**Note:** The missing checkout delay is controlled by `global_settings.checkout_window_minutes`, not by `max_overtime_minutes`.

**Result:** `status=missing_checkout`

---

## Scenario 7: Missing Checkout - Late Recovery

**Setup:** Employee was marked missing_checkout, comes back next morning to check out

| Time | Event | System Action |
|------|-------|---------------|
| Day 1, 09:00 | Check in | `status=present` |
| Day 1, after checkout window | Scheduler marks | `status=missing_checkout` (no check-out detected) |
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
| Tue 06:00+ | Scheduler runs | shift_end=06:00. cairo_time >= 06:00 AND < 22:00 → shift ended. target_date = Monday (yesterday). |
| Tue 06:00+ | Auto-insert | `date=Monday, status=absent` |

**Note:** Overnight absence finalization is based on shift end. It is not delayed by `overtime_enabled`.

### 8d: Overnight forgot checkout

| Time | Event | System Action |
|------|-------|---------------|
| Mon 22:00 | Check in | `date=Monday, status=present` |
| Tue 06:00+ checkout window | Scheduler runs | Finds Monday record with check_in, no check_out. Shift ended and checkout window expired. |
| Tue 06:00+ checkout window | Auto-update | `status=missing_checkout` on Monday's record |

---

## Scenario 9: Off Day

**Setup:** Employee's off_day = 'friday'

| Day | Event | System Action |
|-----|-------|---------------|
| Friday | Scheduler runs | Employee's off_day matches target date, so the employee is skipped for that date. |
| Friday | Employee tries to check in | Check-in window validation may block (depends on shift times) |

**Result:** No absent record created on off days. Employee excluded from expected count in dashboard.

---

## Scenario 10: Check-in From Outside Company Network

**Setup:** Employee tries to check in from personal phone on mobile data

| Step | System Action |
|------|---------------|
| Employee clicks Check In | API extracts client IP address |
| IP validation | Loads active `branch_allowed_ips` rows for the employee's `branch_id` and matches exact IP or CIDR rules |
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

**Setup:** Scheduler already marked employee absent, employee tries to check in late

| Step | System Action |
|------|---------------|
| 20:00 | Scheduler marks employee absent (no record existed, now `status=absent`) |
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
| Scheduler | `shift_ended = true` immediately. Employee will be marked absent if no record exists. |
| Check-in | May fail due to shift window validation (no window calculable) |

**Action needed:** Admin must configure shift times for all employees.

---

## Scenario 16: Simultaneous Scheduler Executions

**Setup:** Two scheduler triggers overlap (unlikely but possible)

| Step | System Action |
|------|---------------|
| Execution 1 starts | Acquires MySQL named lock `GET_LOCK('mark_absent_employees', 0)` |
| Execution 2 starts | Tries the same named lock and receives `409` if another run is active |
| Execution 1 completes | Releases lock |

**Result:** Only one execution runs at a time. No duplicate records. Safe.

---

## Scenario 17: DST Transition (Egypt Daylight Saving)

**Setup:** Clock changes in Egypt

| Aspect | Handling |
|--------|----------|
| Time source | JavaScript `Intl.DateTimeFormat` with `Africa/Cairo` handles Egypt date/time conversion |
| Check-in/out | `getEgyptNow()` uses `Intl.DateTimeFormat` with `Africa/Cairo` timezone |
| Shift times | Stored as HH:MM strings, interpreted relative to Cairo time |

**Result:** DST is handled by the JavaScript timezone APIs used by the Node.js app.

---

## Automation Timing Summary

For a standard shift ending at 00:00 (midnight) Egypt time:

| Employee Type | Marked Absent/Missing At | By |
|---------------|-------------------------|-----|
| No check-in | At the next scheduler run after shift end | CyberPanel/Cron |
| Checked in but no checkout | At the next scheduler run after shift end + `checkout_window_minutes` | CyberPanel/Cron |
| Overtime-enabled employee | Same finalization timing; overtime only affects checkout overtime calculation | CyberPanel/Cron |

---

## Status Transition Diagram

```
[No Record]
    │
    ├── Employee checks in on time ──→ [present]
    ├── Employee checks in late ─────→ [late]
    └── scheduler: shift ended, no record → [absent] ──→ (FINAL, no check-in possible)

[present] or [late]
    │
    ├── Employee checks out ──→ [present/late] (with check_out_time filled)
    └── scheduler: no check-out ──→ [missing_checkout]
                                      │
                                      └── Employee checks out (within session limit) ──→ [present/late] (resolved)
                                      └── Session expired ──→ [missing_checkout] (FINAL, admin must handle)
```

---

## IP Whitelisting Rules

| Rule | Details |
|------|---------|
| Match method | Exact IP or CIDR, for example `156.200.10.20` or `156.200.10.0/24` |
| Check applies to | Both check-in AND check-out |
| Branch mapping | Active IP rules are loaded by the employee's `branch_id` |
| Multiple branches | Employee must match an active rule for their assigned branch |
| Proxy headers | `X-Forwarded-For` is used only when `TRUST_X_FORWARDED_FOR=true`; otherwise `X-Real-IP` is preferred |

---

## Admin Capabilities

| Action | How |
|--------|-----|
| Trigger scheduler finalization | POST `/api/internal/attendance/finalize` with `Authorization: Bearer <secret>` |
| Legacy compatibility endpoint | POST `/api/internal/attendance/mark-absent` with the same secret; delegates to locked finalization |
| View attendance records | Admin attendance page with filters (date, status, search) |
| Export to PDF | Export button on attendance page |
| Manage employees | Create, edit, delete, bulk CSV import |

---

## Database Constraints & Safety

| Constraint | Purpose |
|-----------|---------|
| `UNIQUE(user_id, date)` | Prevents duplicate attendance records per day |
| Duplicate-key handling | Check-in races return `409 Conflict` instead of a generic server error |
| `AND status <> 'missing_checkout'` | Prevents redundant updates |
| `GET_LOCK('mark_absent_employees', 0)` | Prevents concurrent scheduler finalization executions |
| Session timeout check | Prevents unrealistic late check-outs |
