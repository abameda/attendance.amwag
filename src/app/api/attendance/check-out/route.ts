import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { getEgyptNow, getEgyptDate } from '@/lib/timezone';

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
        const currentIp = forwardedFor?.split(',')[0].trim() || realIp || 'Unknown';

        const now = new Date();
        const { date: egyptDate, totalMinutes: currentTotalMinutes } = getEgyptNow();
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
            .select('id, check_in_time, check_out_time, ip_address')
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
                .select('id, check_in_time, check_out_time, ip_address')
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
                { status: 400 }
            );
        }

        // ⚡ Removed strict IP validation - now we just track location

        // Detect location from IP
        const ipNetwork = currentIp.split('.').slice(0, 3).join('.');  // Get first 3 octets
        const { data: matchingBranch } = await supabase
            .from('branch_allowed_ips')
            .select('branch_name')
            .eq('ip_network', ipNetwork)
            .eq('is_active', true)
            .single();

        const checkOutLocation = matchingBranch?.branch_name || 'خارج الشركة';

        // Calculate early departure minutes and overtime
        let earlyDepartureMinutes = 0;
        let overtimeMinutes = 0;

        if (profile?.shift_end) {
            const [endH, endM] = profile.shift_end.split(':').map(Number);
            const shiftEndTotalMinutes = endH * 60 + endM;

            // Handle overnight shifts
            let adjustedShiftEndMinutes = shiftEndTotalMinutes;

            if (profile?.shift_start) {
                const [startH, startM] = profile.shift_start.split(':').map(Number);
                const shiftStartTotalMinutes = startH * 60 + startM;

                // Overnight shift: end time is less than start time (e.g., 2 PM - 2 AM)
                const isOvernightShift = shiftEndTotalMinutes < shiftStartTotalMinutes;

                if (isOvernightShift) {
                    // If we're past the shift start (in the evening/night before midnight)
                    if (currentTotalMinutes >= shiftStartTotalMinutes) {
                        // Shift end is next day, add 24 hours (1440 minutes)
                        adjustedShiftEndMinutes = shiftEndTotalMinutes + 1440;
                    }
                    // If we're before shift end (early morning after midnight)
                    // adjustedShiftEndMinutes stays the same
                }
            }

            // Calculate difference: positive = early, negative = overtime
            const diffMinutes = adjustedShiftEndMinutes - currentTotalMinutes;

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

        // Update the attendance record with check-out time, IP, location, early departure, and overtime
        const { data: updatedRecord, error } = await supabase
            .from('attendance')
            .update({
                check_out_time: now.toISOString(),
                check_out_ip: currentIp,
                check_out_location: checkOutLocation,
                early_departure_minutes: earlyDepartureMinutes,
                overtime_minutes: overtimeMinutes,
            })
            .eq('id', existingRecord.id)
            .is('check_out_time', null)
            .select('id')
            .maybeSingle();

        if (!updatedRecord) {
            return NextResponse.json(
                { success: false, error: 'Already checked out today' },
                { status: 400 }
            );
        }

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
                check_out_location: checkOutLocation,
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
