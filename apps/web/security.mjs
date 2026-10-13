export function apiOrigin(value) {
  if (!value) throw new Error('API_URL is required');
  const url = new URL(value);
  if (
    !['http:', 'https:'].includes(url.protocol) ||
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    url.pathname !== '/'
  )
    throw new Error(
      'API_URL must be an HTTP(S) origin without credentials or a path',
    );
  return url.origin;
}
export function securityHeaders(production, nonce = '') {
  const scripts = nonce ? " 'nonce-" + nonce + "' 'strict-dynamic'" : '';
  const csp = [
    "default-src 'self'",
    "script-src 'self'" + scripts + (production ? '' : " 'unsafe-eval'"),
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data:",
    "font-src 'self'",
    "connect-src 'self'" + (production ? '' : ' ws:'),
    "object-src 'none'",
    "base-uri 'self'",
    "frame-ancestors 'none'",
    "form-action 'self'",
  ].join('; ');
  return [
    { key: 'Content-Security-Policy', value: csp },
    { key: 'X-Frame-Options', value: 'DENY' },
    { key: 'X-Content-Type-Options', value: 'nosniff' },
    { key: 'Referrer-Policy', value: 'no-referrer' },
    {
      key: 'Permissions-Policy',
      value: 'camera=(), microphone=(), geolocation=()',
    },
    ...(production
      ? [
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=31536000; includeSubDomains',
          },
        ]
      : []),
  ];
}
