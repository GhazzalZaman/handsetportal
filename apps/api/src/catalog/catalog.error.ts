import { HttpException } from '@nestjs/common';
export class CatalogError extends HttpException {
  constructor(
    readonly code: string,
    status = 400,
    readonly details?: unknown,
  ) {
    super(code, status);
  }
}
