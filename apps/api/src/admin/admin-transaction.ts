import {
  Injectable,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { DataSource, EntityManager, QueryFailedError } from 'typeorm';
import {
  User,
  Role,
  RolePermission,
  Permission,
  Session,
} from '../database/entities';
import { Principal } from '../auth/auth.types';
import { sessionHash } from '../auth/crypto';
import { Clock } from '../auth/clock';
import { AdminError } from './admin.error';
@Injectable()
export class AdminTransaction {
  constructor(
    private readonly db: DataSource,
    private readonly clock: Clock,
  ) {}
  async run<T>(
    actor: Principal,
    work: (manager: EntityManager, user: User) => Promise<T>,
  ): Promise<T> {
    try {
      return await this.db.transaction(async (manager) => {
        const schema = (this.db.options as { schema: string }).schema;
        const rows: { result: number }[] = await manager.query(
          "DECLARE @r int; EXEC @r=sys.sp_getapplock @Resource=@0,@LockMode='Exclusive',@LockOwner='Transaction',@LockTimeout=10000; SELECT @r AS result",
          ['rbac-admin:' + schema],
        );
        if (!rows[0] || rows[0].result < 0)
          throw new AdminError('ADMIN_BUSY', 409);
        // Recheck authorization after waiting for the lock; queued revoked requests cannot mutate.
        const user = await manager.findOneBy(User, {
          id: actor.id,
          isActive: true,
        });
        const session = await manager
          .getRepository(Session)
          .createQueryBuilder('session')
          .where('session.sessionHash = :hash', {
            hash: sessionHash(actor.sessionId),
          })
          .getOne();
        const now = this.clock.now();
        if (
          !user ||
          user.mustChangePassword ||
          (user.lockedUntil && user.lockedUntil > now) ||
          !session ||
          session.userId !== user.id ||
          session.revokedAt ||
          now >= session.idleExpiresAt ||
          now >= session.absoluteExpiresAt
        )
          throw new UnauthorizedException();
        if (
          !(await this.adminQuery(manager)
            .andWhere('user.id = :actor', { actor: actor.id })
            .getCount())
        )
          throw new ForbiddenException();
        const result = await work(manager, user);
        if (!(await this.adminQuery(manager).getCount()))
          throw new AdminError('LAST_ADMIN', 409);
        return result;
      });
    } catch (error) {
      if (error instanceof QueryFailedError) {
        const number = (error.driverError as { number?: number }).number;
        if ([2601, 2627].includes(number ?? 0))
          throw new AdminError('DUPLICATE_VALUE', 409);
      }
      throw error;
    }
  }
  private adminQuery(manager: EntityManager) {
    return manager
      .getRepository(User)
      .createQueryBuilder('user')
      .innerJoin(Role, 'role', 'role.id=user.roleId AND role.isActive=:active')
      .innerJoin(RolePermission, 'grant', 'grant.roleId=role.id')
      .innerJoin(
        Permission,
        'permission',
        'permission.id=grant.permissionId AND permission.code=:manage AND permission.isActive=:active',
      )
      .where('user.isActive=:active', { active: true, manage: 'users.manage' });
  }
}
