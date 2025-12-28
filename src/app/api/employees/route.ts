import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';

// Helper to check if user is admin
async function isAdmin(supabase: Awaited<ReturnType<typeof createClient>>, userId: string) {
    const { data } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', userId)
        .single();
    return data?.role === 'admin';
}

// GET - List all employees (admin only)
export async function GET() {
    try {
        const supabase = await createClient();

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

        if (!(await isAdmin(supabase, user.id))) {
            return NextResponse.json(
                { success: false, error: 'Forbidden' },
                { status: 403 }
            );
        }

        const { data, error } = await supabase
            .from('profiles')
            .select('*')
            .eq('role', 'employee')
            .order('created_at', { ascending: false });

        if (error) {
            return NextResponse.json(
                { success: false, error: error.message },
                { status: 500 }
            );
        }

        return NextResponse.json({ success: true, data });
    } catch (error) {
        console.error('Get employees error:', error);
        return NextResponse.json(
            { success: false, error: 'Internal server error' },
            { status: 500 }
        );
    }
}

// POST - Create new employee (admin only)
export async function POST(request: NextRequest) {
    try {
        const supabase = await createClient();

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

        if (!(await isAdmin(supabase, user.id))) {
            return NextResponse.json(
                { success: false, error: 'Forbidden' },
                { status: 403 }
            );
        }

        const body = await request.json();
        const { email, password, full_name, branch, job_title, shift_start, shift_end, off_day } = body;

        // Validate required fields
        if (!email || !password || !full_name) {
            return NextResponse.json(
                { success: false, error: 'Email, password, and full name are required' },
                { status: 400 }
            );
        }

        // Create admin client with service role key
        // This allows creating users without affecting the current admin session
        const supabaseAdmin = createAdminClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY!
        );

        // Use Admin API to create user - this does NOT log out the current user
        const { data: createData, error: createError } = await supabaseAdmin.auth.admin.createUser({
            email,
            password,
            email_confirm: true, // Auto-confirm email so user can log in immediately
            user_metadata: {
                full_name,
                role: 'employee',
                branch,
                job_title,
            },
        });

        if (createError) {
            return NextResponse.json(
                { success: false, error: createError.message },
                { status: 400 }
            );
        }

        // Update the profile with shift times and off day if provided
        if (createData.user && (shift_start || shift_end || off_day)) {
            await supabaseAdmin
                .from('profiles')
                .update({
                    shift_start: shift_start || null,
                    shift_end: shift_end || null,
                    off_day: off_day || null
                })
                .eq('id', createData.user.id);
        }

        return NextResponse.json({
            success: true,
            data: { id: createData.user?.id, email },
        });
    } catch (error) {
        console.error('Create employee error:', error);
        return NextResponse.json(
            { success: false, error: 'Internal server error' },
            { status: 500 }
        );
    }
}

