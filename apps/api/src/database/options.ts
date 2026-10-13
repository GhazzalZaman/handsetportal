import './utc-runtime';
import { join } from 'node:path';
import { databaseOptions } from '../config/database';
import { entities } from './entities';
import { SnakeNamingStrategy } from './snake-naming.strategy';
export function applicationDatabaseOptions(
  env: Record<string, unknown>,
  migration = false,
) {
  return {
    ...databaseOptions(env, migration),
    entities,
    namingStrategy: new SnakeNamingStrategy(),
    migrations: [join(__dirname, 'migrations', '*{.ts,.js}')],
    migrationsTableName: 'schema_migrations',
    migrationsTransactionMode: 'all' as const,
  };
}
