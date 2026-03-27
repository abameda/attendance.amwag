-- Migration: Automated absent-marking via pg_cron
-- Replaces the manual-only JS logic with a database-level PL/pgSQL function
-- that runs every 15 minutes via pg_cron (free on Supabase).
--
-- What it does:
--   1. Computes current Cairo time (Africa/Cairo, handles DST automatically)
--   2. Finds employees whose shift has ended and who are NOT on their off day
--   3. For each employee with no attendance record: inserts status='absent'
--   4. For each employee who checked in but never checked out: updates status='missing_checkout'
--   5. Skips employees who already have a complete record (check_in + check_out)
--   6. Uses pg_try_advisory_lock to prevent overlapping executions
--   7. Returns a JSON summary of actions taken
--
-- How to use:
--   Copy-paste this ENTIRE file into the Supabase SQL Editor and click "Run".
--   That's it. The function will run automatically every 15 minutes.
--
-- The manual "Mark Absent" button on the admin dashboard will also call this
-- function via Supabase RPC, so the logic is in ONE place (the database).

-- ============================================================================
-- Step 1: Enable pg_cron extension (idempotent, safe to re-run)
-- ============================================================================
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;

-- Grant usage to postgres role (Supabase runs cron jobs as postgres)
GRANT USAGE ON SCHEMA cron TO postgres;

-- ============================================================================
-- Step 2: Create the mark_absent_employees() function
-- ============================================================================
CREATE OR REPLACE FUNCTION public.mark_absent_employees()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    -- Cairo time variables
    cairo_now         timestamptz;
    cairo_date        date;
    cairo_time_val    time;
    cairo_total_min   integer;
    cairo_dow         integer;  -- 0=Sun, 1=Mon, ..., 6=Sat
    cairo_day_name    text;

    -- Counters
    marked_absent     integer := 0;
    marked_missing    integer := 0;
    already_recorded  integer := 0;
    skipped_shift     integer := 0;

    -- Employee record
    emp               record;

    -- Shift parsing
    shift_start_min   integer;
    shift_end_min     integer;
    shift_ended       boolean;
    target_date       date;

    -- Names for reporting
    absent_names      text[] := '{}';
    missing_names     text[] := '{}';

    -- Existing attendance
    existing_rec      record;
