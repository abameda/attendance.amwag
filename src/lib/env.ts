const DEFAULT_SESSION_TTL_DAYS = 30;
const HEX_64_PATTERN = /^[a-f0-9]{64}$/i;

export const BUILD_DATABASE_URL_PLACEHOLDER =
  'mysql://build:build@127.0.0.1:1/build_placeholder';

type Env = Record<string, string | undefined>;

export interface EnvironmentValidationResult {
  errors: string[];
  warnings: string[];
}

const REQUIRED_PRODUCTION_ENV = [
  'DATABASE_URL',
  'APP_URL',
  'INTERNAL_SCHEDULER_SECRET',
  'BACKUP_ENCRYPTION_KEY',
  'SESSION_TTL_DAYS',
  'TRUST_X_FORWARDED_FOR',
] as const;

function valueOf(env: Env, key: string) {
  return env[key]?.trim() ?? '';
}

function isProduction(env: Env) {
  return env.NODE_ENV === 'production';
}

function isProductionBuild(env: Env) {
  return env.NEXT_PHASE === 'phase-production-build';
}

function isProductionRuntime(env: Env) {
  return isProduction(env) && !isProductionBuild(env);
}

function isHttpUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

function parsePositiveFiniteNumber(value: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function validateProductionValues(env: Env) {
  const errors: string[] = [];
  const warnings: string[] = [];

  for (const key of REQUIRED_PRODUCTION_ENV) {
    if (!valueOf(env, key)) {
      errors.push(`${key} is required in production.`);
    }
  }

  const databaseUrl = valueOf(env, 'DATABASE_URL');
  if (databaseUrl === BUILD_DATABASE_URL_PLACEHOLDER) {
    errors.push('DATABASE_URL must not use the build placeholder in production.');
  }

  const appUrl = valueOf(env, 'APP_URL');
  if (appUrl) {
    if (!isHttpUrl(appUrl)) {
      errors.push('APP_URL must be a valid http or https URL.');
    } else if (new URL(appUrl).protocol !== 'https:') {
      warnings.push('APP_URL should use https in production.');
    }
  }

  const schedulerSecret = valueOf(env, 'INTERNAL_SCHEDULER_SECRET');
  if (schedulerSecret && !HEX_64_PATTERN.test(schedulerSecret)) {
    errors.push('INTERNAL_SCHEDULER_SECRET must be exactly 64 hexadecimal characters.');
  }

  const backupEncryptionKey = valueOf(env, 'BACKUP_ENCRYPTION_KEY');
  if (backupEncryptionKey && !HEX_64_PATTERN.test(backupEncryptionKey)) {
    errors.push('BACKUP_ENCRYPTION_KEY must be exactly 64 hexadecimal characters.');
  }

  const sessionTtlDays = valueOf(env, 'SESSION_TTL_DAYS');
  if (sessionTtlDays && parsePositiveFiniteNumber(sessionTtlDays) === null) {
    errors.push('SESSION_TTL_DAYS must be a positive finite number.');
  }

  const trustXForwardedFor = valueOf(env, 'TRUST_X_FORWARDED_FOR');
  if (
    trustXForwardedFor &&
    trustXForwardedFor !== 'true' &&
    trustXForwardedFor !== 'false'
  ) {
    errors.push('TRUST_X_FORWARDED_FOR must be explicitly "true" or "false".');
  }

  return { errors, warnings };
}

export function validateEnvironment(env: Env = process.env): EnvironmentValidationResult {
  if (!isProduction(env)) {
    return { errors: [], warnings: [] };
  }

  return validateProductionValues(env);
}

export function assertValidProductionRuntimeEnvironment(env: Env = process.env): void {
  if (!isProductionRuntime(env)) {
    return;
  }

  const { errors } = validateProductionValues(env);
  if (errors.length > 0) {
    throw new Error(`Invalid production environment:\n- ${errors.join('\n- ')}`);
  }
}

export function getDatabaseUrl(env: Env = process.env): string {
  const databaseUrl = valueOf(env, 'DATABASE_URL');

  if (!databaseUrl) {
    if (isProductionRuntime(env)) {
      throw new Error('DATABASE_URL is required in production.');
    }

    return BUILD_DATABASE_URL_PLACEHOLDER;
  }

  if (databaseUrl === BUILD_DATABASE_URL_PLACEHOLDER && isProductionRuntime(env)) {
    throw new Error('DATABASE_URL must not use the build placeholder in production.');
  }

  return databaseUrl;
}

export function getAppUrl(env: Env = process.env, fallback?: string): string {
  const appUrl = valueOf(env, 'APP_URL');

  if (!appUrl) {
    if (isProductionRuntime(env)) {
      throw new Error('APP_URL is required in production.');
    }

    return fallback ?? 'http://localhost:3000';
  }

  if (!isHttpUrl(appUrl)) {
    throw new Error('APP_URL must be a valid http or https URL.');
  }

  return appUrl;
}

export function getSessionTtlDays(env: Env = process.env): number {
  const sessionTtlDays = valueOf(env, 'SESSION_TTL_DAYS');
  const parsed = sessionTtlDays ? parsePositiveFiniteNumber(sessionTtlDays) : null;

  if (parsed !== null) {
    return parsed;
  }

  if (isProductionRuntime(env)) {
    throw new Error('SESSION_TTL_DAYS must be a positive finite number.');
  }

  return DEFAULT_SESSION_TTL_DAYS;
}

export function getTrustXForwardedFor(env: Env = process.env): boolean {
  const trustXForwardedFor = valueOf(env, 'TRUST_X_FORWARDED_FOR');

  if (trustXForwardedFor === 'true') {
    return true;
  }

  if (trustXForwardedFor === 'false' || !trustXForwardedFor) {
    if (!trustXForwardedFor && isProductionRuntime(env)) {
      throw new Error('TRUST_X_FORWARDED_FOR is required in production.');
    }

    return false;
  }

  if (isProductionRuntime(env)) {
    throw new Error('TRUST_X_FORWARDED_FOR must be explicitly "true" or "false".');
  }

  return false;
}
