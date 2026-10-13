import { CatalogError } from '../catalog/catalog.error';
import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { STATUS_CODES } from 'node:http';
import type { AuthRequest } from '../auth/auth.types';
import { AdminError } from '../admin/admin.error';
import { AuthError } from '../auth/auth.error';
@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  constructor(
    private readonly recordRejectedLogin?: (
      request: AuthRequest,
      status: number,
    ) => Promise<void>,
  ) {}
  async catch(error: unknown, host: ArgumentsHost): Promise<void> {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request & { id?: string }>();
    const candidate = error instanceof HttpException ? error.getStatus() : 500;
    const status = candidate >= 400 && candidate <= 599 ? candidate : 500;
    if (
      [400, 403].includes(status) &&
      request.method === 'POST' &&
      request.path.toLowerCase().replace(/\/+$/, '') === '/api/v1/auth/login'
    )
      await this.recordRejectedLogin?.(request as AuthRequest, status).catch(
        () => undefined,
      );
    // Exact identical 401 bodies for every credential/account failure. Correlate via header.
    if (status === 401) {
      response.status(401).json({
        error: {
          statusCode: 401,
          code: 'UNAUTHORIZED',
          message: 'Unauthorized',
        },
      });
      return;
    }
    response.status(status).json({
      error: {
        statusCode: status,
        code:
          error instanceof AuthError ||
          error instanceof AdminError ||
          error instanceof CatalogError
            ? error.code
            : status >= 500
              ? 'SERVICE_ERROR'
              : 'REQUEST_ERROR',
        message: STATUS_CODES[status] ?? 'Request failed',
        ...(error instanceof CatalogError && error.details
          ? { details: error.details }
          : {}),
        requestId: request.id ?? 'unavailable',
      },
    });
  }
}
