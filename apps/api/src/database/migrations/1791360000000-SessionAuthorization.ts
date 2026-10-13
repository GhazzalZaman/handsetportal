import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';
export class SessionAuthorization1791360000000 implements MigrationInterface {
  name = 'SessionAuthorization1791360000000';
  private table(runner: QueryRunner): string {
    const schema =
      (runner.connection.options as { schema?: string }).schema ?? 'dbo';
    if (!/^[A-Za-z_][A-Za-z0-9_]{0,63}$/.test(schema))
      throw new Error('Invalid migration schema');
    return schema + '.sessions';
  }
  async up(runner: QueryRunner): Promise<void> {
    await runner.addColumn(
      this.table(runner),
      new TableColumn({
        name: 'authorization_hash',
        type: 'char',
        length: '64',
        isNullable: true,
      }),
    );
  }
  async down(runner: QueryRunner): Promise<void> {
    await runner.dropColumn(this.table(runner), 'authorization_hash');
  }
}
