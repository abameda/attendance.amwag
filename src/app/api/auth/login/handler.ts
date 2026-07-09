import { eq } from 'drizzle-orm';
import { NextRequest, NextResponse } from 'next/server';

import {
  hashLoginAuditValue,
  type LoginSecurityEvent,
  type LoginThrottle,
} from '@/lib/auth/loginThrottle';
import { db } from '@/lib/db';
import { users, type User } from '@/lib/db/schema';

const INVALID_LOGIN_RESPONSE = { success: false, error: 'Invalid email or password' };
const THROTTLED_LOGIN_RESPONSE = {
  success: false,
  error: 'Too many login attempts. Please try again later.',
};

type LoginHandlerDependencies = {
  db: Pick<typeof db, 'select'>;
  findUserByEmail?: (email: string) => Promise<User | null>;
  verifyPassword: (plain: string, hash: string) => Promise<boolean>;
  createSession: (
    userId: string,
    metadata?: { userAgent?: string; ipAddress?: string }
  ) => Promise<{ id: string; expiresAt: Date }>;
  setSessionCookie: (token: string, expiresAt: Date) => Promise<void>;
  throttle: LoginThrottle;
  auditLoginSecurityEvent?: (event: LoginSecurityEvent) => void;
};

function getClientIp(request: NextRequest): string | undefined {
  return (
    request.headers.get('x-real-ip') ??
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    undefined
  );
}

function fail() {
  return NextResponse.json(INVALID_LOGIN_RESPONSE, { status: 401 });
}

function throttleResponse(retryAfterSeconds: number) {
  return NextResponse.json(THROTTLED_LOGIN_RESPONSE, {
    status: 429,
    headers: {
      'Retry-After': String(retryAfterSeconds),
    },
  });
}

function defaultAuditLoginSecurityEvent(event: LoginSecurityEvent) {
  console.warn('Login security event', event);
}

async function findUserByEmail(
  database: LoginHandlerDependencies['db'],
  email: string
): Promise<User | null> {
  const found = await database.select().from(users).where(eq(users.email, email)).limit(1);
  return found[0] ?? null;
}

export function createLoginHandler(dependencies: LoginHandlerDependencies) {
  return async function POST(request: NextRequest) {
    try {
      const body = await request.json().catch(() => null);

      if (!body || typeof body.email !== 'string' || typeof body.password !== 'string') {
        return NextResponse.json({ success: false, error: 'Invalid request' }, { status: 400 });
      }

      const email = body.email.trim().toLowerCase();
      const password = body.password;
      const ipAddress = getClientIp(request);
      const throttleKey = { email, ipAddress };
      const auditLoginSecurityEvent =
        dependencies.auditLoginSecurityEvent ?? defaultAuditLoginSecurityEvent;

      const throttleDecision = dependencies.throttle.check(throttleKey);
      if (throttleDecision.throttled) {
        auditLoginSecurityEvent({
          type: 'login_throttled',
          emailHash: hashLoginAuditValue(email),
          ipHash: hashLoginAuditValue(ipAddress ?? 'unknown'),
          retryAfterSeconds: throttleDecision.retryAfterSeconds ?? 1,
        });
        return throttleResponse(throttleDecision.retryAfterSeconds ?? 1);
      }

      const user = dependencies.findUserByEmail
        ? await dependencies.findUserByEmail(email)
        : await findUserByEmail(dependencies.db, email);
      if (!user) {
        const event = dependencies.throttle.recordFailure(throttleKey);
        if (event) {
          auditLoginSecurityEvent(event);
        }
        return fail();
      }

      const ok = await dependencies.verifyPassword(password, user.passwordHash);
      if (!ok) {
        const event = dependencies.throttle.recordFailure(throttleKey);
        if (event) {
          auditLoginSecurityEvent(event);
        }
        return fail();
      }

      const userAgent = request.headers.get('user-agent') ?? undefined;

      const { id, expiresAt } = await dependencies.createSession(user.id, { userAgent, ipAddress });
      await dependencies.setSessionCookie(id, expiresAt);
      dependencies.throttle.recordSuccess(throttleKey);

      return NextResponse.json({
        success: true,
        data: {
          role: user.role,
          mustChangePassword: user.mustChangePassword === 1,
        },
      });
    } catch (error) {
      console.error('Login error:', error);
      return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
    }
  };
}
