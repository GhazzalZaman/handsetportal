import { CatalogModule } from './catalog/catalog.module';
import { InventoryModule } from './inventory/inventory.module';
import { UsersModule } from './users/users.module';
import { RolesModule } from './roles/roles.module';
import { DirectoryModule } from './directory/directory.module';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { AuthModule } from './auth/auth.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { LoggerModule } from 'nestjs-pino';
import { validateEnvironment } from './config/environment';
import { applicationDatabaseOptions } from './database/options';
import { loggingOptions } from './config/logging';

import { HealthService } from './health/health.service';
import { HealthController } from './health/health.controller';
@Module({
  imports: [
    ScheduleModule.forRoot(),
    AuthModule,
    UsersModule,
    RolesModule,
    DirectoryModule,
    CatalogModule,
    InventoryModule,
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnvironment }),
    LoggerModule.forRoot(loggingOptions),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        ...applicationDatabaseOptions({
          DATABASE_URL: config.get<string>('DATABASE_URL'),
          DB_SCHEMA: config.get<string>('DB_SCHEMA'),
          DB_POOL_MAX: config.get<string>('DB_POOL_MAX'),
          DB_CONNECT_TIMEOUT: config.get<string>('DB_CONNECT_TIMEOUT'),
        }),
        retryAttempts: 1,
      }),
      dataSourceFactory: async (options) => {
        if (!options) throw new Error('Database configuration missing');
        try {
          return await new DataSource(options).initialize();
        } catch {
          throw new Error(
            'Database connection failed; verify server access and configuration',
          );
        }
      },
    }),
  ],
  controllers: [HealthController],
  providers: [HealthService],
})
export class AppModule {}
