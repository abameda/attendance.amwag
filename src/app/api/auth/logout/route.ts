import { NextResponse } from 'next/server';

import { clearSessionCookie, readSessionCookie } from '@/lib/auth/cookies';
import { destroySession } from '@/lib/auth/session';

export async function POST() {
  const token = await readSessionCookie();

  if (token) {
    await destroySession(token);
  }

  await clearSessionCookie();

  return NextResponse.json({ success: true });
}
