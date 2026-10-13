import { LoggerModule } from 'nestjs-pino';
import { AuthConfig } from '../src/auth/auth.config';
import 'reflect-metadata';
import { webAuthSmoke } from './web-auth-smoke';
import { config } from 'dotenv';
import { randomUUID } from 'node:crypto';
import {
  DynamicModule,
  Global,
  Module,
  INestApplication,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import request from 'supertest';
import { AuthModule } from '../src/auth/auth.module';
import { PasswordService } from '../src/auth/password.service';
import { CatalogModule } from '../src/catalog/catalog.module';
import { CatalogService } from '../src/catalog/catalog.service';
import { configureApp } from '../src/configure-app';
import { applicationDatabaseOptions } from '../src/database/options';
import { seedDatabase } from '../src/database/seed/seed';
import {
  Brand,
  Color,
  Role,
  User,
  HandsetModel,
  ModelSpecification,
  HandsetSku,
  InventoryStock,
  ExperienceCenter,
  AuditLog,
  DataImportBatch,
  Permission,
  RolePermission,
} from '../src/database/entities';
config({ quiet: true });
jest.setTimeout(120000);
@Global()
@Module({})
class CatalogDatabase {
  static register(db: DataSource): DynamicModule {
    return {
      module: CatalogDatabase,
      providers: [{ provide: DataSource, useValue: db }],
      exports: [DataSource],
    };
  }
}
const enabled = Boolean(process.env.TEST_DATABASE_URL);
if (!enabled)
  console.log('SKIP catalog integration: TEST_DATABASE_URL is not set.');
(enabled ? describe : describe.skip)('SQL-backed catalog', () => {
  const schema = 'catalog_test_' + randomUUID().replace(/-/g, '');
  const origin = 'http://localhost:3000',
    password = 'Synthetic catalog test password 42!';
  let db: DataSource, app: INestApplication, black: number, blue: number;
  type Credentials = { cookie: string; csrf: string };
  const auth: Record<string, Credentials> = {};
  const name = () => 'Device ' + randomUUID().replace(/-/g, '');
  const get = (path: string, role = 'SYSTEM_ADMIN') =>
    request(app.getHttpServer())
      .get('/api/v1/catalog/' + path)
      .set('Cookie', auth[role]!.cookie);
  const write = (
    path: string,
    body: object = {},
    method: 'post' | 'patch' = 'post',
    role = 'SYSTEM_ADMIN',
  ) =>
    request(app.getHttpServer())
      [method]('/api/v1/catalog/' + path)
      .set('Cookie', auth[role]!.cookie)
      .set('Origin', origin)
      .set('X-CSRF-Token', auth[role]!.csrf)
      .send(body);
  const handset = () => ({
    brand: { name: name() },
    model: { name: name() },
    specifications: [
      { ramGb: 4, storageGb: 64 },
      { ramGb: 12, storageGb: 512 },
    ],
    colors: [{ id: black }, { id: blue }],
    confirmDistinct: true,
  });
  const counts = () =>
    Promise.all(
      [
        Brand,
        HandsetModel,
        ModelSpecification,
        Color,
        HandsetSku,
        AuditLog,
        DataImportBatch,
      ].map((e) => db.getRepository(e).count()),
    );
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
    const module = await Test.createTestingModule({
      imports: [
        CatalogDatabase.register(db),
        LoggerModule.forRoot({ pinoHttp: { level: 'silent' } }),
        AuthModule,
        CatalogModule,
      ],
    })
      .overrideProvider(AuthConfig)
      .useValue(
        new AuthConfig(
          new ConfigService({
            CSRF_SECRET: 'catalog-test-secret-at-least-32-characters',
            ALLOWED_ORIGINS: origin,
            NODE_ENV: 'test',
            LOGIN_IP_LIMIT: 1000,
            LOGIN_USERNAME_LIMIT: 1000,
          }),
        ),
      )
      .compile();
    app = module.createNestApplication({ logger: false });
    configureApp(app, false);
    await app.listen(0, '127.0.0.1');
    const hash = await app.get(PasswordService).hash(password);
    for (const role of await db.getRepository(Role).find()) {
      await db.getRepository(User).save({
        username: role.code,
        displayName: 'Catalog Test',
        passwordHash: hash,
        roleId: role.id,
        mustChangePassword: false,
      });
      const login = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .set('Origin', origin)
        .send({ username: role.code, password })
        .expect(200);
      const cookie = String(login.headers['set-cookie']?.[0]).split(';')[0]!;
      const csrf = (
        await request(app.getHttpServer())
          .get('/api/v1/auth/csrf')
          .set('Cookie', cookie)
          .expect(200)
      ).body.csrfToken as string;
      auth[role.code] = { cookie, csrf };
    }
    black = (await db.getRepository(Color).findOneByOrFail({ name: 'Black' }))
      .id;
    blue = (await db.getRepository(Color).findOneByOrFail({ name: 'Blue' })).id;
  }, 180000);
  afterAll(async () => {
    if (app) await app.close();
    if (!db?.isInitialized) return;
    const runner = db.createQueryRunner();
    try {
      const rows: { count: number }[] = await db.query(
        'SELECT COUNT(*) AS count FROM [' + schema + '].[schema_migrations]',
      );
      for (let i = 0; i < (rows[0]?.count ?? 0); i++)
        await db.undoLastMigration({ transaction: 'all' });
      await runner.dropTable(schema + '.schema_migrations');
      await runner.dropSchema(schema, false);
    } finally {
      await runner.release();
      await db.destroy();
    }
  }, 180000);
  it('backfills keys and migrates legacy grants on down/up without losing custom grants', async () => {
    // Remove the later additive listPrice migration before testing the catalog backfill.
    await db.undoLastMigration({ transaction: 'all' });
    await db.undoLastMigration({ transaction: 'all' });
    await db.query('INSERT INTO [' + schema + '].[brands] (name) VALUES (@0)', [
      'Caf\u00e9 Migration',
    ]);
    await db.query('INSERT INTO [' + schema + '].[brands] (name) VALUES (@0)', [
      'Cafe-Migration',
    ]);
    await expect(db.runMigrations()).rejects.toThrow(
      'Catalog backfill requires manual review',
    );
    await db.query('DELETE FROM [' + schema + '].[brands] WHERE name = @0', [
      'Cafe-Migration',
    ]);
    await db.runMigrations();
    const row = await db
      .getRepository(Brand)
      .createQueryBuilder('b')
      .addSelect('b.nameKey')
      .where('b.name = :name', { name: 'Café Migration' })
      .getOneOrFail();
    expect(row.nameKey).toBe('cafemigration');
    expect(
      await db.getRepository(Permission).countBy({ code: 'masterdata.edit' }),
    ).toBe(0);
    // Rollback intentionally collapses create/manage to edit; restore strict default test matrix.
    const role = await db
      .getRepository(Role)
      .findOneByOrFail({ code: 'EXPERIENCE_CENTER_MANAGER' });
    const manage = await db
      .getRepository(Permission)
      .findOneByOrFail({ code: 'masterdata.manage' });
    await db
      .getRepository(RolePermission)
      .delete({ roleId: role.id, permissionId: manage.id });
  });
  it('reads globally for every dashboard role and hides internal columns', async () => {
    for (const role of Object.keys(auth)) {
      const response = await get('brands', role).expect(200);
      expect(response.body.items.length).toBeGreaterThan(0);
      expect(JSON.stringify(response.body)).not.toContain('nameKey');
    }
  });
  it('enforces every create/manage endpoint for view-only roles and manager', async () => {
    const creates = [
      'brands',
      'colors',
      'models',
      'models/1/specifications',
      'models/1/skus',
      'handsets',
    ];
    const manages = [
      'brands',
      'models',
      'colors',
      'specifications',
      'skus',
    ].flatMap((k) => [k + '/1/activate', k + '/1/deactivate']);
    for (const role of [
      'EXPERIENCE_CENTER_SUPERVISOR',
      'HEAD_OF_EXPERIENCE_CENTERS',
      'CLUSTER_HEAD',
      'OTHER_STAKEHOLDER',
    ]) {
      for (const path of [...creates, ...manages, 'import'])
        await write(path, {}, 'post', role).expect(403);
      for (const kind of ['brands', 'models', 'colors', 'specifications'])
        await write(kind + '/1', {}, 'patch', role).expect(403);
    }
    for (const path of [...manages, 'import'])
      await write(path, {}, 'post', 'EXPERIENCE_CENTER_MANAGER').expect(403);
    for (const kind of ['brands', 'models', 'colors', 'specifications'])
      await write(kind + '/1', {}, 'patch', 'EXPERIENCE_CENTER_MANAGER').expect(
        403,
      );
    await write(
      'handsets',
      handset(),
      'post',
      'EXPERIENCE_CENTER_MANAGER',
    ).expect(201);
  }, 300000);
  it('creates cross-product SKUs and one correlated audit per entity', async () => {
    const response = await write('handsets', handset()).expect(201);
    expect(response.body.skus).toHaveLength(4);
    const ids = [
      response.body.brand.id,
      response.body.model.id,
      ...response.body.specifications.map((s: { id: number }) => s.id),
      ...response.body.skus.map((s: { id: number }) => s.id),
    ];
    const log = await db.getRepository(AuditLog).findOneByOrFail({
      entityType: 'MODEL',
      entityId: String(response.body.model.id),
      action: 'CREATE',
    });
    expect(
      await db.getRepository(AuditLog).countBy({ requestId: log.requestId }),
    ).toBe(ids.length);
    expect(
      (await get('models/' + response.body.model.id).expect(200)).body.skus
        .total,
    ).toBe(4);
  });
  it('stores per-variant prices, combines server filters, and audits versioned listPrice edits', async () => {
    const result = await write('handsets', {
      ...handset(),
      variantPrices: [
        { colorIndex: 0, specificationIndex: 0, listPrice: '54999.50' },
        { colorIndex: 1, specificationIndex: 1, listPrice: '79999' },
      ],
    }).expect(201);
    const brandId = result.body.brand.id;
    const list = await get(
      `skus?brandId=${brandId}&colorId=${black}&ramGb=4&storageGb=64&pageSize=1`,
    ).expect(200);
    expect(list.body.total).toBe(1);
    const row = list.body.items[0];
    expect(row.listPrice).toBe('54999.50');
    expect(row.modelName).toBe(result.body.model.name);
    expect(row.brandName).toBe(result.body.brand.name);
    expect(row.specification.storageGb).toBe(64);
    expect(
      (await get(`skus?brandId=${brandId}&ramGb=4&storageGb=512`).expect(200))
        .body.total,
    ).toBe(0);
    await write(
      `skus/${row.id}/list-price`,
      { listPrice: '1.001', rowVersion: row.rowVersion },
      'patch',
    ).expect(400);
    await write(
      `skus/${row.id}/list-price`,
      { listPrice: '65000', rowVersion: row.rowVersion },
      'patch',
      'EXPERIENCE_CENTER_MANAGER',
    ).expect(403);
    const changed = await write(
      `skus/${row.id}/list-price`,
      { listPrice: '65000', rowVersion: row.rowVersion },
      'patch',
    ).expect(200);
    expect(changed.body.listPrice).toBe('65000.00');
    await write(
      `skus/${row.id}/list-price`,
      { listPrice: '66000', rowVersion: row.rowVersion },
      'patch',
    ).expect(409);
    expect(
      await db.getRepository(AuditLog).countBy({
        entityType: 'SKU',
        entityId: String(row.id),
        fieldName: 'listPrice',
      }),
    ).toBe(1);
    await write(
      `skus/${row.id}/list-price`,
      { listPrice: null, rowVersion: changed.body.rowVersion },
      'patch',
    ).expect(200);
    expect(
      (await db.getRepository(HandsetSku).findOneByOrFail({ id: row.id }))
        .listPrice,
    ).toBeNull();
  });
  it('rolls back a forced failure midway through handset creation', async () => {
    const before = await counts();
    const service = app.get(CatalogService);
    const original = service.sku.bind(service);
    let called = 0;
    const spy = jest
      .spyOn(service, 'sku')
      .mockImplementation(async (...args) => {
        if (++called === 2) throw Error('Synthetic failure');
        return original(...args);
      });
    try {
      await write('handsets', handset()).expect(500);
    } finally {
      spy.mockRestore();
    }
    expect(await counts()).toEqual(before);
  });
  it('rejects exact duplicates and allows explicitly confirmed near duplicates', async () => {
    const brand = (
      await write('brands', { name: 'Distinctive Galaxy Catalog' }).expect(201)
    ).body;
    expect(
      (
        await write('brands', {
          name: 'distinctive-galaxy catalog',
          confirmDistinct: true,
        }).expect(409)
      ).body.error.code,
    ).toBe('DUPLICATE');
    const response = await write('brands', {
      name: 'Distinctive Galaxy Catalog Pro',
    }).expect(409);
    expect(response.body.error.code).toBe('POSSIBLE_DUPLICATE');
    expect(response.body.error.details.existing[0].id).toBe(brand.id);
    await write('brands', {
      name: 'Distinctive Galaxy Catalog Pro',
      confirmDistinct: true,
    }).expect(201);
  });
  it('rejects stale updates and applies normalized renames', async () => {
    const row = (await write('brands', { name: name() }).expect(201)).body;
    const updated = (
      await write(
        'brands/' + row.id,
        { name: name(), rowVersion: row.rowVersion },
        'patch',
      ).expect(200)
    ).body;
    expect(updated.rowVersion).toBe(row.rowVersion + 1);
    expect(
      (
        await write(
          'brands/' + row.id,
          { name: name(), rowVersion: row.rowVersion },
          'patch',
        ).expect(409)
      ).body.error.code,
    ).toBe('CONFLICT');
  });
  it('blocks stock, cascades deactivation, and enforces active parents', async () => {
    const h = (await write('handsets', handset()).expect(201)).body;
    const center = await db
      .getRepository(ExperienceCenter)
      .findOneByOrFail({ code: 'FSD' });
    const stock = await db
      .getRepository(InventoryStock)
      .save({ centerId: center.id, skuId: h.skus[0].id, quantityAvailable: 3 });
    const blocked = await write('brands/' + h.brand.id + '/deactivate', {
      rowVersion: 1,
    }).expect(409);
    expect(blocked.body.error.code).toBe('HAS_STOCK');
    expect(blocked.body.error.details.centers[0].quantity).toBe(3);
    await db
      .getRepository(InventoryStock)
      .update(stock.id, { quantityAvailable: 0 });
    await write('brands/' + h.brand.id + '/deactivate', {
      rowVersion: 1,
    }).expect(201);
    expect(
      await db
        .getRepository(HandsetSku)
        .countBy({ modelId: h.model.id, isActive: true }),
    ).toBe(0);
    await write('models/' + h.model.id + '/activate', { rowVersion: 2 }).expect(
      404,
    );
    await get('models/' + h.model.id, 'EXPERIENCE_CENTER_MANAGER').expect(404);
    await get('models/' + h.model.id + '?includeInactive=true').expect(200);
    await write('brands/' + h.brand.id + '/activate', { rowVersion: 2 }).expect(
      201,
    );
    await write('models/' + h.model.id + '/activate', { rowVersion: 2 }).expect(
      201,
    );
  });
  it('has no SKU identity patch or hard-delete routes, and rejects CSRF omission', async () => {
    await write('skus/1', { colorId: blue, rowVersion: 1 }, 'patch').expect(
      404,
    );
    await request(app.getHttpServer())
      .delete('/api/v1/catalog/brands/1')
      .set('Cookie', auth.SYSTEM_ADMIN!.cookie)
      .set('Origin', origin)
      .set('X-CSRF-Token', auth.SYSTEM_ADMIN!.csrf)
      .expect(404);
    await request(app.getHttpServer())
      .post('/api/v1/catalog/brands')
      .set('Cookie', auth.SYSTEM_ADMIN!.cookie)
      .set('Origin', origin)
      .send({ name: name() })
      .expect(403);
  });
  it('imports only valid rows, keeps dry runs read-only, and neutralizes echoed formulas', async () => {
    const brand = name(),
      model = name();
    const csv = `brand,model,ram_gb,storage_gb,color\n${brand},${model},4,64,Black\n${brand},${model},4,64,Black\n${brand},${model} Pro,4,64,Black\n=Invalid,Bad,-2,64,Black\n`;
    const upload = (dry: boolean, value = csv) =>
      request(app.getHttpServer())
        .post('/api/v1/catalog/import?dryRun=' + dry)
        .set('Cookie', auth.SYSTEM_ADMIN!.cookie)
        .set('Origin', origin)
        .set('X-CSRF-Token', auth.SYSTEM_ADMIN!.csrf)
        .attach('file', Buffer.from(value), {
          filename: 'catalog.csv',
          contentType: 'text/csv',
        });
    const before = await counts();
    const preview = (await upload(true).expect(201)).body;
    expect(await counts()).toEqual(before);
    expect(preview.totals).toMatchObject({
      wouldCreate: 1,
      alreadyExists: 1,
      possibleDuplicate: 1,
      invalid: 1,
    });
    expect(preview.rows[3].cells[0]).toBe("'=Invalid");
    const applied = (await upload(false).expect(201)).body;
    expect(applied.totals.created).toBe(1);
    expect(
      await db.getRepository(DataImportBatch).countBy({ kind: 'MASTER' }),
    ).toBe(1);
    await upload(true, 'bad header\nfoo').expect(400);
    await upload(true, 'x'.repeat(2097153)).expect(413);
    await get('import/template').expect(200);
  });
  it('supports individual create/correct/status actions and rejects invalid specification identity', async () => {
    const role = 'EXPERIENCE_CENTER_MANAGER';
    const brand = (
      await write('brands', { name: name() }, 'post', role).expect(201)
    ).body;
    const model = (
      await write(
        'models',
        { brandId: brand.id, name: name() },
        'post',
        role,
      ).expect(201)
    ).body;
    const color = (
      await write(
        'colors',
        { name: 'Hue' + randomUUID().replace(/-/g, '') },
        'post',
        role,
      ).expect(201)
    ).body;
    const spec = (
      await write(
        'models/' + model.id + '/specifications',
        { ramGb: 6, storageGb: 256 },
        'post',
        role,
      ).expect(201)
    ).body;
    const sku = (
      await write(
        'models/' + model.id + '/skus',
        { colorId: color.id, specificationId: spec.id },
        'post',
        role,
      ).expect(201)
    ).body;
    await write(
      'models/' + model.id + '/specifications',
      { ramGb: 4 },
      'post',
      role,
    ).expect(400);
    await write(
      'models/' + model.id + '/specifications',
      { ramGb: 4, storageGb: 64, label: 'custom' },
      'post',
      role,
    ).expect(400);
    await write('handsets', {
      ...handset(),
      brand: { id: brand.id, name: 'Both' },
    }).expect(400);
    await write('handsets', {
      colors: [{ id: black }],
      specifications: [],
    }).expect(400);
    await write(
      'models/' + model.id,
      { name: name(), rowVersion: 1 },
      'patch',
    ).expect(200);
    await write(
      'colors/' + color.id,
      { name: 'Hue' + randomUUID().replace(/-/g, ''), rowVersion: 1 },
      'patch',
    ).expect(200);
    await write(
      'specifications/' + spec.id,
      { ramGb: 8, storageGb: 256, rowVersion: 1 },
      'patch',
    ).expect(200);
    await write('specifications/' + spec.id + '/deactivate', {
      rowVersion: 2,
    }).expect(201);
    expect(
      (await db.getRepository(HandsetSku).findOneByOrFail({ id: sku.id }))
        .isActive,
    ).toBe(false);
    await write('specifications/' + spec.id + '/activate', {
      rowVersion: 3,
    }).expect(201);
    await write('skus/' + sku.id + '/activate', { rowVersion: 2 }).expect(201);
    await write('skus/' + sku.id + '/deactivate', { rowVersion: 3 }).expect(
      201,
    );
    await write('colors/' + color.id + '/deactivate', { rowVersion: 2 }).expect(
      201,
    );
    await write('colors/' + color.id + '/activate', { rowVersion: 3 }).expect(
      201,
    );
    await write('models/' + model.id + '/deactivate', { rowVersion: 2 }).expect(
      201,
    );
    await write('models/' + model.id + '/activate', { rowVersion: 3 }).expect(
      201,
    );
    const filtered = await get(
      'skus?includeInactive=true&brandId=' +
        brand.id +
        '&modelId=' +
        model.id +
        '&colorId=' +
        color.id +
        '&specificationId=' +
        spec.id,
    ).expect(200);
    expect(filtered.body.total).toBe(1);
    expect(
      (await get('models?brandId=' + brand.id + '&search=Device').expect(200))
        .body.total,
    ).toBe(1);
  });
  it('blocks global stock without disclosing outside-scope centers to a custom manager', async () => {
    const role = await db
      .getRepository(Role)
      .findOneByOrFail({ code: 'EXPERIENCE_CENTER_MANAGER' });
    const permission = await db
      .getRepository(Permission)
      .findOneByOrFail({ code: 'masterdata.manage' });
    await db
      .getRepository(RolePermission)
      .insert({ roleId: role.id, permissionId: permission.id });
    try {
      const h = (await write('handsets', handset()).expect(201)).body;
      const center = await db
        .getRepository(ExperienceCenter)
        .findOneByOrFail({ code: 'FSD' });
      await db.getRepository(InventoryStock).save({
        centerId: center.id,
        skuId: h.skus[0].id,
        quantityAvailable: 2,
      });
      const blocked = await write(
        'brands/' + h.brand.id + '/deactivate',
        { rowVersion: 1 },
        'post',
        'EXPERIENCE_CENTER_MANAGER',
      ).expect(409);
      expect(blocked.body.error.code).toBe('HAS_STOCK');
      expect(blocked.body.error.details.centers).toEqual([]);
    } finally {
      await db
        .getRepository(RolePermission)
        .delete({ roleId: role.id, permissionId: permission.id });
    }
  });
  (process.env.AUTH_WEB_SMOKE === 'true' ? it : it.skip)(
    'serves catalog and mutations through the Next proxy',
    async () => {
      try {
        await webAuthSmoke(
          await app.getUrl(),
          (value) => {
            app.get(AuthConfig).values.ALLOWED_ORIGINS = value;
          },
          password,
          false,
          true,
        );
      } finally {
        app.get(AuthConfig).values.ALLOWED_ORIGINS = origin;
      }
    },
    120000,
  );
});
