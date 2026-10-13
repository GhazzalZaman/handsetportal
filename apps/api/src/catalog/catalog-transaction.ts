import {
  Injectable,
  UnauthorizedException,
  ForbiddenException,
} from '@nestjs/common';
import { DataSource, EntityManager, QueryFailedError } from 'typeorm';
import {
  User,
  Role,
  Permission,
  RolePermission,
  Session,
} from '../database/entities';
import { Principal } from '../auth/auth.types';
import { sessionHash } from '../auth/crypto';
import { Clock } from '../auth/clock';
import { CatalogError } from './catalog.error';
@Injectable()
export class CatalogTransaction {
  constructor(
    private readonly db: DataSource,
    private readonly clock: Clock,
  ) {}
  async run<T>(
    actor: Principal,
    permission: string | string[],
    work: (manager: EntityManager) => Promise<T>,
  ): Promise<T> {
    try {
      return await this.db.transaction('SERIALIZABLE', async (manager) => {
        const lock = await manager.query(
          "DECLARE @r int; EXEC @r=sys.sp_getapplock @Resource=@0,@LockMode='Exclusive',@LockOwner='Transaction',@LockTimeout=10000; SELECT @r AS result",
          ['rbac-admin:' + (this.db.options as { schema: string }).schema],
        );
        if (!lock[0] || lock[0].result < 0) throw new CatalogError('BUSY', 409);
        const user = await manager.findOneBy(User, {
          id: actor.id,
          isActive: true,
        });
        const session = await manager
          .getRepository(Session)
          .createQueryBuilder('s')
          .where('s.sessionHash = :hash', {
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
          session.idleExpiresAt <= now ||
          session.absoluteExpiresAt <= now
        )
          throw new UnauthorizedException();
        const required =
          typeof permission === 'string' ? [permission] : permission;
        const grant = await manager
          .getRepository(RolePermission)
          .createQueryBuilder('g')
          .innerJoin(Role, 'r', 'r.id = g.roleId')
          .innerJoin(Permission, 'p', 'p.id = g.permissionId')
          .where(
            'r.id = :id AND r.isActive = :active AND p.isActive = :active AND p.code IN (:...required)',
            { id: user.roleId, active: true, required },
          )
          .getCount();
        if (grant !== required.length) throw new ForbiddenException();
        return work(manager);
      });
    } catch (error) {
      if (
        error instanceof QueryFailedError &&
        [2601, 2627].includes((error.driverError as { number: number }).number)
      )
        throw new CatalogError('DUPLICATE', 409);
      throw error;
    }
  }
}
