import {
  MigrationInterface,
  QueryRunner,
  Table,
  TableColumn,
  TableCheck,
  TableForeignKey,
  TableIndex,
} from 'typeorm';
const codes = [
  'sales.record',
  'sales.void',
  'sales.backdate',
  'inventory.receive',
  'inventory.adjust',
  'inventory.import',
];
export class InventorySales1791878400000 implements MigrationInterface {
  name = 'InventorySales1791878400000';
  private schema(r: QueryRunner) {
    const s = (r.connection.options as { schema?: string }).schema ?? 'dbo';
    if (!/^[A-Za-z_][A-Za-z0-9_]{0,63}$/.test(s)) throw Error('Invalid schema');
    return s;
  }
  async up(r: QueryRunner) {
    const s = this.schema(r),
      stock = s + '.inventory_stock',
      sales = s + '.sales_transactions';
    await r.dropCheckConstraint(s + '.handset_skus', 'ck_handset_skus_price');
    await r.renameColumn(s + '.handset_skus', 'price', 'list_price');
    await r.createCheckConstraint(
      s + '.handset_skus',
      new TableCheck({
        name: 'ck_handset_skus_list_price',
        expression: '[list_price] IS NULL OR [list_price] >= 0',
      }),
    );
    await r.addColumn(
      stock,
      new TableColumn({
        name: 'low_stock_threshold',
        type: 'int',
        isNullable: true,
      }),
    );
    await r.createCheckConstraint(
      stock,
      new TableCheck({
        name: 'ck_inventory_stock_threshold',
        expression:
          '[low_stock_threshold] IS NULL OR [low_stock_threshold] >= 0',
      }),
    );
    for (const c of [
      { name: 'recorded_by', type: 'int' },
      { name: 'notes', type: 'nvarchar', length: '1000' },
      { name: 'client_request_id', type: 'uniqueidentifier' },
      { name: 'list_price_snapshot', type: 'decimal', precision: 12, scale: 2 },
      { name: 'voided_at', type: 'datetime2', precision: 3 },
      { name: 'voided_by', type: 'int' },
      { name: 'void_reason', type: 'nvarchar', length: '500' },
    ])
      await r.addColumn(sales, new TableColumn({ ...c, isNullable: true }));
    for (const [column, name] of [
      ['recorded_by', 'fk_sales_recorder'],
      ['voided_by', 'fk_sales_voider'],
    ])
      await r.createForeignKey(
        sales,
        new TableForeignKey({
          name,
          columnNames: [column!],
          referencedTableName: s + '.users',
          referencedColumnNames: ['id'],
          onDelete: 'NO ACTION',
        }),
      );
    await r.createIndex(
      sales,
      new TableIndex({
        name: 'uq_sales_client_request',
        columnNames: ['client_request_id'],
        isUnique: true,
        where: '[client_request_id] IS NOT NULL',
      }),
    );
    await r.createTable(
      new Table({
        name: s + '.inventory_movements',
        columns: [
          {
            name: 'id',
            type: 'bigint',
            isPrimary: true,
            isGenerated: true,
            generationStrategy: 'increment',
          },
          { name: 'center_id', type: 'int' },
          { name: 'sku_id', type: 'int' },
          { name: 'movement_type', type: 'varchar', length: '20' },
          { name: 'quantity_delta', type: 'int' },
          { name: 'quantity_after', type: 'int' },
          {
            name: 'reason_code',
            type: 'varchar',
            length: '40',
            isNullable: true,
          },
          { name: 'note', type: 'nvarchar', length: '1000', isNullable: true },
          { name: 'sales_transaction_id', type: 'bigint', isNullable: true },
          {
            name: 'received_from',
            type: 'varchar',
            length: '30',
            isNullable: true,
          },
          { name: 'source_center_id', type: 'int', isNullable: true },
          {
            name: 'reference',
            type: 'nvarchar',
            length: '160',
            isNullable: true,
          },
          { name: 'user_id', type: 'int', isNullable: true },
          {
            name: 'created_at',
            type: 'datetime2',
            precision: 3,
            default: 'SYSUTCDATETIME()',
          },
          { name: 'request_id', type: 'varchar', length: '100' },
        ],
        checks: [
          {
            name: 'ck_movements_quantity',
            expression: '[quantity_after] >= 0',
          },
          {
            name: 'ck_movements_type',
            expression:
              "[movement_type] IN ('OPENING','RECEIPT','SALE','SALE_REVERSAL','ADJUSTMENT')",
          },
          {
            name: 'ck_movements_received',
            expression:
              "[received_from] IS NULL OR [received_from] IN ('WAREHOUSE','EXPERIENCE_CENTER')",
          },
        ],
        indices: [
          {
            name: 'ix_movements_pair',
            columnNames: ['center_id', 'sku_id', 'id'],
          },
        ],
        foreignKeys: [
          ...[
            ['center_id', 'experience_centers', 'fk_movements_center'],
            ['source_center_id', 'experience_centers', 'fk_movements_source'],
            ['sku_id', 'handset_skus', 'fk_movements_sku'],
            ['sales_transaction_id', 'sales_transactions', 'fk_movements_sale'],
            ['user_id', 'users', 'fk_movements_user'],
          ].map(([column, table, name]) => ({
            name,
            columnNames: [column!],
            referencedTableName: s + '.' + table,
            referencedColumnNames: ['id'],
            onDelete: 'NO ACTION',
          })),
        ],
      }),
    );
    // Migration-only baseline: no stock is changed; historical sales are not replayed.
    await r.query(
      `INSERT INTO [${s}].[inventory_movements] (center_id,sku_id,movement_type,quantity_delta,quantity_after,reason_code,note,user_id,request_id) SELECT center_id,sku_id,'OPENING',quantity_available,quantity_available,'MIGRATION_BASELINE','Existing stock at Module 5 rollout',NULL,'migration-inventory-sales' FROM [${s}].[inventory_stock]`,
    );
    await r.query(
      `INSERT INTO [${s}].[audit_logs] (entity_type,entity_id,action,field_name,new_value,user_id,changed_at,request_id) SELECT 'INVENTORY_MOVEMENT',CAST(id AS varchar(100)),'CREATE','quantity_delta',CAST(quantity_delta AS nvarchar(100)),NULL,SYSUTCDATETIME(),'migration-inventory-sales' FROM [${s}].[inventory_movements]`,
    );
    const roles: { id: number; code: string }[] = await r.query(
      `SELECT r.id,r.code FROM [${s}].[roles] r INNER JOIN [${s}].[role_permissions] g ON g.role_id=r.id INNER JOIN [${s}].[permissions] p ON p.id=g.permission_id WHERE p.code=@0`,
      ['inventory.edit'],
    );
    for (const code of codes) {
      const existing = await r.query(
        `SELECT id FROM [${s}].[permissions] WHERE code=@0`,
        [code],
      );
      // A pre-existing new permission may already have customized grants; leave them intact.
      if (existing.length) continue;
      await r.query(
        `INSERT INTO [${s}].[permissions] (code,description) VALUES (@0,@1)`,
        [code, code.replace('.', ' ')],
      );
      for (const role of roles) {
        const allowed =
          role.code === 'SYSTEM_ADMIN' ||
          (role.code === 'EXPERIENCE_CENTER_MANAGER' &&
            code !== 'inventory.import') ||
          (role.code === 'EXPERIENCE_CENTER_SUPERVISOR' &&
            ['sales.record', 'inventory.receive'].includes(code)) ||
          (![
            'SYSTEM_ADMIN',
            'EXPERIENCE_CENTER_MANAGER',
            'EXPERIENCE_CENTER_SUPERVISOR',
          ].includes(role.code) &&
            ['inventory.receive', 'inventory.adjust'].includes(code));
        if (allowed) {
          await r.query(
            `INSERT INTO [${s}].[role_permissions] (role_id,permission_id) SELECT @0,id FROM [${s}].[permissions] WHERE code=@1`,
            [role.id, code],
          );
          await r.query(
            `INSERT INTO [${s}].[audit_logs] (entity_type,entity_id,action,field_name,old_value,new_value,changed_at,request_id) VALUES ('ROLE',@0,'UPDATE','permission','inventory.edit',@1,SYSUTCDATETIME(),'migration-inventory-sales')`,
            [String(role.id), code],
          );
        }
      }
    }
    await r.query(
      `DELETE g FROM [${s}].[role_permissions] g INNER JOIN [${s}].[permissions] p ON p.id=g.permission_id WHERE p.code=@0`,
      ['inventory.edit'],
    );
    await r.query(`DELETE FROM [${s}].[permissions] WHERE code=@0`, [
      'inventory.edit',
    ]);
  }
  async down(r: QueryRunner) {
    const s = this.schema(r),
      sales = s + '.sales_transactions';
    await r.query(
      `IF NOT EXISTS (SELECT 1 FROM [${s}].[permissions] WHERE code=@0) INSERT INTO [${s}].[permissions] (code,description) VALUES (@0,'Edit inventory within assigned scope')`,
      ['inventory.edit'],
    );
    await r.query(
      `INSERT INTO [${s}].[role_permissions] (role_id,permission_id) SELECT DISTINCT g.role_id,legacy.id FROM [${s}].[role_permissions] g INNER JOIN [${s}].[permissions] p ON p.id=g.permission_id CROSS JOIN [${s}].[permissions] legacy WHERE p.code IN (@0,@1,@2,@3,@4,@5) AND legacy.code='inventory.edit' AND NOT EXISTS (SELECT 1 FROM [${s}].[role_permissions] old WHERE old.role_id=g.role_id AND old.permission_id=legacy.id)`,
      codes,
    );
    await r.query(
      `DELETE g FROM [${s}].[role_permissions] g INNER JOIN [${s}].[permissions] p ON p.id=g.permission_id WHERE p.code IN (@0,@1,@2,@3,@4,@5)`,
      codes,
    );
    await r.query(
      `DELETE FROM [${s}].[permissions] WHERE code IN (@0,@1,@2,@3,@4,@5)`,
      codes,
    );
    await r.dropTable(s + '.inventory_movements');
    await r.dropIndex(sales, 'uq_sales_client_request');
    await r.dropForeignKey(sales, 'fk_sales_recorder');
    await r.dropForeignKey(sales, 'fk_sales_voider');
    for (const name of [
      'recorded_by',
      'notes',
      'client_request_id',
      'list_price_snapshot',
      'voided_at',
      'voided_by',
      'void_reason',
    ])
      await r.dropColumn(sales, name);
    await r.dropCheckConstraint(
      s + '.inventory_stock',
      'ck_inventory_stock_threshold',
    );
    await r.dropColumn(s + '.inventory_stock', 'low_stock_threshold');
    await r.dropCheckConstraint(
      s + '.handset_skus',
      'ck_handset_skus_list_price',
    );
    await r.renameColumn(s + '.handset_skus', 'list_price', 'price');
    await r.createCheckConstraint(
      s + '.handset_skus',
      new TableCheck({
        name: 'ck_handset_skus_price',
        expression: '[price] IS NULL OR [price] >= 0',
      }),
    );
  }
}
