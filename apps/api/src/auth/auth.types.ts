import type { CenterScope } from '../scope/scope.service';
import type { Request } from 'express';
import type { Session } from '../database/entities';
export interface Identity {
  id: number;
  username: string;
  displayName: string;
  role: string;
  permissions: string[];
  mustChangePassword: boolean;
}
export interface Principal extends Identity {
  /** Internal only. Never serialize request.user directly or log this value. */
  sessionId: string;
  session: Session;
}
export interface AuthRequest extends Request {
  user?: Principal;
  scope?: CenterScope;
}
export interface AuthEventContext {
  userId?: number;
  ip: string;
  requestId: string;
}
export function eventContext(request: AuthRequest): AuthEventContext {
  return {
    userId: request.user?.id,
    ip: (request.ip ?? request.socket.remoteAddress ?? 'unknown').slice(0, 45),
    requestId: String(request.id ?? 'unavailable'),
  };
}
