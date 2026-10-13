import { seedSettings } from './settings';
import { demoDates } from './demo';
import { seedRoles, permissionDescriptions } from './roles.config';
describe('seed configuration', () => {
  it('requires explicit non-production demo opt-in', () => {
    expect(seedSettings({})).toEqual({ demo: false, admin: undefined });
    expect(() =>
      seedSettings({ SEED_DEMO_DATA: 'true', NODE_ENV: 'production' }),
    ).toThrow();
    expect(() => seedSettings({ SEED_DEMO_DATA: 'yes' })).toThrow();
  });
  it('rejects incomplete administrator settings', () =>
    expect(() => seedSettings({ SEED_ADMIN_USERNAME: 'admin' })).toThrow());
  it('has only known permissions and restricts stakeholders', () => {
    for (const role of seedRoles)
      for (const code of role.permissions)
        expect(Object.keys(permissionDescriptions)).toContain(code);
    expect(
      seedRoles.find((r) => r.code === 'OTHER_STAKEHOLDER')?.scopeType,
    ).toBe('ASSIGNED');
  });
  it('covers previous month and previous year from an October as-of date', () => {
    const dates = demoDates(new Date('2026-10-06T10:00:00Z'));
    expect(dates).toHaveLength(90);
    expect(dates.some((d) => d.toISOString().startsWith('2025-12-31'))).toBe(
      true,
    );
    expect(dates.some((d) => d.toISOString().startsWith('2026-09-30'))).toBe(
      true,
    );
    expect(new Set(dates.map((d) => d.toISOString())).size).toBe(dates.length);
  });
});
