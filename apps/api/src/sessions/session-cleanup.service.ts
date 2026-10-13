import { Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { DataSource } from 'typeorm';
import { LoginAttempt, Session } from '../database/entities';
import { Clock } from '../auth/clock';
import { AuthConfig } from '../auth/auth.config';
import { PinoLogger } from 'nestjs-pino';
@Injectable()
export class SessionCleanup {
  constructor(
    private readonly db: DataSource,
    private readonly clock: Clock,
    private readonly config: AuthConfig,
    private readonly logger: PinoLogger,
  ) {}
  @Cron(CronExpression.EVERY_HOUR, { waitForCompletion: true })
  async run(): Promise<void> {
    const now = this.clock.now().getTime();
    const sessionsCutoff = new Date(
      now - this.config.values.SESSION_RETENTION_DAYS * 86400000,
    );
    const attemptsCutoff = new Date(
      now - this.config.values.LOGIN_ATTEMPT_RETENTION_DAYS * 86400000,
    );
    try {
      // Safe to run on multiple replicas: deletes are idempotent and match only old records.
      await this.db
        .createQueryBuilder()
        .delete()
        .from(Session)
        .where(
          'idle_expires_at < :cutoff OR absolute_expires_at < :cutoff OR revoked_at < :cutoff',
          { cutoff: sessionsCutoff },
        )
        .execute();
      await this.db
        .createQueryBuilder()
        .delete()
        .from(LoginAttempt)
        .where('attempted_at < :cutoff', { cutoff: attemptsCutoff })
        .execute();
    } catch {
      this.logger.error(
        { event: 'AUTH_CLEANUP_FAILED' },
        'Authentication retention cleanup failed',
      );
    }
  }
}
