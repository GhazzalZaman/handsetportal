import { readFileSync, writeFileSync } from 'node:fs';
import { spawn, spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { createServer } from 'node:net';
import { resolve } from 'node:path';

/** HTTP smoke through a real Next dev server; uses only the suite's synthetic SQL users. */
export async function webAuthSmoke(
  apiUrl: string,
  allowOrigin: (origin: string) => void,
  password: string,
  admin = false,
  catalog = false,
) {
  const web = resolve(process.cwd(), '../web');
  const generatedFiles = ['tsconfig.json', 'next-env.d.ts'].map((name) => ({
    path: resolve(web, name),
    content: readFileSync(resolve(web, name)),
  }));
  const requireWeb = createRequire(resolve(web, 'package.json'));
  const reserve = createServer();
  await new Promise<void>((done) => reserve.listen(0, '127.0.0.1', done));
  const address = reserve.address();
  if (!address || typeof address === 'string') throw new Error('No test port');
  const port = address.port;
  await new Promise<void>((done, reject) =>
    reserve.close((error) => (error ? reject(error) : done())),
  );
  const origin = 'http://127.0.0.1:' + port;
  allowOrigin(origin);
  const child = spawn(
    process.execPath,
    [
      requireWeb.resolve('next/dist/bin/next'),
      'dev',
      '--port',
      String(port),
      '--hostname',
      '127.0.0.1',
    ],
    {
      cwd: web,
      windowsHide: true,
      stdio: 'ignore',
      env: {
        ...process.env,
        NODE_ENV: 'development',
        API_URL: apiUrl,
        SESSION_COOKIE_NAME: 'sid',
        NEXT_TELEMETRY_DISABLED: '1',
      },
    },
  );
  let failed = false;
  child.on('error', () => {
    failed = true;
  });
  const call = (path: string, options: RequestInit = {}) =>
    fetch(origin + path, {
      redirect: 'manual',
      signal: AbortSignal.timeout(30000),
      ...options,
    });
  try {
    let ready = false;
    for (let i = 0; i < 60; i++) {
      if (failed || child.exitCode !== null)
        throw new Error('Next smoke server exited');
      try {
        if ((await call('/login')).status === 200) {
          ready = true;
          break;
        }
      } catch {
        /* startup */
      }
      await new Promise((done) => setTimeout(done, 500));
    }
    expect(ready).toBe(true);
    expect((await call('/dashboard')).status).toBe(307);
    const response = await call('/api/v1/auth/login', {
      method: 'POST',
      headers: { Origin: origin, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: catalog ? 'SYSTEM_ADMIN' : admin ? 'admin' : 'authuser',
        password,
      }),
    });
    expect(response.status).toBe(200);
    const cookie = response.headers.get('set-cookie')?.split(';')[0] ?? '';
    expect(cookie).toMatch(/^sid=/);
    const dashboard = await call('/dashboard', { headers: { Cookie: cookie } });
    expect(dashboard.status).toBe(200);
    const html = await dashboard.text();
    expect(html).toContain(
      catalog ? 'Catalog Test' : admin ? 'Admin Test' : 'Auth Test',
    );
    expect(html).not.toContain(cookie.slice(4));
    const csrf = await call('/api/v1/auth/csrf', {
      headers: { Cookie: cookie },
    });
    expect(csrf.status).toBe(200);
    const { csrfToken } = (await csrf.json()) as { csrfToken: string };
    if (catalog) {
      expect((await call('/catalog')).status).toBe(307);
      const page = await call('/catalog', { headers: { Cookie: cookie } });
      expect(page.status).toBe(200);
      expect(await page.text()).toContain('Handset catalog');
      const lookups = await call('/api/v1/catalog/lookups', {
        headers: { Cookie: cookie },
      });
      expect(lookups.status).toBe(200);
      const created = await call('/api/v1/catalog/brands', {
        method: 'POST',
        headers: {
          Cookie: cookie,
          Origin: origin,
          'Content-Type': 'application/json',
          'X-CSRF-Token': csrfToken,
        },
        body: JSON.stringify({
          name: 'ProxySmokeBrand',
          confirmDistinct: true,
        }),
      });
      expect(created.status).toBe(201);
      expect(await created.text()).not.toContain('nameKey');
      const template = await call('/api/v1/catalog/import/template', {
        headers: { Cookie: cookie },
      });
      expect(template.status).toBe(200);
    }
    if (admin) {
      for (const route of ['/admin/users', '/admin/roles', '/admin/centers']) {
        expect((await call(route)).status).toBe(307);
        const page = await call(route, { headers: { Cookie: cookie } });
        expect(page.status).toBe(200);
        const content = await page.text();
        expect(content).toContain('Administration');
        expect(content).not.toContain(cookie.slice(4));
      }
      const member = await call('/api/v1/auth/login', {
        method: 'POST',
        headers: { Origin: origin, 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'member', password }),
      });
      expect(member.status).toBe(200);
      const memberCookie =
        member.headers.get('set-cookie')?.split(';')[0] ?? '';
      expect(
        (await call('/admin/users', { headers: { Cookie: memberCookie } }))
          .status,
      ).toBe(307);
      expect(
        (await call('/api/v1/users', { headers: { Cookie: memberCookie } }))
          .status,
      ).toBe(403);
      const roles = (await (
        await call('/api/v1/roles', { headers: { Cookie: cookie } })
      ).json()) as { items: { id: number; code: string }[] };
      const centers = (await (
        await call('/api/v1/centers', { headers: { Cookie: cookie } })
      ).json()) as { items: { id: number }[] };
      const created = await call('/api/v1/users', {
        method: 'POST',
        headers: {
          Cookie: cookie,
          Origin: origin,
          'Content-Type': 'application/json',
          'X-CSRF-Token': csrfToken,
        },
        body: JSON.stringify({
          username: 'web_smoke_user',
          displayName: 'Web Smoke',
          roleId: roles.items.find((r) => r.code === 'OTHER_STAKEHOLDER')!.id,
          centerIds: [centers.items[0]!.id],
          clusterIds: [],
        }),
      });
      expect(created.status).toBe(201);
      expect(created.headers.get('cache-control')).toBe('no-store');
      const result = (await created.json()) as {
        user: { id: number };
        temporaryPassword: string;
      };
      expect(result.temporaryPassword.length).toBeGreaterThanOrEqual(24);
      const saved = await call('/api/v1/users/' + result.user.id, {
        headers: { Cookie: cookie },
      });
      expect(saved.status).toBe(200);
      expect(await saved.text()).not.toContain(result.temporaryPassword);
    }
    const logout = await call('/api/v1/auth/logout', {
      method: 'POST',
      headers: { Cookie: cookie, Origin: origin, 'X-CSRF-Token': csrfToken },
    });
    expect(logout.status).toBe(204);
    expect(
      (await call('/dashboard', { headers: { Cookie: cookie } })).status,
    ).toBe(307);
  } finally {
    if (child.pid && child.exitCode === null) {
      if (process.platform === 'win32')
        spawnSync('taskkill', ['/PID', String(child.pid), '/T', '/F'], {
          windowsHide: true,
          stdio: 'ignore',
        });
      else child.kill('SIGTERM');
    }
    for (const file of generatedFiles) writeFileSync(file.path, file.content);
  }
}
