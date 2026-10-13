import { EntityManager } from 'typeorm';
import { AuditLog } from '../database/entities';
import { AuthEventContext } from '../auth/auth.types';
export async function adminAudit(
  manager: EntityManager,
  context: AuthEventContext,
  entityType: string,
  entityId: number,
  field: string,
  oldValue: unknown,
  newValue: unknown,
  action = 'UPDATE',
) {
  const encode = (v: unknown) =>
    v === null || v === undefined
      ? null
      : typeof v === 'string'
        ? v
        : JSON.stringify(v);
  await manager.insert(AuditLog, {
    entityType,
    entityId: String(entityId),
    fieldName: field,
    oldValue: encode(oldValue),
    newValue: encode(newValue),
    action,
    userId: context.userId!,
    requestId: context.requestId,
    ipAddress: context.ip,
    changedAt: new Date(),
  });
}
