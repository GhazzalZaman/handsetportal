import { ScopeModule } from '../scope/scope.module';
import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerModule } from '@nestjs/throttler';
import { AuthConfig } from './auth.config';
import { Clock } from './clock';
import { AuthEvents } from './auth-events.service';
import { IdentityRepository } from './identity.repository';
import { PasswordService } from './password.service';
import { LoginLimit } from './login-limit.service';
import { AuthService } from './auth.service';
import { SessionService } from '../sessions/session.service';
import { SessionCookie } from '../sessions/session-cookie.service';
import { SessionCleanup } from '../sessions/session-cleanup.service';
import { RejectedLoginRecorder } from './rejected-login.service';
import { AuthController } from './auth.controller';
import {
  AuthGuard,
  OriginGuard,
  CsrfGuard,
  PasswordChangeGuard,
  PermissionsGuard,
} from './auth.guards';
@Module({
  imports: [
    ScopeModule,
    ThrottlerModule.forRoot([{ name: 'login', ttl: 60000, limit: 60 }]),
  ],
  controllers: [AuthController],
  providers: [
    RejectedLoginRecorder,
    AuthConfig,
    Clock,
    AuthEvents,
    IdentityRepository,
    PasswordService,
    LoginLimit,
    AuthService,
    SessionService,
    SessionCookie,
    SessionCleanup,
    { provide: APP_GUARD, useClass: OriginGuard },
    { provide: APP_GUARD, useClass: AuthGuard },
    { provide: APP_GUARD, useClass: CsrfGuard },
    { provide: APP_GUARD, useClass: PasswordChangeGuard },
    { provide: APP_GUARD, useClass: PermissionsGuard },
  ],
  exports: [SessionService, Clock, AuthConfig, SessionCookie, PasswordService],
})
export class AuthModule {}
