import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import createMiddleware from 'next-intl/middleware';

const intlMiddleware = createMiddleware({
    locales: ['en', 'ar'],
    defaultLocale: 'ar',
    localePrefix: 'always'
});

export async function middleware(request: NextRequest) {
    // 1. Run next-intl middleware first to handle locale routing and redirects
    const response = intlMiddleware(request);

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    // Skip Supabase auth if not configured
    if (!supabaseUrl || !supabaseKey || supabaseUrl === 'your-supabase-project-url') {
        return response;
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
                // Update the response cookies that next-intl prepared
                cookiesToSet.forEach(({ name, value, options }) =>
                    response.cookies.set(name, value, options)
                );
            },
        },
    });

    // Refreshing the auth token
    const {
        data: { user },
    } = await supabase.auth.getUser();

    // Get the locale from the request path (next-intl ensures it's there)
    // path format: /en/..., /ar/... or / (which redirects)
    const pathname = request.nextUrl.pathname;

    // Check if path is just the locale (landing page) or has more segments
    // Matches /en, /ar, /en/..., /ar/...
    const localeMatch = pathname.match(/^\/(en|ar)(\/|$)/);
    const locale = localeMatch ? localeMatch[1] : 'ar';

    // Strip locale to check protected routes simpler
    const pathWithoutLocale = pathname.replace(/^\/(en|ar)/, '') || '/';

    // Public routes that don't require authentication
    // Note: auth callback usually doesn't have locale prefix depending on provider setup, 
    // but better to allow both with and without.
    const publicRoutes = ['/login', '/auth/callback'];
    const isPublicRoute = publicRoutes.some((route) => pathWithoutLocale.startsWith(route));

    // If user is not authenticated and trying to access protected route
    if (!user && !isPublicRoute) {
        const url = request.nextUrl.clone();
        url.pathname = `/${locale}/login`;
        return NextResponse.redirect(url);
    }

    // If user is authenticated and trying to access login page
    if (user && pathWithoutLocale === '/login') {
        // Fetch user profile to determine role
        const { data: profile } = await supabase
            .from('profiles')
            .select('role')
            .eq('id', user.id)
            .single();

        const url = request.nextUrl.clone();
        url.pathname = `/${locale}${profile?.role === 'admin' ? '/admin' : '/employee'}`;
        return NextResponse.redirect(url);
    }

    // Role-based route protection
    if (user) {
        const { data: profile } = await supabase
            .from('profiles')
            .select('role')
            .eq('id', user.id)
            .single();

        // Admin routes protection
        if (pathWithoutLocale.startsWith('/admin') && profile?.role !== 'admin') {
            const url = request.nextUrl.clone();
            url.pathname = `/${locale}/employee`;
            return NextResponse.redirect(url);
        }

        // Employee routes protection
        if (pathWithoutLocale.startsWith('/employee') && profile?.role === 'admin') {
            const url = request.nextUrl.clone();
            url.pathname = `/${locale}/admin`;
            return NextResponse.redirect(url);
        }
    }

    return response;
}

export const config = {
    matcher: [
        /*
         * Match all request paths except for the ones starting with:
         * - _next/static (static files)
         * - _next/image (image optimization files)
         * - favicon.ico (favicon file)
         * - api (API routes)
         * - auth (Auth routes if distinct)
         */
        '/((?!api|_next/static|_next/image|favicon.ico|auth/callback|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
    ],
};
