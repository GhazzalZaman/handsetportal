import 'reflect-metadata';
import 'dotenv/config';
import { DataSource } from 'typeorm';
import { applicationDatabaseOptions } from './options';
async function main(): Promise<void> {
  const action = process.argv[2];
  if (!['migrate', 'revert', 'status'].includes(action ?? ''))
    throw new Error('Unknown DB command');
  const database = new DataSource(
    applicationDatabaseOptions(process.env, true),
  );
  try {
    await database.initialize();
    const runner = database.createQueryRunner();
    try {
      const schema = (database.options as { schema: string }).schema;
      if (action === 'migrate') {
        // TypeORM needs the schema for its migration ledger before migration up() runs.
        await runner.createSchema(schema, true);
        const applied = await database.runMigrations({ transaction: 'all' });
        console.log('Migrations applied: ' + applied.length);
      } else if (action === 'revert') {
        await database.undoLastMigration({ transaction: 'all' });
        console.log('Last migration reverted.');
      } else {
        const hasLedger = await runner.hasTable(schema + '.schema_migrations');
        console.log(
          !hasLedger || (await database.showMigrations())
            ? 'Pending migrations exist.'
            : 'Database migrations are current.',
        );
      }
    } finally {
      await runner.release();
    }
  } finally {
    if (database.isInitialized) await database.destroy();
  }
}
void main().catch(() => {
  console.error(
    'Database command failed. Check connection, schema permissions and migration state. Raw SQL and connection details are suppressed.',
  );
  process.exitCode = 1;
});
