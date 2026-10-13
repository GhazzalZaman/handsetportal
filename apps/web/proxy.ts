import { NextRequest, NextResponse } from 'next/server';
import { securityHeaders } from './security.mjs';
export function proxy(request: NextRequest) {
  const name =
    (process.env.NODE_ENV === 'production' ? '__Host-' : '') +
    (process.env.SESSION_COOKIE_NAME ?? 'sid');
  const protectedRoute =
    request.nextUrl.pathname.startsWith('/inventory') ||
    request.nextUrl.pathname.startsWith('/sales') ||
    request.nextUrl.pathname.startsWith('/admin') ||
    request.nextUrl.pathname.startsWith('/catalog') ||
    request.nextUrl.pathname.startsWith('/dashboard') ||
    request.nextUrl.pathname.startsWith('/change-password');
  // Convenience redirect only. Cookie presence is not authentication; the API always validates it.
  if (protectedRoute && !request.cookies.has(name)) {
    const target = new URL('/login?reason=expired', request.url);
    const response = NextResponse.redirect(target);
    response.headers.set('Cache-Control', 'no-store');
    return response;
  }
  const nonce = Buffer.from(crypto.randomUUID()).toString('base64');
  const security = securityHeaders(
    process.env.NODE_ENV === 'production',
    nonce,
  );
  const headers = new Headers(request.headers);
  headers.set('x-nonce', nonce);
  headers.set(
    'Content-Security-Policy',
    security.find((h) => h.key === 'Content-Security-Policy')!.value,
  );
  const response = NextResponse.next({ request: { headers } });
  for (const header of security) response.headers.set(header.key, header.value);
  response.headers.set('Cache-Control', 'no-store');
  return response;
}
export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
};
