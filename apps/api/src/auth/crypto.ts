import {
  createHash,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from 'node:crypto';
export const newSessionId = () => randomBytes(32).toString('base64url');
export const validSessionId = (value: unknown): value is string =>
  typeof value === 'string' &&
  /^[A-Za-z0-9_-]{43}$/.test(value) &&
  Buffer.from(value, 'base64url').toString('base64url') === value;
export const sessionHash = (raw: string) =>
  createHash('sha256').update(raw).digest('hex');
export const csrfToken = (secret: string, raw: string) =>
  createHmac('sha256', secret).update(raw).digest('base64url');
export function validCsrf(
  secret: string,
  raw: string,
  value: unknown,
): boolean {
  if (typeof value !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(value))
    return false;
  const actual = Buffer.from(value, 'base64url'),
    expected = Buffer.from(csrfToken(secret, raw), 'base64url');
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
