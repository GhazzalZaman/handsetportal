import { Body, Controller, Get, INestApplication, Post } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import { IsString } from 'class-validator';
import { DataSource } from 'typeorm';
import request from 'supertest';
import { LoggerModule } from 'nestjs-pino';
import { HealthService } from '../src/health/health.service';
import { HealthController } from '../src/health/health.controller';
import { DefaultDenyGuard } from '../src/common/default-deny.guard';
import { Public } from '../src/common/public.decorator';
import { configureApp } from '../src/configure-app';
import { httpLoggingOptions } from '../src/config/logging';
class InputDto {
  @IsString() name!: string;
}
@Controller('probe')
class ProbeController {
  @Get() privateRoute() {
    return { secret: true };
  }
  @Public() @Post() validate(@Body() input: InputDto) {
    return input;
  }
  @Public() @Get('failure') failure() {
    throw new Error('SQL password=do-not-leak');
  }
}
describe('HTTP scaffold (mocked DB)', () => {
  let app: INestApplication;
  const query = jest.fn();
  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [
        LoggerModule.forRoot({
          pinoHttp: {
            ...httpLoggingOptions,
            autoLogging: false,
            level: 'silent',
          },
        }),
      ],
      controllers: [HealthController, ProbeController],
      providers: [
        HealthService,
        { provide: DataSource, useValue: { query } },
        { provide: APP_GUARD, useClass: DefaultDenyGuard },
      ],
    }).compile();
    app = module.createNestApplication();
    configureApp(app);
    await app.init();
  });
  afterAll(async () => {
    await app.close();
  });
  it('serves liveness without DB access and emits request IDs/security headers', async () => {
    query.mockClear();
    const response = await request(app.getHttpServer())
      .get('/health/live')
      .set('X-Request-Id', 'untrusted');
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: 'ok' });
    expect(response.headers['x-request-id']).toMatch(/^[a-f0-9-]{36}$/);
    expect(response.headers['x-content-type-options']).toBe('nosniff');
    expect(query).not.toHaveBeenCalled();
  });
  it('checks readiness against the database', async () => {
    query.mockResolvedValueOnce([{ result: 1 }]);
    await request(app.getHttpServer()).get('/health/ready').expect(200);
    expect(query).toHaveBeenCalledWith('SELECT 1');
  });
  it('returns sanitized 503 on a DB outage', async () => {
    query.mockRejectedValueOnce(new Error('password=do-not-leak'));
    const response = await request(app.getHttpServer())
      .get('/health/ready')
      .expect(503);
    expect(response.body.error.statusCode).toBe(503);
    expect(JSON.stringify(response.body)).not.toContain('do-not-leak');
  });
  it('denies routes unless explicitly public', async () => {
    await request(app.getHttpServer()).get('/api/v1/probe').expect(401);
  });
  it('rejects extra and invalid DTO fields', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/probe')
      .send({ name: 'ok', extra: true })
      .expect(400);
    await request(app.getHttpServer())
      .post('/api/v1/probe')
      .send({ name: 42 })
      .expect(400);
    await request(app.getHttpServer())
      .post('/api/v1/probe')
      .send({ name: 'ok' })
      .expect(201);
  });
  it('sanitizes unexpected failures and does not allow cross-origin access', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/probe/failure')
      .set('Origin', 'https://evil.example')
      .expect(500);
    expect(JSON.stringify(response.body)).not.toContain('do-not-leak');
    expect(response.headers['access-control-allow-origin']).toBeUndefined();
    expect(response.body.error.requestId).toBe(
      response.headers['x-request-id'],
    );
  });
});
