import { CatalogNormalizer } from '../../catalog/catalog-normalizer';
import { randomUUID } from 'node:crypto';
import {
  DeepPartial,
  EntityManager,
  EntityTarget,
  FindOptionsWhere,
  ObjectLiteral,
} from 'typeorm';
import { AuditLog } from '../entities';
export interface SeedContext {
  requestId: string;
  now: Date;
}
export function seedContext(now = new Date()): SeedContext {
  return { requestId: 'seed-' + randomUUID(), now };
}
export async function audit(
  manager: EntityManager,
  context: SeedContext,
  entityType: string,
  entityId: string,
  action: 'CREATE' | 'DELETE' | 'UPDATE',
  fieldName: string | null = null,
  oldValue: string | null = null,
  newValue: string | null = null,
): Promise<void> {
  await manager.insert(AuditLog, {
    entityType,
    entityId,
    action,
    fieldName,
    oldValue,
    newValue,
    changedAt: context.now,
    userId: null,
    requestId: context.requestId,
    ipAddress: null,
  });
}
export async function ensure<T extends ObjectLiteral>(
  manager: EntityManager,
  context: SeedContext,
  entity: EntityTarget<T>,
  where: FindOptionsWhere<T>,
  values: DeepPartial<T>,
): Promise<{ row: T; created: boolean }> {
  const repo = manager.getRepository(entity);
  const existing = await repo.findOneBy(where);
  if (existing) return { row: existing, created: false };
  const input = { ...values };
  if (repo.metadata.findColumnWithPropertyName('nameKey')) {
    const text = String(
      (input as Record<string, unknown>).name ??
        (input as Record<string, unknown>).label ??
        '',
    );
    Object.assign(input, { nameKey: new CatalogNormalizer().key(text) });
  }
  const row = await repo.save(repo.create(input));
  const identity = repo.metadata.primaryColumns
    .map((c) => String(row[c.propertyName]))
    .join(':');
  await audit(manager, context, repo.metadata.tableName, identity, 'CREATE');
  return { row, created: true };
}
/** Serialize all seed/clear jobs in the current database and schema. */
export async function lockSeed(manager: EntityManager): Promise<void> {
  const schema =
    (manager.connection.options as { schema?: string }).schema ?? 'dbo';
  const result: { result: number }[] = await manager.query(
    "DECLARE @r int; EXEC @r = sys.sp_getapplock @Resource=@0, @LockMode='Exclusive', @LockOwner='Transaction', @LockTimeout=15000; SELECT @r AS result",
    ['handset-seed:' + schema],
  );
  if (!result[0] || result[0].result < 0)
    throw new Error('Seed lock unavailable');
}
