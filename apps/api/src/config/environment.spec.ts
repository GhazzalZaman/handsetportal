import { validateEnvironment } from './environment';
const env = {
  DATABASE_URL: 'mssql://u:p@host/db',
  CSRF_SECRET: 'test-only-secret-with-at-least-32-characters',
  ALLOWED_ORIGINS: 'http://localhost:3000',
};
describe('startup configuration', () => {
  it('sets documented defaults', () =>
    expect(validateEnvironment(env)).toMatchObject({
      PORT: 3001,
      SESSION_IDLE_TIMEOUT_MINUTES: 30,
      SESSION_ABSOLUTE_TIMEOUT_HOURS: 8,
    }));
  it('requires a database', () =>
    expect(() => validateEnvironment({})).toThrow());
  it.each([
    { NODE_ENV: 'prod' },
    { PORT: '65536' },
    { SESSION_IDLE_TIMEOUT_MINUTES: '0' },
    { SESSION_IDLE_TIMEOUT_MINUTES: '481' },
    { DATABASE_MIGRATION_URL: '' },
  ])('fails fast for %o', (override) =>
    expect(() => validateEnvironment({ ...env, ...override })).toThrow(),
  );
});
