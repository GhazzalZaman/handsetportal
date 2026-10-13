import { Writable } from 'node:stream';
import pino from 'pino';
import { httpLoggingOptions } from './logging';
describe('logging privacy', () => {
  it('omits request data and raw errors while redacting secret fields', () => {
    const lines: string[] = [];
    const destination = new Writable({
      write(chunk, _encoding, callback) {
        lines.push(String(chunk));
        callback();
      },
    });
    const logger = pino(httpLoggingOptions, destination);
    logger.info(
      {
        req: {
          id: 'safe-id',
          method: 'GET',
          url: '/?email=private-email',
          headers: { cookie: 'private-cookie', authorization: 'private-auth' },
          body: { password: 'private-body' },
        },
        res: { statusCode: 500, headers: { 'set-cookie': 'private-session' } },
        err: new Error('private-sql-credentials'),
        password: 'private-password',
        DATABASE_URL: 'private-connection',
        sessionId: 'private-session-id',
      },
      'Request failed',
    );
    const output = lines.join('');
    expect(output).not.toContain('private-');
    expect(JSON.parse(output)).toMatchObject({
      req: { id: 'safe-id', method: 'GET' },
      res: { statusCode: 500 },
      password: '[REDACTED]',
    });
  });
});
