import { EntityManager } from 'typeorm';
import { startOfPktDay, startOfPktYear } from '@handset/shared';
import {
  AuditLog,
  Brand,
  Color,
  DataImportBatch,
  HandsetModel,
  HandsetSku,
  ModelSpecification,
} from '../entities';
import { seedBrands } from './roles.config';
import { ensure, lockSeed, SeedContext, seedContext } from './support';
const DAY = 86400000;
export function demoDates(now: Date): Date[] {
  const today = startOfPktDay(now);
  const year = startOfPktYear(now);
  // Recent 88 days plus explicit year-boundary anchors, even when today is October.
  return [
    ...new Set([
      ...Array.from({ length: 88 }, (_, i) => today.getTime() - i * DAY),
      year.getTime() - DAY,
      year.getTime(),
    ]),
  ]
    .sort((a, b) => a - b)
    .map((ms) => new Date(ms + 12 * 3600000));
}
export async function seedDemo(
  manager: EntityManager,
  context: SeedContext,
): Promise<void> {
  if (process.env.NODE_ENV === 'production')
    throw new Error('Demo data is forbidden in production');
  const previous = await manager.findOneBy(DataImportBatch, {
    sourceSystem: 'DEMO',
    fileName: 'module-1-demo-v1',
  });
  if (previous) return; // The whole seed is atomic, so this marker means all demo rows exist.
  const batch = (
    await ensure(
      manager,
      context,
      DataImportBatch,
      { sourceSystem: 'DEMO', fileName: 'module-1-demo-v1' },
      {
        sourceSystem: 'DEMO',
        fileName: 'module-1-demo-v1',
        kind: 'SALES',
        status: 'RUNNING',
        startedAt: context.now,
      },
    )
  ).row;
  const colors: Color[] = [];
  for (const name of ['Black', 'Blue', 'Silver'])
    colors.push(
      (
        await ensure(
          manager,
          context,
          Color,
          { name },
          { name, sourceSystem: 'DEMO' },
        )
      ).row,
    );
  const skuIds: number[] = [];
  for (const brandName of seedBrands) {
    const brand = await manager.findOneByOrFail(Brand, { name: brandName });
    for (let modelNumber = 1; modelNumber <= 2; modelNumber++) {
      const name = 'DEMO ' + brandName + ' Model ' + modelNumber;
      const model = (
        await ensure(
          manager,
          context,
          HandsetModel,
          { brandId: brand.id, name },
          { brandId: brand.id, name, sourceSystem: 'DEMO' },
        )
      ).row;
      for (const [ramGb, storageGb] of [
        [8, 128],
        [8, 256],
      ] as const) {
        const label = ramGb + 'GB/' + storageGb + 'GB';
        const specification = (
          await ensure(
            manager,
            context,
            ModelSpecification,
            { modelId: model.id, label },
            {
              modelId: model.id,
              label,
              ramGb,
              storageGb,
              notes: 'Synthetic demo specification',
              sourceSystem: 'DEMO',
            },
          )
        ).row;
        for (const color of colors) {
          const skuCode =
            'DEMO-' +
            brand.id +
            '-' +
            modelNumber +
            '-' +
            storageGb +
            '-' +
            color.id;
          const sku = (
            await ensure(
              manager,
              context,
              HandsetSku,
              { skuCode },
              {
                skuCode,
                modelId: model.id,
                specificationId: specification.id,
                colorId: color.id,
                sourceSystem: 'DEMO',
              },
            )
          ).row;
          skuIds.push(sku.id);
        }
      }
    }
  }
  // Module 5: demo seeding creates catalog fixtures only. Inventory and sales must use the application workflows.
  const sales: never[] = [];
  // A single create audit captures final batch state; no intermediate state escapes this transaction.
  await manager.update(DataImportBatch, batch.id, {
    status: 'SUCCESS',
    finishedAt: context.now,
    rowsReceived: sales.length,
    rowsAccepted: sales.length,
  });
  await manager.insert(
    AuditLog,
    ['status', 'finished_at', 'rows_received', 'rows_accepted'].map(
      (fieldName) => ({
        entityType: 'data_import_batches',
        entityId: batch.id,
        action: 'UPDATE',
        fieldName,
        oldValue:
          fieldName === 'status'
            ? 'RUNNING'
            : fieldName === 'finished_at'
              ? null
              : '0',
        newValue:
          fieldName === 'status'
            ? 'SUCCESS'
            : fieldName === 'finished_at'
              ? context.now.toISOString()
              : String(sales.length),
        userId: null,
        changedAt: context.now,
        requestId: context.requestId,
        ipAddress: null,
      }),
    ),
  );
}
export async function clearDemo(
  database: import('typeorm').DataSource,
): Promise<void> {
  if (process.env.NODE_ENV === 'production')
    throw new Error('Demo cleanup is forbidden in production');
  await database.transaction('SERIALIZABLE', async (manager) => {
    await lockSeed(manager);
    const context = seedContext();
    // Real rows referencing demo masters cause FK rejection and roll back this entire cleanup.
    for (const entity of [
      HandsetSku,
      ModelSpecification,
      HandsetModel,
      Color,
      DataImportBatch,
    ]) {
      const metadata = manager.connection.getMetadata(entity);
      const rows: { id: string | number }[] = await manager
        .createQueryBuilder(entity, 'row')
        .select('row.id', 'id')
        .where('row.sourceSystem = :source', { source: 'DEMO' })
        .getRawMany();
      for (let i = 0; i < rows.length; i += 75)
        await manager.insert(
          AuditLog,
          rows.slice(i, i + 75).map((row) => ({
            entityType: metadata.tableName,
            entityId: String(row.id),
            action: 'DELETE',
            fieldName: null,
            oldValue: null,
            newValue: null,
            userId: null,
            changedAt: context.now,
            requestId: context.requestId,
            ipAddress: null,
          })),
        );
      await manager
        .createQueryBuilder()
        .delete()
        .from(entity)
        .where('source_system = :source', { source: 'DEMO' })
        .execute();
    }
  });
  console.log(
    'Demo rows cleared. Append-only audit history and baseline masters were retained.',
  );
}
