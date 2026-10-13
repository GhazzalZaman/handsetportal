import 'dotenv/config';
import { DataSource } from 'typeorm';
import { applicationDatabaseOptions } from '../database/options';
import { reconcileInventory } from './reconcile';
async function main() {
  const db = new DataSource(applicationDatabaseOptions(process.env));
  try {
    await db.initialize();
    const differences = await reconcileInventory(db);
    console.log(
      differences.length
        ? `Inventory reconciliation failed: ${differences.length} mismatched pairs.`
        : 'Inventory reconciliation passed: all stock quantities match the movement ledger.',
    );
    if (differences.length) process.exitCode = 1;
  } finally {
    if (db.isInitialized) await db.destroy();
  }
}
void main().catch(() => {
  console.error(
    'Inventory reconciliation failed; connection and SQL details are suppressed.',
  );
  process.exitCode = 1;
});
