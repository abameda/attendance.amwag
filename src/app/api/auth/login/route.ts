import { setSessionCookie } from '@/lib/auth/cookies';
import { loginThrottle } from '@/lib/auth/loginThrottle';
import { verifyPassword } from '@/lib/auth/password';
import { createSession } from '@/lib/auth/session';
import { db } from '@/lib/db';

import { createLoginHandler } from './handler';

export const POST = createLoginHandler({
  db,
  verifyPassword,
  createSession,
  setSessionCookie,
  throttle: loginThrottle,
});
