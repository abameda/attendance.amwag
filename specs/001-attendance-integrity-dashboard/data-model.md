# Data Model: Attendance Integrity Dashboard

## Entity: AttendanceRecord

- Purpose: Authoritative per-employee attendance record for a single work date.
- Existing storage: `attendance` table.

### Key Fields

- `id`: Unique record identifier.
- `user_id`: Employee identifier.
- `date`: Work date the record belongs to.
- `check_in_time`: Server-recorded check-in timestamp.
- `check_out_time`: Server-recorded check-out timestamp.
- `status`: Attendance outcome.
- `late_minutes`: Minutes late relative to shift start.
- `early_departure_minutes`: Minutes left before scheduled end.
- `overtime_minutes`: Minutes beyond scheduled shift end if policy allows.
- `ip_address`: Check-in IP captured by the server.
- `check_out_ip`: Check-out IP captured by the server.
- `check_in_location`: Branch/location resolved by the server.
- `check_out_location`: Branch/location resolved by the server.

### Validation Rules

- Exactly one authoritative record per `(user_id, date)`.
- `check_in_time` and `check_out_time` must be server-generated.
- `status` must remain within supported attendance outcomes.
- A completed attendance record cannot be downgraded by repeated scheduler runs.

### State Transitions

- `pending` or virtual expected state -> `present`
- `pending` or virtual expected state -> `late`
- `pending` or virtual expected state -> `absent`
- `present` or `late` -> `missing_checkout`
- `missing_checkout` -> `present` or `late` only when a valid later check-out is accepted before final policy closure

## Entity: EmployeeShiftPolicy

- Purpose: Defines the work schedule and finalization rules used to interpret attendance.
- Existing storage: `profiles` fields plus related branch constraints.

### Key Fields

- `id`
- `shift_start`
- `shift_end`
- `off_day`
- `overtime_enabled`
- `branch`
- `role`

### Validation Rules

- Only `employee` role records participate in attendance finalization.
- `off_day` excludes that employee from expected-attendance logic for the day.
- Overnight shifts must map to the correct target work date when finalizing attendance.

## Entity: AttendanceDaySummary

- Purpose: Date-scoped aggregate view used by the dashboard.
- Storage approach: Derived from attendance and profile data; no separate persistence required in this feature.

### Key Fields

- `date`
- `expected_employees`
- `present_count`
- `late_count`
- `absent_count`
- `missing_checkout_count`
- `attendance_rate`
- `departure_completion_rate`
- `top_branch_name`
- `top_branch_attendance_rate`

### Validation Rules

- Summary must be computed only for the selected date.
- Branch compliance denominator must exclude off-day employees.
- Dashboard must not compute these metrics by loading all attendance history.

## Entity: AttendanceFinalizationJob

- Purpose: Background process that finalizes unresolved attendance states after shift deadlines.
- Storage approach: Stateless execution with optional logs/metrics.

### Key Fields

- `run_time`
- `trigger_source`
- `processed_employee_count`
- `marked_absent_count`
- `marked_missing_checkout_count`
- `skipped_count`
- `lock_acquired`

### Validation Rules

- Execution must be idempotent.
- Only one finalization run should own the advisory lock at a time.
- The job must evaluate server time in `Africa/Cairo`.

## Relationships

- One `EmployeeShiftPolicy` can produce many `AttendanceRecord` entries over time.
- One `AttendanceFinalizationJob` processes many `AttendanceRecord` candidates in a run.
- One `AttendanceDaySummary` aggregates many `AttendanceRecord` rows and eligible employees for one date.
