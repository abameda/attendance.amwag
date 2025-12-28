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

interface ImportResult {
    email: string;
    success: boolean;
    error?: string;
}

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
        const { csvData } = body;

        if (!csvData || typeof csvData !== 'string') {
            return NextResponse.json(
                { success: false, error: 'CSV data is required' },
                { status: 400 }
            );
        }

        // Create admin client with service role key
        const supabaseAdmin = createAdminClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY!
        );

        // Parse CSV data
        const lines = csvData.trim().split('\n').filter(line => line.trim());
        const results: ImportResult[] = [];

        for (const line of lines) {
            // Parse CSV line: Email, Password, Full Name, Branch, Shift Start, Shift End
            const parts = line.split(',').map(part => part.trim());

            if (parts.length < 3) {
                results.push({
                    email: parts[0] || 'Unknown',
                    success: false,
                    error: 'Invalid format: at least Email, Password, and Full Name are required'
                });
                continue;
            }

            const [email, password, full_name, branch, shift_start, shift_end] = parts;

            // Validate required fields
            if (!email || !password || !full_name) {
                results.push({
                    email: email || 'Unknown',
                    success: false,
                    error: 'Missing required fields (email, password, or full name)'
                });
                continue;
            }

            try {
                // Create user with Admin API
                const { data: createData, error: createError } = await supabaseAdmin.auth.admin.createUser({
                    email,
                    password,
                    email_confirm: true,
                    user_metadata: {
                        full_name,
                        role: 'employee',
                        branch: branch || null,
                    },
                });

                if (createError) {
                    results.push({
                        email,
                        success: false,
                        error: createError.message
                    });
                    continue;
                }

                // Update profile with shift times if provided
                if (createData.user && (shift_start || shift_end)) {
                    await supabaseAdmin
                        .from('profiles')
                        .update({
                            shift_start: shift_start || null,
                            shift_end: shift_end || null,
                        })
                        .eq('id', createData.user.id);
                }

                results.push({
                    email,
                    success: true
                });
            } catch (err) {
                results.push({
                    email,
                    success: false,
                    error: err instanceof Error ? err.message : 'Unknown error'
                });
            }
        }

        const successCount = results.filter(r => r.success).length;
        const failedCount = results.filter(r => !r.success).length;
        const failedEmails = results.filter(r => !r.success).map(r => ({ email: r.email, error: r.error }));

        return NextResponse.json({
            success: true,
            data: {
                total: results.length,
                successCount,
                failedCount,
                failedEmails
            }
        });
    } catch (error) {
        console.error('Bulk import error:', error);
        return NextResponse.json(
            { success: false, error: 'Internal server error' },
            { status: 500 }
        );
    }
}
