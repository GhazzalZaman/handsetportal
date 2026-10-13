import { Injectable } from '@nestjs/common';
import type { Response, CookieOptions } from 'express';
import { AuthConfig } from '../auth/auth.config';
import { AuthRequest } from '../auth/auth.types';
@Injectable()
export class SessionCookie {
  constructor(private readonly config: AuthConfig) {}
  private get options(): CookieOptions {
    return {
      httpOnly: true,
      secure: this.config.production,
      sameSite: 'lax',
      path: '/',
    };
  }
  read(request: AuthRequest): unknown {
    return (request.cookies as Record<string, unknown> | undefined)?.[
      this.config.cookieName
    ];
  }
  set(response: Response, raw: string): void {
    response.cookie(this.config.cookieName, raw, this.options);
  }
  clear(response: Response): void {
    response.clearCookie(this.config.cookieName, this.options);
  }
}
