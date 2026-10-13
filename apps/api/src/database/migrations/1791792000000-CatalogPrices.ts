import {
  MigrationInterface,
  QueryRunner,
  TableColumn,
  TableCheck,
} from 'typeorm';

export class CatalogPrices1791792000000 implements MigrationInterface {
  name = 'CatalogPrices1791792000000';
  private table(r: QueryRunner) {
    const schema =
      (r.connection.options as { schema?: string }).schema ?? 'dbo';
    if (!/^[A-Za-z_][A-Za-z0-9_]{0,63}$/.test(schema))
      throw new Error('Invalid schema');
    return schema + '.handset_skus';
  }
  async up(r: QueryRunner) {
    await r.addColumn(
      this.table(r),
      new TableColumn({
        name: 'price',
        type: 'decimal',
        precision: 12,
        scale: 2,
        isNullable: true,
      }),
    );
    await r.createCheckConstraint(
      this.table(r),
      new TableCheck({
        name: 'ck_handset_skus_price',
        expression: '[price] IS NULL OR [price] >= 0',
      }),
    );
  }
  async down(r: QueryRunner) {
    await r.dropCheckConstraint(this.table(r), 'ck_handset_skus_price');
    await r.dropColumn(this.table(r), 'price');
  }
}
