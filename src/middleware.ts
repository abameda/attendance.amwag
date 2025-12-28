import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
    let supabaseResponse = NextResponse.next({
        request,
    });

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    // Skip middleware if Supabase is not configured
    if (!supabaseUrl || !supabaseKey || supabaseUrl === 'your-supabase-project-url') {
        return supabaseResponse;
    }

    const supabase = createServerClient(supabaseUrl, supabaseKey, {
        cookies: {
            getAll() {
                return request.cookies.getAll();
            },
            setAll(cookiesToSet) {
                cookiesToSet.forEach(({ name, value }) =>
                    request.cookies.set(name, value)
                );
                supabaseResponse = NextResponse.next({
                    request,
                });
                cookiesToSet.forEach(({ name, value, options }) =>
                    supabaseResponse.cookies.set(name, value, options)
                );
            },
        },
    });

    // Refreshing the auth token
    const {
        data: { user },
    } = await supabase.auth.getUser();

    const { pathname } = request.nextUrl;

    // Public routes that don't require authentication
    const publicRoutes = ['/login', '/auth/callback'];
    const isPublicRoute = publicRoutes.some((route) => pathname.startsWith(route));

    // If user is not authenticated and trying to access protected route
    if (!user && !isPublicRoute) {
        const url = request.nextUrl.clone();
        url.pathname = '/login';
        return NextResponse.redirect(url);
    }

    // If user is authenticated and trying to access login page
    if (user && pathname === '/login') {
        // Fetch user profile to determine role
        const { data: profile, error } = await supabase
            .from('profiles')
            .select('role')
            .eq('id', user.id)
            .single();

        console.log('[Middleware] Login redirect - Profile:', profile, 'Error:', error);

        const url = request.nextUrl.clone();
        url.pathname = profile?.role === 'admin' ? '/admin' : '/employee';
        return NextResponse.redirect(url);
    }

    // Role-based route protection
    if (user) {
        const { data: profile, error } = await supabase
            .from('profiles')
            .select('role')
            .eq('id', user.id)
            .single();

        console.log('[Middleware] Route protection - User:', user.email, 'Profile:', profile, 'Error:', error);

        // Admin routes protection
        if (pathname.startsWith('/admin') && profile?.role !== 'admin') {
            console.log('[Middleware] Redirecting non-admin from /admin to /employee');
            const url = request.nextUrl.clone();
            url.pathname = '/employee';
            return NextResponse.redirect(url);
        }

        // Employee routes protection
        if (pathname.startsWith('/employee') && profile?.role === 'admin') {
            console.log('[Middleware] Redirecting admin from /employee to /admin');
            const url = request.nextUrl.clone();
            url.pathname = '/admin';
            return NextResponse.redirect(url);
        }
    }

    return supabaseResponse;
}

export const config = {
    matcher: [
        /*
         * Match all request paths except for the ones starting with:
         * - _next/static (static files)
         * - _next/image (image optimization files)
         * - favicon.ico (favicon file)
         * - public folder
         */
        '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
    ],
};
