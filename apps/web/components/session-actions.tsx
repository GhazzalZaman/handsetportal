'use client';
import { useEffect, useState } from 'react';
import { authFetch } from '../lib/auth-fetch';
export function SessionActions({
  idleExpiresAt,
  absoluteExpiresAt,
}: {
  idleExpiresAt: string;
  absoluteExpiresAt: string;
}) {
  const [error, setError] = useState('');
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    let stopped = false;
    const schedule = (idle: string, absolute: string) => {
      const wait = Math.max(
        100,
        Math.min(new Date(idle).getTime(), new Date(absolute).getTime()) -
          Date.now() +
          150,
      );
      timer = setTimeout(
        async () => {
          try {
            const response = await authFetch('/api/v1/auth/me');
            const next = (await response.json()) as {
              idleExpiresAt: string;
              absoluteExpiresAt: string;
            };
            if (!stopped) schedule(next.idleExpiresAt, next.absoluteExpiresAt);
          } catch {
            /* The wrapper redirects on 401. A network outage is not a logout. */
          }
        },
        Math.min(wait, 2147483647),
      );
    };
    schedule(idleExpiresAt, absoluteExpiresAt);
    return () => {
      stopped = true;
      clearTimeout(timer);
    };
  }, [idleExpiresAt, absoluteExpiresAt]);
  async function logout() {
    try {
      await authFetch('/api/v1/auth/logout', { method: 'POST', body: '{}' });
      window.location.replace('/login');
    } catch {
      setError('Unable to sign out. Please try again.');
    }
  }
  return (
    <>
      <button type="button" onClick={logout}>
        Sign out
      </button>
      {error && <p role="alert">{error}</p>}
    </>
  );
}
