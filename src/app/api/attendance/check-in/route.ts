import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { headers } from 'next/headers';

export async function POST(request: NextRequest) {
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

        // Validate check-in window: 1 hour before shift_start to shift_end
        if (profile?.shift_start && profile?.shift_end) {
            const [startH, startM] = profile.shift_start.split(':').map(Number);
            const [endH, endM] = profile.shift_end.split(':').map(Number);

            // Window opens 1 hour before shift start
            const windowStart = new Date(now);
            windowStart.setHours(startH - 1, startM, 0, 0);

            // Window closes at shift end
            const windowEnd = new Date(now);
            windowEnd.setHours(endH, endM, 0, 0);

            // Handle overnight shifts (e.g., 1:39 PM - 1:40 AM)
            // If shift_end time is earlier than shift_start time, it means the shift crosses midnight
            const isOvernightShift = endH < startH || (endH === startH && endM < startM);
            if (isOvernightShift) {
                // If we're currently AFTER the shift start (e.g., 2:11 PM when shift started at 1:39 PM),
                // then windowEnd should be tomorrow
                const shiftStartToday = new Date(now);
                shiftStartToday.setHours(startH, startM, 0, 0);

                if (now >= shiftStartToday) {
                    // We're in the first part of the overnight shift, end is tomorrow
                    windowEnd.setDate(windowEnd.getDate() + 1);
                }
                // If now < shiftStartToday, we're in the early morning part of an overnight shift
                // that started yesterday, windowEnd is already correct (today)
            }

            // Format times for error message
            const formatTime = (h: number, m: number) => {
                const hour = h < 0 ? h + 24 : h;
                const period = hour >= 12 ? 'PM' : 'AM';
                const displayHour = hour % 12 || 12;
                return `${displayHour}:${m.toString().padStart(2, '0')} ${period}`;
            };

            // STRICT BLOCKING: Too Early
            if (now < windowStart) {
                return NextResponse.json(
                    {
                        success: false,
                        error: `Check-in is only allowed from ${formatTime(startH - 1, startM)} to ${formatTime(endH, endM)}. You're too early!`
                    },
                    { status: 400 }
                );
            }

            // STRICT BLOCKING: Too Late (After Shift End)
            if (now > windowEnd) {
                return NextResponse.json(
                    {
                        success: false,
                        error: `Shift has ended. You cannot check in after ${formatTime(endH, endM)}.`
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
            const shiftStartDate = new Date(now);
            shiftStartDate.setHours(shiftHours, shiftMinutes, 0, 0);

            // If check-in is AFTER shift start, calculate lateness
            if (now > shiftStartDate) {
                const diffMs = now.getTime() - shiftStartDate.getTime();
                const diffMinutes = Math.floor(diffMs / 60000);

                if (diffMinutes > 0) {
                    lateMinutes = diffMinutes;
                    status = 'late';
                }
            }
        }

        // Get today's date in YYYY-MM-DD format
        const today = now.toISOString().split('T')[0];

        // Check if already checked in today
        const { data: existingRecord } = await supabase
            .from('attendance')
            .select('id, check_in_time')
            .eq('user_id', user.id)
            .eq('date', today)
            .single();

        if (existingRecord?.check_in_time) {
            return NextResponse.json(
                { success: false, error: 'Already checked in today' },
                { status: 400 }
            );
        }

        // Insert or update attendance record
        if (existingRecord) {
            // Update existing record
            const { error } = await supabase
                .from('attendance')
                .update({
                    check_in_time: now.toISOString(),
                    ip_address: ip,
                    late_minutes: lateMinutes,
                    status,
                })
                .eq('id', existingRecord.id);

            if (error) {
                return NextResponse.json(
                    { success: false, error: error.message },
                    { status: 500 }
                );
            }
        } else {
            // Create new record
            const { error } = await supabase.from('attendance').insert({
                user_id: user.id,
                date: today,
                check_in_time: now.toISOString(),
                ip_address: ip,
                late_minutes: lateMinutes,
                status,
            });

            if (error) {
                return NextResponse.json(
                    { success: false, error: error.message },
                    { status: 500 }
                );
            }
        }

        return NextResponse.json({
            success: true,
            data: {
                check_in_time: now.toISOString(),
                ip_address: ip,
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
