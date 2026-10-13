import { Injectable, UnauthorizedException } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import { LoginAttempt, User, Session } from '../database/entities';
import { AuthConfig } from './auth.config';
import { Clock } from './clock';
import { PasswordService } from './password.service';
import { IdentityRepository } from './identity.repository';
import { SessionService, RevocationReason } from '../sessions/session.service';
import { AuthEventContext, Principal } from './auth.types';
import { LoginLimit } from './login-limit.service';
import { AuthEvents } from './auth-events.service';
import { auditAuth } from './auth-audit';
import { AuthError } from './auth.error';
import { sessionHash } from './crypto';
@Injectable()
export class AuthService {
  // Password verification is a separate provider; a future SSO credential provider can
  // feed an authenticated identity into the same session issuance/revocation boundary.
  constructor(
    private readonly db: DataSource,
    private readonly settings: AuthConfig,
    private readonly clock: Clock,
    private readonly passwords: PasswordService,
    private readonly identities: IdentityRepository,
    private readonly sessions: SessionService,
    private readonly limits: LoginLimit,
    private readonly events: AuthEvents,
  ) {}
  async login(
    username: string,
    password: string,
    oldCookie: unknown,
    context: AuthEventContext,
    userAgent: string,
  ): Promise<Principal> {
    const memoryBlocked = await this.limits.memoryBlocked(username, context.ip);
    const result = await this.db.transaction(async (manager) => {
      const dbBlocked = await this.limits.lockAndCheck(
        manager,
        username,
        context.ip,
      );
      if (memoryBlocked || dbBlocked) {
        await this.attempt(manager, username, context, false, 'THROTTLED');
        return {
          failure: true as const,
          throttled: true,
          userId: undefined,
          lockout: false,
        };
      }
      const user = await this.identities.user(manager, { username }, true);
      const valid = await this.passwords.verifyCredential(
        password,
        user?.passwordHash,
      );
      const now = this.clock.now();
      const locked = Boolean(user?.lockedUntil && user.lockedUntil > now);
      const role = user ? await this.identities.identity(manager, user) : null;
      if (!user || !valid || !user.isActive || locked || !role) {
        let lockout = false;
        if (user && user.isActive && !locked) {
          const previous = user.failedLoginCount;
          user.failedLoginCount =
            (user.lockedUntil && user.lockedUntil <= now ? 0 : previous) + 1;
          const oldLock = user.lockedUntil;
          user.lockedUntil =
            user.failedLoginCount >= this.settings.values.LOGIN_MAX_FAILURES
              ? new Date(
                  now.getTime() +
                    this.settings.values.LOGIN_LOCKOUT_MINUTES * 60000,
                )
              : null;
          lockout = Boolean(user.lockedUntil);
          await manager.update(User, user.id, {
            failedLoginCount: user.failedLoginCount,
            lockedUntil: user.lockedUntil,
            updatedAt: now,
          });
          await auditAuth(
            manager,
            user.id,
            'failed_login_count',
            String(previous),
            String(user.failedLoginCount),
            context,
            now,
          );
          if (oldLock?.getTime() !== user.lockedUntil?.getTime())
            await auditAuth(
              manager,
              user.id,
              'locked_until',
              oldLock?.toISOString() ?? null,
              user.lockedUntil?.toISOString() ?? null,
              context,
              now,
            );
        }
        await this.attempt(
          manager,
          username,
          context,
          false,
          locked
            ? 'LOCKED'
            : user && !user.isActive
              ? 'INACTIVE'
              : 'INVALID_CREDENTIALS',
        );
        return {
          failure: true as const,
          throttled: false,
          userId: user?.id,
          lockout,
        };
      }
      const actor = { ...context, userId: user.id };
      const updates: Partial<User> = {
        lastLoginAt: now,
        failedLoginCount: 0,
        lockedUntil: null,
        updatedAt: now,
        updatedBy: user.id,
      };
      if (this.passwords.strengthenedParameters(user.passwordHash)) {
        updates.passwordHash = await this.passwords.rehash(
          password,
          user.passwordHash,
        );
        await auditAuth(
          manager,
          user.id,
          'password',
          '[REDACTED]',
          '[REDACTED]',
          actor,
          now,
        );
      }
      await manager.update(User, user.id, updates);
      await auditAuth(
        manager,
        user.id,
        'last_login_at',
        user.lastLoginAt?.toISOString() ?? null,
        now.toISOString(),
        actor,
        now,
      );
      if (user.failedLoginCount)
        await auditAuth(
          manager,
          user.id,
          'failed_login_count',
          String(user.failedLoginCount),
          '0',
          actor,
          now,
        );
      if (user.lockedUntil)
        await auditAuth(
          manager,
          user.id,
          'locked_until',
          user.lockedUntil.toISOString(),
          null,
          actor,
          now,
        );
      if (typeof oldCookie === 'string')
        await this.sessions.revoke(
          oldCookie,
          RevocationReason.ADMIN_REVOKED,
          manager,
        );
      const created = await this.sessions.create(
        user.id,
        role.fingerprint,
        actor,
        userAgent,
        manager,
      );
      await this.attempt(manager, username, actor, true, null);
      return {
        failure: false as const,
        principal: {
          ...role.identity,
          sessionId: created.raw,
          session: created.session,
        },
      };
    });
    if (result.failure) {
      this.events.emit(result.lockout ? 'LOCKOUT' : 'LOGIN_FAILURE', {
        ...context,
        userId: result.userId,
      });
      if (result.throttled) throw new AuthError('LOGIN_THROTTLED', 429);
      throw new UnauthorizedException();
    }
    this.events.emit('LOGIN_SUCCESS', {
      ...context,
      userId: result.principal.id,
    });
    return result.principal;
  }
  private async attempt(
    manager: EntityManager,
    username: string,
    context: AuthEventContext,
    success: boolean,
    failureReason: string | null,
  ): Promise<void> {
    await manager.insert(LoginAttempt, {
      usernameAttempted: username,
      ipAddress: context.ip,
      success,
      attemptedAt: this.clock.now(),
      failureReason,
    });
  }
  async logout(user: Principal, context: AuthEventContext): Promise<void> {
    await this.sessions.revoke(user.sessionId, RevocationReason.LOGOUT);
    this.events.emit('LOGOUT', context);
    this.events.emit('SESSION_REVOKED', context);
  }
  async changePassword(
    principal: Principal,
    currentPassword: string,
    newPassword: string,
    context: AuthEventContext,
    userAgent: string,
  ): Promise<Principal> {
    const result = await this.db.transaction(async (manager) => {
      const user = await this.identities.user(
        manager,
        { id: principal.id },
        true,
      );
      const current = await manager
        .getRepository(Session)
        .createQueryBuilder('session')
        .where('session.sessionHash = :hash', {
          hash: sessionHash(principal.sessionId),
        })
        .setLock('pessimistic_write')
        .getOne();
      const now = this.clock.now();
      if (
        !user ||
        !user.isActive ||
        (user.lockedUntil && user.lockedUntil > now) ||
        !current ||
        current.revokedAt ||
        now >= current.idleExpiresAt ||
        now >= current.absoluteExpiresAt
      )
        throw new UnauthorizedException();
      if (
        !(await this.passwords.verifyCredential(
          currentPassword,
          user.passwordHash,
        ))
      )
        throw new UnauthorizedException();
      this.passwords.assertAllowed(newPassword, user.username, currentPassword);
      const passwordHash = await this.passwords.hash(newPassword);
      await manager.update(User, user.id, {
        passwordHash,
        passwordChangedAt: now,
        mustChangePassword: false,
        failedLoginCount: 0,
        lockedUntil: null,
        updatedAt: now,
        updatedBy: user.id,
      });
      await auditAuth(
        manager,
        user.id,
        'password',
        '[REDACTED]',
        '[REDACTED]',
        context,
        now,
      );
      await auditAuth(
        manager,
        user.id,
        'password_changed_at',
        user.passwordChangedAt.toISOString(),
        now.toISOString(),
        context,
        now,
      );
      if (user.mustChangePassword)
        await auditAuth(
          manager,
          user.id,
          'must_change_password',
          'true',
          'false',
          context,
          now,
        );
      if (user.failedLoginCount)
        await auditAuth(
          manager,
          user.id,
          'failed_login_count',
          String(user.failedLoginCount),
          '0',
          context,
          now,
        );
      await this.sessions.revokeAllForUser(
        user.id,
        RevocationReason.PASSWORD_CHANGED,
        undefined,
        manager,
      );
      user.mustChangePassword = false;
      const resolved = await this.identities.identity(manager, user);
      if (!resolved) throw new UnauthorizedException();
      const created = await this.sessions.create(
        user.id,
        resolved.fingerprint,
        context,
        userAgent,
        manager,
      );
      return {
        ...resolved.identity,
        sessionId: created.raw,
        session: created.session,
      };
    });
    this.events.emit('SESSION_REVOKED', context);
    return result;
  }
}
