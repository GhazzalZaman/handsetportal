jest.mock('argon2', () => {
  const actual = jest.requireActual<typeof import('argon2')>('argon2');
  return { ...actual, verify: jest.fn(actual.verify) };
});
import { ConfigService } from '@nestjs/config';
import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthConfig, authEnvironment } from './auth.config';
import {
  newSessionId,
  sessionHash,
  validSessionId,
  csrfToken,
  validCsrf,
} from './crypto';
import { passwordAllowed, PasswordService } from './password.service';
import { allowedOrigin, PermissionsGuard } from './auth.guards';
import { SessionCookie } from '../sessions/session-cookie.service';
import { Response } from 'express';
import * as argon from 'argon2';
const env = {
  CSRF_SECRET: 'test-only-secret-at-least-32-characters',
  ALLOWED_ORIGINS: 'http://localhost:3000',
};
describe('authentication security primitives', () => {
  it('generates canonical 256-bit IDs and stores only SHA-256 hex', () => {
    const a = newSessionId(),
      b = newSessionId();
    expect(a).not.toBe(b);
    expect(Buffer.from(a, 'base64url')).toHaveLength(32);
    expect(validSessionId(a)).toBe(true);
    expect(sessionHash(a)).toMatch(/^[a-f0-9]{64}$/);
    expect(sessionHash(a)).not.toBe(a);
    for (const invalid of ['', 'a'.repeat(44), {}, undefined])
      expect(validSessionId(invalid)).toBe(false);
  });
  it('binds HMAC CSRF tokens to both secret and session', () => {
    const raw = newSessionId(),
      token = csrfToken(env.CSRF_SECRET, raw);
    expect(validCsrf(env.CSRF_SECRET, raw, token)).toBe(true);
    expect(validCsrf(env.CSRF_SECRET, newSessionId(), token)).toBe(false);
    expect(validCsrf('other'.repeat(10), raw, token)).toBe(false);
    for (const value of ['', undefined, 'x'.repeat(500), token.slice(1)])
      expect(validCsrf(env.CSRF_SECRET, raw, value)).toBe(false);
  });
  it('requires exact origins and uses Referer only when Origin is absent', () => {
    const allowed = ['https://portal.example'];
    expect(allowedOrigin('https://portal.example', undefined, allowed)).toBe(
      true,
    );
    expect(
      allowedOrigin(undefined, 'https://portal.example/path', allowed),
    ).toBe(true);
    for (const origin of [
      'null',
      'https://portal.example.evil',
      'http://portal.example',
      'https://portal.example:444',
    ])
      expect(
        allowedOrigin(origin, 'https://portal.example/path', allowed),
      ).toBe(false);
    expect(allowedOrigin(undefined, undefined, allowed)).toBe(false);
  });
  it('uses length and common-password checks without composition rules', () => {
    expect(
      passwordAllowed(
        'a long uncommon passphrase',
        'someone',
        12,
        'old-password',
      ),
    ).toBe(true);
    for (const value of [
      'short',
      'password123456',
      'Administrator',
      'x'.repeat(129),
      'old-password',
    ])
      expect(passwordAllowed(value, 'administrator', 12, 'old-password')).toBe(
        false,
      );
    expect(passwordAllowed('usernameislong', 'UsernameIsLong', 12)).toBe(false);
  });
  it('fails startup for missing or invalid security settings', () => {
    expect(() => authEnvironment({})).toThrow();
    for (const override of [
      { CSRF_SECRET: 'short' },
      { ALLOWED_ORIGINS: '*' },
      { ALLOWED_ORIGINS: 'https://example.com/path' },
      { TRUST_PROXY: 'maybe' },
      { PASSWORD_MIN_LENGTH: 11 },
      { ARGON2_MEMORY_KIB: 1024 },
      { SESSION_TOUCH_INTERVAL_SECONDS: 1800 },
      { SESSION_COOKIE_NAME: '__Host-sid' },
    ])
      expect(() => authEnvironment({ ...env, ...override })).toThrow();
    expect(authEnvironment({ ...env, TRUST_PROXY: '2' }).TRUST_PROXY).toBe(2);
    expect(authEnvironment({ ...env, TRUST_PROXY: 'true' }).TRUST_PROXY).toBe(
      true,
    );
  });
  it('uses a session cookie with production flags and no Domain/maxAge', () => {
    const config = new AuthConfig(
      new ConfigService({
        ...env,
        NODE_ENV: 'production',
        ALLOWED_ORIGINS: 'https://portal.example',
      }),
    );
    const response = {
      cookie: jest.fn(),
      clearCookie: jest.fn(),
    } as unknown as Response;
    const cookies = new SessionCookie(config);
    cookies.set(response, newSessionId());
    const options = (response.cookie as jest.Mock).mock.calls[0]![2] as Record<
      string,
      unknown
    >;
    expect((response.cookie as jest.Mock).mock.calls[0]![0]).toBe('__Host-sid');
    expect(options).toEqual({
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      path: '/',
    });
  });
  it('performs an argon2 verification for unknown users', async () => {
    const service = new PasswordService(new AuthConfig(new ConfigService(env)));
    await service.onModuleInit();
    const spy = jest.mocked(argon.verify);
    spy.mockClear();
    expect(await service.verifyCredential('wrong-password')).toBe(false);
    expect(spy).toHaveBeenCalledTimes(1);
    expect(
      typeof spy.mock.calls[0]![0] === 'string' &&
        String(spy.mock.calls[0]![0]).startsWith('$argon2id$'),
    ).toBe(true);
    spy.mockClear();
    const hashed = await service.hash('an uncommon test password');
    expect(
      await service.verifyCredential('an uncommon test password', hashed),
    ).toBe(true);
    expect(service.strengthenedParameters(hashed)).toBe(false);
  });
  it('requires every permission in metadata', () => {
    const reflector = {
      getAllAndMerge: () => ['dashboard.view', 'inventory.edit'],
    } as unknown as Reflector;
    const guard = new PermissionsGuard(reflector);
    const ctx = (permissions: string[]) =>
      ({
        getHandler: () => null,
        getClass: () => null,
        switchToHttp: () => ({ getRequest: () => ({ user: { permissions } }) }),
      }) as unknown as ExecutionContext;
    expect(guard.canActivate(ctx(['dashboard.view', 'inventory.edit']))).toBe(
      true,
    );
    expect(() => guard.canActivate(ctx(['dashboard.view']))).toThrow();
  });
});
