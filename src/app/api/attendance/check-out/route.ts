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
        const currentIp = forwardedFor?.split(',')[0].trim() || realIp || 'Unknown';

        const now = new Date();
        const today = now.toISOString().split('T')[0];

        // Get user's profile for shift info and overtime settings
        const { data: profile } = await supabase
            .from('profiles')
            .select('shift_start, shift_end, overtime_enabled')
            .eq('id', user.id)
            .single();

        // Get today's attendance record (including check-in IP)
        const { data: existingRecord } = await supabase
            .from('attendance')
            .select('id, check_in_time, check_out_time, ip_address')
            .eq('user_id', user.id)
            .eq('date', today)
            .single();

        if (!existingRecord?.check_in_time) {
            return NextResponse.json(
                { success: false, error: 'Must check in before checking out' },
                { status: 400 }
            );
        }

        if (existingRecord.check_out_time) {
            return NextResponse.json(
                { success: false, error: 'Already checked out today' },
                { status: 400 }
            );
        }

        // ⚡ IP Validation: Check-out IP must match Check-in IP
        const checkInIp = existingRecord.ip_address;
        if (checkInIp && checkInIp !== 'Unknown' && currentIp !== checkInIp) {
            return NextResponse.json(
                {
                    success: false,
                    error: 'يجب تسجيل الخروج من نفس موقع تسجيل الدخول (IP مختلف)'
                },
                { status: 403 }
            );
        }

        // Calculate early departure minutes and overtime
        let earlyDepartureMinutes = 0;
        let overtimeMinutes = 0;

        if (profile?.shift_end) {
            const [endH, endM] = profile.shift_end.split(':').map(Number);
            const shiftEndDate = new Date(now);
            shiftEndDate.setHours(endH, endM, 0, 0);

            // Handle overnight shifts
            if (profile?.shift_start) {
                const [startH, startM] = profile.shift_start.split(':').map(Number);

                const isOvernightShift = endH < startH || (endH === startH && endM < startM);
                if (isOvernightShift) {
                    const shiftStartToday = new Date(now);
                    shiftStartToday.setHours(startH, startM, 0, 0);

                    if (now >= shiftStartToday) {
                        // We're in the first part of the overnight shift, end is tomorrow
                        shiftEndDate.setDate(shiftEndDate.getDate() + 1);
                    }
                }
            }

            const diffMs = shiftEndDate.getTime() - now.getTime();
            const diffMinutes = Math.floor(diffMs / 60000);

            if (diffMinutes > 0) {
                // Left early
                earlyDepartureMinutes = diffMinutes;
            } else if (diffMinutes < 0 && profile.overtime_enabled) {
                // Stayed late and overtime is enabled
                // Calculate overtime (max 180 minutes = 3 hours)
                const overtimeDiff = Math.abs(diffMinutes);
                overtimeMinutes = Math.min(overtimeDiff, 180);
            }
        }

        // Update the attendance record with check-out time, early departure, and overtime
        const { error } = await supabase
            .from('attendance')
            .update({
                check_out_time: now.toISOString(),
                early_departure_minutes: earlyDepartureMinutes,
                overtime_minutes: overtimeMinutes,
            })
            .eq('id', existingRecord.id);

        if (error) {
            return NextResponse.json(
                { success: false, error: error.message },
                { status: 500 }
            );
        }

        return NextResponse.json({
            success: true,
            data: {
                check_out_time: now.toISOString(),
                early_departure_minutes: earlyDepartureMinutes,
                overtime_minutes: overtimeMinutes,
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
