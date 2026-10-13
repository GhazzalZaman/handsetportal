import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { AuthRequest } from '../auth/auth.types';
export const Scope = createParamDecorator(
  (_data: unknown, context: ExecutionContext) =>
    context.switchToHttp().getRequest<AuthRequest>().scope,
);
