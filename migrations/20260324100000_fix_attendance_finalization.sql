-- Corrective migration for attendance finalization integrity.
-- Fixes missing overtime_enabled selection and makes status transitions idempotent.

CREATE OR REPLACE FUNCTION public.mark_absent_employees()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    cairo_now timestamptz;
    cairo_date date;
    cairo_time_val time;
    cairo_total_min integer;
    cairo_dow integer;
    cairo_day_name text;
    marked_absent integer := 0;
    marked_missing integer := 0;
    already_recorded integer := 0;
    skipped_shift integer := 0;
    emp record;
    existing_rec record;
    shift_start_min integer;
    shift_end_min integer;
    grace_minutes integer;
    shift_ended boolean;
    target_date date;
    absent_names text[] := '{}';
    missing_names text[] := '{}';
BEGIN
    IF NOT pg_try_advisory_lock(hashtext('mark_absent_employees')) THEN
        RETURN jsonb_build_object(
            'success', false,
            'message', 'Another mark_absent_employees execution is already running',
            'skipped', true
        );
    END IF;

    cairo_now := now() AT TIME ZONE 'Africa/Cairo';
    cairo_date := cairo_now::date;
    cairo_time_val := cairo_now::time;
    cairo_total_min := EXTRACT(HOUR FROM cairo_time_val)::integer * 60
        + EXTRACT(MINUTE FROM cairo_time_val)::integer;
    cairo_dow := EXTRACT(DOW FROM cairo_now)::integer;

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
            shift_start_min := SPLIT_PART(emp.shift_start, ':', 1)::integer * 60
                + SPLIT_PART(emp.shift_start, ':', 2)::integer;
            shift_end_min := SPLIT_PART(emp.shift_end, ':', 1)::integer * 60
                + SPLIT_PART(emp.shift_end, ':', 2)::integer;
            grace_minutes := CASE WHEN COALESCE(emp.overtime_enabled, false) THEN 180 ELSE 0 END;

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
                user_id,
                date,
                status,
                check_in_time,
                check_out_time,
                late_minutes,
                early_departure_minutes,
                overtime_minutes
            )
            VALUES (emp.id, target_date, 'absent', NULL, NULL, 0, 0, 0)
            ON CONFLICT (user_id, date) DO NOTHING;

            marked_absent := marked_absent + 1;
            absent_names := array_append(absent_names, emp.full_name);
        ELSIF existing_rec.check_in_time IS NOT NULL AND existing_rec.check_out_time IS NULL THEN
            UPDATE public.attendance
            SET status = 'missing_checkout'
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
