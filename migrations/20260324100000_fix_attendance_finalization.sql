-- Corrective migration for attendance finalization integrity.
-- Fixes:
--   1. Adds overtime_enabled to SELECT (was causing "no field" runtime error)
--   2. Reads max_overtime_minutes from global_settings instead of hardcoding 180
--   3. Makes status transitions idempotent (AND status <> 'missing_checkout')
--   4. Fixes grants: revoke from PUBLIC/anon, keep authenticated/postgres/service_role

CREATE OR REPLACE FUNCTION public.mark_absent_employees()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    cairo_now         timestamptz;
    cairo_date        date;
    cairo_time_val    time;
    cairo_total_min   integer;
    cairo_dow         integer;
    cairo_day_name    text;
    marked_absent     integer := 0;
    marked_missing    integer := 0;
    already_recorded  integer := 0;
    skipped_shift     integer := 0;
    emp               record;
    existing_rec      record;
    shift_start_min   integer;
    shift_end_min     integer;
    grace_minutes     integer;
    shift_ended       boolean;
    target_date       date;
    absent_names      text[] := '{}';
    missing_names     text[] := '{}';
    v_max_overtime    integer;
    v_checkout_ts     timestamptz;
BEGIN
    IF NOT pg_try_advisory_lock(hashtext('mark_absent_employees')) THEN
        RETURN jsonb_build_object(
            'success', false,
            'message', 'Another mark_absent_employees execution is already running',
            'skipped', true
        );
    END IF;

    -- Read max_overtime_minutes from global_settings (fallback 180)
    SELECT COALESCE(max_overtime_minutes, 180) INTO v_max_overtime
    FROM public.global_settings WHERE id = 1;
    IF NOT FOUND THEN
        v_max_overtime := 180;
    END IF;

    cairo_now       := now() AT TIME ZONE 'Africa/Cairo';
    cairo_date      := cairo_now::date;
    cairo_time_val  := cairo_now::time;
    cairo_total_min := EXTRACT(HOUR FROM cairo_time_val)::integer * 60
                     + EXTRACT(MINUTE FROM cairo_time_val)::integer;
    cairo_dow       := EXTRACT(DOW FROM cairo_now)::integer;

    cairo_day_name := CASE cairo_dow
        WHEN 0 THEN 'sunday'
        WHEN 1 THEN 'monday'
        WHEN 2 THEN 'tuesday'
        WHEN 3 THEN 'wednesday'
        WHEN 4 THEN 'thursday'
        WHEN 5 THEN 'friday'
        WHEN 6 THEN 'saturday'
    END;

    FOR emp IN
        SELECT id, full_name, off_day, shift_start, shift_end, overtime_enabled
        FROM public.profiles
        WHERE role = 'employee'
          AND (off_day IS NULL OR off_day <> cairo_day_name)
    LOOP
        IF emp.shift_start IS NULL OR emp.shift_end IS NULL THEN
            shift_ended := true;
            target_date := cairo_date;
        ELSE
            shift_start_min := EXTRACT(HOUR FROM emp.shift_start)::integer * 60
                             + EXTRACT(MINUTE FROM emp.shift_start)::integer;
            shift_end_min   := EXTRACT(HOUR FROM emp.shift_end)::integer * 60
                             + EXTRACT(MINUTE FROM emp.shift_end)::integer;
            grace_minutes := CASE WHEN COALESCE(emp.overtime_enabled, false) THEN v_max_overtime ELSE 0 END;

            IF shift_end_min < shift_start_min THEN
                shift_ended := cairo_total_min >= (shift_end_min + grace_minutes)
                    AND cairo_total_min < shift_start_min;
                IF cairo_total_min < shift_start_min THEN
                    target_date := cairo_date - INTERVAL '1 day';
                ELSE
                    target_date := cairo_date;
                END IF;
            ELSE
                shift_ended := cairo_total_min >= (shift_end_min + grace_minutes);
                target_date := cairo_date;
            END IF;
        END IF;

        IF NOT shift_ended THEN
            skipped_shift := skipped_shift + 1;
            CONTINUE;
        END IF;

        SELECT id, status, check_in_time, check_out_time
        INTO existing_rec
        FROM public.attendance
        WHERE user_id = emp.id
          AND date = target_date;

        IF NOT FOUND THEN
            INSERT INTO public.attendance (
                user_id, date, status, check_in_time, check_out_time,
                late_minutes, early_departure_minutes, overtime_minutes
            )
            VALUES (emp.id, target_date, 'absent', NULL, NULL, 0, 0, 0)
            ON CONFLICT (user_id, date) DO NOTHING;

            marked_absent := marked_absent + 1;
            absent_names := array_append(absent_names, emp.full_name);
        ELSIF existing_rec.check_in_time IS NOT NULL AND existing_rec.check_out_time IS NULL THEN
            -- Build a checkout timestamp at shift_end on target_date (Cairo timezone)
            IF emp.shift_end IS NOT NULL THEN
                v_checkout_ts := (target_date || ' ' || emp.shift_end::text)::timestamp AT TIME ZONE 'Africa/Cairo';
            ELSE
                v_checkout_ts := cairo_now;
            END IF;

            UPDATE public.attendance
            SET status = 'missing_checkout',
                check_out_time = v_checkout_ts
            WHERE id = existing_rec.id
              AND status <> 'missing_checkout';

            IF FOUND THEN
                marked_missing := marked_missing + 1;
                missing_names := array_append(missing_names, emp.full_name);
            ELSE
                already_recorded := already_recorded + 1;
            END IF;
        ELSE
            already_recorded := already_recorded + 1;
        END IF;
    END LOOP;

    PERFORM pg_advisory_unlock(hashtext('mark_absent_employees'));

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

-- Fix grants
REVOKE EXECUTE ON FUNCTION public.mark_absent_employees() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.mark_absent_employees() FROM anon;
GRANT EXECUTE ON FUNCTION public.mark_absent_employees() TO authenticated;
GRANT EXECUTE ON FUNCTION public.mark_absent_employees() TO postgres;
GRANT EXECUTE ON FUNCTION public.mark_absent_employees() TO service_role;
