import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { getEgyptNow, isWithinTimeWindow } from '@/lib/timezone';
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

        // Get client IP address
        const headersList = await headers();
        // Prevent spoofing by utilizing x-real-ip preferentially if the reverse proxy sets it cleanly,
        // Otherwise trust the first IP in the forwarded list (usually the true edge origin).
        const currentIp = headersList.get('x-real-ip') || headersList.get('x-forwarded-for')?.split(',')[0].trim() || 'Unknown';

        // Very strict check against known branches (First 3 octets of IPv4)
        // If the connection is local or IPv6 format, handle accordingly.
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
                    error: 'You must be connected to the company network (WiFi) to check in.'
                },
                { status: 403 }
            );
        }

        const checkInLocation = matchingBranch.branch_name;

        // Get user's profile for shift information
        const { data: profile } = await supabase
            .from('profiles')
            .select('shift_start, shift_end')
            .eq('id', user.id)
            .single();

        const now = new Date();
        const { date: egyptToday, totalMinutes: currentTotalMinutes } = getEgyptNow();

        // Format times for error message safely
        const formatTime = (h: number, m: number) => {
            const hour = h < 0 ? h + 24 : (h >= 24 ? h - 24 : h);
            const period = hour >= 12 ? 'PM' : 'AM';
            const displayHour = hour % 12 || 12;
            return `${displayHour}:${m.toString().padStart(2, '0')} ${period}`;
        };

        // Fetch global time window settings
        const settings = await getGlobalSettings();

        // Validate check-in window: [shift_start - early_checkin_minutes] to [shift_end]
        if (profile?.shift_start && profile?.shift_end) {
            const [startH, startM] = profile.shift_start.split(':').map(Number);
            const [endH, endM] = profile.shift_end.split(':').map(Number);

            // Window opens early_checkin_minutes before shift start
            const shiftStartMinutes = startH * 60 + startM;
            let windowStartMinutes = shiftStartMinutes - settings.early_checkin_minutes;
            if (windowStartMinutes < 0) windowStartMinutes += 1440;

            const shiftEndMinutes = endH * 60 + endM;

            const windowStartH = Math.floor(windowStartMinutes / 60) % 24;
            const windowStartM = windowStartMinutes % 60;

            const isWithinWindow = isWithinTimeWindow(
                currentTotalMinutes,
                windowStartMinutes,
                shiftEndMinutes
            );

            if (!isWithinWindow) {
                return NextResponse.json(
                    {
                        success: false,
                        error: `Check-in is only allowed between ${formatTime(windowStartH, windowStartM)} and ${formatTime(endH, endM)}. You are currently outside your shift window.`
                    },
                    { status: 400 }
                );
            }
        }

        // Calculate lateness and status (respects late_grace_minutes from global settings)
        let lateMinutes = 0;
        let status: 'present' | 'late' = 'present';

        if (profile?.shift_start) {
            const [shiftHours, shiftMinutes] = profile.shift_start.split(':').map(Number);
            const shiftStartTotalMinutes = shiftHours * 60 + shiftMinutes;

            // Be mindful of overnight wrapping (e.g. shift starts at 23:00 and it's 00:30)
            let diff = currentTotalMinutes - shiftStartTotalMinutes;
            if (diff < -720) {
                diff += 1440;
            }

            // Apply late grace period: arrival within grace minutes is not considered late
            if (diff > settings.late_grace_minutes) {
                lateMinutes = diff;
                status = 'late';
            }
        }

        const today = egyptToday;

        const { data: existingAttendance, error: existingAttendanceError } = await supabase
            .from('attendance')
            .select('id, status, check_in_time, check_out_time')
            .eq('user_id', user.id)
            .eq('date', today)
            .maybeSingle();

        if (existingAttendanceError) {
            throw existingAttendanceError;
        }

        if (existingAttendance?.check_in_time) {
            return NextResponse.json(
                { success: false, error: 'Duplicate check-in is not allowed for the same work date' },
                { status: 409 }
            );
        }

        if (existingAttendance) {
            return NextResponse.json(
                {
                    success: false,
                    error: existingAttendance.status === 'absent'
                        ? 'Attendance for this work date has already been finalized'
                        : 'Attendance already exists for this work date',
                },
                { status: 409 }
            );
        }

        const { error } = await supabase
            .from('attendance')
            .insert({
                user_id: user.id,
                date: today,
                check_in_time: now.toISOString(),
                ip_address: currentIp,
                check_in_location: checkInLocation,
                late_minutes: lateMinutes,
                status,
            });

        if (error) {
            return NextResponse.json(
                { success: false, error: error.message },
                { status: 500 }
            );
        }

        return NextResponse.json({
            success: true,
            data: {
                check_in_time: now.toISOString(),
                ip_address: currentIp,
                check_in_location: checkInLocation,
                late_minutes: lateMinutes,
                status,
            },
        });
    } catch (error) {
        console.error('Check-in error:', error);
        return NextResponse.json(
            { success: false, error: 'Internal server error' },
            { status: 500 }
        );
    }
}
