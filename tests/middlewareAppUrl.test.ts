import assert from 'node:assert/strict';
import test, { mock } from 'node:test';

import { NextRequest } from 'next/server';

import { middleware } from '../src/middleware';

test('middleware fetches the current user from APP_URL when configured', async () => {
  const originalAppUrl = process.env.APP_URL;
  process.env.APP_URL = 'https://attendance.example.com';

  try {
    let fetchedUrl = '';
    const fetchMock = mock.method(globalThis, 'fetch', async (input: string | URL | Request) => {
      fetchedUrl = input.toString();

      return Response.json({
        success: true,
        data: {
          role: 'employee',
          must_change_password: false,
        },
      });
    });

    await middleware(
      new NextRequest('http://internal-proxy.local/ar/employee', {
        headers: {
          cookie: 'amwag_session=test-session',
        },
      })
    );

    assert.equal(fetchMock.mock.callCount(), 1);
    assert.equal(fetchedUrl, 'https://attendance.example.com/api/auth/me');
  } finally {
    if (originalAppUrl === undefined) {
      delete process.env.APP_URL;
    } else {
      process.env.APP_URL = originalAppUrl;
    }
    mock.restoreAll();
  }
});

test('middleware deduplicates concurrent auth lookups for the same session', async () => {
  let resolveFetch: ((response: Response) => void) | undefined;
  const fetchMock = mock.method(
    globalThis,
    'fetch',
    () => new Promise<Response>((resolve) => { resolveFetch = resolve; })
  );

  try {
    const request = () => new NextRequest('http://localhost/ar/employee', {
      headers: { cookie: 'amwag_session=shared-session' },
    });
    const first = middleware(request());
    const second = middleware(request());

    assert.equal(fetchMock.mock.callCount(), 1);
    resolveFetch?.(Response.json({
      success: true,
      data: { role: 'employee', must_change_password: false },
    }));
    await Promise.all([first, second]);
  } finally {
    mock.restoreAll();
  }
});
