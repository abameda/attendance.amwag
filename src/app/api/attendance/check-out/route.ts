import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { getEgyptNow, getEgyptDate } from '@/lib/timezone';
import { getGlobalSettings } from '@/lib/globalSettings';

export async function POST(_request: NextRequest) {
    try {
        const supabase = await createClient();

        // Get current user
        const {
            data: { user },
            error: authError,
        } = await supabase.auth.getUser();

        if (authError || !user) {
            return NextResponse.json(
                { success: false, error: 'Unauthorized' },
                { status: 401 }
            );
        }

        // Get client IP address - Ensure protection from basic Forwarded-For spoofing
        const headersList = await headers();
        const currentIp = headersList.get('x-real-ip') || headersList.get('x-forwarded-for')?.split(',')[0].trim() || 'Unknown';

        // Detect location from IP and enforce strict checks
        const ipv4Parts = currentIp.split('.');
        const ipNetwork = ipv4Parts.length === 4 ? ipv4Parts.slice(0, 3).join('.') : currentIp;

        const { data: matchingBranch } = await supabase
            .from('branch_allowed_ips')
            .select('branch_name')
            .eq('ip_network', ipNetwork)
            .eq('is_active', true)
            .single();

        if (!matchingBranch) {
            return NextResponse.json(
                {
                    success: false,
                    error: 'You must be connected to the company network (WiFi) to check out.'
                },
                { status: 403 }
            );
        }

        const checkOutLocation = matchingBranch.branch_name;

        const now = new Date();
        const { date: egyptDate, totalMinutes: _currentTotalMinutes } = getEgyptNow();
        const today = egyptDate;

        // Get user's profile for shift info and overtime settings
        const { data: profile } = await supabase
            .from('profiles')
            .select('shift_start, shift_end, overtime_enabled')
            .eq('id', user.id)
            .single();

        // Try today first; fall back to yesterday for overnight shift workers
        let { data: existingRecord } = await supabase
            .from('attendance')
            .select('id, check_in_time, check_out_time, ip_address, status, late_minutes')
            .eq('user_id', user.id)
            .eq('date', today)
            .maybeSingle();

        if (!existingRecord?.check_in_time) {
            // Overnight shift: worker may have checked in yesterday
            const yesterday = new Date(now);
            yesterday.setDate(yesterday.getDate() - 1);
            const yesterdayDate = getEgyptDate(yesterday);

            const { data: yesterdayRecord } = await supabase
                .from('attendance')
                .select('id, check_in_time, check_out_time, ip_address, status, late_minutes')
                .eq('user_id', user.id)
                .eq('date', yesterdayDate)
                .is('check_out_time', null)
                .maybeSingle();

            if (yesterdayRecord?.check_in_time) {
                existingRecord = yesterdayRecord;
            }
        }

        if (!existingRecord?.check_in_time) {
            return NextResponse.json(
                { success: false, error: 'Must check in before checking out' },
                { status: 400 }
            );
        }

        if (existingRecord.check_out_time) {
            return NextResponse.json(
                { success: false, error: 'Already checked out today' },
                { status: 409 }
            );
        }

        // Calculate expected shift dynamics to define session limits
        let shiftDurationHours = 9; // Fallback default (8 work + 1 break)
        if (profile?.shift_start && profile?.shift_end) {
            const [startH, startM] = profile.shift_start.split(':').map(Number);
            const [endH, endM] = profile.shift_end.split(':').map(Number);
            let durationMinutes = (endH * 60 + endM) - (startH * 60 + startM);
            if (durationMinutes < 0) durationMinutes += 24 * 60; // Handle overnight shifts
            shiftDurationHours = durationMinutes / 60;
        }

        // Security check: Hard reject check-outs that happen far past the shift + overtime buffer.
        // Formula: Max(14 hours, Shift Duration + 5 hours allowance). 
        // Example for 12hr shift: 12 + 5 = 17 hours max checkout time (covers early check-ins + up to 3h overtime + 1h buffer)
        const checkInTime = new Date(existingRecord.check_in_time);
        const hoursSinceCheckIn = (now.getTime() - checkInTime.getTime()) / (1000 * 60 * 60);
        const maxAllowedSessionHours = Math.max(14, shiftDurationHours + 5);

        if (hoursSinceCheckIn > maxAllowedSessionHours) {
            return NextResponse.json(
                { success: false, error: 'Your session timed out. You forgot to check out of your previous shift.' },
                { status: 400 }
            );
        }

        // Fetch global time window settings
        const settings = await getGlobalSettings();

        // Validate checkout window: employee must check out within checkout_window_minutes after shift_end
        // Overtime-enabled employees get the overtime cap (180 min) as their window instead
        if (profile?.shift_start && profile?.shift_end) {
            const [endH, endM] = profile.shift_end.split(':').map(Number);
            const [startH, startM] = profile.shift_start.split(':').map(Number);

            const shiftEndRef = new Date(checkInTime);
            shiftEndRef.setHours(endH, endM, 0, 0);

            // Shift crosses midnight
            if (endH < startH || (endH === startH && endM < startM)) {
                shiftEndRef.setDate(shiftEndRef.getDate() + 1);
            }

            const windowMinutes = profile.overtime_enabled ? settings.max_overtime_minutes : settings.checkout_window_minutes;
            const windowEnd = new Date(shiftEndRef.getTime() + windowMinutes * 60000);

            if (now.getTime() > windowEnd.getTime()) {
                return NextResponse.json(
                    {
                        success: false,
                        error: `Check-out window has expired. You had ${windowMinutes} minutes after your shift ended to check out.`
                    },
                    { status: 400 }
                );
            }
        }

        // Calculate early departure minutes and overtime using exact Date mathematics instead of static minute values
        let earlyDepartureMinutes = 0;
        let overtimeMinutes = 0;

        if (profile?.shift_end) {
            const [endH, endM] = profile.shift_end.split(':').map(Number);
            const shiftEndDate = new Date(checkInTime);
            shiftEndDate.setHours(endH, endM, 0, 0);

            if (profile?.shift_start) {
                const [startH, startM] = profile.shift_start.split(':').map(Number);
                // Shift crosses midnight
                if (endH < startH || (endH === startH && endM < startM)) {
                    shiftEndDate.setDate(shiftEndDate.getDate() + 1);
                }
            }

            // Difference in minutes calculated via exact Date differences
            const diffMinutes = Math.floor((shiftEndDate.getTime() - now.getTime()) / 60000);

            if (diffMinutes > 0) {
                // Left early
                earlyDepartureMinutes = diffMinutes;
            } else if (diffMinutes < 0 && profile.overtime_enabled) {
                // Stayed late and overtime is enabled (max 180 min)
                const overtimeDiff = Math.abs(diffMinutes);
                overtimeMinutes = Math.min(overtimeDiff, settings.max_overtime_minutes);
            }
        }

        // Dynamic status reset (Re-evaluates `missing_checkout` to present/late assuming check-out is now happening)
        let resolvedStatus = existingRecord.status;
        if (resolvedStatus === 'missing_checkout') {
            resolvedStatus = (existingRecord.late_minutes && existingRecord.late_minutes > 0) ? 'late' : 'present';
        }

        // Update the attendance record with check-out time, IP, location, early departure, and overtime
        const { data: updatedRecord, error } = await supabase
            .from('attendance')
            .update({
                check_out_time: now.toISOString(),
                check_out_ip: currentIp,
                check_out_location: checkOutLocation,
                early_departure_minutes: earlyDepartureMinutes,
                overtime_minutes: overtimeMinutes,
                status: resolvedStatus
            })
            .eq('id', existingRecord.id)
            .is('check_out_time', null)
            .select('id')
            .maybeSingle();

        if (error) {
            return NextResponse.json(
                { success: false, error: error.message },
                { status: 500 }
            );
        }

        if (!updatedRecord) {
            return NextResponse.json(
                { success: false, error: 'Already checked out today' },
                { status: 409 }
            );
        }

        return NextResponse.json({
            success: true,
            data: {
                check_out_time: now.toISOString(),
                check_out_location: checkOutLocation,
                early_departure_minutes: earlyDepartureMinutes,
                overtime_minutes: overtimeMinutes,
                status: resolvedStatus
            },
        });
    } catch (error) {
        console.error('Check-out error:', error);
        return NextResponse.json(
            { success: false, error: 'Internal server error' },
            { status: 500 }
        );
    }
}
