import { Injectable } from '@nestjs/common';
import { PinoLogger } from 'nestjs-pino';
import { AuthEventContext } from './auth.types';
export type AuthEvent =
  'LOGIN_SUCCESS' | 'LOGIN_FAILURE' | 'LOCKOUT' | 'LOGOUT' | 'SESSION_REVOKED';
@Injectable()
export class AuthEvents {
  constructor(private readonly logger: PinoLogger) {}
  emit(event: AuthEvent, context: AuthEventContext): void {
    // Explicit Module 2 exception to the general no-PII logging rule: IDs/IP only.
    this.logger.info(
      {
        event,
        userId: context.userId ?? null,
        ip: context.ip,
        requestId: context.requestId,
      },
      'Authentication event',
    );
  }
}
