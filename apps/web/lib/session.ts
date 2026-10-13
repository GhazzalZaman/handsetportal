import 'server-only';
import { cookies } from 'next/headers';
export interface SessionView {
  id: number;
  username: string;
  displayName: string;
  role: string;
  permissions: string[];
  mustChangePassword: boolean;
  idleExpiresAt: string;
  absoluteExpiresAt: string;
}
export async function getSession(): Promise<SessionView | null> {
  const name =
    (process.env.NODE_ENV === 'production' ? '__Host-' : '') +
    (process.env.SESSION_COOKIE_NAME ?? 'sid');
  const value = (await cookies()).get(name)?.value;
  if (!value) return null;
  const response = await fetch(
    new URL('/api/v1/auth/me', process.env.API_URL),
    {
      headers: { cookie: name + '=' + encodeURIComponent(value) },
      cache: 'no-store',
      signal: AbortSignal.timeout(10000),
    },
  );
  if (response.status === 401) return null;
  if (!response.ok) throw new Error('Authentication service unavailable');
  return response.json() as Promise<SessionView>;
}
