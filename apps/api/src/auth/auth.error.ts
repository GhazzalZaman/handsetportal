import { HttpException } from '@nestjs/common';
export type AuthErrorCode =
  | 'PASSWORD_CHANGE_REQUIRED'
  | 'CSRF_INVALID'
  | 'ORIGIN_INVALID'
  | 'PASSWORD_POLICY'
  | 'LOGIN_THROTTLED';
export class AuthError extends HttpException {
  constructor(
    readonly code: AuthErrorCode,
    status = 403,
  ) {
    super('Request rejected', status);
  }
}
