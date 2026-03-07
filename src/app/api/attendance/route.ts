import { isAdmin } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { getEgyptDate } from '@/lib/timezone';
import type { AttendanceRecord, Profile } from '@/types';
import { NextRequest, NextResponse } from 'next/server';

const VALID_STATUSES: AttendanceRecord['status'][] = [
    'present',
    'late',
    'absent',
    'missing_checkout',
    'pending',
];

export async function GET(request: NextRequest) {
    try {
        const auth = await isAdmin(request);
        if (!auth.authorized) {
            return NextResponse.json(
                { success: false, error: auth.error },
                { status: auth.status }
            );
        }

        const supabase = await createClient();
        const { searchParams } = new URL(request.url);

        const parsedPage = Number.parseInt(searchParams.get('page') ?? '1', 10);
        const parsedPageSize = Number.parseInt(searchParams.get('pageSize') ?? '10', 10);

        const page = Number.isNaN(parsedPage) || parsedPage < 1 ? 1 : parsedPage;
        const pageSize = Number.isNaN(parsedPageSize) || parsedPageSize < 1 ? 10 : parsedPageSize;

        const date = searchParams.get('date')?.trim() ?? '';
        const status = searchParams.get('status')?.trim() ?? '';
        const search = searchParams.get('search')?.trim() ?? '';
        const includeExpected = searchParams.get('includeExpected') === 'true';

        if (status && !VALID_STATUSES.includes(status as AttendanceRecord['status'])) {
            return NextResponse.json(
                { success: false, error: 'Invalid status filter' },
                { status: 400 }
            );
        }

        const from = (page - 1) * pageSize;
        const to = page * pageSize - 1;
        const escapedSearch = search.replace(/[%_]/g, (match) => `\\${match}`);

        const profilesSelect = search
            ? 'profiles!inner(full_name, email, branch, job_title)'
            : 'profiles(full_name, email, branch, job_title)';

        let dataQuery = supabase
            .from('attendance')
            .select(`*, ${profilesSelect}`)
            .order('date', { ascending: false })
            .order('check_in_time', { ascending: false });

        let countQuery = supabase
            .from('attendance')
            .select(search ? 'id, profiles!inner(id)' : 'id', { count: 'exact', head: true });

        if (date) {
            dataQuery = dataQuery.eq('date', date);
            countQuery = countQuery.eq('date', date);
        }

        if (status) {
            dataQuery = dataQuery.eq('status', status);
            countQuery = countQuery.eq('status', status);
        }

        if (search) {
            const searchFilter = `full_name.ilike.%${escapedSearch}%,email.ilike.%${escapedSearch}%,branch.ilike.%${escapedSearch}%`;
            dataQuery = dataQuery.or(searchFilter, { foreignTable: 'profiles' });
            countQuery = countQuery.or(searchFilter, { foreignTable: 'profiles' });
        }

        const [dataResponse, countResponse] = await Promise.all([
            dataQuery.range(from, to),
            countQuery,
        ]);

        if (dataResponse.error || countResponse.error) {
            if (!search) {
                throw dataResponse.error ?? countResponse.error;
            }

            let fallbackQuery = supabase
                .from('attendance')
                .select('*, profiles(full_name, email, branch, job_title)')
                .order('date', { ascending: false })
                .order('check_in_time', { ascending: false });

            if (date) {
                fallbackQuery = fallbackQuery.eq('date', date);
            }

            if (status) {
                fallbackQuery = fallbackQuery.eq('status', status);
            }

            const { data: fallbackData, error: fallbackError } = await fallbackQuery;

            if (fallbackError) {
                throw fallbackError;
            }

            const normalizedSearch = search.toLowerCase();
            const filteredData = (fallbackData ?? []).filter((record) => {
                const profile = record.profiles;
                return (
                    profile?.full_name?.toLowerCase().includes(normalizedSearch) ||
                    profile?.email?.toLowerCase().includes(normalizedSearch) ||
                    profile?.branch?.toLowerCase().includes(normalizedSearch)
                );
            }) as AttendanceRecord[];

            return NextResponse.json({
                success: true,
                data: filteredData.slice(from, to + 1),
                total: filteredData.length,
                page,
                pageSize,
            });
        }

        const realRecords = (dataResponse.data ?? []) as AttendanceRecord[];
        let totalCount = countResponse.count ?? 0;

        // --- Frontend Virtualization: inject "pending" rows for today ---
        const egyptToday = getEgyptDate();
        const isViewingToday = !date || date === egyptToday;
        const shouldVirtualize = includeExpected && isViewingToday && (!status || status === 'pending');

        if (shouldVirtualize) {
            // Get the current day-of-week in Egypt
            const dayOfWeek = new Intl.DateTimeFormat('en-US', {
                timeZone: 'Africa/Cairo',
                weekday: 'long',
            }).format(new Date()).toLowerCase();

            // Fetch all employees (excluding those on their off day)
            const { data: allEmployees } = await supabase
                .from('profiles')
                .select('id, full_name, email, branch, job_title, role, shift_start, shift_end, off_day, overtime_enabled, created_at, updated_at')
                .eq('role', 'employee')
                .or(`off_day.is.null,off_day.neq.${dayOfWeek}`);

            // Fetch ALL attendance user_ids for today (un-paginated) to know who checked in
            const { data: todayCheckedIn } = await supabase
                .from('attendance')
                .select('user_id')
                .eq('date', egyptToday);

            const checkedInIds = new Set((todayCheckedIn ?? []).map((r: { user_id: string }) => r.user_id));
            const employees = (allEmployees ?? []) as Profile[];

            // Build virtual pending records for missing employees
            let virtualRecords: AttendanceRecord[] = employees
                .filter((emp) => !checkedInIds.has(emp.id))
                .map((emp) => ({
                    id: `virtual-${emp.id}`,
                    user_id: emp.id,
                    date: egyptToday,
                    check_in_time: null,
                    check_out_time: null,
                    ip_address: null,
                    check_out_ip: null,
                    check_in_location: null,
                    check_out_location: null,
                    status: 'pending' as const,
                    late_minutes: 0,
                    early_departure_minutes: 0,
                    overtime_minutes: 0,
                    created_at: new Date().toISOString(),
                    profiles: {
                        id: emp.id,
                        email: emp.email,
                        full_name: emp.full_name,
                        role: emp.role,
                        branch: emp.branch,
                        job_title: emp.job_title,
                        shift_start: emp.shift_start,
                        shift_end: emp.shift_end,
                        off_day: emp.off_day,
                        overtime_enabled: emp.overtime_enabled,
                        created_at: emp.created_at,
                        updated_at: emp.updated_at,
                    },
                }));

            // Apply search filter to virtual records if searching
            if (search) {
                const normalizedSearch = search.toLowerCase();
                virtualRecords = virtualRecords.filter((r) => {
                    const p = r.profiles;
                    return (
                        p?.full_name?.toLowerCase().includes(normalizedSearch) ||
                        p?.email?.toLowerCase().includes(normalizedSearch) ||
                        p?.branch?.toLowerCase().includes(normalizedSearch)
                    );
                });
            }

            if (status === 'pending') {
                // Only show virtual pending records
                const paginatedVirtual = virtualRecords.slice(from, to + 1);
                return NextResponse.json({
                    success: true,
                    data: paginatedVirtual,
                    total: virtualRecords.length,
                    page,
                    pageSize,
                });
            }

            // Merge: virtual pending first, then real records
            // Re-paginate the combined list
            const combined = [...virtualRecords, ...realRecords];
            // We need the full un-paginated real records for correct combined count
            // Since we already have `totalCount` for real records, combined total =
            totalCount = virtualRecords.length + totalCount;

            // Re-fetch real records without pagination to interleave correctly
            // Actually, for efficiency, re-slice the combined set:
            // Virtual records go first, then real records fill the rest
            // The `from` / `to` indices apply to the combined list
            const combinedSlice = combined.slice(from, to + 1);

            // If the current page is beyond the virtual records, we need real records
            // from the correct offset
            if (from >= virtualRecords.length) {
                // This page is entirely real records
                const realFrom = from - virtualRecords.length;
                const realTo = to - virtualRecords.length;
                // Re-fetch real records with corrected range
                let refetchQuery = supabase
                    .from('attendance')
                    .select(`*, ${profilesSelect}`)
                    .order('date', { ascending: false })
                    .order('check_in_time', { ascending: false });

                if (date) refetchQuery = refetchQuery.eq('date', date);
                if (search) {
                    const searchFilter = `full_name.ilike.%${escapedSearch}%,email.ilike.%${escapedSearch}%,branch.ilike.%${escapedSearch}%`;
                    refetchQuery = refetchQuery.or(searchFilter, { foreignTable: 'profiles' });
                }

                const { data: refetchedData } = await refetchQuery.range(realFrom, realTo);
                return NextResponse.json({
                    success: true,
                    data: (refetchedData ?? []) as AttendanceRecord[],
                    total: totalCount,
                    page,
                    pageSize,
                });
            }

            return NextResponse.json({
                success: true,
                data: combinedSlice,
                total: totalCount,
                page,
                pageSize,
            });
        }

        return NextResponse.json({
            success: true,
            data: realRecords,
            total: totalCount,
            page,
            pageSize,
        });
    } catch (error) {
        console.error('Get attendance error:', error);
        return NextResponse.json(
            { success: false, error: 'Internal server error' },
            { status: 500 }
        );
    }
}
