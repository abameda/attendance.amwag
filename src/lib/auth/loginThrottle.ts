import { createHash } from 'node:crypto';

const DEFAULT_MAX_FAILED_ATTEMPTS = 5;
const DEFAULT_COOLDOWN_MS = 15 * 60 * 1000;
const DEFAULT_PRUNE_AFTER_MS = 60 * 60 * 1000;

type LoginThrottleKey = {
  email: string;
  ipAddress?: string;
};

type LoginThrottleRecord = {
  failedAttempts: number;
  lockedUntilMs: number;
  lastFailureMs: number;
};

export type LoginSecurityEvent =
  | {
      type: 'login_repeated_failure';
      emailHash: string;
      ipHash: string;
      failureCount: number;
    }
  | {
      type: 'login_throttled';
      emailHash: string;
      ipHash: string;
      retryAfterSeconds: number;
    };

export type LoginThrottleDecision = {
  throttled: boolean;
  retryAfterSeconds?: number;
};

export type LoginThrottle = ReturnType<typeof createLoginThrottle>;

export function hashLoginAuditValue(value: string): string {
  return createHash('sha256').update(value).digest('hex').slice(0, 16);
}

function auditKeyParts(key: LoginThrottleKey) {
  return {
    emailHash: hashLoginAuditValue(key.email),
    ipHash: hashLoginAuditValue(key.ipAddress ?? 'unknown'),
  };
}

function bucketKeys(key: LoginThrottleKey): string[] {
  return [`email:${key.email}`, `ip:${key.ipAddress ?? 'unknown'}`];
}

function retryAfterSeconds(untilMs: number, nowMs: number): number {
  return Math.max(1, Math.ceil((untilMs - nowMs) / 1000));
}

/**
 * Process-local login throttle storage.
 *
 * This intentionally avoids a migration for Task 2C. It is a temporary guard:
 * it does not share state across PM2 cluster workers or multiple app instances,
 * and all counters reset on process restart. A DB/Redis-backed store should
 * replace it before horizontally scaling login traffic.
 */
export function createLoginThrottle(
  options: {
    maxFailedAttempts?: number;
    cooldownMs?: number;
    pruneAfterMs?: number;
    nowMs?: () => number;
  } = {}
) {
  const maxFailedAttempts = options.maxFailedAttempts ?? DEFAULT_MAX_FAILED_ATTEMPTS;
  const cooldownMs = options.cooldownMs ?? DEFAULT_COOLDOWN_MS;
  const pruneAfterMs = options.pruneAfterMs ?? DEFAULT_PRUNE_AFTER_MS;
  const nowMs = options.nowMs ?? Date.now;
  const attempts = new Map<string, LoginThrottleRecord>();

  function prune(now: number) {
    for (const [key, record] of attempts) {
      if (record.lockedUntilMs <= now && record.lastFailureMs + pruneAfterMs <= now) {
        attempts.delete(key);
      }
    }
  }

  return {
    check(key: LoginThrottleKey): LoginThrottleDecision {
      const now = nowMs();
      prune(now);

      let retryAfter = 0;
      for (const bucketKey of bucketKeys(key)) {
        const record = attempts.get(bucketKey);
        if (record && record.lockedUntilMs > now) {
          retryAfter = Math.max(retryAfter, retryAfterSeconds(record.lockedUntilMs, now));
        }
      }

      return retryAfter > 0
        ? { throttled: true, retryAfterSeconds: retryAfter }
        : { throttled: false };
    },

    recordFailure(key: LoginThrottleKey): LoginSecurityEvent | null {
      const now = nowMs();
      prune(now);

      let highestFailureCount = 0;
      for (const bucketKey of bucketKeys(key)) {
        const current = attempts.get(bucketKey);
        const failedAttempts = (current?.failedAttempts ?? 0) + 1;
        const lockedUntilMs =
          failedAttempts >= maxFailedAttempts ? now + cooldownMs : current?.lockedUntilMs ?? 0;

        attempts.set(bucketKey, {
          failedAttempts,
          lockedUntilMs,
          lastFailureMs: now,
        });
        highestFailureCount = Math.max(highestFailureCount, failedAttempts);
      }

      if (highestFailureCount >= Math.max(3, maxFailedAttempts - 1)) {
        return {
          type: 'login_repeated_failure',
          ...auditKeyParts(key),
          failureCount: highestFailureCount,
        };
      }

      return null;
    },

    recordSuccess(key: LoginThrottleKey): void {
      for (const bucketKey of bucketKeys(key)) {
        attempts.delete(bucketKey);
      }
    },
  };
}

export const loginThrottle = createLoginThrottle();
