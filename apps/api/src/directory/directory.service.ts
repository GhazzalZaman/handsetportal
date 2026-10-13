import { Injectable, NotFoundException } from '@nestjs/common';
import { Cluster, ExperienceCenter } from '../database/entities';
import { AdminTransaction } from '../admin/admin-transaction';
import { adminAudit } from '../admin/admin-audit';
import { AdminError } from '../admin/admin.error';
import { Principal, AuthEventContext } from '../auth/auth.types';
import { ScopeService } from '../scope/scope.service';
import {
  CreateCenterDto,
  CreateClusterDto,
  PatchCenterDto,
  PatchClusterDto,
} from './directory.dto';
@Injectable()
export class DirectoryService {
  constructor(
    private readonly tx: AdminTransaction,
    private readonly scopes: ScopeService,
  ) {}
  createCluster(
    dto: CreateClusterDto,
    actor: Principal,
    context: AuthEventContext,
  ) {
    return this.tx.run(actor, async (manager) => {
      const row = await manager.save(
        Cluster,
        manager.create(Cluster, {
          ...dto,
          createdBy: actor.id,
          updatedBy: actor.id,
        }),
      );
      for (const key of ['code', 'name', 'isActive'] as const)
        await adminAudit(
          manager,
          context,
          'CLUSTER',
          row.id,
          key,
          null,
          row[key],
          'CREATE',
        );
      return {
        id: row.id,
        code: row.code,
        name: row.name,
        isActive: row.isActive,
      };
    });
  }
  patchCluster(
    id: number,
    dto: PatchClusterDto,
    actor: Principal,
    context: AuthEventContext,
  ) {
    return this.tx.run(actor, async (manager) => {
      const row = await manager.findOneBy(Cluster, { id });
      if (!row) throw new NotFoundException();
      for (const key of ['name', 'isActive'] as const)
        if (dto[key] !== undefined && dto[key] !== row[key])
          await adminAudit(
            manager,
            context,
            'CLUSTER',
            id,
            key,
            row[key],
            dto[key],
          );
      if (
        (['name', 'isActive'] as const).some(
          (key) => dto[key] !== undefined && dto[key] !== row[key],
        )
      )
        await manager.update(Cluster, id, {
          ...dto,
          updatedBy: actor.id,
          updatedAt: new Date(),
        });
      return {
        id,
        code: row.code,
        name: dto.name ?? row.name,
        isActive: dto.isActive ?? row.isActive,
      };
    });
  }
  createCenter(
    dto: CreateCenterDto,
    actor: Principal,
    context: AuthEventContext,
  ) {
    return this.tx.run(actor, async (manager) => {
      if (
        dto.clusterId &&
        !(await manager.findOneBy(Cluster, {
          id: dto.clusterId,
          isActive: true,
        }))
      )
        throw new AdminError('INVALID_CLUSTER');
      const row = await manager.save(
        ExperienceCenter,
        manager.create(ExperienceCenter, {
          ...dto,
          shortName: dto.shortName ?? null,
          clusterId: dto.clusterId ?? null,
          createdBy: actor.id,
          updatedBy: actor.id,
        }),
      );
      for (const key of [
        'code',
        'name',
        'shortName',
        'clusterId',
        'isActive',
      ] as const)
        await adminAudit(
          manager,
          context,
          'CENTER',
          row.id,
          key,
          null,
          row[key],
          'CREATE',
        );
      return {
        id: row.id,
        code: row.code,
        name: row.name,
        shortName: row.shortName,
        clusterId: row.clusterId,
        isActive: row.isActive,
      };
    });
  }
  patchCenter(
    id: number,
    dto: PatchCenterDto,
    actor: Principal,
    context: AuthEventContext,
  ) {
    return this.tx.run(actor, async (manager) => {
      const scope = await this.scopes.resolve(
        actor.id,
        actor.permissions,
        manager,
      );
      scope.assertCanAccessCenter(id, true);
      const query = manager
        .getRepository(ExperienceCenter)
        .createQueryBuilder('center')
        .where('center.id=:id', { id });
      const row = await scope.applyToQuery(query, 'center.id').getOne();
      if (!row) throw new NotFoundException();
      if (
        dto.clusterId &&
        !(await manager.findOneBy(Cluster, {
          id: dto.clusterId,
          isActive: true,
        }))
      )
        throw new AdminError('INVALID_CLUSTER');
      for (const key of ['name', 'shortName', 'clusterId', 'isActive'] as const)
        if (dto[key] !== undefined && dto[key] !== row[key])
          await adminAudit(
            manager,
            context,
            'CENTER',
            id,
            key,
            row[key],
            dto[key],
          );
      if (
        (['name', 'shortName', 'clusterId', 'isActive'] as const).some(
          (key) => dto[key] !== undefined && dto[key] !== row[key],
        )
      )
        await manager.update(ExperienceCenter, id, {
          ...dto,
          updatedBy: actor.id,
          updatedAt: new Date(),
        });
      return {
        id,
        code: row.code,
        name: dto.name ?? row.name,
        shortName: dto.shortName === undefined ? row.shortName : dto.shortName,
        clusterId: dto.clusterId === undefined ? row.clusterId : dto.clusterId,
        isActive: dto.isActive ?? row.isActive,
      };
    });
  }
}
