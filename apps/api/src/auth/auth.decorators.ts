import {
  createParamDecorator,
  ExecutionContext,
  SetMetadata,
} from '@nestjs/common';
import { AuthRequest } from './auth.types';
export const REQUIRED_PERMISSIONS = 'requiredPermissions';
export const RequirePermissions = (...codes: string[]) =>
  SetMetadata(REQUIRED_PERMISSIONS, codes);
export const PASSWORD_CHANGE_ALLOWED = 'passwordChangeAllowed';
export const PasswordChangeAllowed = () =>
  SetMetadata(PASSWORD_CHANGE_ALLOWED, true);
export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext) =>
    context.switchToHttp().getRequest<AuthRequest>().user,
);
export const LOGIN_ENDPOINT = 'loginEndpoint';
export const LoginEndpoint = () => SetMetadata(LOGIN_ENDPOINT, true);
