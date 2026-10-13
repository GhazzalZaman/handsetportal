import { startOfPktDay, pktDateKey } from '@handset/shared';
import { CatalogError } from '../catalog/catalog.error';
export function saleTime(
  now: Date,
  input: string | undefined,
  reason: string | undefined,
  canBackdate: boolean,
  maxDays: number,
) {
  if (input !== undefined && !canBackdate)
    throw new CatalogError('BACKDATE_FORBIDDEN', 403);
  const soldAt = input === undefined ? now : new Date(input);
  if (!Number.isFinite(soldAt.getTime()) || soldAt > now)
    throw new CatalogError('INVALID_SALE_TIME');
  if (
    input !== undefined &&
    (!reason?.trim() ||
      soldAt.getTime() < startOfPktDay(now).getTime() - maxDays * 86400000)
  )
    throw new CatalogError('BACKDATE_WINDOW');
  return { soldAt, saleDate: pktDateKey(soldAt) };
}
