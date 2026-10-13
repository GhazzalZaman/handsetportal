'use client';
export class AuthRequestError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    readonly details?: unknown,
  ) {
    super(code);
  }
}
export async function authFetch(
  path: string,
  init: RequestInit = {},
): Promise<Response> {
  if (!path.startsWith('/api/'))
    throw new Error('API requests must be same-origin');
  const method = (init.method ?? 'GET').toUpperCase();
  const headers = new Headers(init.headers);
  if (
    ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method) &&
    path !== '/api/v1/auth/login'
  ) {
    const csrf = await authFetch('/api/v1/auth/csrf');
    const data = (await csrf.json()) as { csrfToken: string };
    headers.set('X-CSRF-Token', data.csrfToken);
  }
  if (init.body && !(init.body instanceof FormData))
    headers.set('Content-Type', 'application/json');
  const response = await fetch(path, {
    ...init,
    method,
    headers,
    credentials: 'same-origin',
    cache: 'no-store',
  });
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as {
      error?: { code?: string; details?: unknown };
    } | null;
    const code = body?.error?.code ?? 'REQUEST_FAILED';
    if (response.status === 401 && path !== '/api/v1/auth/login')
      window.location.replace('/login?reason=expired');
    if (code === 'PASSWORD_CHANGE_REQUIRED')
      window.location.replace('/change-password');
    throw new AuthRequestError(response.status, code, body?.error?.details);
  }
  return response;
}
