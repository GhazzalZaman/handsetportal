import {
  CanActivate,
  ExecutionContext,
  Injectable,
  HttpException,
} from '@nestjs/common';
import { AuthRequest } from '../auth/auth.types';
@Injectable()
export class InventoryWriteGuard implements CanActivate {
  private readonly buckets = new Map<
    number,
    { count: number; until: number }
  >();
  canActivate(context: ExecutionContext) {
    const actor = context.switchToHttp().getRequest<AuthRequest>().user;
    if (!actor) return false;
    const now = Date.now();
    for (const [id, bucket] of this.buckets)
      if (bucket.until <= now) this.buckets.delete(id);
    const bucket = this.buckets.get(actor.id) ?? {
      count: 0,
      until: now + 60000,
    };
    if (bucket.count >= 60)
      throw new HttpException(
        'Too many stock or sales writes. Try again shortly.',
        429,
      );
    bucket.count++;
    this.buckets.set(actor.id, bucket);
    return true;
  }
}
