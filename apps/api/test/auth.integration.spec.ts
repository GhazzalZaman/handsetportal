import { webAuthSmoke } from './web-auth-smoke';
import 'reflect-metadata';
import { config } from 'dotenv';
import { randomUUID } from 'node:crypto';
import {
  Controller,
  DynamicModule,
  Get,
  Global,
  INestApplication,
  Module,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import request from 'supertest';
import { LoggerModule } from 'nestjs-pino';
import { AuthModule } from '../src/auth/auth.module';
import { AuthConfig } from '../src/auth/auth.config';
import { Clock } from '../src/auth/clock';
import { PasswordService } from '../src/auth/password.service';
import { RequirePermissions } from '../src/auth/auth.decorators';
import { sessionHash, newSessionId } from '../src/auth/crypto';
import { SessionCleanup } from '../src/sessions/session-cleanup.service';
import { configureApp } from '../src/configure-app';
import { httpLoggingOptions } from '../src/config/logging';
import { applicationDatabaseOptions } from '../src/database/options';
import { seedDatabase } from '../src/database/seed/seed';
import {
  AuditLog,
  LoginAttempt,
  Permission,
  Role,
  RolePermission,
  Session,
  User,
} from '../src/database/entities';
config({ quiet: true });
// Remote SQL round trips can exceed Jest's five-second unit-test default.
jest.setTimeout(60000);
@Global()
@Module({})
class TestDatabase {
  static register(db: DataSource): DynamicModule {
    return {
      module: TestDatabase,
      providers: [{ provide: DataSource, useValue: db }],
      exports: [DataSource],
    };
  }
}
@Controller('test-auth')
class Probe {
  @Get('plain') plain() {
    return { ok: true };
  }
  @Get('view') @RequirePermissions('dashboard.view') view() {
    return { ok: true };
  }
  @Get('admin') @RequirePermissions('users.manage') admin() {
    return { ok: true };
  }
}
const enabled = Boolean(process.env.TEST_DATABASE_URL);
if (!enabled)
  console.log('SKIP auth integration: TEST_DATABASE_URL is not set.');
(enabled ? describe : describe.skip)('SQL-backed auth flow', () => {
  const schema = 'auth_test_' + randomUUID().replace(/-/g, '');
  const origin = 'http://localhost:3000';
  const password = 'An uncommon test passphrase 42!';
  let db: DataSource,
    app: INestApplication,
    hash: string,
    roleId: number,
    userId: number;
  let now = new Date('2026-01-15T10:00:00Z');
  const clock = { now: () => new Date(now) };
  const advance = (milliseconds: number) => {
    now = new Date(now.getTime() + milliseconds);
  };
  function settings(production = false) {
    return new AuthConfig(
      new ConfigService({
        CSRF_SECRET: 'integration-only-secret-with-more-than-32-characters',
        ALLOWED_ORIGINS: production ? 'https://portal.example' : origin,
        NODE_ENV: production ? 'production' : 'test',
        LOGIN_MAX_FAILURES: 3,
        LOGIN_IP_LIMIT: 200,
        LOGIN_USERNAME_LIMIT: 200,
        TRUST_PROXY: 1,
      }),
    );
  }
  async function makeApp(production = false) {
    const module = await Test.createTestingModule({
      imports: [
        TestDatabase.register(db),
        LoggerModule.forRoot({
          pinoHttp: {
            ...httpLoggingOptions,
            autoLogging: false,
            level: 'silent',
          },
        }),
        AuthModule,
      ],
      controllers: [Probe],
    })
      .overrideProvider(AuthConfig)
      .useValue(settings(production))
      .overrideProvider(Clock)
      .useValue(clock)
      .compile();
    const instance = module.createNestApplication();
    configureApp(instance, 1);
    await instance.listen(0, '127.0.0.1');
    return instance;
  }
  function cookie(response: { headers: Record<string, unknown> }): string {
    const header = response.headers['set-cookie'];
    return String(Array.isArray(header) ? header[0] : (header ?? '')).split(
      ';',
    )[0]!;
  }
  const raw = (value: string) => value.slice(value.indexOf('=') + 1);
  const login = (name = 'authuser', pass = password, cookieValue?: string) => {
    const test = request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .set('Origin', origin)
      .send({ username: name, password: pass });
    return cookieValue ? test.set('Cookie', cookieValue) : test;
  };
  async function token(value: string): Promise<string> {
    const response = await request(app.getHttpServer())
      .get('/api/v1/auth/csrf')
      .set('Cookie', value)
      .expect(200);
    return response.body.csrfToken as string;
  }
  async function stored(value: string): Promise<Session> {
    return db
      .getRepository(Session)
      .createQueryBuilder('session')
      .addSelect(['session.sessionHash', 'session.authorizationHash'])
      .where('session.sessionHash = :hash', { hash: sessionHash(raw(value)) })
      .getOneOrFail();
  }
  beforeAll(async () => {
    db = new DataSource(
      applicationDatabaseOptions({
        ...process.env,
        DATABASE_URL: process.env.TEST_DATABASE_URL,
        DATABASE_MIGRATION_URL: undefined,
        DB_SCHEMA: schema,
      }),
    );
    await db.initialize();
    const runner = db.createQueryRunner();
    try {
      await runner.createSchema(schema, true);
    } finally {
      await runner.release();
    }
    await db.runMigrations();
    await seedDatabase(db, { demo: false });
    roleId = (
      await db
        .getRepository(Role)
        .findOneByOrFail({ code: 'OTHER_STAKEHOLDER' })
    ).id;
    app = await makeApp();
    hash = await app.get(PasswordService).hash(password);
    for (const username of ['authuser', 'inactive', 'locked', 'rate-user']) {
      const row = await db.getRepository(User).save({
        username,
        email: null,
        displayName: 'Auth Test',
        passwordHash: hash,
        roleId,
        mustChangePassword: false,
      });
      if (username === 'authuser') userId = row.id;
    }
  }, 120000);
  beforeEach(async () => {
    now = new Date('2026-01-15T10:00:00Z');
    const values = app.get(AuthConfig).values;
    values.SESSION_ABSOLUTE_TIMEOUT_HOURS = 8;
    values.LOGIN_USERNAME_LIMIT = 200;
    values.LOGIN_IP_LIMIT = 200;
    await db.createQueryBuilder().delete().from(Session).execute();
    await db.createQueryBuilder().delete().from(LoginAttempt).execute();
    await db
      .createQueryBuilder()
      .update(User)
      .set({
        passwordHash: hash,
        mustChangePassword: false,
        isActive: true,
        failedLoginCount: 0,
        lockedUntil: null,
        roleId,
      })
      .execute();
    await db
      .getRepository(User)
      .update({ username: 'inactive' }, { isActive: false });
    await db
      .getRepository(User)
      .update(
        { username: 'locked' },
        { lockedUntil: new Date(now.getTime() + 900000) },
      );
  });
  afterAll(async () => {
    if (app) await app.close();
    if (!db?.isInitialized) return;
    try {
      const runner = db.createQueryRunner();
      try {
        if (await runner.hasTable(schema + '.schema_migrations')) {
          const rows: { count: number }[] = await db.query(
            `SELECT COUNT(*) AS count FROM [${schema}].[schema_migrations]`,
          );
          for (let i = 0; i < (rows[0]?.count ?? 0); i++)
            await db.undoLastMigration({ transaction: 'all' });
          await runner.dropTable(schema + '.schema_migrations');
        }
        if (await runner.hasSchema(schema))
          await runner.dropSchema(schema, false);
      } finally {
        await runner.release();
      }
    } finally {
      await db.destroy();
    }
  }, 120000);
  (process.env.AUTH_WEB_SMOKE === 'true' ? it : it.skip)(
    'proves login and logout through the Next proxy',
    async () => {
      try {
        await webAuthSmoke(
          await app.getUrl(),
          (value) => {
            app.get(AuthConfig).values.ALLOWED_ORIGINS = value;
          },
          password,
        );
      } finally {
        app.get(AuthConfig).values.ALLOWED_ORIGINS = origin;
      }
    },
    180000,
  );
  it('sets a host-only session cookie and returns no secrets', async () => {
    const response = await login('  AUTHUSER  ').expect(200);
    const header = String(response.headers['set-cookie']);
    expect(header).toContain('HttpOnly');
    expect(header).toContain('SameSite=Lax');
    expect(header).toContain('Path=/');
    expect(header).not.toMatch(/Domain=|Max-Age=|Expires=|Secure/);
    expect(response.headers['cache-control']).toBe('no-store');
    expect(Object.keys(response.body).sort()).toEqual(
      [
        'id',
        'username',
        'displayName',
        'role',
        'permissions',
        'mustChangePassword',
        'idleExpiresAt',
        'absoluteExpiresAt',
      ].sort(),
    );
    const row = await stored(cookie(response));
    expect(row.sessionHash === raw(cookie(response))).toBe(false);
    expect(row.sessionHash).toHaveLength(64);
    const attempt = await db
      .getRepository(LoginAttempt)
      .findOneByOrFail({ success: true });
    expect(attempt.usernameAttempted).toBe('AUTHUSER');
  });
  it('uses Secure and __Host- in production', async () => {
    const production = await makeApp(true);
    try {
      const response = await request(production.getHttpServer())
        .post('/api/v1/auth/login')
        .set('Origin', 'https://portal.example')
        .send({ username: 'authuser', password })
        .expect(200);
      expect(cookie(response).startsWith('__Host-sid=')).toBe(true);
      expect(String(response.headers['set-cookie'])).toContain('Secure');
      expect(String(response.headers['set-cookie'])).not.toMatch(
        /Domain=|Max-Age=/,
      );
    } finally {
      await production.close();
    }
  });
  it('returns identical 401 bodies for wrong, unknown, inactive and locked accounts', async () => {
    const responses = [];
    for (const [name, pass] of [
      ['authuser', 'wrong'],
      ['unknown', 'wrong'],
      ['inactive', password],
      ['locked', password],
    ])
      responses.push(await login(name!, pass!).expect(401));
    for (const response of responses)
      expect(response.body).toEqual(responses[0]!.body);
    expect(await db.getRepository(LoginAttempt).count()).toBe(4);
  });
  it('validates oversized credentials before argon2', async () => {
    const spy = jest.spyOn(app.get(PasswordService), 'verifyCredential');
    try {
      await login('x'.repeat(101)).expect(400);
      await login('authuser', 'x'.repeat(129)).expect(400);
      expect(spy).not.toHaveBeenCalled();
    } finally {
      spy.mockRestore();
    }
  });
  it('locks after N failures and accepts login after the lockout period', async () => {
    for (let i = 0; i < 3; i++) await login('authuser', 'wrong').expect(401);
    expect(
      (
        await db.getRepository(User).findOneByOrFail({ id: userId })
      ).lockedUntil?.getTime(),
    ).toBe(now.getTime() + 900000);
    await login().expect(401);
    advance(900001);
    await login().expect(200);
    expect(
      (await db.getRepository(User).findOneByOrFail({ id: userId }))
        .failedLoginCount,
    ).toBe(0);
  });
  it('ignores/revokes incoming session cookies and prevents fixation', async () => {
    const first = cookie(await login().expect(200));
    const second = cookie(await login('authuser', password, first).expect(200));
    expect(second === first).toBe(false);
    await request(app.getHttpServer())
      .get('/api/v1/auth/me')
      .set('Cookie', first)
      .expect(401);
    await request(app.getHttpServer())
      .get('/api/v1/auth/me')
      .set('Cookie', second)
      .expect(200);
  });
  it('expires idle sessions and clears their cookies', async () => {
    const value = cookie(await login().expect(200));
    advance(1800001);
    const response = await request(app.getHttpServer())
      .get('/api/v1/auth/me')
      .set('Cookie', value)
      .expect(401);
    expect(String(response.headers['set-cookie'])).toContain(
      'Expires=Thu, 01 Jan 1970',
    );
  });
  it('throttles sliding writes, caps idle expiry, and enforces absolute expiry', async () => {
    app.get(AuthConfig).values.SESSION_ABSOLUTE_TIMEOUT_HOURS = 1;
    const value = cookie(await login().expect(200));
    const initial = await stored(value);
    advance(30000);
    await request(app.getHttpServer())
      .get('/api/v1/auth/me')
      .set('Cookie', value)
      .expect(200);
    expect((await stored(value)).lastSeenAt.getTime()).toBe(
      initial.lastSeenAt.getTime(),
    );
    advance(1200000);
    await request(app.getHttpServer())
      .get('/api/v1/auth/me')
      .set('Cookie', value)
      .expect(200);
    expect((await stored(value)).idleExpiresAt.getTime()).toBeGreaterThan(
      initial.idleExpiresAt.getTime(),
    );
    advance(1200000);
    await request(app.getHttpServer())
      .get('/api/v1/auth/me')
      .set('Cookie', value)
      .expect(200);
    const touched = await stored(value);
    expect(touched.idleExpiresAt.getTime()).toBe(
      touched.absoluteExpiresAt.getTime(),
    );
    now = new Date(touched.absoluteExpiresAt);
    await request(app.getHttpServer())
      .get('/api/v1/auth/me')
      .set('Cookie', value)
      .expect(401);
  });
  it('requires origin and session-bound CSRF for mutations', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .set('Origin', 'https://evil.example')
      .send({ username: 'authuser', password })
      .expect(403);
    const value = cookie(await login().expect(200));
    for (const csrf of ['', 'invalid'])
      await request(app.getHttpServer())
        .post('/api/v1/auth/logout')
        .set('Cookie', value)
        .set('Origin', origin)
        .set('X-CSRF-Token', csrf)
        .send({})
        .expect(403);
    await request(app.getHttpServer())
      .post('/api/v1/auth/logout')
      .set('Cookie', value)
      .set('Origin', 'https://evil.example')
      .set('X-CSRF-Token', await token(value))
      .send({})
      .expect(403);
    await request(app.getHttpServer())
      .post('/api/v1/auth/logout')
      .set('Cookie', value)
      .set('Referer', origin + '/dashboard')
      .set('X-CSRF-Token', await token(value))
      .send({})
      .expect(204);
    await request(app.getHttpServer())
      .get('/api/v1/auth/me')
      .set('Cookie', value)
      .expect(401);
  });
  it('gates mandatory password changes, rotates the current ID and revokes every old session', async () => {
    await db.getRepository(User).update(userId, { mustChangePassword: true });
    const first = cookie(await login().expect(200)),
      second = cookie(await login().expect(200));
    const blocked = await request(app.getHttpServer())
      .get('/api/v1/test-auth/plain')
      .set('Cookie', first)
      .expect(403);
    expect(blocked.body.error.code).toBe('PASSWORD_CHANGE_REQUIRED');
    const csrf = await token(first);
    const response = await request(app.getHttpServer())
      .post('/api/v1/auth/change-password')
      .set('Cookie', first)
      .set('Origin', origin)
      .set('X-CSRF-Token', csrf)
      .send({
        currentPassword: password,
        newPassword: 'A different uncommon test passphrase 43!',
      })
      .expect(200);
    const rotated = cookie(response);
    expect(rotated === first).toBe(false);
    expect(response.body.mustChangePassword).toBe(false);
    for (const value of [first, second])
      await request(app.getHttpServer())
        .get('/api/v1/auth/me')
        .set('Cookie', value)
        .expect(401);
    await request(app.getHttpServer())
      .get('/api/v1/test-auth/plain')
      .set('Cookie', rotated)
      .expect(200);
    const audit = await db.getRepository(AuditLog).findOneOrFail({
      where: {
        entityType: 'USER',
        entityId: String(userId),
        fieldName: 'password',
      },
      order: { id: 'DESC' },
    });
    expect([audit.oldValue, audit.newValue]).toEqual([
      '[REDACTED]',
      '[REDACTED]',
    ]);
  });
  it('enforces permissions and notices privilege changes on existing sessions', async () => {
    const value = cookie(await login().expect(200));
    await request(app.getHttpServer())
      .get('/api/v1/test-auth/view')
      .set('Cookie', value)
      .expect(200);
    await request(app.getHttpServer())
      .get('/api/v1/test-auth/admin')
      .set('Cookie', value)
      .expect(403);
    const permission = await db
      .getRepository(Permission)
      .findOneByOrFail({ code: 'dashboard.view' });
    await db
      .getRepository(RolePermission)
      .delete({ roleId, permissionId: permission.id });
    try {
      await request(app.getHttpServer())
        .get('/api/v1/test-auth/view')
        .set('Cookie', value)
        .expect(403);
    } finally {
      await db
        .getRepository(RolePermission)
        .insert({ roleId, permissionId: permission.id });
    }
  });
  it('invalidates sessions after deactivation or lockout', async () => {
    let value = cookie(await login().expect(200));
    await db.getRepository(User).update(userId, { isActive: false });
    await request(app.getHttpServer())
      .get('/api/v1/auth/me')
      .set('Cookie', value)
      .expect(401);
    await db.getRepository(User).update(userId, { isActive: true });
    value = cookie(await login().expect(200));
    await db
      .getRepository(User)
      .update(userId, { lockedUntil: new Date(now.getTime() + 60000) });
    await request(app.getHttpServer())
      .get('/api/v1/auth/me')
      .set('Cookie', value)
      .expect(401);
  });
  it('throttles usernames and records the rejected credential attempt', async () => {
    app.get(AuthConfig).values.LOGIN_USERNAME_LIMIT = 2;
    await login('rate-user', 'wrong').expect(401);
    await login('rate-user', 'wrong').expect(401);
    await login('rate-user', 'wrong').expect(429);
    expect(
      await db
        .getRepository(LoginAttempt)
        .countBy({ usernameAttempted: 'rate-user' }),
    ).toBe(3);
  });
  it('throttles by trusted client IP across usernames', async () => {
    app.get(AuthConfig).values.LOGIN_IP_LIMIT = 1;
    await login().set('X-Forwarded-For', '203.0.113.55').expect(200);
    await login('another-unknown', 'wrong')
      .set('X-Forwarded-For', '203.0.113.55')
      .expect(429);
    expect(
      await db
        .getRepository(LoginAttempt)
        .countBy({ ipAddress: '203.0.113.55' }),
    ).toBe(2);
  });
  it('serializes concurrent failures without losing the lockout count', async () => {
    const responses = await Promise.all(
      Array.from({ length: 3 }, () => login('authuser', 'wrong')),
    );
    expect(responses.map((response) => response.status)).toEqual([
      401, 401, 401,
    ]);
    const user = await db.getRepository(User).findOneByOrFail({ id: userId });
    expect(user.failedLoginCount).toBe(3);
    expect(user.lockedUntil).not.toBeNull();
  });
  it('revokes all sessions when account deactivation is detected', async () => {
    const first = cookie(await login().expect(200));
    const second = cookie(await login().expect(200));
    await db.getRepository(User).update(userId, { isActive: false });
    await request(app.getHttpServer())
      .get('/api/v1/auth/me')
      .set('Cookie', first)
      .expect(401);
    expect((await stored(second)).revokedReason).toBe('USER_DEACTIVATED');
    await db.getRepository(User).update(userId, { isActive: true });
    await request(app.getHttpServer())
      .get('/api/v1/auth/me')
      .set('Cookie', second)
      .expect(401);
  });
  it('cleans only sessions and attempts beyond retention', async () => {
    const value = cookie(await login().expect(200));
    const old = new Date(now.getTime() - 9 * 86400000);
    await db.getRepository(Session).insert({
      sessionHash: sessionHash(newSessionId()),
      userId,
      createdAt: old,
      lastSeenAt: old,
      idleExpiresAt: old,
      absoluteExpiresAt: old,
      ipAddress: '127.0.0.1',
      userAgent: 'test',
    });
    await db.getRepository(LoginAttempt).insert({
      usernameAttempted: 'retention-test',
      ipAddress: '127.0.0.1',
      success: false,
      attemptedAt: new Date(now.getTime() - 91 * 86400000),
    });
    await app.get(SessionCleanup).run();
    expect(await db.getRepository(Session).count()).toBe(1);
    expect(
      await db
        .getRepository(LoginAttempt)
        .countBy({ usernameAttempted: 'retention-test' }),
    ).toBe(0);
    await request(app.getHttpServer())
      .get('/api/v1/auth/me')
      .set('Cookie', value)
      .expect(200);
  });
});
