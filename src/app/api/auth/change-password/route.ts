import { eq } from 'drizzle-orm';
import { NextRequest, NextResponse } from 'next/server';

import { readSessionCookie } from '@/lib/auth/cookies';
import { hashPassword, verifyPassword } from '@/lib/auth/password';
import { destroyAllUserSessions, getSessionByToken } from '@/lib/auth/session';
import { db } from '@/lib/db';
import { users } from '@/lib/db/schema';

export async function POST(request: NextRequest) {
  try {
    const token = await readSessionCookie();

    if (!token) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const sessionData = await getSessionByToken(token);

    if (!sessionData) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json().catch(() => null);
    const currentPassword = body?.currentPassword;
    const newPassword = body?.newPassword;

    if (typeof currentPassword !== 'string' || typeof newPassword !== 'string') {
      return NextResponse.json({ success: false, error: 'Invalid request' }, { status: 400 });
    }

    if (newPassword.length < 8) {
      return NextResponse.json(
        { success: false, error: 'New password must be at least 8 characters' },
        { status: 400 }
      );
    }

    const ok = await verifyPassword(currentPassword, sessionData.user.passwordHash);

    if (!ok) {
      return NextResponse.json(
        { success: false, error: 'Current password is incorrect' },
        { status: 400 }
      );
    }

    const newHash = await hashPassword(newPassword);

    await db
      .update(users)
      .set({ passwordHash: newHash, mustChangePassword: 0, updatedAt: new Date() })
      .where(eq(users.id, sessionData.user.id));

    await destroyAllUserSessions(sessionData.user.id, token);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Change-password error:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
