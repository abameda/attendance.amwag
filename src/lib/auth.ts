import { type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export interface AdminCheckResult {
  authorized: boolean;
  userId?: string;
  error?: string;
  status?: number;
}

/**
 * Checks whether the current request is authenticated as an admin.
 * Caller is responsible for returning the HTTP response on failure.
 *
 * Usage in a route handler:
 *   const auth = await isAdmin(request);
 *   if (!auth.authorized) {
 *     return NextResponse.json({ error: auth.error }, { status: auth.status });
 *   }
 *   // auth.userId is available here
 */
export async function isAdmin(_request: NextRequest): Promise<AdminCheckResult> {
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return { authorized: false, error: 'Unauthorized', status: 401 };
  }

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (profileError || !profile) {
    return { authorized: false, error: 'Profile not found', status: 403 };
  }

  if (profile.role !== 'admin') {
    return { authorized: false, error: 'Forbidden', status: 403 };
  }

  return { authorized: true, userId: user.id };
}
