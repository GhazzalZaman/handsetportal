import { CatalogNormalizer } from './catalog-normalizer';
import { csvSafe, CatalogImportService } from './catalog-import.service';
const normalizer = new CatalogNormalizer();
describe('catalog normalization', () => {
  it.each(['Galaxy  A16', 'galaxy a16', 'GALAXY-A16', 'Gálaxy A16'])(
    'normalizes %s',
    (name) => expect(normalizer.clean(name, 100).nameKey).toBe('galaxya16'),
  );
  it('cleans control characters and whitespace without changing casing', () =>
    expect(normalizer.clean('  Note\u0000  40   Pro  ', 100)).toEqual({
      name: 'Note 40 Pro',
      nameKey: 'note40pro',
    }));
  it('enforces cleaned lengths and rejects empty comparison keys', () => {
    expect(() => normalizer.clean('---', 50)).toThrow();
    expect(() => normalizer.clean('a'.repeat(51), 50)).toThrow();
  });
  it.each([
    ['galaxya16', 'galaxya17', true],
    ['abc', 'abd', false],
    ['galaxya16', 'galaxya16pro', true],
    ['galaxya16', 'iphone16', false],
    ['galaxya16', 'galaxya16', false],
  ])('compares %s and %s', (a, b, result) =>
    expect(normalizer.similar(a, b)).toBe(result),
  );
  it('generates specifications and validates paired dimensions', () => {
    expect(normalizer.specification({ ramGb: 8, storageGb: 128 }).label).toBe(
      '8GB/128GB',
    );
    expect(
      normalizer.specification({ label: 'Feature phone' }).ramGb,
    ).toBeNull();
    expect(() => normalizer.specification({ ramGb: 8 })).toThrow();
    expect(() =>
      normalizer.specification({ ramGb: 8, storageGb: 128, label: 'Custom' }),
    ).toThrow();
    expect(() =>
      normalizer.specification({ ramGb: 0, storageGb: 128 }),
    ).toThrow();
  });
  it.each(['=SUM(A1)', '+test', '-test', '@test', '  =x', '\t@x'])(
    'neutralizes formula prefix %s',
    (value) => expect(csvSafe(value)).toBe("'" + value),
  );
  it('preserves ordinary CSV cells', () =>
    expect(csvSafe('Galaxy A16')).toBe('Galaxy A16'));
  it('parses quoted CSV and rejects malformed input and oversized uploads', async () => {
    const service = new CatalogImportService(undefined as never);
    const file = (value: string) => ({
      buffer: Buffer.from(value),
      size: Buffer.byteLength(value),
      originalname: 'a.csv',
      mimetype: 'text/csv',
    });
    expect(
      await service.parse(
        file('brand,model,ram_gb,storage_gb,color\r\n"A, B",Phone,4,64,Black'),
      ),
    ).toEqual([['A, B', 'Phone', '4', '64', 'Black']]);
    await expect(
      service.parse(file('brand,model,ram_gb,storage_gb,color\n"unclosed')),
    ).rejects.toThrow();
    await expect(
      service.parse({ ...file('x'), size: 2097153 }),
    ).rejects.toThrow();
  });
});
