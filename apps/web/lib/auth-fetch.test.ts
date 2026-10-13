import { afterEach, describe, expect, it, vi } from 'vitest';
import { authFetch } from './auth-fetch';
afterEach(() => {
  vi.unstubAllGlobals();
});
describe('same-origin auth fetch', () => {
  it('fetches a fresh CSRF token for mutations and includes cookies', async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ csrfToken: 'test-token' }), {
          status: 200,
        }),
      )
      .mockResolvedValueOnce(new Response(null, { status: 204 }));
    vi.stubGlobal('fetch', fetch);
    await authFetch('/api/v1/auth/logout', { method: 'POST', body: '{}' });
    expect(fetch.mock.calls[0]![0]).toBe('/api/v1/auth/csrf');
    expect(fetch.mock.calls[1]![0]).toBe('/api/v1/auth/logout');
    const init = fetch.mock.calls[1]![1] as RequestInit;
    expect(new Headers(init.headers).get('X-CSRF-Token')).toBe('test-token');
    expect(init.credentials).toBe('same-origin');
  });
  it('redirects expired sessions and never submits the mutation', async () => {
    const replace = vi.fn();
    vi.stubGlobal('window', { location: { replace } });
    const fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ error: { code: 'UNAUTHORIZED' } }), {
        status: 401,
      }),
    );
    vi.stubGlobal('fetch', fetch);
    await expect(
      authFetch('/api/v1/auth/logout', { method: 'POST' }),
    ).rejects.toThrow();
    expect(replace).toHaveBeenCalledWith('/login?reason=expired');
    expect(fetch).toHaveBeenCalledTimes(1);
  });
  it('leaves credential errors on the login form', async () => {
    const replace = vi.fn();
    vi.stubGlobal('window', { location: { replace } });
    const fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ error: { code: 'UNAUTHORIZED' } }), {
        status: 401,
      }),
    );
    vi.stubGlobal('fetch', fetch);
    await expect(
      authFetch('/api/v1/auth/login', { method: 'POST', body: '{}' }),
    ).rejects.toThrow();
    expect(replace).not.toHaveBeenCalled();
    expect(fetch).toHaveBeenCalledTimes(1);
  });
  it('refuses off-origin targets', async () => {
    await expect(
      authFetch('https://evil.example/login', { method: 'POST' }),
    ).rejects.toThrow('same-origin');
  });
  it('preserves browser multipart boundaries and returns structured catalog errors', async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ csrfToken: 'test-token' })),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            error: {
              code: 'POSSIBLE_DUPLICATE',
              details: { existing: [{ id: 1, name: 'Phone' }] },
            },
          }),
          { status: 409 },
        ),
      );
    vi.stubGlobal('fetch', fetch);
    const form = new FormData();
    form.append(
      'file',
      new Blob(['brand,model,ram_gb,storage_gb,color']),
      'catalog.csv',
    );
    await expect(
      authFetch('/api/v1/catalog/import', { method: 'POST', body: form }),
    ).rejects.toMatchObject({
      code: 'POSSIBLE_DUPLICATE',
      details: { existing: [{ id: 1, name: 'Phone' }] },
    });
    const init = fetch.mock.calls[1]![1] as RequestInit;
    expect(new Headers(init.headers).has('Content-Type')).toBe(false);
    expect(new Headers(init.headers).get('X-CSRF-Token')).toBe('test-token');
  });
});
