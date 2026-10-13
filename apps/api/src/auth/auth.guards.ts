import { ScopeService } from '../scope/scope.service';
import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Response } from 'express';
import { SessionService } from '../sessions/session.service';
import { SessionCookie } from '../sessions/session-cookie.service';
import { PUBLIC_ROUTE } from '../common/public.decorator';
import { AuthRequest, eventContext } from './auth.types';
import { AuthConfig } from './auth.config';
import { AuthError } from './auth.error';
import {
  LOGIN_ENDPOINT,
  PASSWORD_CHANGE_ALLOWED,
  REQUIRED_PERMISSIONS,
} from './auth.decorators';
import { validCsrf } from './crypto';
const unsafe = (method: string) =>
  ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method);
export function allowedOrigin(
  origin: string | undefined,
  referer: string | undefined,
  allowed: string[],
): boolean {
  if (origin !== undefined) return allowed.includes(origin);
  if (!referer) return false;
  try {
    return allowed.includes(new URL(referer).origin);
  } catch {
    return false;
  }
}
@Injectable()
export class OriginGuard implements CanActivate {
  constructor(private readonly config: AuthConfig) {}
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<AuthRequest>();
    if (
      unsafe(req.method) &&
      !allowedOrigin(
        req.get('origin'),
        req.get('referer'),
        this.config.values.ALLOWED_ORIGINS.split(','),
      )
    )
      throw new AuthError('ORIGIN_INVALID');
    return true;
  }
}
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly sessions: SessionService,
    private readonly cookies: SessionCookie,
    private readonly scopes: ScopeService,
  ) {}
  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (
      this.reflector.getAllAndOverride<boolean>(PUBLIC_ROUTE, [
        context.getHandler(),
        context.getClass(),
      ])
    )
      return true;
    const req = context.switchToHttp().getRequest<AuthRequest>();
    const principal = await this.sessions.validate(
      this.cookies.read(req),
      eventContext(req),
    );
    if (!principal) {
      this.cookies.clear(context.switchToHttp().getResponse<Response>());
      throw new UnauthorizedException();
    }
    req.user = principal;
    req.scope = await this.scopes.resolve(principal.id, principal.permissions);
    return true;
  }
}
@Injectable()
export class CsrfGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly config: AuthConfig,
  ) {}
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<AuthRequest>();
    if (
      !unsafe(req.method) ||
      this.reflector.get<boolean>(LOGIN_ENDPOINT, context.getHandler())
    )
      return true;
    if (
      !req.user ||
      !validCsrf(
        this.config.values.CSRF_SECRET,
        req.user.sessionId,
        req.get('x-csrf-token'),
      )
    )
      throw new AuthError('CSRF_INVALID');
    return true;
  }
}
@Injectable()
export class PasswordChangeGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<AuthRequest>();
    if (
      req.user?.mustChangePassword &&
      !this.reflector.getAllAndOverride<boolean>(PASSWORD_CHANGE_ALLOWED, [
        context.getHandler(),
        context.getClass(),
      ])
    )
      throw new AuthError('PASSWORD_CHANGE_REQUIRED');
    return true;
  }
}
@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}
  canActivate(context: ExecutionContext): boolean {
    const required =
      this.reflector.getAllAndMerge<string[]>(REQUIRED_PERMISSIONS, [
        context.getHandler(),
        context.getClass(),
      ]) ?? [];
    const user = context.switchToHttp().getRequest<AuthRequest>().user;
    if (required.some((code) => !user?.permissions.includes(code)))
      throw new ForbiddenException();
    return true;
  }
}
