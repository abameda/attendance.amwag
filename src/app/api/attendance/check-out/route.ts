import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

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

        const now = new Date();
        const today = now.toISOString().split('T')[0];

        // Get user's profile for shift_end
        const { data: profile } = await supabase
            .from('profiles')
            .select('shift_end')
            .eq('id', user.id)
            .single();

        // Get today's attendance record
        const { data: existingRecord } = await supabase
            .from('attendance')
            .select('id, check_in_time, check_out_time')
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

        // Calculate early departure minutes
        let earlyDepartureMinutes = 0;

        if (profile?.shift_end) {
            const [endH, endM] = profile.shift_end.split(':').map(Number);
            const shiftEndDate = new Date(now);
            shiftEndDate.setHours(endH, endM, 0, 0);

            // We also need shift_start to detect overnight shifts
            const { data: fullProfile } = await supabase
                .from('profiles')
                .select('shift_start')
                .eq('id', user.id)
                .single();

            if (fullProfile?.shift_start) {
                const [startH, startM] = fullProfile.shift_start.split(':').map(Number);

                // Handle overnight shifts (e.g., 1:39 PM - 1:40 AM)
                const isOvernightShift = endH < startH || (endH === startH && endM < startM);
                if (isOvernightShift) {
                    // If we're currently AFTER the shift start (e.g., 3:12 PM when shift started at 1:39 PM),
                    // then shiftEndDate should be tomorrow
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
                earlyDepartureMinutes = diffMinutes;
            }
        }

        // Update the attendance record with check-out time and early departure
        const { error } = await supabase
            .from('attendance')
            .update({
                check_out_time: now.toISOString(),
                early_departure_minutes: earlyDepartureMinutes,
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
