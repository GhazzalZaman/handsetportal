import { EntityManager } from 'typeorm';
import { AuditLog } from '../database/entities';
import { AuthEventContext } from './auth.types';
export async function auditAuth(
  manager: EntityManager,
  userId: number,
  fieldName: string,
  oldValue: string | null,
  newValue: string | null,
  context: AuthEventContext,
  now: Date,
): Promise<void> {
  await manager.insert(AuditLog, {
    entityType: 'USER',
    entityId: String(userId),
    action: 'UPDATE',
    fieldName,
    oldValue,
    newValue,
    userId: context.userId ?? null,
    changedAt: now,
    requestId: context.requestId,
    ipAddress: context.ip,
  });
}
