import { randomUUID } from 'node:crypto';
import type { Params } from 'nestjs-pino';
import type { Options } from 'pino-http';
export const httpLoggingOptions: Options = {
  genReqId: (_req, res) => {
    const id = randomUUID();
    res.setHeader('X-Request-Id', id);
    return id;
  },
  redact: {
    paths: [
      'req.headers.authorization',
      'req.headers.cookie',
      'res.headers["set-cookie"]',
      'password',
      'temporaryPassword',
      '*.temporaryPassword',
      '*.password',
      'DATABASE_URL',
      'DATABASE_MIGRATION_URL',
      'sessionId',
      'token',
      'csrfToken',
      '*.csrfToken',
      'currentPassword',
      'newPassword',
      '*.passwordHash',
      'CSRF_SECRET',
      'passwordHash',
      'sessionHash',
      'authorizationHash',
      '*.sessionId',
      '*.sessionHash',
      '*.currentPassword',
      '*.newPassword',
    ],
    censor: '[REDACTED]',
  },
  // Allowlist only request IDs/methods and response status. URLs can contain PII.
  serializers: {
    req: (req) => ({ id: req.id, method: req.method }),
    res: (res) => ({ statusCode: res.statusCode }),
    err: () => ({ type: 'Error', message: 'Request failed' }),
  },
  customSuccessMessage: () => 'Request completed',
  customErrorMessage: () => 'Request failed',
};
export const loggingOptions: Params = { pinoHttp: httpLoggingOptions };
