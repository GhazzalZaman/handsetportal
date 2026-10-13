import { Inject, Injectable } from '@nestjs/common';
import { getStorageToken, ThrottlerStorage } from '@nestjs/throttler';
import { EntityManager } from 'typeorm';
import { LoginAttempt } from '../database/entities';
import { AuthConfig } from './auth.config';
import { Clock } from './clock';
import { createHmac } from 'node:crypto';
@Injectable()
export class LoginLimit {
  constructor(
    @Inject(getStorageToken()) private readonly storage: ThrottlerStorage,
    private readonly config: AuthConfig,
    private readonly clock: Clock,
  ) {}
  private key(value: string): string {
    return createHmac('sha256', this.config.values.CSRF_SECRET)
      .update(value)
      .digest('hex');
  }
  async memoryBlocked(username: string, ip: string): Promise<boolean> {
    const ttl = this.config.values.LOGIN_RATE_WINDOW_SECONDS * 1000;
    const checks = await Promise.all([
      this.storage.increment(
        this.key('ip:' + ip),
        ttl,
        this.config.values.LOGIN_IP_LIMIT,
        ttl,
        'login-ip',
      ),
      this.storage.increment(
        this.key('username:' + username.toLowerCase()),
        ttl,
        this.config.values.LOGIN_USERNAME_LIMIT,
        ttl,
        'login-username',
      ),
    ]);
    return checks.some((check) => check.isBlocked);
  }
  async lockAndCheck(
    manager: EntityManager,
    username: string,
    ip: string,
  ): Promise<boolean> {
    // Same deterministic lock order on all replicas; no raw username/IP in resource names.
    const keys = [
      this.key('ip:' + ip),
      this.key('username:' + username.toLowerCase()),
    ].sort();
    const schema = (manager.connection.options as { schema: string }).schema;
    for (const key of keys) {
      const rows: { result: number }[] = await manager.query(
        "DECLARE @r int; EXEC @r = sys.sp_getapplock @Resource=@0,@LockMode='Exclusive',@LockOwner='Transaction',@LockTimeout=10000; SELECT @r AS result",
        ['auth-login:' + schema + ':' + key],
      );
      if (!rows[0] || rows[0].result < 0)
        throw new Error('Login serialization unavailable');
    }
    const cutoff = new Date(
      this.clock.now().getTime() -
        this.config.values.LOGIN_RATE_WINDOW_SECONDS * 1000,
    );
    const repo = manager.getRepository(LoginAttempt);
    const ipCount = await repo
      .createQueryBuilder('attempt')
      .where('attempt.ipAddress = :ip AND attempt.attemptedAt > :cutoff', {
        ip,
        cutoff,
      })
      .getCount();
    const usernameCount = await repo
      .createQueryBuilder('attempt')
      .where(
        'attempt.usernameAttempted = :username AND attempt.attemptedAt > :cutoff',
        { username, cutoff },
      )
      .getCount();
    return (
      ipCount >= this.config.values.LOGIN_IP_LIMIT ||
      usernameCount >= this.config.values.LOGIN_USERNAME_LIMIT
    );
  }
}
