import { Injectable, NotFoundException } from '@nestjs/common';
import { In } from 'typeorm';
import { Permission, Role, RolePermission } from '../database/entities';
import { AdminTransaction } from '../admin/admin-transaction';
import { adminAudit } from '../admin/admin-audit';
import { AdminError } from '../admin/admin.error';
import { AuthEventContext, Principal } from '../auth/auth.types';
import { RolesRepository } from './roles.repository';
@Injectable()
export class RolesService {
  constructor(
    private readonly tx: AdminTransaction,
    private readonly repo: RolesRepository,
  ) {}
  replace(
    id: number,
    codes: string[],
    actor: Principal,
    context: AuthEventContext,
  ) {
    return this.tx.run(actor, async (manager, user) => {
      const role = await manager.findOneBy(Role, { id, isActive: true });
      if (!role) throw new NotFoundException();
      if (
        role.code === 'SYSTEM_ADMIN' &&
        (!codes.includes('users.manage') || !codes.includes('audit.view'))
      )
        throw new AdminError('ADMIN_PERMISSIONS_REQUIRED', 409);
      if (user.roleId === id && !codes.includes('users.manage'))
        throw new AdminError('SELF_PERMISSION_REMOVAL', 403);
      const permissions = codes.length
        ? await manager.findBy(Permission, { code: In(codes), isActive: true })
        : [];
      if (
        permissions.length !== codes.length ||
        codes.some((code) => !permissions.some((p) => p.code === code))
      )
        throw new AdminError('UNKNOWN_PERMISSION');
      const old = await this.repo.codes(manager, id),
        before = old.map((p) => p.code);
      for (const permission of old.filter((p) => !codes.includes(p.code))) {
        await manager.delete(RolePermission, {
          roleId: id,
          permissionId: permission.id,
        });
        await adminAudit(
          manager,
          context,
          'ROLE',
          id,
          'permission:' + permission.code,
          true,
          false,
        );
      }
      for (const permission of permissions.filter(
        (p) => !before.includes(p.code),
      )) {
        await manager.insert(RolePermission, {
          roleId: id,
          permissionId: permission.id,
          createdBy: actor.id,
          updatedBy: actor.id,
        });
        await adminAudit(
          manager,
          context,
          'ROLE',
          id,
          'permission:' + permission.code,
          false,
          true,
        );
      }
      // Permissions are not in the session fingerprint. Every request reloads them.
      return { id, permissionCodes: permissions.map((p) => p.code).sort() };
    });
  }
}
