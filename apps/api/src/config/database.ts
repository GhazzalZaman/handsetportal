import { databaseSchema } from '../database/schema';
import type { SqlServerConnectionOptions } from 'typeorm/driver/sqlserver/SqlServerConnectionOptions';
type Env = Record<string, unknown>;
const invalid = () =>
  new Error(
    'Invalid database configuration; check connection format and options',
  );
export function positiveInteger(
  value: unknown,
  fallback: number,
  max = 2147483647,
): number {
  if (value === undefined) return fallback;
  if (!/^\d+$/.test(String(value))) throw invalid();
  const n = Number(value);
  if (!Number.isSafeInteger(n) || n < 1 || n > max) throw invalid();
  return n;
}
function bool(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined) return fallback;
  if (/^true$/i.test(value)) return true;
  if (/^false$/i.test(value)) return false;
  throw invalid();
}
/** ADO quoted values permit semicolons; doubled quotes escape a quote. */
function adoFields(input: string): Map<string, string> {
  const fields = new Map<string, string>();
  let i = 0;
  while (i < input.length) {
    while (i < input.length && /[;\s]/.test(input[i]!)) i++;
    if (i === input.length) break;
    const begin = i;
    while (i < input.length && input[i] !== '=' && input[i] !== ';') i++;
    if (input[i] !== '=') throw invalid();
    const key = input.slice(begin, i).trim().toLowerCase().replace(/\s+/g, ' ');
    i++;
    while (i < input.length && /\s/.test(input[i]!)) i++;
    let value = '';
    const quote = input[i];
    if (quote === '"' || quote === "'") {
      i++;
      let closed = false;
      while (i < input.length) {
        const char = input[i++]!;
        if (char === quote) {
          if (input[i] === quote) {
            value += quote;
            i++;
          } else {
            closed = true;
            break;
          }
        } else value += char;
      }
      if (!closed) throw invalid();
      while (i < input.length && /\s/.test(input[i]!)) i++;
      if (i < input.length && input[i] !== ';') throw invalid();
    } else {
      const start = i;
      while (i < input.length && input[i] !== ';') i++;
      value = input.slice(start, i).trim();
    }
    if (!key || fields.has(key)) throw invalid();
    fields.set(key, value);
  }
  return fields;
}
/** This is the only driver-specific connection translation point. Never log input. */
export function databaseOptions(
  env: Env,
  migration = false,
): SqlServerConnectionOptions {
  try {
    const raw = migration
      ? (env.DATABASE_MIGRATION_URL ?? env.DATABASE_URL)
      : env.DATABASE_URL;
    if (typeof raw !== 'string' || !raw.trim()) throw invalid();
    let host: string,
      port: number,
      database: string,
      username: string,
      password: string;
    let encrypt: boolean, trustServerCertificate: boolean;
    if (/^mssql:\/\//i.test(raw)) {
      const url = new URL(raw);
      if (url.protocol !== 'mssql:' || url.hash) throw invalid();
      const params = new Map<string, string>();
      url.searchParams.forEach((value, key) => {
        if (
          !['encrypt', 'trustServerCertificate'].includes(key) ||
          params.has(key)
        )
          throw invalid();
        params.set(key, value);
      });
      host = url.hostname.replace(/^\[|\]$/g, '');
      port = positiveInteger(url.port || undefined, 1433, 65535);
      database = decodeURIComponent(url.pathname.slice(1));
      if (database.includes('/')) throw invalid();
      username = decodeURIComponent(url.username);
      password = decodeURIComponent(url.password);
      encrypt = bool(params.get('encrypt'), true);
      trustServerCertificate = bool(
        params.get('trustServerCertificate'),
        false,
      );
    } else {
      const fields = adoFields(raw);
      const allowed = [
        'server',
        'database',
        'user id',
        'password',
        'encrypt',
        'trustservercertificate',
      ];
      for (const key of fields.keys())
        if (!allowed.includes(key)) throw invalid();
      const server = (fields.get('server') ?? '').replace(/^tcp:/i, '');
      const match = /^(\[[^\]]+\]|[^,\\\s]+)(?:,(\d+))?$/.exec(server);
      if (!match) throw invalid();
      host = match[1]!.replace(/^\[|\]$/g, '');
      port = positiveInteger(match[2], 1433, 65535);
      database = fields.get('database') ?? '';
      username = fields.get('user id') ?? '';
      password = fields.get('password') ?? '';
      encrypt = bool(fields.get('encrypt'), true);
      trustServerCertificate = bool(
        fields.get('trustservercertificate'),
        false,
      );
    }
    if (![host, database, username, password].every((v) => v.length > 0))
      throw invalid();
    return {
      type: 'mssql',
      schema: databaseSchema(env.DB_SCHEMA),
      host,
      port,
      database,
      username,
      password,
      synchronize: false,
      migrationsRun: false,
      logging: false,
      entities: [],
      pool: { max: positiveInteger(env.DB_POOL_MAX, 10, 1000) },
      connectionTimeout: positiveInteger(env.DB_CONNECT_TIMEOUT, 15000),
      requestTimeout: 15000,
      options: { encrypt, trustServerCertificate, useUTC: true },
    };
  } catch {
    throw invalid();
  }
}
