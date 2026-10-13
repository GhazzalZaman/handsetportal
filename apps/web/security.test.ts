import { describe, it, expect } from 'vitest';
import { apiOrigin, securityHeaders } from './security.mjs';
describe('web boundary', () => {
  it('requires a server-only API origin', () => {
    expect(apiOrigin('http://localhost:3001')).toBe('http://localhost:3001');
    for (const value of [
      undefined,
      'https://u:p@host',
      'https://host/path',
      'file:///tmp',
    ])
      expect(() => apiOrigin(value)).toThrow();
  });
  it('disables production eval and framing', () => {
    const headers = securityHeaders(true) as { key: string; value: string }[];
    expect(
      headers.find((h) => h.key === 'Content-Security-Policy')?.value,
    ).not.toContain('unsafe-eval');
    expect(headers.find((h) => h.key === 'X-Frame-Options')?.value).toBe(
      'DENY',
    );
    expect(headers.some((h) => h.key === 'Strict-Transport-Security')).toBe(
      true,
    );
  });
});
