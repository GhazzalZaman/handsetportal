import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { LoginAttempt } from '../database/entities';
import { Clock } from './clock';
import { AuthEvents } from './auth-events.service';
import { AuthRequest, eventContext } from './auth.types';
@Injectable()
export class RejectedLoginRecorder {
  constructor(
    private readonly db: DataSource,
    private readonly clock: Clock,
    private readonly events: AuthEvents,
  ) {}
  async record(request: AuthRequest, status: number): Promise<void> {
    const body = request.body as { username?: unknown } | undefined;
    const username =
      typeof body?.username === 'string'
        ? body.username.trim().slice(0, 100)
        : '<invalid>';
    const context = eventContext(request);
    await this.db.getRepository(LoginAttempt).insert({
      usernameAttempted: username || '<invalid>',
      ipAddress: context.ip,
      success: false,
      attemptedAt: this.clock.now(),
      failureReason: status === 400 ? 'INVALID_INPUT' : 'ORIGIN_REJECTED',
    });
    this.events.emit('LOGIN_FAILURE', context);
  }
}
