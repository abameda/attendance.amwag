import { eq } from 'drizzle-orm';
import { NextRequest, NextResponse } from 'next/server';

import { setSessionCookie } from '@/lib/auth/cookies';
import { verifyPassword } from '@/lib/auth/password';
import { createSession } from '@/lib/auth/session';
import { db } from '@/lib/db';
import { users } from '@/lib/db/schema';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null);

    if (!body || typeof body.email !== 'string' || typeof body.password !== 'string') {
      return NextResponse.json({ success: false, error: 'Invalid request' }, { status: 400 });
    }

    const email = body.email.trim().toLowerCase();
    const password = body.password;

    const found = await db.select().from(users).where(eq(users.email, email)).limit(1);
    const user = found[0];

    const fail = () =>
      NextResponse.json(
        { success: false, error: 'Invalid email or password' },
        { status: 401 }
      );

    if (!user) {
      return fail();
    }

    const ok = await verifyPassword(password, user.passwordHash);
    if (!ok) {
      return fail();
    }

    const userAgent = request.headers.get('user-agent') ?? undefined;
    const ipAddress =
      request.headers.get('x-real-ip') ??
      request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
      undefined;

    const { id, expiresAt } = await createSession(user.id, { userAgent, ipAddress });
    await setSessionCookie(id, expiresAt);

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
}
