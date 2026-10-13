import { DataSource } from 'typeorm';
import { applicationDatabaseOptions } from './options';
import { databaseSchema } from './schema';
import { SnakeNamingStrategy } from './snake-naming.strategy';
class MetadataDataSource extends DataSource {
  async inspect() {
    await this.buildMetadatas();
    return this.entityMetadatas;
  }
}
describe('database metadata', () => {
  it('uses validated schemas', () => {
    expect(databaseSchema(undefined)).toBe('dbo');
    expect(databaseSchema('portal')).toBe('portal');
    for (const value of ['', 'a.b', 'x]; DROP TABLE users;--'])
      expect(() => databaseSchema(value)).toThrow();
  });
  it('names columns in snake case', () => {
    const naming = new SnakeNamingStrategy();
    expect(naming.columnName('quantityAvailable', '', [])).toBe(
      'quantity_available',
    );
    expect(naming.columnName('createdAt', '', ['audit'])).toBe(
      'audit_created_at',
    );
  });
  it('registers all tables, bigint identities, versions and foreign keys without connecting', async () => {
    const db = new MetadataDataSource(
      applicationDatabaseOptions({
        DATABASE_URL: 'mssql://u:p@localhost/db',
        DB_SCHEMA: 'portal',
      }),
    );
    const tables = await db.inspect();
    expect(tables).toHaveLength(20);
    for (const table of tables) {
      expect(table.schema).toBe('portal');
      expect(
        table.columns.every((c) => /^[a-z0-9_]+$/.test(c.databaseName)),
      ).toBe(true);
    }
    for (const name of [
      'sessions',
      'sales_transactions',
      'audit_logs',
      'login_attempts',
    ])
      expect(
        tables.find((t) => t.tableName === name)?.primaryColumns[0]?.type,
      ).toBe('bigint');
    expect(
      tables.find((t) => t.tableName === 'inventory_stock')?.versionColumn
        ?.databaseName,
    ).toBe('row_version');
    expect(
      tables
        .find((t) => t.tableName === 'handset_skus')
        ?.foreignKeys.some(
          (k) => k.columnNames.join(',') === 'specification_id,model_id',
        ),
    ).toBe(true);
    for (const table of tables) {
      if (table.versionColumn) expect(table.versionColumn.default).toBe(1);
    }
    expect(db.options.synchronize).toBe(false);
  });
});
