import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
export function authEnvironment(env: Record<string, unknown>) {
  const integer = (
    key: string,
    fallback: number,
    min = 1,
    max = 2147483647,
  ) => {
    const value = env[key] ?? fallback;
    if (
      !/^\d+$/.test(String(value)) ||
      Number(value) < min ||
      Number(value) > max
    )
      throw new Error('Invalid ' + key);
    return Number(value);
  };
  const secret = env.CSRF_SECRET;
  if (typeof secret !== 'string' || secret.length < 32)
    throw new Error('CSRF_SECRET must contain at least 32 characters');
  const name = env.SESSION_COOKIE_NAME ?? 'sid';
  if (
    typeof name !== 'string' ||
    !/^[A-Za-z0-9_-]{1,40}$/.test(name) ||
    name.startsWith('__Host-')
  )
    throw new Error('Invalid SESSION_COOKIE_NAME (use unprefixed name)');
  if (typeof env.ALLOWED_ORIGINS !== 'string' || !env.ALLOWED_ORIGINS.trim())
    throw new Error('ALLOWED_ORIGINS is required');
  const origins = env.ALLOWED_ORIGINS.split(',').map((v) => v.trim());
  for (const origin of origins) {
    let url: URL;
    try {
      url = new URL(origin);
    } catch {
      throw new Error('Invalid ALLOWED_ORIGINS');
    }
    if (
      !['http:', 'https:'].includes(url.protocol) ||
      url.origin !== origin ||
      url.username ||
      url.password ||
      (env.NODE_ENV === 'production' && url.protocol !== 'https:')
    )
      throw new Error(
        'ALLOWED_ORIGINS must contain exact HTTP(S) origins (HTTPS in production)',
      );
  }
  const proxy = String(env.TRUST_PROXY ?? 'false');
  if (!['true', 'false'].includes(proxy) && !/^\d{1,2}$/.test(proxy))
    throw new Error('Invalid TRUST_PROXY');
  const idle = integer('SESSION_IDLE_TIMEOUT_MINUTES', 30, 1, 1440);
  const absolute = integer('SESSION_ABSOLUTE_TIMEOUT_HOURS', 8, 1, 720);
  const touch = integer('SESSION_TOUCH_INTERVAL_SECONDS', 60, 1, 3600);
  if (idle > absolute * 60 || touch >= idle * 60)
    throw new Error('Invalid session timeout relationship');
  return {
    SESSION_COOKIE_NAME: name,
    CSRF_SECRET: secret,
    ALLOWED_ORIGINS: origins.join(','),
    TRUST_PROXY:
      proxy === 'true' ? true : proxy === 'false' ? false : Number(proxy),
    SESSION_IDLE_TIMEOUT_MINUTES: idle,
    SESSION_ABSOLUTE_TIMEOUT_HOURS: absolute,
    SESSION_TOUCH_INTERVAL_SECONDS: touch,
    LOGIN_MAX_FAILURES: integer('LOGIN_MAX_FAILURES', 5, 1, 100),
    LOGIN_LOCKOUT_MINUTES: integer('LOGIN_LOCKOUT_MINUTES', 15, 1, 1440),
    PASSWORD_MIN_LENGTH: integer('PASSWORD_MIN_LENGTH', 12, 12, 128),
    ARGON2_MEMORY_KIB: integer('ARGON2_MEMORY_KIB', 19456, 19456, 262144),
    ARGON2_TIME_COST: integer('ARGON2_TIME_COST', 2, 2, 10),
    ARGON2_PARALLELISM: integer('ARGON2_PARALLELISM', 1, 1, 8),
    SESSION_RETENTION_DAYS: integer('SESSION_RETENTION_DAYS', 7, 1, 3650),
    LOGIN_ATTEMPT_RETENTION_DAYS: integer(
      'LOGIN_ATTEMPT_RETENTION_DAYS',
      90,
      1,
      3650,
    ),
    LOGIN_RATE_WINDOW_SECONDS: integer(
      'LOGIN_RATE_WINDOW_SECONDS',
      60,
      1,
      3600,
    ),
    LOGIN_IP_LIMIT: integer('LOGIN_IP_LIMIT', 60, 1, 10000),
    LOGIN_USERNAME_LIMIT: integer('LOGIN_USERNAME_LIMIT', 20, 1, 1000),
  };
}
@Injectable()
export class AuthConfig {
  readonly values: ReturnType<typeof authEnvironment>;
  readonly production: boolean;
  constructor(config: ConfigService) {
    const keys = [
      'SESSION_COOKIE_NAME',
      'CSRF_SECRET',
      'ALLOWED_ORIGINS',
      'TRUST_PROXY',
      'SESSION_IDLE_TIMEOUT_MINUTES',
      'SESSION_ABSOLUTE_TIMEOUT_HOURS',
      'SESSION_TOUCH_INTERVAL_SECONDS',
      'LOGIN_MAX_FAILURES',
      'LOGIN_LOCKOUT_MINUTES',
      'PASSWORD_MIN_LENGTH',
      'ARGON2_MEMORY_KIB',
      'ARGON2_TIME_COST',
      'ARGON2_PARALLELISM',
      'SESSION_RETENTION_DAYS',
      'LOGIN_ATTEMPT_RETENTION_DAYS',
      'LOGIN_RATE_WINDOW_SECONDS',
      'LOGIN_IP_LIMIT',
      'LOGIN_USERNAME_LIMIT',
      'NODE_ENV',
    ];
    this.values = authEnvironment(
      Object.fromEntries(keys.map((k) => [k, config.get(k)])),
    );
    this.production = config.get('NODE_ENV') === 'production';
  }
  get cookieName() {
    return (this.production ? '__Host-' : '') + this.values.SESSION_COOKIE_NAME;
  }
}
