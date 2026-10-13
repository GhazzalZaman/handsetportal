import { authEnvironment } from '../auth/auth.config';
import { inventoryEnvironment } from '../inventory/inventory.config';
import { databaseOptions, positiveInteger } from './database';
export function validateEnvironment(env: Record<string, unknown>) {
  const nodeEnv = env.NODE_ENV ?? 'development';
  if (!['development', 'test', 'production'].includes(String(nodeEnv)))
    throw new Error('Invalid NODE_ENV');
  databaseOptions(env);
  if (env.DATABASE_MIGRATION_URL !== undefined) databaseOptions(env, true);
  let port: number, idle: number, absolute: number;
  try {
    port = positiveInteger(env.PORT, 3001, 65535);
    idle = positiveInteger(env.SESSION_IDLE_TIMEOUT_MINUTES, 30);
    absolute = positiveInteger(env.SESSION_ABSOLUTE_TIMEOUT_HOURS, 8);
  } catch {
    throw new Error('Invalid port or session timeout configuration');
  }
  if (idle > absolute * 60)
    throw new Error('Session idle timeout exceeds absolute timeout');
  return {
    ...env,
    ...authEnvironment(env),
    ...inventoryEnvironment(env),
    NODE_ENV: nodeEnv,
    PORT: port,
    SESSION_IDLE_TIMEOUT_MINUTES: idle,
    SESSION_ABSOLUTE_TIMEOUT_HOURS: absolute,
  };
}
