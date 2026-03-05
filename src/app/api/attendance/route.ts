import { isAdmin } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import type { AttendanceRecord } from '@/types';
import { NextRequest, NextResponse } from 'next/server';

const VALID_STATUSES: AttendanceRecord['status'][] = [
    'present',
    'late',
    'absent',
    'missing_checkout',
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

        return NextResponse.json({
            success: true,
            data: (dataResponse.data ?? []) as AttendanceRecord[],
            total: countResponse.count ?? 0,
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
