import {
  INestApplication,
  RequestMethod,
  ValidationPipe,
} from '@nestjs/common';
import type { Application, Request, Response, NextFunction } from 'express';
import helmet from 'helmet';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import { RejectedLoginRecorder } from './auth/rejected-login.service';
import { ApiExceptionFilter } from './common/exception.filter';
export function configureApp(
  app: INestApplication,
  trustProxy: boolean | number = false,
): void {
  (app.getHttpAdapter().getInstance() as Application).set(
    'trust proxy',
    trustProxy,
  );
  app.use(helmet());
  app.use(compression());
  app.use(cookieParser());
  app.use((request: Request, response: Response, next: NextFunction) => {
    if (request.path.toLowerCase().startsWith('/api/v1/')) {
      response.setHeader('Cache-Control', 'no-store');
      response.setHeader('Pragma', 'no-cache');
      response.setHeader('Expires', '0');
    }
    next();
  });
  // Browser traffic reaches the private API exclusively through Next; no CORS wildcard.
  app.setGlobalPrefix('api/v1', {
    exclude: [
      { path: 'health/live', method: RequestMethod.GET },
      { path: 'health/ready', method: RequestMethod.GET },
    ],
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  let recorder: RejectedLoginRecorder | undefined;
  try {
    recorder = app.get(RejectedLoginRecorder);
  } catch {
    /* Standalone scaffold tests omit auth providers. */
  }
  app.useGlobalFilters(
    new ApiExceptionFilter(
      recorder
        ? (request, status) => recorder!.record(request, status)
        : undefined,
    ),
  );
  app.enableShutdownHooks();
}
