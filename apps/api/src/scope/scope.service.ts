import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  DataSource,
  EntityManager,
  ObjectLiteral,
  SelectQueryBuilder,
} from 'typeorm';
import {
  Cluster,
  ExperienceCenter,
  Role,
  User,
  UserCenterAssignment,
  UserClusterAssignment,
} from '../database/entities';
export class CenterScope {
  constructor(
    readonly allCenters: boolean,
    readonly centerIds: number[],
    private readonly permissions: string[],
  ) {}
  applyToQuery<T extends ObjectLiteral>(
    qb: SelectQueryBuilder<T>,
    column: string,
  ): SelectQueryBuilder<T> {
    // Column is a developer-supplied alias, never request input.
    if (!/^[A-Za-z_][A-Za-z0-9_]*\.[A-Za-z_][A-Za-z0-9_]*$/.test(column))
      throw new Error('Invalid center column alias');
    if (!this.centerIds.length) return qb.andWhere('1 = 0');
    const key = 'scopeCenters' + Object.keys(qb.getParameters()).length;
    // One bound JSON parameter avoids SQL Server's 2100-parameter limit.
    return qb.andWhere(
      column +
        ' IN (SELECT [value] FROM OPENJSON(:' +
        key +
        ") WITH ([value] int '$'))",
      { [key]: JSON.stringify(this.centerIds) },
    );
  }
  assertCanAccessCenter(id: number, resourceLookup = false): void {
    if (!this.centerIds.includes(id)) {
      if (resourceLookup) throw new NotFoundException();
      throw new ForbiddenException();
    }
  }
  assertCanEditCenter(id: number, requiredPermission?: string): void {
    this.assertCanAccessCenter(id);
    if (
      !(requiredPermission
        ? this.permissions.includes(requiredPermission)
        : [
            'inventory.receive',
            'inventory.adjust',
            'inventory.import',
            'sales.record',
            'sales.void',
          ].some((permission) => this.permissions.includes(permission)))
    )
      throw new ForbiddenException();
  }
}
@Injectable()
export class ScopeService {
  constructor(private readonly db: DataSource) {}
  async resolve(
    userId: number,
    permissions: string[],
    manager: EntityManager = this.db.manager,
  ): Promise<CenterScope> {
    const user = await manager.findOneBy(User, { id: userId, isActive: true });
    const role = user
      ? await manager.findOneBy(Role, { id: user.roleId, isActive: true })
      : null;
    if (!role) return new CenterScope(false, [], permissions);
    const query = manager
      .getRepository(ExperienceCenter)
      .createQueryBuilder('center')
      .where('center.isActive = :active', { active: true });
    if (role.scopeType !== 'ALL') {
      const direct = manager
        .getRepository(UserCenterAssignment)
        .createQueryBuilder('direct')
        .select('direct.centerId')
        .where('direct.userId = :scopeUser');
      if (['CLUSTER', 'ASSIGNED'].includes(role.scopeType)) {
        const clusters = manager
          .getRepository(UserClusterAssignment)
          .createQueryBuilder('assigned')
          .select('assigned.clusterId')
          .innerJoin(
            Cluster,
            'cluster',
            'cluster.id = assigned.clusterId AND cluster.isActive = :active',
          )
          .where('assigned.userId = :scopeUser');
        query.andWhere(
          '(center.id IN (' +
            direct.getQuery() +
            ') OR center.clusterId IN (' +
            clusters.getQuery() +
            '))',
          { scopeUser: userId },
        );
      } else if (role.scopeType === 'CENTER')
        query.andWhere('center.id IN (' + direct.getQuery() + ')', {
          scopeUser: userId,
        });
      else query.andWhere('1 = 0');
    }
    const centers = await query
      .select(['center.id'])
      .orderBy('center.id', 'ASC')
      .getMany();
    return new CenterScope(
      role.scopeType === 'ALL',
      centers.map((c) => c.id),
      permissions,
    );
  }
}
