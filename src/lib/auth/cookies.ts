import { cookies } from 'next/headers';
import type { NextRequest, NextResponse } from 'next/server';

const COOKIE_NAME = process.env.SESSION_COOKIE_NAME ?? 'amwag_session';

const BASE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path: '/',
};

export function cookieName(): string {
  return COOKIE_NAME;
}

export async function setSessionCookie(token: string, expiresAt: Date): Promise<void> {
  const store = await cookies();

  store.set(COOKIE_NAME, token, {
    ...BASE_OPTIONS,
    expires: expiresAt,
  });
}

export async function clearSessionCookie(): Promise<void> {
  const store = await cookies();

  store.set(COOKIE_NAME, '', {
    ...BASE_OPTIONS,
    expires: new Date(0),
  });
}

export async function readSessionCookie(): Promise<string | null> {
  const store = await cookies();

  return store.get(COOKIE_NAME)?.value ?? null;
}

export function readSessionCookieFromRequest(request: NextRequest): string | null {
  return request.cookies.get(COOKIE_NAME)?.value ?? null;
}

export function setSessionCookieOnResponse(
  response: NextResponse,
  token: string,
  expiresAt: Date
): void {
  response.cookies.set(COOKIE_NAME, token, {
    ...BASE_OPTIONS,
    expires: expiresAt,
  });
}

export function clearSessionCookieOnResponse(response: NextResponse): void {
  response.cookies.set(COOKIE_NAME, '', {
    ...BASE_OPTIONS,
    expires: new Date(0),
  });
}
