import {
  MigrationInterface,
  QueryRunner,
  Table,
  TableForeignKey,
} from 'typeorm';

// Frozen migration snapshot. Never import current entity definitions here.
// All SQL identifiers below originate in this snapshot or the validated schema.
const tables = [
  {
    name: 'clusters',
    columns: [
      {
        name: 'id',
        type: 'int',
        isPrimary: true,
        isGenerated: true,
        generationStrategy: 'increment',
      },
      {
        name: 'code',
        type: 'varchar',
        length: '40',
        collation: 'Latin1_General_100_CI_AS',
      },
      {
        name: 'name',
        type: 'nvarchar',
        length: '120',
        collation: 'Latin1_General_100_CI_AS',
      },
      { name: 'is_active', type: 'bit', default: '1' },
      { name: 'row_version', type: 'int', default: '1' },
      {
        name: 'created_at',
        type: 'datetime2',
        precision: 3,
        default: 'SYSUTCDATETIME()',
      },
      {
        name: 'updated_at',
        type: 'datetime2',
        precision: 3,
        default: 'SYSUTCDATETIME()',
      },
      { name: 'created_by', type: 'int', isNullable: true },
      { name: 'updated_by', type: 'int', isNullable: true },
    ],
    uniques: [
      { name: 'uq_clusters_0', columnNames: ['code'] },
      { name: 'uq_clusters_1', columnNames: ['name'] },
    ],
    checks: [],
    indices: [],
    foreignKeys: [
      {
        name: 'fk_clusters_0',
        columnNames: ['created_by'],
        referencedTableName: 'users',
        referencedColumnNames: ['id'],
        onDelete: 'NO ACTION',
        onUpdate: 'NO ACTION',
      },
      {
        name: 'fk_clusters_1',
        columnNames: ['updated_by'],
        referencedTableName: 'users',
        referencedColumnNames: ['id'],
        onDelete: 'NO ACTION',
        onUpdate: 'NO ACTION',
      },
    ],
  },
  {
    name: 'experience_centers',
    columns: [
      {
        name: 'id',
        type: 'int',
        isPrimary: true,
        isGenerated: true,
        generationStrategy: 'increment',
      },
      {
        name: 'code',
        type: 'varchar',
        length: '40',
        collation: 'Latin1_General_100_CI_AS',
      },
      {
        name: 'name',
        type: 'nvarchar',
        length: '160',
        collation: 'Latin1_General_100_CI_AS',
      },
      { name: 'short_name', type: 'nvarchar', length: '60', isNullable: true },
      { name: 'cluster_id', type: 'int', isNullable: true },
      { name: 'is_active', type: 'bit', default: '1' },
      { name: 'row_version', type: 'int', default: '1' },
      {
        name: 'created_at',
        type: 'datetime2',
        precision: 3,
        default: 'SYSUTCDATETIME()',
      },
      {
        name: 'updated_at',
        type: 'datetime2',
        precision: 3,
        default: 'SYSUTCDATETIME()',
      },
      { name: 'created_by', type: 'int', isNullable: true },
      { name: 'updated_by', type: 'int', isNullable: true },
    ],
    uniques: [
      { name: 'uq_experience_centers_0', columnNames: ['code'] },
      { name: 'uq_experience_centers_1', columnNames: ['name'] },
    ],
    checks: [],
    indices: [
      {
        name: 'ix_experience_centers_0',
        columnNames: ['cluster_id'],
        isUnique: false,
      },
    ],
    foreignKeys: [
      {
        name: 'fk_experience_centers_0',
        columnNames: ['cluster_id'],
        referencedTableName: 'clusters',
        referencedColumnNames: ['id'],
        onDelete: 'NO ACTION',
        onUpdate: 'NO ACTION',
      },
      {
        name: 'fk_experience_centers_1',
        columnNames: ['created_by'],
        referencedTableName: 'users',
        referencedColumnNames: ['id'],
        onDelete: 'NO ACTION',
        onUpdate: 'NO ACTION',
      },
      {
        name: 'fk_experience_centers_2',
        columnNames: ['updated_by'],
        referencedTableName: 'users',
        referencedColumnNames: ['id'],
        onDelete: 'NO ACTION',
        onUpdate: 'NO ACTION',
      },
    ],
  },
  {
    name: 'brands',
    columns: [
      {
        name: 'id',
        type: 'int',
        isPrimary: true,
        isGenerated: true,
        generationStrategy: 'increment',
      },
      {
        name: 'name',
        type: 'nvarchar',
        length: '100',
        collation: 'Latin1_General_100_CI_AS',
      },
      { name: 'is_active', type: 'bit', default: '1' },
      { name: 'row_version', type: 'int', default: '1' },
      {
        name: 'created_at',
        type: 'datetime2',
        precision: 3,
        default: 'SYSUTCDATETIME()',
      },
      {
        name: 'updated_at',
        type: 'datetime2',
        precision: 3,
        default: 'SYSUTCDATETIME()',
      },
      { name: 'created_by', type: 'int', isNullable: true },
      { name: 'updated_by', type: 'int', isNullable: true },
    ],
    uniques: [{ name: 'uq_brands_0', columnNames: ['name'] }],
    checks: [],
    indices: [],
    foreignKeys: [
      {
        name: 'fk_brands_0',
        columnNames: ['created_by'],
        referencedTableName: 'users',
        referencedColumnNames: ['id'],
        onDelete: 'NO ACTION',
        onUpdate: 'NO ACTION',
      },
      {
        name: 'fk_brands_1',
        columnNames: ['updated_by'],
        referencedTableName: 'users',
        referencedColumnNames: ['id'],
        onDelete: 'NO ACTION',
        onUpdate: 'NO ACTION',
      },
    ],
  },
  {
    name: 'handset_models',
    columns: [
      {
        name: 'id',
        type: 'int',
        isPrimary: true,
        isGenerated: true,
        generationStrategy: 'increment',
      },
      { name: 'brand_id', type: 'int' },
      {
        name: 'name',
        type: 'nvarchar',
        length: '120',
        collation: 'Latin1_General_100_CI_AS',
      },
      { name: 'is_active', type: 'bit', default: '1' },
      {
        name: 'source_system',
        type: 'varchar',
        length: '40',
        isNullable: true,
      },
      { name: 'row_version', type: 'int', default: '1' },
      {
        name: 'created_at',
        type: 'datetime2',
        precision: 3,
        default: 'SYSUTCDATETIME()',
      },
      {
        name: 'updated_at',
        type: 'datetime2',
        precision: 3,
        default: 'SYSUTCDATETIME()',
      },
      { name: 'created_by', type: 'int', isNullable: true },
      { name: 'updated_by', type: 'int', isNullable: true },
    ],
    uniques: [
      { name: 'uq_handset_models_0', columnNames: ['brand_id', 'name'] },
    ],
    checks: [],
    indices: [],
    foreignKeys: [
      {
        name: 'fk_handset_models_0',
        columnNames: ['brand_id'],
        referencedTableName: 'brands',
        referencedColumnNames: ['id'],
        onDelete: 'NO ACTION',
        onUpdate: 'NO ACTION',
      },
      {
        name: 'fk_handset_models_1',
        columnNames: ['created_by'],
        referencedTableName: 'users',
        referencedColumnNames: ['id'],
        onDelete: 'NO ACTION',
        onUpdate: 'NO ACTION',
      },
      {
        name: 'fk_handset_models_2',
        columnNames: ['updated_by'],
        referencedTableName: 'users',
        referencedColumnNames: ['id'],
        onDelete: 'NO ACTION',
        onUpdate: 'NO ACTION',
      },
    ],
  },
  {
    name: 'model_specifications',
    columns: [
      {
        name: 'id',
        type: 'int',
        isPrimary: true,
        isGenerated: true,
        generationStrategy: 'increment',
      },
      { name: 'model_id', type: 'int' },
      {
        name: 'label',
        type: 'nvarchar',
        length: '100',
        collation: 'Latin1_General_100_CI_AS',
      },
      { name: 'ram_gb', type: 'int', isNullable: true },
      { name: 'storage_gb', type: 'int', isNullable: true },
      { name: 'notes', type: 'nvarchar', length: 'max', isNullable: true },
      { name: 'is_active', type: 'bit', default: '1' },
      {
        name: 'source_system',
        type: 'varchar',
        length: '40',
        isNullable: true,
      },
      { name: 'row_version', type: 'int', default: '1' },
      {
        name: 'created_at',
        type: 'datetime2',
        precision: 3,
        default: 'SYSUTCDATETIME()',
      },
      {
        name: 'updated_at',
        type: 'datetime2',
        precision: 3,
        default: 'SYSUTCDATETIME()',
      },
      { name: 'created_by', type: 'int', isNullable: true },
      { name: 'updated_by', type: 'int', isNullable: true },
    ],
    uniques: [
      { name: 'uq_model_specifications_0', columnNames: ['model_id', 'label'] },
      { name: 'uq_model_specifications_1', columnNames: ['id', 'model_id'] },
    ],
    checks: [
      {
        name: 'ck_model_specifications_0',
        expression: '[ram_gb] IS NULL OR [ram_gb] > 0',
      },
      {
        name: 'ck_model_specifications_1',
        expression: '[storage_gb] IS NULL OR [storage_gb] > 0',
      },
    ],
    indices: [],
    foreignKeys: [
      {
        name: 'fk_model_specifications_0',
        columnNames: ['model_id'],
        referencedTableName: 'handset_models',
        referencedColumnNames: ['id'],
        onDelete: 'NO ACTION',
        onUpdate: 'NO ACTION',
      },
      {
        name: 'fk_model_specifications_1',
        columnNames: ['created_by'],
        referencedTableName: 'users',
        referencedColumnNames: ['id'],
        onDelete: 'NO ACTION',
        onUpdate: 'NO ACTION',
      },
      {
        name: 'fk_model_specifications_2',
        columnNames: ['updated_by'],
        referencedTableName: 'users',
        referencedColumnNames: ['id'],
        onDelete: 'NO ACTION',
        onUpdate: 'NO ACTION',
      },
    ],
  },
  {
    name: 'colors',
    columns: [
      {
        name: 'id',
        type: 'int',
        isPrimary: true,
        isGenerated: true,
        generationStrategy: 'increment',
      },
      {
        name: 'name',
        type: 'nvarchar',
        length: '60',
        collation: 'Latin1_General_100_CI_AS',
      },
      { name: 'is_active', type: 'bit', default: '1' },
      {
        name: 'source_system',
        type: 'varchar',
        length: '40',
        isNullable: true,
      },
      { name: 'row_version', type: 'int', default: '1' },
      {
        name: 'created_at',
        type: 'datetime2',
        precision: 3,
        default: 'SYSUTCDATETIME()',
      },
      {
        name: 'updated_at',
        type: 'datetime2',
        precision: 3,
        default: 'SYSUTCDATETIME()',
      },
      { name: 'created_by', type: 'int', isNullable: true },
      { name: 'updated_by', type: 'int', isNullable: true },
    ],
    uniques: [{ name: 'uq_colors_0', columnNames: ['name'] }],
    checks: [],
    indices: [],
    foreignKeys: [
      {
        name: 'fk_colors_0',
        columnNames: ['created_by'],
        referencedTableName: 'users',
        referencedColumnNames: ['id'],
        onDelete: 'NO ACTION',
        onUpdate: 'NO ACTION',
      },
      {
        name: 'fk_colors_1',
        columnNames: ['updated_by'],
        referencedTableName: 'users',
        referencedColumnNames: ['id'],
        onDelete: 'NO ACTION',
        onUpdate: 'NO ACTION',
      },
    ],
  },
  {
    name: 'handset_skus',
    columns: [
      {
        name: 'id',
        type: 'int',
        isPrimary: true,
        isGenerated: true,
        generationStrategy: 'increment',
      },
      { name: 'model_id', type: 'int' },
      { name: 'specification_id', type: 'int', isNullable: true },
      { name: 'color_id', type: 'int' },
      {
        name: 'sku_code',
        type: 'varchar',
        length: '100',
        collation: 'Latin1_General_100_CI_AS',
      },
      { name: 'is_active', type: 'bit', default: '1' },
      {
        name: 'source_system',
        type: 'varchar',
        length: '40',
        isNullable: true,
      },
      { name: 'row_version', type: 'int', default: '1' },
      {
        name: 'created_at',
        type: 'datetime2',
        precision: 3,
        default: 'SYSUTCDATETIME()',
      },
      {
        name: 'updated_at',
        type: 'datetime2',
        precision: 3,
        default: 'SYSUTCDATETIME()',
      },
      { name: 'created_by', type: 'int', isNullable: true },
      { name: 'updated_by', type: 'int', isNullable: true },
    ],
    uniques: [{ name: 'uq_handset_skus_0', columnNames: ['sku_code'] }],
    checks: [],
    indices: [
      {
        name: 'ix_handset_skus_0',
        columnNames: ['model_id', 'specification_id', 'color_id'],
        isUnique: true,
        where: '[specification_id] IS NOT NULL',
      },
      {
        name: 'ix_handset_skus_1',
        columnNames: ['model_id', 'color_id'],
        isUnique: true,
        where: '[specification_id] IS NULL',
      },
      { name: 'ix_handset_skus_2', columnNames: ['color_id'], isUnique: false },
    ],
    foreignKeys: [
      {
        name: 'fk_handset_skus_0',
        columnNames: ['model_id'],
        referencedTableName: 'handset_models',
        referencedColumnNames: ['id'],
        onDelete: 'NO ACTION',
        onUpdate: 'NO ACTION',
      },
      {
        name: 'fk_handset_skus_1',
        columnNames: ['specification_id', 'model_id'],
        referencedTableName: 'model_specifications',
        referencedColumnNames: ['id', 'model_id'],
        onDelete: 'NO ACTION',
        onUpdate: 'NO ACTION',
      },
      {
        name: 'fk_handset_skus_2',
        columnNames: ['color_id'],
        referencedTableName: 'colors',
        referencedColumnNames: ['id'],
        onDelete: 'NO ACTION',
        onUpdate: 'NO ACTION',
      },
      {
        name: 'fk_handset_skus_3',
        columnNames: ['created_by'],
        referencedTableName: 'users',
        referencedColumnNames: ['id'],
        onDelete: 'NO ACTION',
        onUpdate: 'NO ACTION',
      },
      {
        name: 'fk_handset_skus_4',
        columnNames: ['updated_by'],
        referencedTableName: 'users',
        referencedColumnNames: ['id'],
        onDelete: 'NO ACTION',
        onUpdate: 'NO ACTION',
      },
    ],
  },
  {
    name: 'inventory_stock',
    columns: [
      {
        name: 'id',
        type: 'int',
        isPrimary: true,
        isGenerated: true,
        generationStrategy: 'increment',
      },
      { name: 'center_id', type: 'int' },
      { name: 'sku_id', type: 'int' },
      { name: 'quantity_available', type: 'int', default: '0' },
      {
        name: 'last_stock_update_at',
        type: 'datetime2',
        precision: 3,
        default: 'SYSUTCDATETIME()',
      },
      {
        name: 'source_system',
        type: 'varchar',
        length: '40',
        isNullable: true,
      },
      { name: 'row_version', type: 'int', default: '1' },
      {
        name: 'created_at',
        type: 'datetime2',
        precision: 3,
        default: 'SYSUTCDATETIME()',
      },
      {
        name: 'updated_at',
        type: 'datetime2',
        precision: 3,
        default: 'SYSUTCDATETIME()',
      },
      { name: 'created_by', type: 'int', isNullable: true },
      { name: 'updated_by', type: 'int', isNullable: true },
    ],
    uniques: [
      { name: 'uq_inventory_stock_0', columnNames: ['center_id', 'sku_id'] },
    ],
    checks: [
      { name: 'ck_inventory_stock_0', expression: '[quantity_available] >= 0' },
    ],
    indices: [
      {
        name: 'ix_inventory_stock_0',
        columnNames: ['sku_id'],
        isUnique: false,
      },
    ],
    foreignKeys: [
      {
        name: 'fk_inventory_stock_0',
        columnNames: ['center_id'],
        referencedTableName: 'experience_centers',
        referencedColumnNames: ['id'],
        onDelete: 'NO ACTION',
        onUpdate: 'NO ACTION',
      },
      {
        name: 'fk_inventory_stock_1',
        columnNames: ['sku_id'],
        referencedTableName: 'handset_skus',
        referencedColumnNames: ['id'],
        onDelete: 'NO ACTION',
        onUpdate: 'NO ACTION',
      },
      {
        name: 'fk_inventory_stock_2',
        columnNames: ['created_by'],
        referencedTableName: 'users',
        referencedColumnNames: ['id'],
        onDelete: 'NO ACTION',
        onUpdate: 'NO ACTION',
      },
      {
        name: 'fk_inventory_stock_3',
        columnNames: ['updated_by'],
        referencedTableName: 'users',
        referencedColumnNames: ['id'],
        onDelete: 'NO ACTION',
        onUpdate: 'NO ACTION',
      },
    ],
  },
  {
    name: 'sales_transactions',
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
      { name: 'sold_at', type: 'datetime2', precision: 3 },
      { name: 'sale_date', type: 'date' },
      { name: 'quantity', type: 'int' },
      { name: 'sales_type', type: 'varchar', length: '20' },
      { name: 'dispatch_source', type: 'varchar', length: '30' },
      {
        name: 'source_system',
        type: 'varchar',
        length: '40',
        collation: 'Latin1_General_100_CI_AS',
      },
      {
        name: 'external_ref',
        type: 'varchar',
        length: '160',
        collation: 'Latin1_General_100_CI_AS',
      },
      { name: 'import_batch_id', type: 'bigint', isNullable: true },
      {
        name: 'created_at',
        type: 'datetime2',
        precision: 3,
        default: 'SYSUTCDATETIME()',
      },
      {
        name: 'updated_at',
        type: 'datetime2',
        precision: 3,
        default: 'SYSUTCDATETIME()',
      },
      { name: 'created_by', type: 'int', isNullable: true },
      { name: 'updated_by', type: 'int', isNullable: true },
    ],
    uniques: [
      {
        name: 'uq_sales_transactions_0',
        columnNames: ['source_system', 'external_ref'],
      },
    ],
    checks: [
      { name: 'ck_sales_transactions_0', expression: '[quantity] > 0' },
      {
        name: 'ck_sales_transactions_1',
        expression: "[sales_type] IN ('CASH','INSTALLMENT','FNF')",
      },
      {
        name: 'ck_sales_transactions_2',
        expression: "[dispatch_source] IN ('WAREHOUSE','EXPERIENCE_CENTER')",
      },
      {
        name: 'ck_sales_transactions_3',
        expression:
          '[sale_date] = CONVERT(date, DATEADD(minute, 300, [sold_at]))',
      },
    ],
    indices: [
      {
        name: 'ix_sales_transactions_0',
        columnNames: ['center_id', 'sale_date'],
        isUnique: false,
      },
      {
        name: 'ix_sales_transactions_1',
        columnNames: ['sku_id', 'sale_date'],
        isUnique: false,
      },
      {
        name: 'ix_sales_transactions_3',
        columnNames: ['import_batch_id'],
        isUnique: false,
      },
    ],
    foreignKeys: [
      {
        name: 'fk_sales_transactions_0',
        columnNames: ['center_id'],
        referencedTableName: 'experience_centers',
        referencedColumnNames: ['id'],
        onDelete: 'NO ACTION',
        onUpdate: 'NO ACTION',
      },
      {
        name: 'fk_sales_transactions_1',
        columnNames: ['sku_id'],
        referencedTableName: 'handset_skus',
        referencedColumnNames: ['id'],
        onDelete: 'NO ACTION',
        onUpdate: 'NO ACTION',
      },
      {
        name: 'fk_sales_transactions_2',
        columnNames: ['import_batch_id'],
        referencedTableName: 'data_import_batches',
        referencedColumnNames: ['id'],
        onDelete: 'NO ACTION',
        onUpdate: 'NO ACTION',
      },
      {
        name: 'fk_sales_transactions_3',
        columnNames: ['created_by'],
        referencedTableName: 'users',
        referencedColumnNames: ['id'],
        onDelete: 'NO ACTION',
        onUpdate: 'NO ACTION',
      },
      {
        name: 'fk_sales_transactions_4',
        columnNames: ['updated_by'],
        referencedTableName: 'users',
        referencedColumnNames: ['id'],
        onDelete: 'NO ACTION',
        onUpdate: 'NO ACTION',
      },
    ],
  },
  {
    name: 'data_import_batches',
    columns: [
      {
        name: 'id',
        type: 'bigint',
        isPrimary: true,
        isGenerated: true,
        generationStrategy: 'increment',
      },
      { name: 'source_system', type: 'varchar', length: '40' },
      { name: 'kind', type: 'varchar', length: '20' },
      { name: 'file_name', type: 'nvarchar', length: '255', isNullable: true },
      {
        name: 'started_at',
        type: 'datetime2',
        precision: 3,
        default: 'SYSUTCDATETIME()',
      },
      {
        name: 'finished_at',
        type: 'datetime2',
        precision: 3,
        isNullable: true,
      },
      { name: 'status', type: 'varchar', length: '20', default: "'RUNNING'" },
      { name: 'rows_received', type: 'int', default: '0' },
      { name: 'rows_accepted', type: 'int', default: '0' },
      { name: 'rows_rejected', type: 'int', default: '0' },
      {
        name: 'error_summary',
        type: 'nvarchar',
        length: 'max',
        isNullable: true,
      },
      { name: 'triggered_by', type: 'int', isNullable: true },
      {
        name: 'created_at',
        type: 'datetime2',
        precision: 3,
        default: 'SYSUTCDATETIME()',
      },
      {
        name: 'updated_at',
        type: 'datetime2',
        precision: 3,
        default: 'SYSUTCDATETIME()',
      },
      { name: 'created_by', type: 'int', isNullable: true },
      { name: 'updated_by', type: 'int', isNullable: true },
    ],
    uniques: [],
    checks: [
      {
        name: 'ck_data_import_batches_0',
        expression: "[kind] IN ('SALES','INVENTORY','MASTER')",
      },
      {
        name: 'ck_data_import_batches_1',
        expression: "[status] IN ('RUNNING','SUCCESS','PARTIAL','FAILED')",
      },
      {
        name: 'ck_data_import_batches_2',
        expression:
          '[rows_received] >= 0 AND [rows_accepted] >= 0 AND [rows_rejected] >= 0 AND [rows_accepted] + [rows_rejected] <= [rows_received]',
      },
      {
        name: 'ck_data_import_batches_3',
        expression: '[finished_at] IS NULL OR [finished_at] >= [started_at]',
      },
    ],
    indices: [
      {
        name: 'ix_data_import_batches_0',
        columnNames: ['kind', 'status', 'finished_at'],
        isUnique: false,
      },
    ],
    foreignKeys: [
      {
        name: 'fk_data_import_batches_0',
        columnNames: ['triggered_by'],
        referencedTableName: 'users',
        referencedColumnNames: ['id'],
        onDelete: 'NO ACTION',
        onUpdate: 'NO ACTION',
      },
      {
        name: 'fk_data_import_batches_1',
        columnNames: ['created_by'],
        referencedTableName: 'users',
        referencedColumnNames: ['id'],
        onDelete: 'NO ACTION',
        onUpdate: 'NO ACTION',
      },
      {
        name: 'fk_data_import_batches_2',
        columnNames: ['updated_by'],
        referencedTableName: 'users',
        referencedColumnNames: ['id'],
        onDelete: 'NO ACTION',
        onUpdate: 'NO ACTION',
      },
    ],
  },
  {
    name: 'roles',
    columns: [
      {
        name: 'id',
        type: 'int',
        isPrimary: true,
        isGenerated: true,
        generationStrategy: 'increment',
      },
      {
        name: 'code',
        type: 'varchar',
        length: '60',
        collation: 'Latin1_General_100_CI_AS',
      },
      { name: 'name', type: 'nvarchar', length: '120' },
      { name: 'scope_type', type: 'varchar', length: '10' },
      { name: 'can_edit_default', type: 'bit', default: '0' },
      { name: 'is_active', type: 'bit', default: '1' },
      { name: 'row_version', type: 'int', default: '1' },
      {
        name: 'created_at',
        type: 'datetime2',
        precision: 3,
        default: 'SYSUTCDATETIME()',
      },
      {
        name: 'updated_at',
        type: 'datetime2',
        precision: 3,
        default: 'SYSUTCDATETIME()',
      },
      { name: 'created_by', type: 'int', isNullable: true },
      { name: 'updated_by', type: 'int', isNullable: true },
    ],
    uniques: [{ name: 'uq_roles_0', columnNames: ['code'] }],
    checks: [
      {
        name: 'ck_roles_0',
        expression: "[scope_type] IN ('ALL','CLUSTER','CENTER')",
      },
    ],
    indices: [],
    foreignKeys: [
      {
        name: 'fk_roles_0',
        columnNames: ['created_by'],
        referencedTableName: 'users',
        referencedColumnNames: ['id'],
        onDelete: 'NO ACTION',
        onUpdate: 'NO ACTION',
      },
      {
        name: 'fk_roles_1',
        columnNames: ['updated_by'],
        referencedTableName: 'users',
        referencedColumnNames: ['id'],
        onDelete: 'NO ACTION',
        onUpdate: 'NO ACTION',
      },
    ],
  },
  {
    name: 'permissions',
    columns: [
      {
        name: 'id',
        type: 'int',
        isPrimary: true,
        isGenerated: true,
        generationStrategy: 'increment',
      },
      {
        name: 'code',
        type: 'varchar',
        length: '80',
        collation: 'Latin1_General_100_CI_AS',
      },
      { name: 'description', type: 'nvarchar', length: '255' },
      { name: 'is_active', type: 'bit', default: '1' },
      { name: 'row_version', type: 'int', default: '1' },
      {
        name: 'created_at',
        type: 'datetime2',
        precision: 3,
        default: 'SYSUTCDATETIME()',
      },
      {
        name: 'updated_at',
        type: 'datetime2',
        precision: 3,
        default: 'SYSUTCDATETIME()',
      },
      { name: 'created_by', type: 'int', isNullable: true },
      { name: 'updated_by', type: 'int', isNullable: true },
    ],
    uniques: [{ name: 'uq_permissions_0', columnNames: ['code'] }],
    checks: [],
    indices: [],
    foreignKeys: [
      {
        name: 'fk_permissions_0',
        columnNames: ['created_by'],
        referencedTableName: 'users',
        referencedColumnNames: ['id'],
        onDelete: 'NO ACTION',
        onUpdate: 'NO ACTION',
      },
      {
        name: 'fk_permissions_1',
        columnNames: ['updated_by'],
        referencedTableName: 'users',
        referencedColumnNames: ['id'],
        onDelete: 'NO ACTION',
        onUpdate: 'NO ACTION',
      },
    ],
  },
  {
    name: 'role_permissions',
    columns: [
      { name: 'role_id', type: 'int', isPrimary: true },
      { name: 'permission_id', type: 'int', isPrimary: true },
      {
        name: 'created_at',
        type: 'datetime2',
        precision: 3,
        default: 'SYSUTCDATETIME()',
      },
      {
        name: 'updated_at',
        type: 'datetime2',
        precision: 3,
        default: 'SYSUTCDATETIME()',
      },
      { name: 'created_by', type: 'int', isNullable: true },
      { name: 'updated_by', type: 'int', isNullable: true },
    ],
    uniques: [],
    checks: [],
    indices: [
      {
        name: 'ix_role_permissions_0',
        columnNames: ['permission_id'],
        isUnique: false,
      },
    ],
    foreignKeys: [
      {
        name: 'fk_role_permissions_0',
        columnNames: ['role_id'],
        referencedTableName: 'roles',
        referencedColumnNames: ['id'],
        onDelete: 'NO ACTION',
        onUpdate: 'NO ACTION',
      },
      {
        name: 'fk_role_permissions_1',
        columnNames: ['permission_id'],
        referencedTableName: 'permissions',
        referencedColumnNames: ['id'],
        onDelete: 'NO ACTION',
        onUpdate: 'NO ACTION',
      },
      {
        name: 'fk_role_permissions_2',
        columnNames: ['created_by'],
        referencedTableName: 'users',
        referencedColumnNames: ['id'],
        onDelete: 'NO ACTION',
        onUpdate: 'NO ACTION',
      },
      {
        name: 'fk_role_permissions_3',
        columnNames: ['updated_by'],
        referencedTableName: 'users',
        referencedColumnNames: ['id'],
        onDelete: 'NO ACTION',
        onUpdate: 'NO ACTION',
      },
    ],
  },
  {
    name: 'users',
    columns: [
      {
        name: 'id',
        type: 'int',
        isPrimary: true,
        isGenerated: true,
        generationStrategy: 'increment',
      },
      {
        name: 'username',
        type: 'nvarchar',
        length: '100',
        collation: 'Latin1_General_100_CI_AS',
      },
      {
        name: 'email',
        type: 'nvarchar',
        length: '254',
        collation: 'Latin1_General_100_CI_AS',
        isNullable: true,
      },
      { name: 'display_name', type: 'nvarchar', length: '160' },
      { name: 'password_hash', type: 'varchar', length: '255' },
      { name: 'role_id', type: 'int' },
      { name: 'is_active', type: 'bit', default: '1' },
      { name: 'must_change_password', type: 'bit', default: '1' },
      { name: 'failed_login_count', type: 'int', default: '0' },
      {
        name: 'locked_until',
        type: 'datetime2',
        precision: 3,
        isNullable: true,
      },
      {
        name: 'last_login_at',
        type: 'datetime2',
        precision: 3,
        isNullable: true,
      },
      {
        name: 'password_changed_at',
        type: 'datetime2',
        precision: 3,
        default: 'SYSUTCDATETIME()',
      },
      { name: 'row_version', type: 'int', default: '1' },
      {
        name: 'created_at',
        type: 'datetime2',
        precision: 3,
        default: 'SYSUTCDATETIME()',
      },
      {
        name: 'updated_at',
        type: 'datetime2',
        precision: 3,
        default: 'SYSUTCDATETIME()',
      },
      { name: 'created_by', type: 'int', isNullable: true },
      { name: 'updated_by', type: 'int', isNullable: true },
    ],
    uniques: [{ name: 'uq_users_0', columnNames: ['username'] }],
    checks: [{ name: 'ck_users_0', expression: '[failed_login_count] >= 0' }],
    indices: [
      {
        name: 'ix_users_0',
        columnNames: ['email'],
        isUnique: true,
        where: '[email] IS NOT NULL',
      },
      { name: 'ix_users_1', columnNames: ['role_id'], isUnique: false },
    ],
    foreignKeys: [
      {
        name: 'fk_users_0',
        columnNames: ['role_id'],
        referencedTableName: 'roles',
        referencedColumnNames: ['id'],
        onDelete: 'NO ACTION',
        onUpdate: 'NO ACTION',
      },
      {
        name: 'fk_users_1',
        columnNames: ['created_by'],
        referencedTableName: 'users',
        referencedColumnNames: ['id'],
        onDelete: 'NO ACTION',
        onUpdate: 'NO ACTION',
      },
      {
        name: 'fk_users_2',
        columnNames: ['updated_by'],
        referencedTableName: 'users',
        referencedColumnNames: ['id'],
        onDelete: 'NO ACTION',
        onUpdate: 'NO ACTION',
      },
    ],
  },
  {
    name: 'user_center_assignments',
    columns: [
      { name: 'user_id', type: 'int', isPrimary: true },
      { name: 'center_id', type: 'int', isPrimary: true },
      {
        name: 'created_at',
        type: 'datetime2',
        precision: 3,
        default: 'SYSUTCDATETIME()',
      },
      {
        name: 'updated_at',
        type: 'datetime2',
        precision: 3,
        default: 'SYSUTCDATETIME()',
      },
      { name: 'created_by', type: 'int', isNullable: true },
      { name: 'updated_by', type: 'int', isNullable: true },
    ],
    uniques: [],
    checks: [],
    indices: [
      {
        name: 'ix_user_center_assignments_0',
        columnNames: ['center_id'],
        isUnique: false,
      },
    ],
    foreignKeys: [
      {
        name: 'fk_user_center_assignments_0',
        columnNames: ['user_id'],
        referencedTableName: 'users',
        referencedColumnNames: ['id'],
        onDelete: 'NO ACTION',
        onUpdate: 'NO ACTION',
      },
      {
        name: 'fk_user_center_assignments_1',
        columnNames: ['center_id'],
        referencedTableName: 'experience_centers',
        referencedColumnNames: ['id'],
        onDelete: 'NO ACTION',
        onUpdate: 'NO ACTION',
      },
      {
        name: 'fk_user_center_assignments_2',
        columnNames: ['created_by'],
        referencedTableName: 'users',
        referencedColumnNames: ['id'],
        onDelete: 'NO ACTION',
        onUpdate: 'NO ACTION',
      },
      {
        name: 'fk_user_center_assignments_3',
        columnNames: ['updated_by'],
        referencedTableName: 'users',
        referencedColumnNames: ['id'],
        onDelete: 'NO ACTION',
        onUpdate: 'NO ACTION',
      },
    ],
  },
  {
    name: 'user_cluster_assignments',
    columns: [
      { name: 'user_id', type: 'int', isPrimary: true },
      { name: 'cluster_id', type: 'int', isPrimary: true },
      {
        name: 'created_at',
        type: 'datetime2',
        precision: 3,
        default: 'SYSUTCDATETIME()',
      },
      {
        name: 'updated_at',
        type: 'datetime2',
        precision: 3,
        default: 'SYSUTCDATETIME()',
      },
      { name: 'created_by', type: 'int', isNullable: true },
      { name: 'updated_by', type: 'int', isNullable: true },
    ],
    uniques: [],
    checks: [],
    indices: [
      {
        name: 'ix_user_cluster_assignments_0',
        columnNames: ['cluster_id'],
        isUnique: false,
      },
    ],
    foreignKeys: [
      {
        name: 'fk_user_cluster_assignments_0',
        columnNames: ['user_id'],
        referencedTableName: 'users',
        referencedColumnNames: ['id'],
        onDelete: 'NO ACTION',
        onUpdate: 'NO ACTION',
      },
      {
        name: 'fk_user_cluster_assignments_1',
        columnNames: ['cluster_id'],
        referencedTableName: 'clusters',
        referencedColumnNames: ['id'],
        onDelete: 'NO ACTION',
        onUpdate: 'NO ACTION',
      },
      {
        name: 'fk_user_cluster_assignments_2',
        columnNames: ['created_by'],
        referencedTableName: 'users',
        referencedColumnNames: ['id'],
        onDelete: 'NO ACTION',
        onUpdate: 'NO ACTION',
      },
      {
        name: 'fk_user_cluster_assignments_3',
        columnNames: ['updated_by'],
        referencedTableName: 'users',
        referencedColumnNames: ['id'],
        onDelete: 'NO ACTION',
        onUpdate: 'NO ACTION',
      },
    ],
  },
  {
    name: 'sessions',
    columns: [
      {
        name: 'id',
        type: 'bigint',
        isPrimary: true,
        isGenerated: true,
        generationStrategy: 'increment',
      },
      {
        name: 'session_hash',
        type: 'char',
        length: '64',
        collation: 'Latin1_General_100_BIN2',
      },
      { name: 'user_id', type: 'int' },
      {
        name: 'created_at',
        type: 'datetime2',
        precision: 3,
        default: 'SYSUTCDATETIME()',
      },
      {
        name: 'last_seen_at',
        type: 'datetime2',
        precision: 3,
        default: 'SYSUTCDATETIME()',
      },
      { name: 'idle_expires_at', type: 'datetime2', precision: 3 },
      { name: 'absolute_expires_at', type: 'datetime2', precision: 3 },
      { name: 'revoked_at', type: 'datetime2', precision: 3, isNullable: true },
      {
        name: 'revoked_reason',
        type: 'nvarchar',
        length: '160',
        isNullable: true,
      },
      { name: 'ip_address', type: 'varchar', length: '45' },
      { name: 'user_agent', type: 'nvarchar', length: '512' },
    ],
    uniques: [{ name: 'uq_sessions_0', columnNames: ['session_hash'] }],
    checks: [
      {
        name: 'ck_sessions_0',
        expression:
          "LEN([session_hash]) = 64 AND [session_hash] NOT LIKE '%[^0-9a-f]%' COLLATE Latin1_General_100_BIN2",
      },
      {
        name: 'ck_sessions_1',
        expression:
          '[idle_expires_at] <= [absolute_expires_at] AND [created_at] <= [last_seen_at] AND [last_seen_at] <= [idle_expires_at]',
      },
      {
        name: 'ck_sessions_2',
        expression: '[revoked_at] IS NULL OR [revoked_at] >= [created_at]',
      },
    ],
    indices: [
      { name: 'ix_sessions_0', columnNames: ['user_id'], isUnique: false },
      {
        name: 'ix_sessions_1',
        columnNames: ['idle_expires_at'],
        isUnique: false,
      },
      {
        name: 'ix_sessions_2',
        columnNames: ['absolute_expires_at'],
        isUnique: false,
      },
    ],
    foreignKeys: [
      {
        name: 'fk_sessions_0',
        columnNames: ['user_id'],
        referencedTableName: 'users',
        referencedColumnNames: ['id'],
        onDelete: 'NO ACTION',
        onUpdate: 'NO ACTION',
      },
    ],
  },
  {
    name: 'login_attempts',
    columns: [
      {
        name: 'id',
        type: 'bigint',
        isPrimary: true,
        isGenerated: true,
        generationStrategy: 'increment',
      },
      {
        name: 'username_attempted',
        type: 'nvarchar',
        length: '100',
        collation: 'Latin1_General_100_CI_AS',
      },
      { name: 'ip_address', type: 'varchar', length: '45' },
      { name: 'success', type: 'bit', default: '0' },
      {
        name: 'attempted_at',
        type: 'datetime2',
        precision: 3,
        default: 'SYSUTCDATETIME()',
      },
      {
        name: 'failure_reason',
        type: 'nvarchar',
        length: '160',
        isNullable: true,
      },
    ],
    uniques: [],
    checks: [],
    indices: [
      {
        name: 'ix_login_attempts_0',
        columnNames: ['username_attempted', 'attempted_at'],
        isUnique: false,
      },
      {
        name: 'ix_login_attempts_1',
        columnNames: ['ip_address', 'attempted_at'],
        isUnique: false,
      },
    ],
    foreignKeys: [],
  },
  {
    name: 'audit_logs',
    columns: [
      {
        name: 'id',
        type: 'bigint',
        isPrimary: true,
        isGenerated: true,
        generationStrategy: 'increment',
      },
      { name: 'entity_type', type: 'varchar', length: '100' },
      { name: 'entity_id', type: 'varchar', length: '100' },
      { name: 'action', type: 'varchar', length: '10' },
      { name: 'field_name', type: 'nvarchar', length: '100', isNullable: true },
      { name: 'old_value', type: 'nvarchar', length: 'max', isNullable: true },
      { name: 'new_value', type: 'nvarchar', length: 'max', isNullable: true },
      { name: 'user_id', type: 'int', isNullable: true },
      {
        name: 'changed_at',
        type: 'datetime2',
        precision: 3,
        default: 'SYSUTCDATETIME()',
      },
      { name: 'request_id', type: 'varchar', length: '64' },
      { name: 'ip_address', type: 'varchar', length: '45', isNullable: true },
    ],
    uniques: [],
    checks: [
      {
        name: 'ck_audit_logs_0',
        expression: "[action] IN ('CREATE','UPDATE','DELETE')",
      },
      {
        name: 'ck_audit_logs_1',
        expression: "[action] <> 'UPDATE' OR [field_name] IS NOT NULL",
      },
    ],
    indices: [
      {
        name: 'ix_audit_logs_0',
        columnNames: ['entity_type', 'entity_id', 'changed_at'],
        isUnique: false,
      },
      {
        name: 'ix_audit_logs_1',
        columnNames: ['user_id', 'changed_at'],
        isUnique: false,
      },
    ],
    foreignKeys: [
      {
        name: 'fk_audit_logs_0',
        columnNames: ['user_id'],
        referencedTableName: 'users',
        referencedColumnNames: ['id'],
        onDelete: 'NO ACTION',
        onUpdate: 'NO ACTION',
      },
    ],
  },
] as const;

