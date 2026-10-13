import { Injectable } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import {
  Permission,
  Role,
  RolePermission,
  User,
  UserCenterAssignment,
  UserClusterAssignment,
} from '../database/entities';
import { Identity } from './auth.types';
import { createHash } from 'node:crypto';
@Injectable()
export class IdentityRepository {
  async user(
    manager: EntityManager,
    where: { id?: number; username?: string },
    lock = false,
  ): Promise<User | null> {
    const query = manager
      .getRepository(User)
      .createQueryBuilder('user')
      .addSelect('user.passwordHash');
    if (where.id !== undefined) query.where('user.id = :id', { id: where.id });
    else query.where('user.username = :username', { username: where.username });
    if (lock) query.setLock('pessimistic_write');
    return query.getOne();
  }
  async identity(
    manager: EntityManager,
    user: User,
  ): Promise<{ identity: Identity; fingerprint: string } | null> {
    const role = await manager.findOneBy(Role, {
      id: user.roleId,
      isActive: true,
    });
    if (!role) return null;
    const permissions = await manager
      .getRepository(Permission)
      .createQueryBuilder('permission')
      .innerJoin(RolePermission, 'grant', 'grant.permissionId = permission.id')
      .where('grant.roleId = :id AND permission.isActive = :active', {
        id: role.id,
        active: true,
      })
      .orderBy('permission.code', 'ASC')
      .getMany();
    const codes = permissions.map((p) => p.code);
    // Role and assignment changes invalidate sessions; permission sets are always loaded fresh.
    const centers = (
      await manager.findBy(UserCenterAssignment, { userId: user.id })
    )
      .map((a) => a.centerId)
      .sort((a, b) => a - b);
    const clusters = (
      await manager.findBy(UserClusterAssignment, { userId: user.id })
    )
      .map((a) => a.clusterId)
      .sort((a, b) => a - b);
    const fingerprint = createHash('sha256')
      .update(
        JSON.stringify([role.id, role.code, role.scopeType, centers, clusters]),
      )
      .digest('hex');
    return {
      identity: {
        id: user.id,
        username: user.username,
        displayName: user.displayName,
        role: role.code,
        permissions: codes,
        mustChangePassword: user.mustChangePassword,
      },
      fingerprint,
    };
  }
}
