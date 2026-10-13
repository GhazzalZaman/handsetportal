import { webAuthSmoke } from './web-auth-smoke';
import 'reflect-metadata';
import { config } from 'dotenv';
import { randomUUID } from 'node:crypto';
import { Writable } from 'node:stream';
import {
  DynamicModule,
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
import { PasswordService } from '../src/auth/password.service';
import { SessionService } from '../src/sessions/session.service';
import { UsersModule } from '../src/users/users.module';
import { UsersService } from '../src/users/users.service';
import { RolesModule } from '../src/roles/roles.module';
import { DirectoryModule } from '../src/directory/directory.module';
import { ScopeService, CenterScope } from '../src/scope/scope.service';
import { AdminTransaction } from '../src/admin/admin-transaction';
import { configureApp } from '../src/configure-app';
import { httpLoggingOptions } from '../src/config/logging';
import { applicationDatabaseOptions } from '../src/database/options';
import { seedDatabase } from '../src/database/seed/seed';
import { seedRoles } from '../src/database/seed/roles.config';
import {
  AuditLog,
  Cluster,
  ExperienceCenter,
  LoginAttempt,
  Permission,
  Role,
  RolePermission,
  Session,
  User,
  UserCenterAssignment,
  UserClusterAssignment,
} from '../src/database/entities';
config({ quiet: true });
jest.setTimeout(60000);
@Global()
@Module({})
class RbacDatabase {
  static register(db: DataSource): DynamicModule {
    return {
      module: RbacDatabase,
      providers: [{ provide: DataSource, useValue: db }],
      exports: [DataSource],
    };
  }
}
const enabled = Boolean(process.env.TEST_DATABASE_URL);
if (!enabled)
  console.log('SKIP RBAC integration: TEST_DATABASE_URL is not set.');
(enabled ? describe : describe.skip)(
  'SQL-backed administration and scope',
  () => {
    const schema = 'rbac_test_' + randomUUID().replace(/-/g, '');
    const origin = 'http://localhost:3000',
      password = 'A unique RBAC test passphrase 89!';
    const context = { ip: '127.0.0.1', requestId: 'rbac-test' };
    let db: DataSource,
      app: INestApplication,
      adminId: number,
      userId: number,
      adminCookie: string,
      adminToken: string,
      hash: string;
    let roles: Record<string, number>, centerIds: number[], clusterId: number;
    let captured = '';
    const stream = new Writable({
      write(chunk, _encoding, done) {
        captured += String(chunk);
        done();
      },
    });
    const cookie = (res: request.Response) =>
      String(res.headers['set-cookie']?.[0] ?? '').split(';')[0]!;
    const login = (name = 'admin', pass = password) =>
      request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .set('Origin', origin)
        .send({ username: name, password: pass });
    const get = (path: string, value = adminCookie) =>
      request(app.getHttpServer())
        .get('/api/v1/' + path)
        .set('Cookie', value);
    const write = (
      path: string,
      body: object = {},
      method: 'post' | 'patch' | 'put' = 'post',
      value = adminCookie,
      token = adminToken,
    ) =>
      request(app.getHttpServer())
        [method]('/api/v1/' + path)
        .set('Cookie', value)
        .set('Origin', origin)
        .set('X-CSRF-Token', token)
        .send(body);
    async function credentials(name: string) {
      const value = cookie(await login(name).expect(200));
      return {
        value,
        token: (await get('auth/csrf', value).expect(200)).body
          .csrfToken as string,
      };
    }
    const create = (extra: Record<string, unknown> = {}) =>
      write('users', {
        username: 'new_' + randomUUID().slice(0, 8),
        displayName: 'New Test',
        roleId: roles.OTHER_STAKEHOLDER,
        centerIds: [centerIds[0]],
        clusterIds: [],
        ...extra,
      });
    async function actor() {
      const principal = await app
        .get(SessionService)
        .validate(adminCookie.slice(adminCookie.indexOf('=') + 1), context);
      if (!principal) throw new Error('Missing test actor');
      return principal;
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
      roles = Object.fromEntries(
        (await db.getRepository(Role).find()).map((r) => [r.code, r.id]),
      );
      centerIds = (
        await db.getRepository(ExperienceCenter).find({ order: { id: 'ASC' } })
      ).map((c) => c.id);
      clusterId = (
        await db
          .getRepository(Cluster)
          .save({ code: 'TEST_CLUSTER', name: 'Test Cluster' })
      ).id;
      const testing = await Test.createTestingModule({
        imports: [
          RbacDatabase.register(db),
          LoggerModule.forRoot({
            pinoHttp: [{ ...httpLoggingOptions, autoLogging: true }, stream],
          }),
          AuthModule,
          UsersModule,
          RolesModule,
          DirectoryModule,
        ],
      })
        .overrideProvider(AuthConfig)
        .useValue(
          new AuthConfig(
            new ConfigService({
              CSRF_SECRET: 'test-only-rbac-secret-over-32-characters',
              ALLOWED_ORIGINS: origin,
              NODE_ENV: 'test',
              LOGIN_IP_LIMIT: 10000,
              LOGIN_USERNAME_LIMIT: 1000,
            }),
          ),
        )
        .compile();
      app = testing.createNestApplication();
      configureApp(app);
      await app.listen(0, '127.0.0.1');
      hash = await app.get(PasswordService).hash(password);
      adminId = (
        await db.getRepository(User).save({
          username: 'admin',
          displayName: 'Admin Test',
          passwordHash: hash,
          roleId: roles.SYSTEM_ADMIN,
          mustChangePassword: false,
        })
      ).id;
      userId = (
        await db.getRepository(User).save({
          username: 'member',
          displayName: 'Member Test',
          passwordHash: hash,
          roleId: roles.OTHER_STAKEHOLDER,
          mustChangePassword: false,
        })
      ).id;
    }, 120000);
    beforeEach(async () => {
      await db.createQueryBuilder().delete().from(Session).execute();
      await db.createQueryBuilder().delete().from(LoginAttempt).execute();
      await db
        .createQueryBuilder()
        .delete()
        .from(UserCenterAssignment)
        .execute();
      await db
        .createQueryBuilder()
        .delete()
        .from(UserClusterAssignment)
        .execute();
      await db.createQueryBuilder().delete().from(RolePermission).execute();
      const permissions = await db.getRepository(Permission).find();
      for (const role of seedRoles)
        await db.getRepository(RolePermission).insert(
          role.permissions.map((code) => ({
            roleId: roles[role.code]!,
            permissionId: permissions.find((p) => p.code === code)!.id,
          })),
        );
      await db
        .createQueryBuilder()
        .update(User)
        .set({ isActive: false })
        .execute();
      await db.getRepository(User).update(adminId, {
        isActive: true,
        roleId: roles.SYSTEM_ADMIN,
        mustChangePassword: false,
        passwordHash: hash,
        lockedUntil: null,
        failedLoginCount: 0,
      });
      await db.getRepository(User).update(userId, {
        isActive: true,
        roleId: roles.OTHER_STAKEHOLDER,
        mustChangePassword: false,
        passwordHash: hash,
        lockedUntil: null,
        failedLoginCount: 0,
      });
      await db
        .createQueryBuilder()
        .update(ExperienceCenter)
        .set({ isActive: true, clusterId: null })
        .execute();
      await db.getRepository(Cluster).update(clusterId, { isActive: true });
      const creds = await credentials('admin');
      adminCookie = creds.value;
      adminToken = creds.token;
      captured = '';
    });
    afterAll(async () => {
      if (app) await app.close();
      if (!db?.isInitialized) return;
      const runner = db.createQueryRunner();
      try {
        if (await runner.hasTable(schema + '.schema_migrations')) {
          const rows: { count: number }[] = await db.query(
            'SELECT COUNT(*) AS count FROM [' +
              schema +
              '].[schema_migrations]',
          );
          for (let i = 0; i < (rows[0]?.count ?? 0); i++)
            await db.undoLastMigration({ transaction: 'all' });
          await runner.dropTable(schema + '.schema_migrations');
        }
        if (await runner.hasSchema(schema))
          await runner.dropSchema(schema, false);
      } finally {
        await runner.release();
        await db.destroy();
      }
    }, 120000);
    it.each(['CENTER', 'CLUSTER', 'ASSIGNED'])(
      '%s denies zero assignments',
      async (type) => {
        const role = (
          await db.getRepository(Role).findOneByOrFail({ scopeType: type })
        ).id;
        await db.getRepository(User).update(userId, { roleId: role });
        expect(
          (await app.get(ScopeService).resolve(userId, [])).centerIds,
        ).toEqual([]);
      },
    );
    it('resolves ALL freshly and includes later centers, excluding inactive centers', async () => {
      const scopes = app.get(ScopeService),
        before = await scopes.resolve(adminId, []);
      const added = await write('centers', {
        code: 'C_' + randomUUID().slice(0, 8),
        name: 'New center ' + randomUUID(),
      }).expect(201);
      expect(before.centerIds).not.toContain(added.body.id);
      expect((await scopes.resolve(adminId, [])).centerIds).toContain(
        added.body.id,
      );
      await write(
        'centers/' + added.body.id,
        { isActive: false },
        'patch',
      ).expect(200);
      expect((await scopes.resolve(adminId, [])).centerIds).not.toContain(
        added.body.id,
      );
    });
    it.each(['CLUSTER', 'ASSIGNED'])(
      '%s unions active cluster and direct centers without cross-request caching',
      async (type) => {
        const role = (
          await db.getRepository(Role).findOneByOrFail({ scopeType: type })
        ).id;
        await db.getRepository(User).update(userId, { roleId: role });
        await db
          .getRepository(UserClusterAssignment)
          .insert({ userId, clusterId });
        await db
          .getRepository(ExperienceCenter)
          .update(centerIds[0]!, { clusterId });
        await db
          .getRepository(UserCenterAssignment)
          .insert({ userId, centerId: centerIds[1]! });
        const scopes = app.get(ScopeService);
        expect((await scopes.resolve(userId, [])).centerIds).toEqual(
          centerIds.slice(0, 2),
        );
        await db
          .getRepository(ExperienceCenter)
          .update(centerIds[2]!, { clusterId });
        expect((await scopes.resolve(userId, [])).centerIds).toEqual(
          centerIds.slice(0, 3),
        );
        await db.getRepository(Cluster).update(clusterId, { isActive: false });
        expect((await scopes.resolve(userId, [])).centerIds).toEqual([
          centerIds[1],
        ]);
        await db
          .getRepository(ExperienceCenter)
          .update(centerIds[1]!, { isActive: false });
        expect((await scopes.resolve(userId, [])).centerIds).toEqual([]);
      },
    );
    it('CENTER uses only direct assignments, filters real SQL rows, and never widens empty scope', async () => {
      await db
        .getRepository(User)
        .update(userId, { roleId: roles.EXPERIENCE_CENTER_MANAGER });
      const scopes = app.get(ScopeService),
        empty = await scopes.resolve(userId, ['inventory.adjust']);
      expect(
        await empty
          .applyToQuery(
            db.getRepository(ExperienceCenter).createQueryBuilder('center'),
            'center.id',
          )
          .getCount(),
      ).toBe(0);
      await db
        .getRepository(UserCenterAssignment)
        .insert({ userId, centerId: centerIds[0]! });
      await db
        .getRepository(UserClusterAssignment)
        .insert({ userId, clusterId });
      await db
        .getRepository(ExperienceCenter)
        .update(centerIds[1]!, { clusterId });
      const scoped = await scopes.resolve(userId, ['inventory.adjust']);
      expect(
        (
          await scoped
            .applyToQuery(
              db.getRepository(ExperienceCenter).createQueryBuilder('center'),
              'center.id',
            )
            .getMany()
        ).map((c) => c.id),
      ).toEqual([centerIds[0]]);
      const member = await credentials('member');
      expect(
        (await get('centers', member.value).expect(200)).body.items.map(
          (c: { id: number }) => c.id,
        ),
      ).toEqual([centerIds[0]]);
      expect(
        (await get('clusters', member.value).expect(200)).body.items,
      ).toEqual([]);
      await db.getRepository(UserCenterAssignment).delete({ userId });
      expect((await scopes.resolve(userId, [])).centerIds).toEqual([]);
    });
    it('binds large scopes with one parameter', async () => {
      const scope = new CenterScope(
        false,
        Array.from({ length: 3000 }, (_, i) => i + 1),
        [],
      );
      const qb = scope.applyToQuery(
        db.getRepository(ExperienceCenter).createQueryBuilder('center'),
        'center.id',
      );
      expect(Object.keys(qb.getParameters())).toHaveLength(1);
      expect(await qb.getCount()).toBeGreaterThan(0);
    });
    it('creates a user with an argon2 temporary password, explicit safe fields and atomic audits', async () => {
      const response = await create({
        temporaryPassword: 'Provided temporary secret 982!',
      }).expect(201);
      const id = response.body.user.id as number;
      expect(response.body.temporaryPassword).toBe(
        'Provided temporary secret 982!',
      );
      expect(response.body.user.mustChangePassword).toBe(true);
      const stored = await db
        .getRepository(User)
        .createQueryBuilder('user')
        .addSelect('user.passwordHash')
        .where('user.id=:id', { id })
        .getOneOrFail();
      expect(
        await app
          .get(PasswordService)
          .verifyCredential(
            response.body.temporaryPassword,
            stored.passwordHash,
          ),
      ).toBe(true);
      const audits = await db
        .getRepository(AuditLog)
        .findBy({ entityType: 'USER', entityId: String(id) });
      expect(audits.map((a) => a.fieldName)).toEqual(
        expect.arrayContaining([
          'password',
          'ASSIGNED_CENTERS',
          'username',
          'roleId',
        ]),
      );
      expect(JSON.stringify(audits)).not.toContain(
        response.body.temporaryPassword,
      );
      expect(JSON.stringify(audits)).not.toContain(stored.passwordHash);
      const view = await get('users/' + id).expect(200);
      expect(JSON.stringify(view.body)).not.toMatch(
        /passwordHash|password_hash|failedLoginCount|temporaryPassword/,
      );
      await new Promise((done) => setImmediate(done));
      expect(captured.length).toBeGreaterThan(0);
      expect(captured).not.toContain(response.body.temporaryPassword);
      expect(captured).not.toContain(stored.passwordHash);
    });
    it('validates assignments and referenced active records on create and patch', async () => {
      await create({
        roleId: roles.EXPERIENCE_CENTER_MANAGER,
        centerIds: [],
      }).expect(400);
      await create({ roleId: roles.CLUSTER_HEAD, clusterIds: [] }).expect(400);
      await create({ roleId: roles.SYSTEM_ADMIN }).expect(400);
      await create({ centerIds: [], clusterIds: [] }).expect(400);
      await create({ centerIds: [2147483647] }).expect(400);
      await create({ clusterIds: [2147483647] }).expect(400);
      await db
        .getRepository(ExperienceCenter)
        .update(centerIds[1]!, { isActive: false });
      await create({ centerIds: [centerIds[1]] }).expect(400);
      const made = await create().expect(201);
      await write(
        'users/' + made.body.user.id,
        { centerIds: [] },
        'patch',
      ).expect(400);
      await write(
        'users/' + made.body.user.id,
        { roleId: roles.SYSTEM_ADMIN },
        'patch',
      ).expect(400);
      await write(
        'users/' + made.body.user.id,
        { roleId: roles.SYSTEM_ADMIN, centerIds: [], clusterIds: [] },
        'patch',
      ).expect(200);
    });
    it('rejects duplicate username case-insensitively and duplicate email', async () => {
      await create({
        username: 'UniqueUser',
        email: 'unique@example.test',
      }).expect(201);
      await create({ username: 'uniqueuser' }).expect(409);
      await create({ email: 'UNIQUE@example.test' }).expect(409);
    });
    it('blocks self-deactivation, self-role change and self-permission removal in services', async () => {
      const principal = await actor(),
        service = app.get(UsersService);
      await expect(
        service.action(adminId, 'deactivate', principal, {
          ...context,
          userId: adminId,
        }),
      ).rejects.toMatchObject({ code: 'SELF_DEACTIVATION' });
      await expect(
        service.patch(
          adminId,
          { roleId: roles.HEAD_OF_EXPERIENCE_CENTERS },
          principal,
          { ...context, userId: adminId },
        ),
      ).rejects.toMatchObject({ code: 'SELF_ROLE_CHANGE' });
      await write(
        'roles/' + roles.SYSTEM_ADMIN + '/permissions',
        { permissionCodes: ['audit.view'] },
        'put',
      ).expect(409);
      await write(
        'roles/' + roles.SYSTEM_ADMIN + '/permissions',
        { permissionCodes: ['users.manage'] },
        'put',
      ).expect(409);
    });
    it('rolls back any transaction leaving no active user administrator', async () => {
      const principal = await actor();
      await expect(
        app.get(AdminTransaction).run(principal, async (manager) => {
          await manager.update(User, adminId, { isActive: false });
        }),
      ).rejects.toMatchObject({ code: 'LAST_ADMIN' });
      expect(
        (await db.getRepository(User).findOneByOrFail({ id: adminId }))
          .isActive,
      ).toBe(true);
    });
    it('serializes concurrent administrator deactivation and keeps one active administrator', async () => {
      await db
        .getRepository(User)
        .update(userId, { roleId: roles.SYSTEM_ADMIN });
      const other = await credentials('member');
      const results = await Promise.all([
        write('users/' + userId + '/deactivate'),
        write(
          'users/' + adminId + '/deactivate',
          {},
          'post',
          other.value,
          other.token,
        ),
      ]);
      expect(results.map((r) => r.status).sort()).toEqual([201, 401]);
      expect(
        await db
          .getRepository(User)
          .countBy({ roleId: roles.SYSTEM_ADMIN, isActive: true }),
      ).toBe(1);
    });
    it('replaces permissions without expiring existing sessions and rejects unknown codes', async () => {
      const member = await credentials('member');
      await write(
        'roles/' + roles.OTHER_STAKEHOLDER + '/permissions',
        { permissionCodes: ['dashboard.view', 'inventory.adjust'] },
        'put',
      ).expect(200);
      expect(
        (await get('auth/me', member.value).expect(200)).body.permissions,
      ).toContain('inventory.adjust');
      await write(
        'roles/' + roles.OTHER_STAKEHOLDER + '/permissions',
        { permissionCodes: ['dashboard.view'] },
        'put',
      ).expect(200);
      expect(
        (await get('auth/me', member.value).expect(200)).body.permissions,
      ).not.toContain('inventory.adjust');
      await write(
        'roles/' + roles.OTHER_STAKEHOLDER + '/permissions',
        { permissionCodes: ['unknown.code'] },
        'put',
      ).expect(400);
      expect(
        await db.getRepository(AuditLog).countBy({
          entityType: 'ROLE',
          entityId: String(roles.OTHER_STAKEHOLDER),
          fieldName: 'permission:inventory.adjust',
        }),
      ).toBe(2);
    });
    it('revokes sessions on assignment and role changes, but not a display-name edit', async () => {
      await db
        .getRepository(UserCenterAssignment)
        .insert({ userId, centerId: centerIds[0]! });
      let member = await credentials('member');
      await write(
        'users/' + userId,
        { displayName: 'Renamed' },
        'patch',
      ).expect(200);
      await get('auth/me', member.value).expect(200);
      await write(
        'users/' + userId,
        { centerIds: [centerIds[1]] },
        'patch',
      ).expect(200);
      await get('auth/me', member.value).expect(401);
      member = await credentials('member');
      await write(
        'users/' + userId,
        { roleId: roles.EXPERIENCE_CENTER_MANAGER },
        'patch',
      ).expect(200);
      await get('auth/me', member.value).expect(401);
    });
    it('deactivates, activates, unlocks and revokes sessions with audit records', async () => {
      let member = await credentials('member');
      await write('users/' + userId + '/deactivate').expect(201);
      await get('auth/me', member.value).expect(401);
      await login('member').expect(401);
      await write('users/' + userId + '/activate').expect(201);
      await db.getRepository(User).update(userId, {
        lockedUntil: new Date(Date.now() + 600000),
        failedLoginCount: 5,
      });
      await write('users/' + userId + '/unlock').expect(201);
      member = await credentials('member');
      const listed = await get('users/' + userId + '/sessions').expect(200);
      expect(listed.body.total).toBe(1);
      expect(JSON.stringify(listed.body)).not.toMatch(/hash|sessionId/i);
      await write('users/' + userId + '/revoke-sessions').expect(201);
      await get('auth/me', member.value).expect(401);
      expect(
        (
          await db.getRepository(AuditLog).findBy({
            entityType: 'USER',
            entityId: String(userId),
            fieldName: 'ADMIN_ACTION',
          })
        ).map((a) => a.newValue),
      ).toEqual(
        expect.arrayContaining([
          'deactivate',
          'activate',
          'unlock',
          'revoke-sessions',
        ]),
      );
    });
    it('reset-password returns one secret, invalidates old credentials and forces password change', async () => {
      const member = await credentials('member');
      captured = '';
      const response = await write(
        'users/' + userId + '/reset-password',
      ).expect(201);
      await get('auth/me', member.value).expect(401);
      await login('member').expect(401);
      const signed = await login(
        'member',
        response.body.temporaryPassword,
      ).expect(200);
      expect(signed.body.mustChangePassword).toBe(true);
      await get('centers', cookie(signed)).expect(403);
      await new Promise((done) => setImmediate(done));
      expect(captured).not.toContain(response.body.temporaryPassword);
    });
    it('denies every administrative route without users.manage and enforces CSRF', async () => {
      const member = await credentials('member');
      for (const path of [
        'users',
        'users/' + adminId,
        'users/' + adminId + '/sessions',
        'roles',
        'permissions',
        'clusters/catalog',
      ])
        await get(path, member.value).expect(403);
      for (const [method, path, body] of [
        ['post', 'users', {}],
        ['patch', 'users/' + adminId, {}],
        ...[
          'activate',
          'deactivate',
          'unlock',
          'reset-password',
          'revoke-sessions',
        ].map((a) => ['post', 'users/' + adminId + '/' + a, {}]),
        [
          'put',
          'roles/' + roles.SYSTEM_ADMIN + '/permissions',
          { permissionCodes: [] },
        ],
        ['post', 'centers', {}],
        ['patch', 'centers/' + centerIds[0], {}],
        ['post', 'clusters', {}],
        ['patch', 'clusters/' + clusterId, {}],
      ] as ['post' | 'patch' | 'put', string, object][])
        await write(path, body, method, member.value, member.token).expect(403);
      await write(
        'users/' + userId + '/unlock',
        {},
        'post',
        adminCookie,
        'invalid',
      ).expect(403);
    });
    it('paginates and filters users and enforces maximum page sizes', async () => {
      await db
        .getRepository(UserCenterAssignment)
        .insert({ userId, centerId: centerIds[0]! });
      await db
        .getRepository(UserClusterAssignment)
        .insert({ userId, clusterId });
      const result = await get(
        'users?centerId=' +
          centerIds[0] +
          '&clusterId=' +
          clusterId +
          '&isActive=true&search=member&pageSize=1',
      ).expect(200);
      expect(result.body.total).toBe(1);
      expect(result.body.items[0].id).toBe(userId);
      for (const path of [
        'users',
        'roles',
        'permissions',
        'centers',
        'clusters',
        'users/' + userId + '/sessions',
      ])
        await get(path + '?pageSize=101').expect(400);
    });
    it('adds/renames/deactivates clusters, maps centers and audits each mutation', async () => {
      const cluster = await write('clusters', {
        code: 'K_' + randomUUID().slice(0, 8),
        name: 'Cluster ' + randomUUID(),
      }).expect(201);
      await write(
        'clusters/' + cluster.body.id,
        { name: 'Renamed ' + randomUUID() },
        'patch',
      ).expect(200);
      await write(
        'centers/' + centerIds[0],
        { clusterId: cluster.body.id, shortName: 'Mapped' },
        'patch',
      ).expect(200);
      expect(
        (await get('clusters').expect(200)).body.items.map(
          (c: { id: number }) => c.id,
        ),
      ).toContain(cluster.body.id);
      await write(
        'clusters/' + cluster.body.id,
        { isActive: false },
        'patch',
      ).expect(200);
      expect(
        await db.getRepository(AuditLog).countBy({
          entityType: 'CLUSTER',
          entityId: String(cluster.body.id),
        }),
      ).toBe(5);
      expect(
        await db.getRepository(AuditLog).countBy({
          entityType: 'CENTER',
          entityId: String(centerIds[0]),
          fieldName: 'clusterId',
        }),
      ).toBeGreaterThan(0);
    });

    (process.env.AUTH_WEB_SMOKE === 'true' ? it : it.skip)(
      'serves protected admin pages and user creation through Next',
      async () => {
        try {
          await webAuthSmoke(
            await app.getUrl(),
            (value) => {
              app.get(AuthConfig).values.ALLOWED_ORIGINS = value;
            },
            password,
            true,
          );
        } finally {
          app.get(AuthConfig).values.ALLOWED_ORIGINS = origin;
        }
      },
      180000,
    );
  },
);