function schemaOf(runner: QueryRunner): string {
  const schema =
    (runner.connection.options as { schema?: string }).schema ?? 'dbo';
  if (!/^[A-Za-z_][A-Za-z0-9_]{0,63}$/.test(schema))
    throw new Error('Invalid migration schema');
  return schema;
}
export class InitialDatabase1791288000000 implements MigrationInterface {
  name = 'InitialDatabase1791288000000';
  async up(runner: QueryRunner): Promise<void> {
    const schema = schemaOf(runner);
    await runner.createSchema(schema, true);
    for (const definition of tables) {
      // JSON copy removes readonly tuple types without sharing mutable migration state.
      const { foreignKeys: _keys, ...options } = JSON.parse(
        JSON.stringify(definition),
      ) as ConstructorParameters<typeof Table>[0] & { foreignKeys: unknown };
      void _keys;
      await runner.createTable(new Table({ ...options, schema }), false);
    }
    // Create FKs after all tables, resolving users' self references and audit cycles.
    for (const definition of tables) {
      for (const key of definition.foreignKeys) {
        await runner.createForeignKey(
          schema + '.' + definition.name,
          new TableForeignKey({
            ...key,
            columnNames: [...key.columnNames],
            referencedColumnNames: [...key.referencedColumnNames],
            referencedSchema: schema,
          }),
        );
      }
    }
    // TypeORM cannot describe SQL Server INCLUDE columns: preserve via @Index synchronize:false.
    await runner.query(
      `CREATE INDEX [ix_sales_transactions_2] ON [${schema}].[sales_transactions] ([sale_date]) INCLUDE ([center_id], [sku_id], [quantity], [sales_type])`,
    );
  }
  async down(runner: QueryRunner): Promise<void> {
    const schema = schemaOf(runner);
    for (const definition of tables) {
      const table = await runner.getTable(schema + '.' + definition.name);
      if (!table)
        throw new Error('Migration rollback requires all module tables');
      for (const key of [...table.foreignKeys])
        await runner.dropForeignKey(table, key);
    }
    for (const definition of [...tables].reverse())
      await runner.dropTable(schema + '.' + definition.name);
    // Retain the schema: it may predate this migration or contain unrelated objects.
  }
}