BEGIN
    -- ========================================================================
    -- Advisory lock: prevent overlapping executions
    -- hashtext returns a stable int4 hash — same string = same lock
    -- pg_try_advisory_lock is session-level and non-blocking
    -- ========================================================================
    IF NOT pg_try_advisory_lock(hashtext('mark_absent_employees')) THEN
        RETURN jsonb_build_object(
            'success', false,
            'message', 'Another mark_absent_employees execution is already running',
            'skipped', true
        );
    END IF;

    -- ========================================================================
    -- Compute Cairo time (Africa/Cairo handles DST automatically)
    -- ========================================================================
    cairo_now       := now() AT TIME ZONE 'Africa/Cairo';
    cairo_date      := cairo_now::date;
    cairo_time_val  := cairo_now::time;
    cairo_total_min := EXTRACT(HOUR FROM cairo_time_val)::integer * 60
                     + EXTRACT(MINUTE FROM cairo_time_val)::integer;
    cairo_dow       := EXTRACT(DOW FROM cairo_now)::integer;  -- 0=Sun

    -- Map DOW integer to lowercase day name (matches profiles.off_day format)
    cairo_day_name := CASE cairo_dow
        WHEN 0 THEN 'sunday'
        WHEN 1 THEN 'monday'
        WHEN 2 THEN 'tuesday'
        WHEN 3 THEN 'wednesday'
        WHEN 4 THEN 'thursday'
        WHEN 5 THEN 'friday'
        WHEN 6 THEN 'saturday'
    END;

    -- ========================================================================
    -- Process each employee
    -- ========================================================================
    FOR emp IN
        SELECT id, full_name, off_day, shift_start, shift_end
        FROM profiles
        WHERE role = 'employee'
          AND (off_day IS NULL OR off_day <> cairo_day_name)
    LOOP
        -- ====================================================================
        -- Parse shift times (HH:MM strings -> total minutes)
        -- ====================================================================
        IF emp.shift_start IS NULL OR emp.shift_end IS NULL THEN
            -- No shift defined: treat shift as ended (mark absent at any time)
            shift_ended := true;
            target_date := cairo_date;
        ELSE
            shift_start_min := EXTRACT(HOUR FROM emp.shift_start)::integer * 60
                             + EXTRACT(MINUTE FROM emp.shift_start)::integer;
            shift_end_min   := EXTRACT(HOUR FROM emp.shift_end)::integer * 60
                             + EXTRACT(MINUTE FROM emp.shift_end)::integer;

            -- ================================================================
            -- Determine if shift has ended
            -- We add a 3 hour (180 minute) grace period for overtime if overtime_enabled is true
            -- to avoid aggressively labelling missing_checkout for valid overtimers.
            -- ================================================================
            DECLARE 
                grace_minutes integer := CASE WHEN emp.overtime_enabled THEN 180 ELSE 0 END;
            BEGIN
                IF shift_end_min < shift_start_min THEN
                    -- Overnight shift (e.g., 22:00-06:00)
                    -- Shift has ended when: current_time >= end + grace AND current_time < start
                    shift_ended := (cairo_total_min >= (shift_end_min + grace_minutes) AND cairo_total_min < shift_start_min);
                ELSE
                    -- Regular day shift (e.g., 09:00-17:00)
                    -- Shift has ended when: current_time >= end + grace
                    shift_ended := (cairo_total_min >= (shift_end_min + grace_minutes));
                END IF;

                -- ================================================================
                -- Determine target date
                -- For overnight shifts checked in the morning: target = yesterday
                -- ================================================================
                IF shift_end_min < shift_start_min AND cairo_total_min < shift_start_min THEN
                    -- We're in the morning after an overnight shift
                    -- The shift that ended was from YESTERDAY
                    target_date := cairo_date - INTERVAL '1 day';
                ELSE
                    target_date := cairo_date;
                END IF;
            END;
        END IF;

        -- Skip if shift hasn't ended yet
        IF NOT shift_ended THEN
            skipped_shift := skipped_shift + 1;
            CONTINUE;
        END IF;

        -- ====================================================================
        -- Check existing attendance for target_date
        -- ====================================================================
        SELECT a.check_in_time, a.check_out_time
        INTO existing_rec
        FROM attendance a
        WHERE a.user_id = emp.id
          AND a.date = target_date;

        IF NOT FOUND THEN
            -- No record at all -> mark absent
            INSERT INTO attendance (user_id, date, status, check_in_time, check_out_time, late_minutes, early_departure_minutes, overtime_minutes)
            VALUES (emp.id, target_date, 'absent', NULL, NULL, 0, 0, 0)
            ON CONFLICT (user_id, date) DO NOTHING;

            marked_absent := marked_absent + 1;
            absent_names := array_append(absent_names, emp.full_name);

        ELSIF existing_rec.check_in_time IS NOT NULL AND existing_rec.check_out_time IS NULL THEN
            -- Checked in but never checked out -> flag as missing_checkout
            UPDATE attendance
            SET status = 'missing_checkout'
            WHERE user_id = emp.id
              AND date = target_date;

            marked_missing := marked_missing + 1;
            missing_names := array_append(missing_names, emp.full_name);

        ELSE
            -- Already has both check_in and check_out -> skip
            already_recorded := already_recorded + 1;
        END IF;

    END LOOP;

    -- Release the advisory lock
    PERFORM pg_advisory_unlock(hashtext('mark_absent_employees'));

    -- ========================================================================
    -- Return summary
    -- ========================================================================
    RETURN jsonb_build_object(
        'success', true,
        'message', format('Marked %s absent, %s missing checkout', marked_absent, marked_missing),
        'markedAbsent', marked_absent,
        'markedMissingCheckout', marked_missing,
        'alreadyRecorded', already_recorded,
        'skippedShiftNotEnded', skipped_shift,
        'currentTime', to_char(cairo_now, 'YYYY-MM-DD HH24:MI:SS'),
        'currentDate', to_char(cairo_date, 'YYYY-MM-DD'),
        'dayOfWeek', cairo_day_name,
        'absentEmployees', to_jsonb(absent_names),
        'missingCheckoutEmployees', to_jsonb(missing_names)
    );
END;
$$;

-- ============================================================================
-- Step 3: Grant execute permission to authenticated users (for RPC calls)
-- and to postgres (for pg_cron)
-- ============================================================================
GRANT EXECUTE ON FUNCTION public.mark_absent_employees() TO authenticated;
GRANT EXECUTE ON FUNCTION public.mark_absent_employees() TO postgres;

-- ============================================================================
-- Step 4: Schedule the function to run every 15 minutes via pg_cron
-- ============================================================================

-- Remove any existing schedule with the same name (idempotent)
SELECT cron.unschedule('mark-absent-every-15min')
WHERE EXISTS (
    SELECT 1 FROM cron.job WHERE jobname = 'mark-absent-every-15min'
);

-- Schedule: every 15 minutes, every day
SELECT cron.schedule(
    'mark-absent-every-15min',           -- job name
    '*/15 * * * *',                       -- every 15 minutes
    $$SELECT public.mark_absent_employees()$$  -- the function to call
);

-- ============================================================================
-- Done! The function will now:
--   1. Run automatically every 15 minutes via pg_cron
--   2. Be callable manually via: SELECT mark_absent_employees();
--   3. Be callable from the app via Supabase RPC: supabase.rpc('mark_absent_employees')
-- ============================================================================
