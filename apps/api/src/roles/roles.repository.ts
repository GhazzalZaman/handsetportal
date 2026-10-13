import { Injectable } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import { Permission, Role, RolePermission, User } from '../database/entities';
import { PageDto, pageResult } from '../admin/admin.dto';
@Injectable()
export class RolesRepository {
  constructor(private readonly db: DataSource) {}
  async codes(manager: EntityManager, id: number) {
    return manager
      .getRepository(Permission)
      .createQueryBuilder('permission')
      .innerJoin(RolePermission, 'grant', 'grant.permissionId=permission.id')
      .where('grant.roleId=:id', { id })
      .orderBy('permission.code', 'ASC')
      .getMany();
  }
  async roles(dto: PageDto) {
    const [roles, total] = await this.db.getRepository(Role).findAndCount({
      order: { id: 'ASC' },
      skip: (dto.page - 1) * dto.pageSize,
      take: dto.pageSize,
    });
    const items = await Promise.all(
      roles.map(async (role) => ({
        id: role.id,
        code: role.code,
        name: role.name,
        scopeType: role.scopeType,
        isActive: role.isActive,
        permissions: (await this.codes(this.db.manager, role.id)).map(
          (p) => p.code,
        ),
        userCount: await this.db.manager.countBy(User, { roleId: role.id }),
      })),
    );
    return pageResult(items, total, dto);
  }
  async permissions(dto: PageDto) {
    const [items, total] = await this.db
      .getRepository(Permission)
      .findAndCount({
        where: { isActive: true },
        select: { id: true, code: true, description: true },
        order: { id: 'ASC' },
        skip: (dto.page - 1) * dto.pageSize,
        take: dto.pageSize,
      });
    return pageResult(items, total, dto);
  }
}
