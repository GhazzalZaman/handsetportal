import { Injectable } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { CatalogTransaction } from '../catalog/catalog-transaction';
import { Principal } from '../auth/auth.types';
import { ScopeService, CenterScope } from '../scope/scope.service';
import { User, Permission, RolePermission } from '../database/entities';
@Injectable()
export class InventoryTransaction {
  constructor(
    private readonly tx: CatalogTransaction,
    private readonly scopes: ScopeService,
  ) {}
  run<T>(
    actor: Principal,
    permission: string,
    work: (
      manager: EntityManager,
      scope: CenterScope,
      permissions: string[],
    ) => Promise<T>,
  ) {
    return this.tx.run(actor, permission, async (manager) => {
      const user = await manager.findOneByOrFail(User, { id: actor.id });
      const grants = await manager
        .getRepository(Permission)
        .createQueryBuilder('p')
        .innerJoin(RolePermission, 'g', 'g.permissionId=p.id')
        .where('g.roleId=:role AND p.isActive=:active', {
          role: user.roleId,
          active: true,
        })
        .getMany();
      const permissions = grants.map((p) => p.code);
      return work(
        manager,
        await this.scopes.resolve(actor.id, permissions, manager),
        permissions,
      );
    });
  }
}
