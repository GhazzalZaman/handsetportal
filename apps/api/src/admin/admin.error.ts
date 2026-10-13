import { HttpException } from '@nestjs/common';
export class AdminError extends HttpException {
  constructor(
    readonly code: string,
    status = 400,
  ) {
    super(code, status);
  }
}
