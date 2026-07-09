import assert from 'node:assert/strict';
import test from 'node:test';

import { createLoginHandler } from '../src/app/api/auth/login/handler';
import { createLoginThrottle } from '../src/lib/auth/loginThrottle';

const validUser = {
  id: 'user-1',
  email: 'user@example.com',
  passwordHash: 'hash',
  fullName: 'Test User',
  role: 'employee' as const,
  branch: 'HQ',
  branchId: 'branch-1',
  jobTitle: null,
  shiftStart: '09:00',
  shiftEnd: '17:00',
  offDay: null,
  overtimeEnabled: 1,
  mustChangePassword: 0,
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedAt: new Date('2026-01-01T00:00:00.000Z'),
};

function request(
  body: { email: string; password: string },
  headers: Record<string, string> = { 'x-real-ip': '203.0.113.10' }
) {
  return new Request('http://localhost/api/auth/login', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...headers,
    },
    body: JSON.stringify(body),
  }) as never;
}

function createLoginTestHandler(options: {
  users?: Array<typeof validUser>;
  passwordOk?: (password: string) => boolean;
  nowMs?: () => number;
}) {
  const usersByEmail = new Map((options.users ?? [validUser]).map((user) => [user.email, user]));
  const sessions: string[] = [];
  const audits: unknown[] = [];
  const throttle = createLoginThrottle({ nowMs: options.nowMs });

  const post = createLoginHandler({
    db: {} as never,
    findUserByEmail: async (email) => usersByEmail.get(email) ?? null,
    verifyPassword: async (password) => options.passwordOk?.(password) ?? password === 'correct-password',
    createSession: async (userId) => {
      sessions.push(userId);
      return { id: 'session-1', expiresAt: new Date('2026-01-02T00:00:00.000Z') };
    },
    setSessionCookie: async () => {},
    throttle,
    auditLoginSecurityEvent: (event) => audits.push(event),
  });

  return { post, sessions, audits };
}

test('POST /api/auth/login still creates a session for valid credentials', async () => {
  const { post, sessions } = createLoginTestHandler({});

  const response = await post(request({ email: ' USER@example.COM ', password: 'correct-password' }));
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.success, true);
  assert.deepEqual(body.data, {
    role: 'employee',
    mustChangePassword: false,
  });
  assert.deepEqual(sessions, ['user-1']);
});

test('POST /api/auth/login returns a generic 401 for invalid credentials', async () => {
  const { post } = createLoginTestHandler({ passwordOk: () => false });

  const response = await post(request({ email: 'missing@example.com', password: 'wrong-password' }));
  const body = await response.json();

  assert.equal(response.status, 401);
  assert.deepEqual(body, {
    success: false,
    error: 'Invalid email or password',
  });
});

test('POST /api/auth/login returns 429 after repeated failed attempts', async () => {
  const { post, audits } = createLoginTestHandler({ passwordOk: () => false });

  for (let index = 0; index < 5; index += 1) {
    const response = await post(request({ email: 'user@example.com', password: 'wrong-password' }));
    assert.equal(response.status, 401);
  }

  const response = await post(request({ email: 'user@example.com', password: 'wrong-password' }));
  const body = await response.json();

  assert.equal(response.status, 429);
  assert.deepEqual(body, {
    success: false,
    error: 'Too many login attempts. Please try again later.',
  });
  assert.ok(audits.some((event) => JSON.stringify(event).includes('login_throttled')));
});

test('POST /api/auth/login throttles by both client IP and normalized email', async () => {
  const { post } = createLoginTestHandler({ passwordOk: () => false });

  for (let index = 0; index < 5; index += 1) {
    const response = await post(
      request(
        { email: 'User@Example.com', password: 'wrong-password' },
        { 'x-real-ip': '203.0.113.10' }
      )
    );
    assert.equal(response.status, 401);
  }

  const sameEmailDifferentIp = await post(
    request(
      { email: ' user@example.com ', password: 'wrong-password' },
      { 'x-real-ip': '203.0.113.11' }
    )
  );
  const differentEmailSameIp = await post(
    request(
      { email: 'other@example.com', password: 'wrong-password' },
      { 'x-real-ip': '203.0.113.10' }
    )
  );
  const differentEmailDifferentIp = await post(
    request(
      { email: 'other@example.com', password: 'wrong-password' },
      { 'x-real-ip': '203.0.113.11' }
    )
  );

  assert.equal(sameEmailDifferentIp.status, 429);
  assert.equal(differentEmailSameIp.status, 429);
  assert.equal(differentEmailDifferentIp.status, 401);
});

test('POST /api/auth/login clears failure state after a successful login', async () => {
  const { post } = createLoginTestHandler({});

  for (let index = 0; index < 4; index += 1) {
    const response = await post(request({ email: 'user@example.com', password: 'wrong-password' }));
    assert.equal(response.status, 401);
  }

  const success = await post(request({ email: 'user@example.com', password: 'correct-password' }));
  assert.equal(success.status, 200);

  for (let index = 0; index < 5; index += 1) {
    const response = await post(request({ email: 'user@example.com', password: 'wrong-password' }));
    assert.equal(response.status, 401);
  }

  const throttled = await post(request({ email: 'user@example.com', password: 'wrong-password' }));
  assert.equal(throttled.status, 429);
});
