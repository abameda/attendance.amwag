# Quickstart: Attendance Integrity Dashboard

## Goal

Implement the dashboard, attendance integrity, and employee-form fixes defined in [spec.md](/Users/elshorbagy/Desktop/amwag attendence v2/amwag-attendance/specs/001-attendance-integrity-dashboard/spec.md).

## Preconditions

- Supabase environment variables are configured.
- Local dependencies are installed with `npm install`.
- The working branch is `001-attendance-integrity-dashboard`.

## Recommended Implementation Order

1. Update the SQL finalization logic.
   - Fix the existing scheduled finalization migration so it selects all required employee fields.
   - Ensure absent and missing-checkout transitions are idempotent and use Cairo server time.

2. Tighten attendance event integrity.
   - Update check-in logic to reject duplicate check-ins explicitly instead of silently ignoring duplicates.
   - Keep conditional check-out updates and preserve server-side location/time authority.

3. Add a selected-date dashboard aggregate interface.
   - Return overall attendance rate, departure completion rate, and top branch compliance for one selected date.
   - Do not return data until a date is supplied.

4. Refactor admin dashboard and attendance pages.
   - Remove quick actions.
   - Replace them with statistics and insights cards.
   - Remove CSV and Excel export actions and related client code.
   - Gate attendance list fetching behind a selected date.

5. Fix employee-form layout issues.
   - Move the shift-end helper under the shift-start field.
   - Make the overtime row safe in RTL and narrow widths.

6. Verify manually.
   - Dashboard with no date selected.
   - Dashboard after selecting a date.
   - Attendance page with and without date.
   - Employee modal in English and Arabic.
   - Check-in/check-out duplicate and edge cases.

## Suggested Validation Commands

```bash
npm run lint
```

## Internal Scheduler Setup

1. Set `INTERNAL_SCHEDULER_SECRET` on the app host.
2. Create a scheduler job that sends `POST /api/internal/attendance/finalize`.
3. Include `Authorization: Bearer <INTERNAL_SCHEDULER_SECRET>`.
4. Run the scheduler every 15 minutes, or keep the existing `pg_cron` schedule if the database job is enabled.

## Manual Validation Checklist

- No attendance records load before date selection on admin attendance views.
- Dashboard shows insights instead of quick actions.
- CSV and Excel buttons are gone.
- Waiting/expected employees finalize as absent after deadline.
- Checked-in employees without checkout finalize as missing checkout.
- Shift-start helper no longer creates a large gap.
- Overtime toggle stays inside its container in Arabic RTL mode.
- Dashboard and attendance page reuse selected-date results when revisiting the same admin route in the same browser session.
