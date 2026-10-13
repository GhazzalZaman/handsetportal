import { Injectable, NotFoundException } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import {
  Role,
  Session,
  User,
  UserCenterAssignment,
  UserClusterAssignment,
} from '../database/entities';
import { PageDto, UserQueryDto, pageResult } from '../admin/admin.dto';
import { Clock } from '../auth/clock';
@Injectable()
export class UsersRepository {
  constructor(
    private readonly db: DataSource,
    private readonly clock: Clock,
  ) {}
  async entity(manager: EntityManager, id: number, lock = false) {
    const q = manager
      .getRepository(User)
      .createQueryBuilder('user')
      .where('user.id=:id', { id });
    if (lock) q.setLock('pessimistic_write');
    const user = await q.getOne();
    if (!user) throw new NotFoundException();
    return user;
  }
  async assignments(manager: EntityManager, id: number) {
    const centers = await manager.findBy(UserCenterAssignment, { userId: id });
    const clusters = await manager.findBy(UserClusterAssignment, {
      userId: id,
    });
    return {
      centerIds: centers.map((c) => c.centerId).sort((a, b) => a - b),
      clusterIds: clusters.map((c) => c.clusterId).sort((a, b) => a - b),
    };
  }
  async view(user: User, manager: EntityManager = this.db.manager) {
    const role = await manager.findOneByOrFail(Role, { id: user.roleId });
    return {
      id: user.id,
      username: user.username,
      email: user.email,
      displayName: user.displayName,
      role: {
        id: role.id,
        code: role.code,
        name: role.name,
        scopeType: role.scopeType,
      },
      isActive: user.isActive,
      lockedUntil: user.lockedUntil,
      mustChangePassword: user.mustChangePassword,
      lastLoginAt: user.lastLoginAt,
      ...(await this.assignments(manager, user.id)),
    };
  }
  async detail(id: number) {
    return this.view(await this.entity(this.db.manager, id));
  }
  async list(dto: UserQueryDto) {
    const q = this.db.getRepository(User).createQueryBuilder('user');
    if (dto.roleId !== undefined)
      q.andWhere('user.roleId=:role', { role: dto.roleId });
    if (dto.isActive !== undefined)
      q.andWhere('user.isActive=:active', { active: dto.isActive });
    if (dto.centerId !== undefined)
      q.innerJoin(
        UserCenterAssignment,
        'centerAssignment',
        'centerAssignment.userId=user.id AND centerAssignment.centerId=:centerId',
        { centerId: dto.centerId },
      );
    if (dto.clusterId !== undefined)
      q.innerJoin(
        UserClusterAssignment,
        'clusterAssignment',
        'clusterAssignment.userId=user.id AND clusterAssignment.clusterId=:clusterId',
        { clusterId: dto.clusterId },
      );
    if (dto.search)
      q.andWhere(
        "(user.username LIKE :search ESCAPE '!' OR user.displayName LIKE :search ESCAPE '!' OR user.email LIKE :search ESCAPE '!')",
        { search: '%' + dto.search.replace(/[!%_[]/g, '!$&') + '%' },
      );
    const [users, total] = await q
      .orderBy('user.id', 'ASC')
      .skip((dto.page - 1) * dto.pageSize)
      .take(dto.pageSize)
      .getManyAndCount();
    return pageResult(
      await Promise.all(users.map((user) => this.view(user))),
      total,
      dto,
    );
  }
  async sessions(id: number, dto: PageDto) {
    await this.entity(this.db.manager, id);
    const [sessions, total] = await this.db
      .getRepository(Session)
      .createQueryBuilder('session')
      .where(
        'session.userId=:id AND session.revokedAt IS NULL AND session.idleExpiresAt > :now AND session.absoluteExpiresAt > :now',
        { id, now: this.clock.now() },
      )
      .orderBy('session.createdAt', 'DESC')
      .addOrderBy('session.id', 'DESC')
      .skip((dto.page - 1) * dto.pageSize)
      .take(dto.pageSize)
      .getManyAndCount();
    return pageResult(
      sessions.map((s) => ({
        createdAt: s.createdAt,
        lastSeenAt: s.lastSeenAt,
        ipAddress: s.ipAddress,
        userAgent: s.userAgent.slice(0, 100),
      })),
      total,
      dto,
    );
  }
}
