import { verify } from 'argon2';
import 'reflect-metadata';
import { config } from 'dotenv';
import { randomUUID } from 'node:crypto';
import { DataSource } from 'typeorm';
import { applicationDatabaseOptions } from '../src/database/options';
import {
  entities,
  Brand,
  Color,
  HandsetModel,
  ModelSpecification,
  HandsetSku,
  ExperienceCenter,
  InventoryStock,
  SalesTransaction,
  User,
  Role,
  AuditLog,
} from '../src/database/entities';
import { seedDatabase } from '../src/database/seed/seed';
import { clearDemo } from '../src/database/seed/demo';
config({ quiet: true });
const enabled = Boolean(process.env.TEST_DATABASE_URL);
if (!enabled)
  console.log(
    'SKIP database integration: TEST_DATABASE_URL is not set; no migration or rollback was attempted.',
  );
(enabled ? describe : describe.skip)(
  'SQL Server migration and seed lifecycle',
  () => {
    let db: DataSource;
    const schema = 'handset_test_' + randomUUID().replace(/-/g, '');
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
    }, 60000);
    afterAll(async () => {
      if (!db?.isInitialized) return;
      try {
        const runner = db.createQueryRunner();
        try {
          // Only this randomly named test schema can be removed. Never drop the database.
          const ledger = await runner.getTable(schema + '.schema_migrations');
          if (ledger) {
            const applied: { count: number }[] = await db.query(
              `SELECT COUNT(*) AS count FROM [${schema}].[schema_migrations]`,
            );
            for (let i = 0; i < (applied[0]?.count ?? 0); i++)
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
    it('runs up/down/up; rejects invalid records; seeds twice; preserves baseline during demo clear', async () => {
      await db.runMigrations();
      expect(db.entityMetadatas).toHaveLength(20);
      const seed = { demo: false };
      await seedDatabase(db, seed);
      const counts = async () =>
        Promise.all(entities.map((entity) => db.getRepository(entity).count()));
      const first = await counts();
      await seedDatabase(db, seed);
      expect(await counts()).toEqual(first);
      const center = await db
        .getRepository(ExperienceCenter)
        .findOneByOrFail({ code: 'FSD' });
      const brand = await db
        .getRepository(Brand)
        .findOneByOrFail({ name: 'Samsung' });
      const color = await db
        .getRepository(Color)
        .save({ name: 'Test Black', nameKey: 'testblack' });
      await expect(
        db.getRepository(Brand).insert({ name: 'samsung', nameKey: 'samsung' }),
      ).rejects.toThrow();
      const model = await db
        .getRepository(HandsetModel)
        .save({ brandId: brand.id, name: 'Test Model', nameKey: 'testmodel' });
      const model2 = await db.getRepository(HandsetModel).save({
        brandId: brand.id,
        name: 'Other Test Model',
        nameKey: 'othertestmodel',
      });
      const specification = await db
        .getRepository(ModelSpecification)
        .save({ modelId: model.id, label: '8GB/128GB', nameKey: '8gb128gb' });
      const nullSku = await db.getRepository(HandsetSku).save({
        modelId: model.id,
        colorId: color.id,
        specificationId: null,
        skuCode: 'TEST-NULL',
      });
      await expect(
        db.getRepository(HandsetSku).insert({
          modelId: model.id,
          colorId: color.id,
          specificationId: null,
          skuCode: 'TEST-NULL-2',
        }),
      ).rejects.toThrow();
      await db.getRepository(HandsetSku).insert({
        modelId: model.id,
        colorId: color.id,
        specificationId: specification.id,
        skuCode: 'TEST-SPEC',
      });
      await expect(
        db.getRepository(HandsetSku).insert({
          modelId: model.id,
          colorId: color.id,
          specificationId: specification.id,
          skuCode: 'TEST-SPEC-2',
        }),
      ).rejects.toThrow();
      await expect(
        db.getRepository(HandsetSku).insert({
          modelId: model2.id,
          colorId: color.id,
          specificationId: specification.id,
          skuCode: 'TEST-MISMATCH',
        }),
      ).rejects.toThrow();
      await expect(
        db.getRepository(InventoryStock).insert({
          centerId: center.id,
          skuId: nullSku.id,
          quantityAvailable: -1,
        }),
      ).rejects.toThrow();
      const sale = {
        centerId: center.id,
        skuId: nullSku.id,
        soldAt: new Date('2026-01-01T20:00:00Z'),
        saleDate: '2026-01-02',
        quantity: 1,
        salesType: 'CASH',
        dispatchSource: 'WAREHOUSE',
        sourceSystem: 'TEST',
        externalRef: 'unique-ref',
      };
      await db.getRepository(SalesTransaction).insert(sale);
      await expect(
        db.getRepository(SalesTransaction).insert(sale),
      ).rejects.toThrow();
      await expect(
        db
          .getRepository(SalesTransaction)
          .insert({ ...sale, externalRef: 'zero', quantity: 0 }),
      ).rejects.toThrow();
      await expect(
        db
          .getRepository(SalesTransaction)
          .insert({ ...sale, externalRef: 'date', saleDate: '2026-01-01' }),
      ).rejects.toThrow();
      await expect(
        db
          .getRepository(SalesTransaction)
          .insert({ ...sale, externalRef: 'enum', salesType: 'INVALID' }),
      ).rejects.toThrow();
      const role = await db
        .getRepository(Role)
        .findOneByOrFail({ code: 'OTHER_STAKEHOLDER' });
      for (const username of ['test-null-email-1', 'test-null-email-2'])
        await db.getRepository(User).insert({
          username,
          email: null,
          displayName: 'Test',
          passwordHash: 'test-only',
          roleId: role.id,
        });
      for (
        let migrationIndex = 0;
        migrationIndex < db.migrations.length;
        migrationIndex++
      )
        await db.undoLastMigration();
      const runner = db.createQueryRunner();
      try {
        for (const metadata of db.entityMetadatas)
          expect(await runner.hasTable(schema + '.' + metadata.tableName)).toBe(
            false,
          );
      } finally {
        await runner.release();
      }
      await db.runMigrations();
      await seedDatabase(db, seed);
      const baseline = await counts();
      await seedDatabase(db, seed);
      expect(await counts()).toEqual(baseline);
      const admin = {
        username: 'test-seed-admin',
        email: 'seed-test@example.invalid',
        password: 'Synthetic-test-password-42!',
      };
      await seedDatabase(db, { demo: false, admin });
      const administrator = await db
        .getRepository(User)
        .createQueryBuilder('user')
        .addSelect('user.passwordHash')
        .where('user.username = :username', { username: admin.username })
        .getOneOrFail();
      expect(administrator.mustChangePassword).toBe(true);
      expect(administrator.passwordHash.startsWith('$argon2id$')).toBe(true);
      expect(await verify(administrator.passwordHash, admin.password)).toBe(
        true,
      );
      await seedDatabase(db, {
        demo: false,
        admin: { ...admin, password: 'Changed-test-password-42!' },
      });
      const preserved = await db
        .getRepository(User)
        .createQueryBuilder('user')
        .addSelect('user.passwordHash')
        .where('user.id = :id', { id: administrator.id })
        .getOneOrFail();
      expect(preserved.passwordHash === administrator.passwordHash).toBe(true);
      await seedDatabase(db, { demo: true }, new Date('2026-10-06T10:00:00Z'));
      const demoCounts = await counts();
      await seedDatabase(db, { demo: true }, new Date('2026-10-06T10:00:00Z'));
      expect(await counts()).toEqual(demoCounts);
      expect(
        await db
          .getRepository(SalesTransaction)
          .countBy({ sourceSystem: 'DEMO' }),
      ).toBe(900);
      const auditCount = await db.getRepository(AuditLog).count();
      await clearDemo(db);
      expect(await db.getRepository(SalesTransaction).count()).toBe(0);
      expect(await db.getRepository(ExperienceCenter).count()).toBe(10);
      expect(await db.getRepository(Brand).count()).toBe(5);
      expect(await db.getRepository(AuditLog).count()).toBeGreaterThan(
        auditCount,
      );
      await clearDemo(db);
    }, 600000);
  },
);
