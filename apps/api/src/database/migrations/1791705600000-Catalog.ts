import {
  MigrationInterface,
  QueryRunner,
  TableColumn,
  TableUnique,
} from 'typeorm';
// Frozen migration normalization: do not import the evolving application service.
const key = (s: string) =>
  s
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]/gu, '');
const tables = [
  ['brands', 'name', null],
  ['colors', 'name', null],
  ['handset_models', 'name', 'brand_id'],
  ['model_specifications', 'label', 'model_id'],
] as const;
export class Catalog1791705600000 implements MigrationInterface {
  name = 'Catalog1791705600000';
  private schema(r: QueryRunner) {
    const s = (r.connection.options as { schema?: string }).schema ?? 'dbo';
    if (!/^[A-Za-z_][A-Za-z0-9_]{0,63}$/.test(s)) throw Error('Invalid schema');
    return s;
  }
  private async audit(
    r: QueryRunner,
    s: string,
    entityType: string,
    entityId: string,
    fieldName: string,
    oldValue: unknown,
    newValue: unknown,
  ) {
    await r.query(
      'INSERT INTO [' +
        s +
        '].[audit_logs] (entity_type,entity_id,action,field_name,old_value,new_value,user_id,changed_at,request_id,ip_address) VALUES (@0,@1,@2,@3,@4,@5,NULL,@6,@7,NULL)',
      [
        entityType,
        entityId,
        'UPDATE',
        fieldName,
        oldValue === null ? null : JSON.stringify(oldValue),
        newValue === null ? null : JSON.stringify(newValue),
        new Date(),
        'migration-catalog',
      ],
    );
  }

