import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { getEgyptNow } from '@/lib/timezone';

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
        const forwardedFor = headersList.get('x-forwarded-for');
        const realIp = headersList.get('x-real-ip');
        const ip = forwardedFor?.split(',')[0].trim() || realIp || 'Unknown';

        // Get user's profile for shift information
        const { data: profile } = await supabase
            .from('profiles')
            .select('shift_start, shift_end')
            .eq('id', user.id)
            .single();

        const now = new Date();
        const { date: egyptToday, totalMinutes: currentTotalMinutes } = getEgyptNow();

        // Validate check-in window: 1 hour before shift_start to shift_end
        if (profile?.shift_start && profile?.shift_end) {
            const [startH, startM] = profile.shift_start.split(':').map(Number);
            const [endH, endM] = profile.shift_end.split(':').map(Number);

            // Window opens 1 hour before shift start
            let windowStartH = startH - 1;
            const windowStartM = startM;
            if (windowStartH < 0) {
                windowStartH = 23; // Wrap to previous day (e.g., shift at 00:30 -> window starts at 23:30)
            }

            const windowStartMinutes = windowStartH * 60 + windowStartM;
            const shiftStartMinutes = startH * 60 + startM;
            const shiftEndMinutes = endH * 60 + endM;

            // Format times for error message
            const formatTime = (h: number, m: number) => {
                const hour = h < 0 ? h + 24 : (h >= 24 ? h - 24 : h);
                const period = hour >= 12 ? 'PM' : 'AM';
                const displayHour = hour % 12 || 12;
                return `${displayHour}:${m.toString().padStart(2, '0')} ${period}`;
            };

            // Handle overnight shifts (e.g., 2:36 PM - 2:37 AM means endH < startH)
            const isOvernightShift = shiftEndMinutes < shiftStartMinutes;

            let isWithinWindow = false;

            if (isOvernightShift) {
                // For overnight shifts:
                // Window is valid from (shiftStart - 1 hour) until shiftEnd (next day)
                // This spans midnight, so we need to check two ranges:
                // 1. From windowStart to midnight (23:59)
                // 2. From midnight (00:00) to shiftEnd

                if (currentTotalMinutes >= windowStartMinutes) {
                    // We're after the window start time (afternoon/evening)
                    isWithinWindow = true;
                } else if (currentTotalMinutes <= shiftEndMinutes) {
                    // We're before the shift end time (early morning after midnight)
                    isWithinWindow = true;
                }
            } else {
                // Regular shift (same-day): window is from (shiftStart - 1hr) to shiftEnd
                isWithinWindow = currentTotalMinutes >= windowStartMinutes && currentTotalMinutes <= shiftEndMinutes;
            }

            if (!isWithinWindow) {
                // Determine if too early or too late
                if (isOvernightShift) {
                    // For overnight shifts, if we're between shiftEnd and windowStart, we're outside
                    if (currentTotalMinutes > shiftEndMinutes && currentTotalMinutes < windowStartMinutes) {
                        // Check if closer to start (too early) or end (too late)
                        if (currentTotalMinutes < shiftStartMinutes) {
                            return NextResponse.json(
                                {
                                    success: false,
                                    error: `Shift has ended. You cannot check in after ${formatTime(endH, endM)}.`
                                },
                                { status: 400 }
                            );
                        } else {
                            return NextResponse.json(
                                {
                                    success: false,
                                    error: `Check-in is only allowed from ${formatTime(windowStartH, windowStartM)} to ${formatTime(endH, endM)}. You're too early!`
                                },
                                { status: 400 }
                            );
                        }
                    }
                } else {
                    // Regular shift
                    if (currentTotalMinutes < windowStartMinutes) {
                        return NextResponse.json(
                            {
                                success: false,
                                error: `Check-in is only allowed from ${formatTime(windowStartH, windowStartM)} to ${formatTime(endH, endM)}. You're too early!`
                            },
                            { status: 400 }
                        );
                    } else {
                        return NextResponse.json(
                            {
                                success: false,
                                error: `Shift has ended. You cannot check in after ${formatTime(endH, endM)}.`
                            },
                            { status: 400 }
                        );
                    }
                }
            }
        }

        // Calculate lateness and status
        let lateMinutes = 0;
        let status: 'present' | 'late' = 'present';

        if (profile?.shift_start) {
            const [shiftHours, shiftMinutes] = profile.shift_start.split(':').map(Number);
            const shiftStartTotalMinutes = shiftHours * 60 + shiftMinutes;

            // Use Egypt time for lateness calculation
            if (currentTotalMinutes > shiftStartTotalMinutes) {
                lateMinutes = currentTotalMinutes - shiftStartTotalMinutes;
                status = 'late';
            }
        }

        const today = egyptToday;

        // Detect location from IP
        const ipNetwork = ip.split('.').slice(0, 3).join('.');
        const { data: matchingBranch } = await supabase
            .from('branch_allowed_ips')
            .select('branch_name')
            .eq('ip_network', ipNetwork)
            .eq('is_active', true)
            .single();

        const checkInLocation = matchingBranch?.branch_name || 'خارج الشركة';

        const { error } = await supabase
            .from('attendance')
            .upsert(
                {
                    user_id: user.id,
                    date: today,
                    check_in_time: now.toISOString(),
                    ip_address: ip,
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
                ip_address: ip,
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
