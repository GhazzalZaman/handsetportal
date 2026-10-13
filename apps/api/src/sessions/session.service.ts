import { Injectable } from '@nestjs/common';
import { DataSource, EntityManager, IsNull } from 'typeorm';
import { Session, User } from '../database/entities';
import { AuthConfig } from '../auth/auth.config';
import { Clock } from '../auth/clock';
import { newSessionId, sessionHash, validSessionId } from '../auth/crypto';
import { IdentityRepository } from '../auth/identity.repository';
import { AuthEventContext, Principal } from '../auth/auth.types';
import { AuthEvents } from '../auth/auth-events.service';
export enum RevocationReason {
  LOGOUT = 'LOGOUT',
  PASSWORD_CHANGED = 'PASSWORD_CHANGED',
  USER_DEACTIVATED = 'USER_DEACTIVATED',
  ADMIN_REVOKED = 'ADMIN_REVOKED',
  EXPIRED = 'EXPIRED',
}
@Injectable()
export class SessionService {
  constructor(
    private readonly db: DataSource,
    private readonly config: AuthConfig,
    private readonly clock: Clock,
    private readonly identities: IdentityRepository,
    private readonly events: AuthEvents,
  ) {}
  async create(
    userId: number,
    fingerprint: string,
    context: AuthEventContext,
    userAgent: string,
    manager: EntityManager = this.db.manager,
  ): Promise<{ raw: string; session: Session }> {
    const raw = newSessionId(),
      now = this.clock.now();
    const absoluteExpiresAt = new Date(
      now.getTime() +
        this.config.values.SESSION_ABSOLUTE_TIMEOUT_HOURS * 3600000,
    );
    const idleExpiresAt = new Date(
      Math.min(
        now.getTime() + this.config.values.SESSION_IDLE_TIMEOUT_MINUTES * 60000,
        absoluteExpiresAt.getTime(),
      ),
    );
    const session = await manager.getRepository(Session).save({
      sessionHash: sessionHash(raw),
      authorizationHash: fingerprint,
      userId,
      createdAt: now,
      lastSeenAt: now,
      idleExpiresAt,
      absoluteExpiresAt,
      revokedAt: null,
      revokedReason: null,
      ipAddress: context.ip.slice(0, 45),
      userAgent: userAgent.slice(0, 512),
    });
    return { raw, session };
  }
  async validate(
    raw: unknown,
    context: AuthEventContext,
  ): Promise<Principal | null> {
    if (!validSessionId(raw)) return null;
    let session = await this.db
      .getRepository(Session)
      .createQueryBuilder('session')
      .addSelect('session.authorizationHash')
      .where('session.sessionHash = :hash', { hash: sessionHash(raw) })
      .getOne();
    if (!session || session.revokedAt) return null;
    const now = this.clock.now();
    if (now >= session.idleExpiresAt || now >= session.absoluteExpiresAt) {
      await this.revoke(raw, RevocationReason.EXPIRED);
      this.events.emit('SESSION_REVOKED', {
        ...context,
        userId: session.userId,
      });
      return null;
    }
    const user = await this.db
      .getRepository(User)
      .findOneBy({ id: session.userId });
    if (
      !user ||
      !user.isActive ||
      Boolean(user.lockedUntil && user.lockedUntil > now)
    ) {
      if (user && !user.isActive)
        await this.revokeAllForUser(user.id, RevocationReason.USER_DEACTIVATED);
      else await this.revoke(raw, RevocationReason.ADMIN_REVOKED);
      this.events.emit('SESSION_REVOKED', {
        ...context,
        userId: session.userId,
      });
      return null;
    }
    const resolved = await this.identities.identity(this.db.manager, user);
    if (!resolved || session.authorizationHash !== resolved.fingerprint) {
      // Privilege changes require reauthentication: revoke first, rotate ID through a fresh login.
      await this.revoke(raw, RevocationReason.ADMIN_REVOKED);
      this.events.emit('SESSION_REVOKED', { ...context, userId: user.id });
      return null;
    }
    if (
      now.getTime() - session.lastSeenAt.getTime() >=
      this.config.values.SESSION_TOUCH_INTERVAL_SECONDS * 1000
    ) {
      await this.touch(raw, session);
      const latest = await this.db
        .getRepository(Session)
        .findOneBy({ id: session.id, revokedAt: IsNull() });
      if (
        !latest ||
        now >= latest.idleExpiresAt ||
        now >= latest.absoluteExpiresAt
      )
        return null;
      session = latest;
    }
    return { ...resolved.identity, sessionId: raw, session };
  }
  async touch(raw: string, session: Session): Promise<void> {
    const now = this.clock.now();
    const idle = new Date(
      Math.min(
        now.getTime() + this.config.values.SESSION_IDLE_TIMEOUT_MINUTES * 60000,
        session.absoluteExpiresAt.getTime(),
      ),
    );
    await this.db
      .createQueryBuilder()
      .update(Session)
      .set({ lastSeenAt: now, idleExpiresAt: idle })
      .where(
        'session_hash = :hash AND revoked_at IS NULL AND idle_expires_at > :now AND absolute_expires_at > :now AND last_seen_at <= :threshold',
        {
          hash: sessionHash(raw),
          now,
          threshold: new Date(
            now.getTime() -
              this.config.values.SESSION_TOUCH_INTERVAL_SECONDS * 1000,
          ),
        },
      )
      .execute();
  }
  async revoke(
    raw: string,
    reason: RevocationReason,
    manager: EntityManager = this.db.manager,
  ): Promise<void> {
    if (!validSessionId(raw)) return;
    await manager
      .createQueryBuilder()
      .update(Session)
      .set({ revokedAt: this.clock.now(), revokedReason: reason })
      .where('session_hash = :hash AND revoked_at IS NULL', {
        hash: sessionHash(raw),
      })
      .execute();
  }
  async revokeAllForUser(
    userId: number,
    reason: RevocationReason,
    exceptSessionId?: string,
    manager: EntityManager = this.db.manager,
  ): Promise<void> {
    const query = manager
      .createQueryBuilder()
      .update(Session)
      .set({ revokedAt: this.clock.now(), revokedReason: reason })
      .where('user_id = :userId AND revoked_at IS NULL', { userId });
    if (exceptSessionId)
      query.andWhere('session_hash <> :hash', {
        hash: sessionHash(exceptSessionId),
      });
    await query.execute();
  }
}