  async up(r: QueryRunner) {
    const s = this.schema(r);
    for (const [table, display, parent] of tables) {
      await r.addColumn(
        s + '.' + table,
        new TableColumn({
          name: 'name_key',
          type: 'nvarchar',
          length: '200',
          isNullable: true,
          collation: 'Latin1_General_100_BIN2',
        }),
      );
      const rows: { id: number; display: string; parent?: number }[] =
        await r.manager
          .createQueryBuilder()
          .select('id')
          .addSelect(display, 'display')
          .addSelect(parent ?? 'NULL', 'parent')
          .from(s + '.' + table, 't')
          .getRawMany();
      const seen = new Map<string, number>();
      for (const row of rows) {
        const value = key(row.display),
          group = String(row.parent) + ':' + value;
        if (!value || value.length > 200 || seen.has(group))
          throw Error(
            'Catalog backfill requires manual review: ' +
              table +
              ' ID ' +
              row.id +
              (seen.has(group) ? ' conflicts with ID ' + seen.get(group) : ''),
          );
        seen.set(group, row.id);
        await r.manager
          .createQueryBuilder()
          .update(s + '.' + table)
          .set({ nameKey: value })
          .where('id = :id', { id: row.id })
          .execute();
      }
      await r.changeColumn(
        s + '.' + table,
        'name_key',
        new TableColumn({
          name: 'name_key',
          type: 'nvarchar',
          length: '200',
          isNullable: false,
          collation: 'Latin1_General_100_BIN2',
        }),
      );
      await r.createUniqueConstraint(
        s + '.' + table,
        new TableUnique({
          name: 'uq_' + table + '_name_key',
          columnNames: parent ? [parent, 'name_key'] : ['name_key'],
        }),
      );
    }
    const all: { id: number; code: string }[] = await r.manager
      .createQueryBuilder()
      .select(['id', 'code'])
      .from(s + '.permissions', 'p')
      .getRawMany();
    const old = all.find((p) => p.code === 'masterdata.edit');
    for (const code of ['masterdata.create', 'masterdata.manage']) {
      if (!all.some((p) => p.code === code)) {
        await r.manager
          .createQueryBuilder()
          .insert()
          .into(s + '.permissions')
          .values({
            code,
            description:
              code === 'masterdata.create'
                ? 'Create global handset catalog records'
                : 'Correct and manage global handset catalog records',
          })
          .execute();
        await this.audit(r, s, 'PERMISSION', code, 'code', null, code);
      }
    }
    const permissions: { id: number; code: string }[] = await r.manager
      .createQueryBuilder()
      .select(['id', 'code'])
      .from(s + '.permissions', 'p')
      .getRawMany();
    const roles: { id: number; code: string }[] = await r.manager
      .createQueryBuilder()
      .select(['id', 'code'])
      .from(s + '.roles', 'r')
      .getRawMany();
    const legacy: { roleId: number }[] = old
      ? await r.manager
          .createQueryBuilder()
          .select('role_id', 'roleId')
          .from(s + '.role_permissions', 'g')
          .where('permission_id = :id', { id: old.id })
          .getRawMany()
      : [];
    for (const p of permissions.filter((p) =>
      ['masterdata.create', 'masterdata.manage'].includes(p.code),
    )) {
      const roleIds = new Set([
        ...legacy.map((g) => g.roleId),
        ...roles
          .filter(
            (role) =>
              role.code === 'SYSTEM_ADMIN' ||
              (p.code === 'masterdata.create' &&
                role.code === 'EXPERIENCE_CENTER_MANAGER'),
          )
          .map((role) => role.id),
      ]);
      for (const roleId of roleIds) {
        const exists = await r.manager
          .createQueryBuilder()
          .select('role_id')
          .from(s + '.role_permissions', 'g')
          .where('role_id = :roleId AND permission_id = :permissionId', {
            roleId,
            permissionId: p.id,
          })
          .getRawOne();
        if (!exists) {
          await r.manager
            .createQueryBuilder()
            .insert()
            .into(s + '.role_permissions')
            .values({ roleId: roleId, permissionId: p.id })
            .execute();
          await this.audit(
            r,
            s,
            'ROLE',
            String(roleId),
            'permission',
            null,
            p.code,
          );
        }
      }
    }
    if (old) {
      for (const g of legacy)
        await this.audit(
          r,
          s,
          'ROLE',
          String(g.roleId),
          'permission',
          'masterdata.edit',
          null,
        );
      await r.manager
        .createQueryBuilder()
        .delete()
        .from(s + '.role_permissions')
        .where('permission_id = :id', { id: old.id })
        .execute();
      await r.manager
        .createQueryBuilder()
        .delete()
        .from(s + '.permissions')
        .where('id = :id', { id: old.id })
        .execute();
      await this.audit(
        r,
        s,
        'PERMISSION',
        'masterdata.edit',
        'code',
        'masterdata.edit',
        null,
      );
    }
  }
  async down(r: QueryRunner) {
    const s = this.schema(r);
    const permissions: { id: number; code: string }[] = await r.manager
      .createQueryBuilder()
      .select(['id', 'code'])
      .from(s + '.permissions', 'p')
      .getRawMany();
    if (!permissions.some((p) => p.code === 'masterdata.edit'))
      await r.manager
        .createQueryBuilder()
        .insert()
        .into(s + '.permissions')
        .values({
          code: 'masterdata.edit',
          description: 'Maintain approved master data',
        })
        .execute();
    const old = await r.manager
      .createQueryBuilder()
      .select('id')
      .from(s + '.permissions', 'p')
      .where('code = :code', { code: 'masterdata.edit' })
      .getRawOne();
    if (!old) throw Error('Legacy permission missing');
    for (const p of permissions.filter((p) =>
      ['masterdata.create', 'masterdata.manage'].includes(p.code),
    )) {
      const grants: { roleId: number }[] = await r.manager
        .createQueryBuilder()
        .select('role_id', 'roleId')
        .from(s + '.role_permissions', 'g')
        .where('permission_id = :id', { id: p.id })
        .getRawMany();
      for (const g of grants) {
        const exists = await r.manager
          .createQueryBuilder()
          .select('role_id')
          .from(s + '.role_permissions', 'g')
          .where('role_id = :role AND permission_id = :permission', {
            role: g.roleId,
            permission: old.id,
          })
          .getRawOne();
        if (!exists)
          await r.manager
            .createQueryBuilder()
            .insert()
            .into(s + '.role_permissions')
            .values({ roleId: g.roleId, permissionId: old.id })
            .execute();
        await this.audit(
          r,
          s,
          'ROLE',
          String(g.roleId),
          'permission',
          p.code,
          'masterdata.edit',
        );
      }
      await r.manager
        .createQueryBuilder()
        .delete()
        .from(s + '.role_permissions')
        .where('permission_id = :id', { id: p.id })
        .execute();
      await r.manager
        .createQueryBuilder()
        .delete()
        .from(s + '.permissions')
        .where('id = :id', { id: p.id })
        .execute();
    }
    for (const [table] of [...tables].reverse()) {
      await r.dropUniqueConstraint(
        s + '.' + table,
        'uq_' + table + '_name_key',
      );
      await r.dropColumn(s + '.' + table, 'name_key');
    }
  }
}
