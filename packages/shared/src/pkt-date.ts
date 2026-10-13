/** UTC instants for the Asia/Karachi business calendar (fixed UTC+05:00). */
export const BUSINESS_TIME_ZONE = 'Asia/Karachi';
const OFFSET = 5 * 60 * 60 * 1000;
export function pktDateKey(value: Date): string {
  return parts(value).toISOString().slice(0, 10);
}
export function pktDateBoundary(value: string): Date {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value))
    throw new RangeError('Invalid PKT date');
  const utc = new Date(value + 'T00:00:00.000Z');
  if (
    !Number.isFinite(utc.getTime()) ||
    utc.toISOString().slice(0, 10) !== value
  )
    throw new RangeError('Invalid PKT date');
  return new Date(utc.getTime() - OFFSET);
}
function parts(value: Date): Date {
  if (!Number.isFinite(value.getTime())) throw new RangeError('Invalid date');
  return new Date(value.getTime() + OFFSET);
}
export function startOfPktDay(value: Date): Date {
  const d = parts(value);
  return new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) - OFFSET,
  );
}
export function startOfPktMonth(value: Date): Date {
  const d = parts(value);
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1) - OFFSET);
}
export function startOfPktYear(value: Date): Date {
  const d = parts(value);
  return new Date(Date.UTC(d.getUTCFullYear(), 0, 1) - OFFSET);
}
/** Half-open [start, end) UTC range for yesterday in PKT. */
export function previousPktDay(value: Date): { start: Date; end: Date } {
  const end = startOfPktDay(value);
  return { start: new Date(end.getTime() - 86_400_000), end };
}
