import { MigrationInterface, QueryRunner, TableCheck } from 'typeorm';
export class AssignedScope1791446400000 implements MigrationInterface {
  name = 'AssignedScope1791446400000';
  private schema(r: QueryRunner) {
    const s = (r.connection.options as { schema?: string }).schema ?? 'dbo';
    if (!/^[A-Za-z_][A-Za-z0-9_]{0,63}$/.test(s))
      throw new Error('Invalid schema');
    return s;
  }
  async up(r: QueryRunner) {
    const s = this.schema(r);
    await r.dropCheckConstraint(s + '.roles', 'ck_roles_0');
    await r.createCheckConstraint(
      s + '.roles',
      new TableCheck({
        name: 'ck_roles_0',
        expression: "[scope_type] IN ('ALL','CLUSTER','CENTER','ASSIGNED')",
      }),
    );
    await r.query(
      'INSERT INTO [' +
        s +
        "].[audit_logs] (entity_type,entity_id,action,field_name,old_value,new_value,user_id,changed_at,request_id,ip_address) SELECT 'ROLE',CAST(id AS varchar(100)),'UPDATE','scope_type',scope_type,'ASSIGNED',NULL,SYSUTCDATETIME(),'migration-assigned-scope',NULL FROM [" +
        s +
        "].[roles] WHERE code='OTHER_STAKEHOLDER' AND scope_type<>'ASSIGNED'",
    );
    await r.query(
      'UPDATE [' +
        s +
        "].[roles] SET scope_type='ASSIGNED', updated_at=SYSUTCDATETIME(), updated_by=NULL, row_version=row_version+1 WHERE code='OTHER_STAKEHOLDER' AND scope_type<>'ASSIGNED'",
    );
  }
  async down(r: QueryRunner) {
    const s = this.schema(r);
    await r.query(
      'INSERT INTO [' +
        s +
        "].[audit_logs] (entity_type,entity_id,action,field_name,old_value,new_value,user_id,changed_at,request_id,ip_address) SELECT 'ROLE',CAST(id AS varchar(100)),'UPDATE','scope_type',scope_type,'CENTER',NULL,SYSUTCDATETIME(),'rollback-assigned-scope',NULL FROM [" +
        s +
        "].[roles] WHERE scope_type='ASSIGNED'",
    );
    await r.query(
      'UPDATE [' +
        s +
        "].[roles] SET scope_type='CENTER',updated_at=SYSUTCDATETIME(),updated_by=NULL,row_version=row_version+1 WHERE scope_type='ASSIGNED'",
    );
    await r.dropCheckConstraint(s + '.roles', 'ck_roles_0');
    await r.createCheckConstraint(
      s + '.roles',
      new TableCheck({
        name: 'ck_roles_0',
        expression: "[scope_type] IN ('ALL','CLUSTER','CENTER')",
      }),
    );
  }
}
