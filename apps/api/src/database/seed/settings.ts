export interface SeedSettings {
  demo: boolean;
  admin?: { username: string; email: string; password: string };
}
export function seedSettings(
  env: Record<string, string | undefined>,
): SeedSettings {
  if (
    env.SEED_DEMO_DATA !== undefined &&
    !['true', 'false'].includes(env.SEED_DEMO_DATA)
  )
    throw new Error('SEED_DEMO_DATA must be true or false');
  if (env.SEED_DEMO_DATA === 'true' && env.NODE_ENV === 'production')
    throw new Error('Demo seed is forbidden in production');
  const supplied = [
    env.SEED_ADMIN_USERNAME,
    env.SEED_ADMIN_EMAIL,
    env.SEED_ADMIN_PASSWORD,
  ];
  if (supplied.some(Boolean) && !supplied.every(Boolean))
    throw new Error('Set all three SEED_ADMIN variables or omit all three');
  const admin = supplied.every(Boolean)
    ? {
        username: env.SEED_ADMIN_USERNAME!,
        email: env.SEED_ADMIN_EMAIL!,
        password: env.SEED_ADMIN_PASSWORD!,
      }
    : undefined;
  if (
    admin &&
    (!admin.username.trim() ||
      admin.username.length > 100 ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(admin.email) ||
      admin.email.length > 254 ||
      admin.password.length < 12)
  )
    throw new Error(
      'Invalid seed administrator settings (password requires at least 12 characters)',
    );
  return { demo: env.SEED_DEMO_DATA === 'true', admin };
}
