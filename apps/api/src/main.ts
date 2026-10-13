import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module';
import { configureApp } from './configure-app';
async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, {
    bufferLogs: true,
    abortOnError: false,
  });
  app.useLogger(app.get(Logger));
  configureApp(
    app,
    app.get(ConfigService).get<boolean | number>('TRUST_PROXY') ?? false,
  );
  const config = app.get(ConfigService);
  if (config.get<string>('NODE_ENV') !== 'production') {
    const document = SwaggerModule.createDocument(
      app,
      new DocumentBuilder()
        .setTitle('Handset Portal API')
        .setVersion('1')
        .build(),
    );
    SwaggerModule.setup('api/docs', app, document);
  }
  await app.listen(config.getOrThrow<number>('PORT'), '0.0.0.0');
}
void bootstrap().catch(() => {
  // Do not print driver/config errors, which may contain credentials.
  process.stderr.write(
    'API startup failed; verify environment and database connectivity.\n',
  );
  process.exitCode = 1;
});
