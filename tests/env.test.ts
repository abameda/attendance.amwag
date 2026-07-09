import assert from 'node:assert/strict';
import test from 'node:test';

import {
  BUILD_DATABASE_URL_PLACEHOLDER,
  getDatabaseUrl,
  getSessionTtlDays,
  getTrustXForwardedFor,
  validateEnvironment,
} from '../src/lib/env';

const validProductionEnv = {
  NODE_ENV: 'production',
  DATABASE_URL: 'mysql://amwag:secret@127.0.0.1:3306/amwag_attendance',
  APP_URL: 'https://attendance.example.com',
  INTERNAL_SCHEDULER_SECRET: 'a'.repeat(64),
  BACKUP_ENCRYPTION_KEY: 'b'.repeat(64),
  SESSION_TTL_DAYS: '30',
  TRUST_X_FORWARDED_FOR: 'true',
};

test('validateEnvironment accepts a complete production environment', () => {
  const result = validateEnvironment(validProductionEnv);

  assert.deepEqual(result.errors, []);
});

test('validateEnvironment reports every missing production variable', () => {
  const result = validateEnvironment({ NODE_ENV: 'production' });

  assert.deepEqual(result.errors, [
    'DATABASE_URL is required in production.',
    'APP_URL is required in production.',
    'INTERNAL_SCHEDULER_SECRET is required in production.',
    'BACKUP_ENCRYPTION_KEY is required in production.',
    'SESSION_TTL_DAYS is required in production.',
    'TRUST_X_FORWARDED_FOR is required in production.',
  ]);
});

test('validateEnvironment rejects invalid production values', () => {
  const result = validateEnvironment({
    ...validProductionEnv,
    DATABASE_URL: BUILD_DATABASE_URL_PLACEHOLDER,
    APP_URL: 'ftp://attendance.example.com',
    INTERNAL_SCHEDULER_SECRET: 'not-hex',
    BACKUP_ENCRYPTION_KEY: 'c'.repeat(63),
    SESSION_TTL_DAYS: '0',
    TRUST_X_FORWARDED_FOR: 'yes',
  });

  assert.deepEqual(result.errors, [
    'DATABASE_URL must not use the build placeholder in production.',
    'APP_URL must be a valid http or https URL.',
    'INTERNAL_SCHEDULER_SECRET must be exactly 64 hexadecimal characters.',
    'BACKUP_ENCRYPTION_KEY must be exactly 64 hexadecimal characters.',
    'SESSION_TTL_DAYS must be a positive finite number.',
    'TRUST_X_FORWARDED_FOR must be explicitly "true" or "false".',
  ]);
});

test('validateEnvironment keeps non-production environments practical when optional values are absent', () => {
  const result = validateEnvironment({ NODE_ENV: 'test' });

  assert.deepEqual(result.errors, []);
  assert.deepEqual(result.warnings, []);
});

test('getDatabaseUrl allows the build placeholder outside production runtime only', () => {
  assert.equal(getDatabaseUrl({ NODE_ENV: 'test' }), BUILD_DATABASE_URL_PLACEHOLDER);
  assert.equal(
    getDatabaseUrl({ NODE_ENV: 'production', NEXT_PHASE: 'phase-production-build' }),
    BUILD_DATABASE_URL_PLACEHOLDER
  );

  assert.throws(
    () => getDatabaseUrl({ NODE_ENV: 'production' }),
    /DATABASE_URL is required in production/
  );
  assert.throws(
    () =>
      getDatabaseUrl({
        NODE_ENV: 'production',
        DATABASE_URL: BUILD_DATABASE_URL_PLACEHOLDER,
      }),
    /DATABASE_URL must not use the build placeholder in production/
  );
});

test('environment helpers normalize practical non-production defaults', () => {
  assert.equal(getSessionTtlDays({ NODE_ENV: 'development', SESSION_TTL_DAYS: 'invalid' }), 30);
  assert.equal(getSessionTtlDays({ NODE_ENV: 'production', SESSION_TTL_DAYS: '7' }), 7);
  assert.equal(getTrustXForwardedFor({ NODE_ENV: 'development' }), false);
  assert.equal(getTrustXForwardedFor({ NODE_ENV: 'production', TRUST_X_FORWARDED_FOR: 'true' }), true);
});
