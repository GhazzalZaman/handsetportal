import { Injectable } from '@nestjs/common';
import { EntityManager, In } from 'typeorm';
import { randomBytes } from 'node:crypto';
import {
  Cluster,
  ExperienceCenter,
  Role,
  User,
  UserCenterAssignment,
  UserClusterAssignment,
} from '../database/entities';
import { Principal, AuthEventContext } from '../auth/auth.types';
import { PasswordService } from '../auth/password.service';
import { AuthConfig } from '../auth/auth.config';
import { Clock } from '../auth/clock';
import { SessionService, RevocationReason } from '../sessions/session.service';
import { AdminTransaction } from '../admin/admin-transaction';
import { adminAudit } from '../admin/admin-audit';
import { AdminError } from '../admin/admin.error';
import { UsersRepository } from './users.repository';
import { CreateUserDto, PatchUserDto } from './users.dto';
import { validateAssignments } from './assignment-policy';
@Injectable()
export class UsersService {
  constructor(
    private readonly tx: AdminTransaction,
    private readonly repo: UsersRepository,
    private readonly passwords: PasswordService,
    private readonly config: AuthConfig,
    private readonly sessions: SessionService,
    private readonly clock: Clock,
  ) {}
  private temporary() {
    return randomBytes(96)
      .toString('base64url')
      .slice(0, Math.max(24, this.config.values.PASSWORD_MIN_LENGTH));
  }
  private async validate(
    manager: EntityManager,
    roleId: number,
    centerIds: number[],
    clusterIds: number[],
  ) {
    const role = await manager.findOneBy(Role, { id: roleId, isActive: true });
    if (!role) throw new AdminError('INVALID_ROLE');
    validateAssignments(role.scopeType, centerIds, clusterIds);
    if (
      centerIds.length &&
      (await manager.countBy(ExperienceCenter, {
        id: In(centerIds),
        isActive: true,
      })) !== centerIds.length
    )
      throw new AdminError('INVALID_CENTERS');
    if (
      clusterIds.length &&
      (await manager.countBy(Cluster, {
        id: In(clusterIds),
        isActive: true,
      })) !== clusterIds.length
    )
      throw new AdminError('INVALID_CLUSTERS');
  }
  private async assign(
    manager: EntityManager,
    id: number,
    centers: number[],
    clusters: number[],
    context: AuthEventContext,
    old: { centerIds: number[]; clusterIds: number[] },
  ) {
    for (const [field, before, after] of [
      ['ASSIGNED_CENTERS', old.centerIds, centers],
      ['ASSIGNED_CLUSTERS', old.clusterIds, clusters],
    ] as const) {
      if (JSON.stringify(before) !== JSON.stringify(after))
        await adminAudit(manager, context, 'USER', id, field, before, after);
    }
    const audit = {
      createdBy: context.userId!,
      updatedBy: context.userId!,
      createdAt: this.clock.now(),
      updatedAt: this.clock.now(),
    };
    if (JSON.stringify(old.centerIds) !== JSON.stringify(centers)) {
      await manager.delete(UserCenterAssignment, { userId: id });
      for (let offset = 0; offset < centers.length; offset += 100)
        await manager.insert(
          UserCenterAssignment,
          centers
            .slice(offset, offset + 100)
            .map((centerId) => ({ userId: id, centerId, ...audit })),
        );
    }
    if (JSON.stringify(old.clusterIds) !== JSON.stringify(clusters)) {
      await manager.delete(UserClusterAssignment, { userId: id });
      for (let offset = 0; offset < clusters.length; offset += 100)
        await manager.insert(
          UserClusterAssignment,
          clusters
            .slice(offset, offset + 100)
            .map((clusterId) => ({ userId: id, clusterId, ...audit })),
        );
    }
  }
  async create(
    dto: CreateUserDto,
    actor: Principal,
    context: AuthEventContext,
  ) {
    return this.tx.run(actor, async (manager) => {
      const centers = [...dto.centerIds].sort((a, b) => a - b),
        clusters = [...dto.clusterIds].sort((a, b) => a - b);
      await this.validate(manager, dto.roleId, centers, clusters);
      const temporaryPassword = dto.temporaryPassword ?? this.temporary();
      this.passwords.assertAllowed(temporaryPassword, dto.username, '');
      const user = await manager.save(
        User,
        manager.create(User, {
          username: dto.username,
          email: dto.email ?? null,
          displayName: dto.displayName,
          roleId: dto.roleId,
          passwordHash: await this.passwords.hash(temporaryPassword),
          isActive: true,
          mustChangePassword: true,
          passwordChangedAt: this.clock.now(),
          createdBy: actor.id,
          updatedBy: actor.id,
        }),
      );
      for (const field of [
        'username',
        'email',
        'displayName',
        'roleId',
        'isActive',
        'mustChangePassword',
      ] as const)
        await adminAudit(
          manager,
          context,
          'USER',
          user.id,
          field,
          null,
          user[field],
          'CREATE',
        );
      await adminAudit(
        manager,
        context,
        'USER',
        user.id,
        'password',
        '[REDACTED]',
        '[REDACTED]',
        'CREATE',
      );
      await this.assign(manager, user.id, centers, clusters, context, {
        centerIds: [],
        clusterIds: [],
      });
      return { user: await this.repo.view(user, manager), temporaryPassword };
    });
  }
  async patch(
    id: number,
    dto: PatchUserDto,
    actor: Principal,
    context: AuthEventContext,
  ) {
    return this.tx.run(actor, async (manager) => {
      const user = await this.repo.entity(manager, id, true),
        old = await this.repo.assignments(manager, id);
      const roleId = dto.roleId ?? user.roleId,
        centers = [...(dto.centerIds ?? old.centerIds)].sort((a, b) => a - b),
        clusters = [...(dto.clusterIds ?? old.clusterIds)].sort(
          (a, b) => a - b,
        );
      if (id === actor.id && roleId !== user.roleId)
        throw new AdminError('SELF_ROLE_CHANGE', 403);
      await this.validate(manager, roleId, centers, clusters);
      const privilegesChanged =
        roleId !== user.roleId ||
        JSON.stringify(centers) !== JSON.stringify(old.centerIds) ||
        JSON.stringify(clusters) !== JSON.stringify(old.clusterIds);
      const updates = {
        roleId,
        displayName: dto.displayName ?? user.displayName,
        email: dto.email === undefined ? user.email : dto.email,
      };
      for (const field of ['roleId', 'displayName', 'email'] as const)
        if (updates[field] !== user[field])
          await adminAudit(
            manager,
            context,
            'USER',
            id,
            field,
            user[field],
            updates[field],
          );
      if (
        privilegesChanged ||
        updates.displayName !== user.displayName ||
        updates.email !== user.email
      )
        await manager.update(User, id, {
          ...updates,
          updatedBy: actor.id,
          updatedAt: this.clock.now(),
        });
      if (privilegesChanged) {
        await this.assign(manager, id, centers, clusters, context, old);
        await this.sessions.revokeAllForUser(
          id,
          RevocationReason.ADMIN_REVOKED,
          undefined,
          manager,
        );
      }
      return this.repo.view(await this.repo.entity(manager, id), manager);
    });
  }
  async action(
    id: number,
    action:
      | 'activate'
      | 'deactivate'
      | 'reset-password'
      | 'unlock'
      | 'revoke-sessions',
    actor: Principal,
    context: AuthEventContext,
  ) {
    return this.tx.run(actor, async (manager) => {
      const user = await this.repo.entity(manager, id, true);
      if (action === 'deactivate' && id === actor.id)
        throw new AdminError('SELF_DEACTIVATION', 403);
      const updates: Partial<User> = {
        updatedAt: this.clock.now(),
        updatedBy: actor.id,
      };
      let temporaryPassword: string | undefined;
      if (action === 'activate' || action === 'deactivate')
        updates.isActive = action === 'activate';
      if (action === 'unlock' || action === 'reset-password') {
        updates.failedLoginCount = 0;
        updates.lockedUntil = null;
      }
      if (action === 'reset-password') {
        temporaryPassword = this.temporary();
        updates.passwordHash = await this.passwords.hash(temporaryPassword);
        updates.mustChangePassword = true;
        updates.passwordChangedAt = this.clock.now();
        await adminAudit(
          manager,
          context,
          'USER',
          id,
          'password',
          '[REDACTED]',
          '[REDACTED]',
        );
      }
      for (const field of [
        'isActive',
        'failedLoginCount',
        'lockedUntil',
        'mustChangePassword',
        'passwordChangedAt',
      ] as const)
        if (updates[field] !== undefined && updates[field] !== user[field])
          await adminAudit(
            manager,
            context,
            'USER',
            id,
            field,
            user[field],
            updates[field],
          );
      await manager.update(User, id, updates);
      if (
        ['deactivate', 'reset-password', 'revoke-sessions'].includes(action)
      ) {
        await this.sessions.revokeAllForUser(
          id,
          action === 'deactivate'
            ? RevocationReason.USER_DEACTIVATED
            : action === 'reset-password'
              ? RevocationReason.PASSWORD_CHANGED
              : RevocationReason.ADMIN_REVOKED,
          undefined,
          manager,
        );
        await adminAudit(
          manager,
          context,
          'USER',
          id,
          'SESSIONS_REVOKED',
          null,
          action,
        );
      }
      // Audit intent as well, including idempotent activate/unlock calls.
      await adminAudit(
        manager,
        context,
        'USER',
        id,
        'ADMIN_ACTION',
        null,
        action,
      );
      return temporaryPassword ? { temporaryPassword } : { ok: true };
    });
  }
}
