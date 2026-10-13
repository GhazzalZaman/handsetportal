import { securityHeaders, apiOrigin } from './security.mjs';
export default {
  poweredByHeader: false,
  distDir: process.env.AUTH_WEB_SMOKE === 'true' ? '.next/auth-smoke' : '.next',
  transpilePackages: ['@handset/shared'],
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: apiOrigin(process.env.API_URL) + '/api/:path*',
      },
    ];
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: securityHeaders(process.env.NODE_ENV === 'production').filter(
          (header) => header.key !== 'Content-Security-Policy',
        ),
      },
    ];
  },
};
