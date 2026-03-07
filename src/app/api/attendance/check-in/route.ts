import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { getEgyptNow, isWithinTimeWindow } from '@/lib/timezone';

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

        // Validate check-in window: 1 hour before shift_start to shift_end
        if (profile?.shift_start && profile?.shift_end) {
            const [startH, startM] = profile.shift_start.split(':').map(Number);
            const [endH, endM] = profile.shift_end.split(':').map(Number);

            // Window opens 1 hour before shift start
            let windowStartH = startH - 1;
            const windowStartM = startM;
            if (windowStartH < 0) {
                windowStartH += 24; // Wrap to previous day (e.g., shift at 00:30 -> window starts at 23:30)
            }

            const windowStartMinutes = windowStartH * 60 + windowStartM;
            const shiftEndMinutes = endH * 60 + endM;

            const isWithinWindow = isWithinTimeWindow(
                currentTotalMinutes,
                windowStartMinutes,
                shiftEndMinutes
            );

            if (!isWithinWindow) {
                // Not in window. Let's provide a clear message.
                // Reconstruct exactly if they are early or late in relation to bounds.
                return NextResponse.json(
                    {
                        success: false,
                        error: `Check-in is only allowed between ${formatTime(windowStartH, windowStartM)} and ${formatTime(endH, endM)}. You are currently outside your shift window.`
                    },
                    { status: 400 }
                );
            }
        }

        // Calculate lateness and status
        let lateMinutes = 0;
        let status: 'present' | 'late' = 'present';

        if (profile?.shift_start) {
            const [shiftHours, shiftMinutes] = profile.shift_start.split(':').map(Number);
            const shiftStartTotalMinutes = shiftHours * 60 + shiftMinutes;

            // If we've passed the exact start minute within the window, compute lateness.
            // Be mindful of overnight wrapping (e.g. shift starts at 23:00 and it's 00:30)
            let diff = currentTotalMinutes - shiftStartTotalMinutes;
            if (diff < -720) {
                // e.g. current = 30 (00:30 AM), start = 1380 (23:00) => diff = -1350
                // Meaning they are 90 minutes late the next morning
                diff += 1440;
            }

            if (diff > 0) {
                lateMinutes = diff;
                status = 'late';
            }
        }

        const today = egyptToday;

        const { error } = await supabase
            .from('attendance')
            .upsert(
                {
                    user_id: user.id,
                    date: today,
                    check_in_time: now.toISOString(),
                    ip_address: currentIp,
                    check_in_location: checkInLocation,
                    late_minutes: lateMinutes,
                    status,
                },
                { onConflict: 'user_id,date', ignoreDuplicates: true }
            );

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
