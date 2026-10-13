import 'reflect-metadata';
import 'dotenv/config';
import { DataSource } from 'typeorm';
import { applicationDatabaseOptions } from '../options';
import { seedDatabase } from './seed';
import { seedSettings } from './settings';
import { clearDemo } from './demo';
async function main(): Promise<void> {
  const settings = seedSettings(process.env);
  const database = new DataSource(
    applicationDatabaseOptions(process.env, true),
  );
  try {
    await database.initialize();
    if (await database.showMigrations()) throw new Error('Pending migrations');
    if (process.argv.includes('--clear-demo')) await clearDemo(database);
    else await seedDatabase(database, settings);
  } finally {
    if (database.isInitialized) await database.destroy();
  }
}
void main().catch(() => {
  // Never print driver errors, SQL parameters, PII, hashes or environment values.
  console.error(
    'Database seed failed. Check connectivity, applied migrations, seed settings and conflicting records. No transaction was partially committed.',
  );
  process.exitCode = 1;
});
