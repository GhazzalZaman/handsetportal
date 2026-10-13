import { DataSource } from 'typeorm';
import { hash, argon2id } from 'argon2';
import {
  Brand,
  Color,
  Cluster,
  ExperienceCenter,
  Permission,
  Role,
  RolePermission,
  User,
} from '../entities';
import clusterConfig from './clusters.json';
import {
  permissionDescriptions,
  seedBrands,
  seedColors,
  seedCenters,
  seedRoles,
} from './roles.config';
import { ensure, lockSeed, seedContext } from './support';
import { SeedSettings } from './settings';
import { seedDemo } from './demo';
export async function seedDatabase(
  database: DataSource,
  settings: SeedSettings,
  now = new Date(),
): Promise<void> {
  // Recheck at the callable boundary as well as the CLI.
  if (settings.demo && process.env.NODE_ENV === 'production')
    throw new Error('Demo seed is forbidden in production');
  await database.transaction('SERIALIZABLE', async (manager) => {
    await lockSeed(manager);
    const context = seedContext(now);
    const permissionIds = new Map<string, number>();
    for (const [code, description] of Object.entries(permissionDescriptions)) {
      const { row } = await ensure(
        manager,
        context,
        Permission,
        { code },
        { code, description },
      );
      permissionIds.set(code, row.id);
    }
    let adminRoleId = 0;
    for (const role of seedRoles) {
      const { permissions, ...values } = role;
      const { row, created } = await ensure(
        manager,
        context,
        Role,
        { code: role.code },
        values,
      );
      if (role.code === 'SYSTEM_ADMIN') adminRoleId = row.id;
      // Existing roles keep their exact customized grants; only new roles receive defaults.

      for (const code of created ? permissions : []) {
        const permissionId = permissionIds.get(code)!;
        await ensure(
          manager,
          context,
          RolePermission,
          { roleId: row.id, permissionId },
          { roleId: row.id, permissionId },
        );
      }
    }
    const clusters = new Map<string, number>();
    const definitions = clusterConfig.clusters as {
      code: string;
      name: string;
    }[];
    for (const definition of definitions) {
      if (!definition.code || !definition.name)
        throw new Error('Invalid cluster seed definition');
      const { row } = await ensure<Cluster>(
        manager,
        context,
        Cluster,
        { code: definition.code },
        definition,
      );
      clusters.set(definition.code, row.id);
    }
    const mapping = clusterConfig.centerToCluster as Record<string, string>;
    for (const code of Object.keys(mapping))
      if (!seedCenters.some((c) => c[0] === code))
        throw new Error('Unknown center code in cluster mapping');
    for (const [code, name, shortName] of seedCenters) {
      const clusterCode = mapping[code];
      const clusterId = clusterCode ? clusters.get(clusterCode) : null;
      if (clusterCode && clusterId === undefined)
        throw new Error('Unknown cluster code in center mapping');
      // Existing assignments are never silently overwritten by bootstrap data.
      await ensure(
        manager,
        context,
        ExperienceCenter,
        { code },
        { code, name, shortName, clusterId },
      );
    }
    for (const name of seedBrands)
      await ensure(manager, context, Brand, { name }, { name });
    for (const name of seedColors)
      await ensure(manager, context, Color, { name }, { name });
    if (settings.admin) {
      const { username, email, password } = settings.admin;
      const existing = await manager.findOneBy(User, { username });
      if (!existing) {
        const passwordHash = await hash(password, {
          type: argon2id,
          memoryCost: 19456,
          timeCost: 2,
          parallelism: 1,
        });
        await ensure(
          manager,
          context,
          User,
          { username },
          {
            username,
            email,
            displayName: 'Initial Administrator',
            passwordHash,
            roleId: adminRoleId,
            mustChangePassword: true,
            passwordChangedAt: now,
          },
        );
      }
    } else {
      console.log(
        'Administrator seed skipped: SEED_ADMIN_USERNAME, SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD are not configured.',
      );
    }
    if (settings.demo) await seedDemo(manager, context);
  });
  console.log(
    'Seed completed successfully. Existing records and administrator credentials were preserved.',
  );
}
