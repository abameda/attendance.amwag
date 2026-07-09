import { randomBytes } from 'node:crypto';

import { and, eq, gt, lt, ne } from 'drizzle-orm';

import { db } from '@/lib/db';
import { sessions, users, type Session, type User } from '@/lib/db/schema';
import { getSessionTtlDays } from '@/lib/env';

const SESSION_TTL_DAYS = getSessionTtlDays();

function generateSessionId(): string {
  return randomBytes(48).toString('base64url');
}

function ttlDate(): Date {
  return new Date(Date.now() + SESSION_TTL_DAYS * 24 * 60 * 60 * 1000);
}

export interface SessionWithUser {
  session: Session;
  user: User;
}

export async function createSession(
  userId: string,
  metadata: { userAgent?: string; ipAddress?: string } = {}
): Promise<{ id: string; expiresAt: Date }> {
  const id = generateSessionId();
  const expiresAt = ttlDate();

  await db.insert(sessions).values({
    id,
    userId,
    expiresAt,
    userAgent: metadata.userAgent?.slice(0, 500) ?? null,
    ipAddress: metadata.ipAddress ?? null,
  });

  return { id, expiresAt };
}

export async function getSessionByToken(token: string): Promise<SessionWithUser | null> {
  if (!token) {
    return null;
  }

  const rows = await db
    .select({
      session: sessions,
      user: users,
    })
    .from(sessions)
    .innerJoin(users, eq(sessions.userId, users.id))
    .where(and(eq(sessions.id, token), gt(sessions.expiresAt, new Date())))
    .limit(1);

  return rows[0] ?? null;
}

export async function destroySession(token: string): Promise<void> {
  if (!token) {
    return;
  }

  await db.delete(sessions).where(eq(sessions.id, token));
}

export async function destroyAllUserSessions(userId: string, exceptToken?: string): Promise<void> {
  const predicate = exceptToken
    ? and(eq(sessions.userId, userId), ne(sessions.id, exceptToken))
    : eq(sessions.userId, userId);

  await db.delete(sessions).where(predicate);
}

export async function cleanupExpiredSessions(): Promise<number> {
  const result = await db.delete(sessions).where(lt(sessions.expiresAt, new Date()));

  // mysql2 + drizzle returns [ResultSetHeader, FieldPacket[]]
  const header = Array.isArray(result) ? result[0] : result;
  return (
    (header as unknown as { rowsAffected?: number; affectedRows?: number }).rowsAffected ??
    (header as unknown as { affectedRows?: number }).affectedRows ??
    0
  );
}
