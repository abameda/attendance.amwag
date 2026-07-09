import { NextResponse, type NextRequest } from 'next/server';
import createMiddleware from 'next-intl/middleware';

import { assertValidProductionRuntimeEnvironment, getAppUrl } from '@/lib/env';

assertValidProductionRuntimeEnvironment();

const intlMiddleware = createMiddleware({
  locales: ['en', 'ar'],
  defaultLocale: 'ar',
  localePrefix: 'always',
});

const SESSION_COOKIE_NAME = process.env.SESSION_COOKIE_NAME ?? 'amwag_session';

type MiddlewareUser = {
  role: 'admin' | 'accountant' | 'employee';
  must_change_password: boolean;
};

function getMiddlewareAuthUrl(request: NextRequest) {
  return new URL('/api/auth/me', getAppUrl(process.env, request.url));
}

async function fetchMiddlewareUser(request: NextRequest): Promise<MiddlewareUser | null> {
  const cookieHeader = request.headers.get('cookie');
  if (!cookieHeader) {
    return null;
  }

  try {
    const response = await fetch(getMiddlewareAuthUrl(request), {
      headers: { cookie: cookieHeader },
    });

    if (!response.ok) {
      return null;
    }

    const result = await response.json();
    return result.success ? (result.data as MiddlewareUser) : null;
  } catch (error) {
    console.error('middleware auth lookup failed:', error);
    return null;
  }
}

export async function middleware(request: NextRequest) {
  const response = intlMiddleware(request);

  const pathname = request.nextUrl.pathname;
  const localeMatch = pathname.match(/^\/(en|ar)(\/|$)/);
  const locale = localeMatch ? localeMatch[1] : 'ar';
  const pathWithoutLocale = pathname.replace(/^\/(en|ar)/, '') || '/';

  const publicRoutes = ['/login'];
  const isPublicRoute = publicRoutes.some((route) => pathWithoutLocale.startsWith(route));

  const hasSessionCookie = Boolean(request.cookies.get(SESSION_COOKIE_NAME)?.value);
  const user = hasSessionCookie ? await fetchMiddlewareUser(request) : null;

  if (!user && !isPublicRoute) {
    const url = request.nextUrl.clone();
    url.pathname = `/${locale}/login`;
    return NextResponse.redirect(url);
  }

  if (user) {
    const role = user.role;

    const needsChange = user.must_change_password;
    const isChangePasswordRoute = pathWithoutLocale === '/change-password';

    if (needsChange && !isChangePasswordRoute) {
      const url = request.nextUrl.clone();
      url.pathname = `/${locale}/change-password`;
      return NextResponse.redirect(url);
    }

    if (pathWithoutLocale === '/login') {
      const url = request.nextUrl.clone();

      if (role === 'admin') {
        url.pathname = `/${locale}/admin`;
      } else if (role === 'accountant') {
        url.pathname = `/${locale}/admin/attendance`;
      } else {
        url.pathname = `/${locale}/employee`;
      }

      return NextResponse.redirect(url);
    }

    if (role === 'accountant') {
      if (
        pathWithoutLocale.startsWith('/admin') &&
        !pathWithoutLocale.startsWith('/admin/attendance')
      ) {
        const url = request.nextUrl.clone();
        url.pathname = `/${locale}/admin/attendance`;
        return NextResponse.redirect(url);
      }

      if (pathWithoutLocale.startsWith('/employee')) {
        const url = request.nextUrl.clone();
        url.pathname = `/${locale}/admin/attendance`;
        return NextResponse.redirect(url);
      }
    }

    if (pathWithoutLocale.startsWith('/admin') && role !== 'admin' && role !== 'accountant') {
      const url = request.nextUrl.clone();
      url.pathname = `/${locale}/employee`;
      return NextResponse.redirect(url);
    }

    if (pathWithoutLocale.startsWith('/employee') && role === 'admin') {
      const url = request.nextUrl.clone();
      url.pathname = `/${locale}/admin`;
      return NextResponse.redirect(url);
    }
  }

  return response;
}

export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico|auth/callback|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
