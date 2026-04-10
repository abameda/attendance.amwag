import { timingSafeEqual } from 'node:crypto';
import type { NextRequest } from 'next/server';

import { readSessionCookieFromRequest } from '@/lib/auth/cookies';
import { getSessionByToken } from '@/lib/auth/session';

export interface AdminCheckResult {
  authorized: boolean;
  userId?: string;
  role?: 'admin' | 'accountant' | 'employee';
  error?: string;
  status?: number;
}

export interface InternalAuthResult {
  authorized: boolean;
  error?: string;
  status?: number;
}

/**
 * Returns `{ authorized: true, userId, role }` when the request has a valid
 * session cookie AND the session's user has role === 'admin'. Call sites can
 * treat the returned `status` as the HTTP status to return on failure.
 */
export async function isAdmin(request: NextRequest): Promise<AdminCheckResult> {
  const token = readSessionCookieFromRequest(request);
  if (!token) {
    return { authorized: false, error: 'Unauthorized', status: 401 };
  }

  const result = await getSessionByToken(token);
  if (!result) {
    return { authorized: false, error: 'Unauthorized', status: 401 };
  }

  if (result.user.role !== 'admin') {
    return { authorized: false, error: 'Forbidden', status: 403 };
  }

  return { authorized: true, userId: result.user.id, role: result.user.role };
}

/**
 * Variant for routes that should allow `admin` OR `accountant`. Used by the
 * attendance-viewing endpoints.
 */
export async function isAdminOrAccountant(request: NextRequest): Promise<AdminCheckResult> {
  const token = readSessionCookieFromRequest(request);
  if (!token) {
    return { authorized: false, error: 'Unauthorized', status: 401 };
  }

  const result = await getSessionByToken(token);
  if (!result) {
    return { authorized: false, error: 'Unauthorized', status: 401 };
  }

  if (result.user.role !== 'admin' && result.user.role !== 'accountant') {
    return { authorized: false, error: 'Forbidden', status: 403 };
  }

  return { authorized: true, userId: result.user.id, role: result.user.role };
}

/**
 * Retrieves the current logged-in user for employee-facing routes. Returns
 * null when unauthenticated. Caller decides the HTTP response.
 */
export async function getCurrentUser(request: NextRequest) {
  const token = readSessionCookieFromRequest(request);
  if (!token) {
    return null;
  }

  const result = await getSessionByToken(token);
  return result?.user ?? null;
}

export function authorizeInternalScheduler(request: NextRequest): InternalAuthResult {
  const expectedToken = process.env.INTERNAL_SCHEDULER_SECRET;
  if (!expectedToken) {
    return {
      authorized: false,
      error: 'Internal scheduler secret is not configured',
      status: 500,
    };
  }

  const authorizationHeader = request.headers.get('authorization')?.trim();
  if (!authorizationHeader?.startsWith('Bearer ')) {
    return { authorized: false, error: 'Unauthorized', status: 401 };
  }

  const providedToken = authorizationHeader.slice('Bearer '.length);
  const expectedBuffer = Buffer.from(expectedToken);
  const providedBuffer = Buffer.from(providedToken);

  if (
    expectedBuffer.length !== providedBuffer.length ||
    !timingSafeEqual(expectedBuffer, providedBuffer)
  ) {
    return { authorized: false, error: 'Forbidden', status: 403 };
  }

  return { authorized: true };
}
