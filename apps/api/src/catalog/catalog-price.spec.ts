import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CatalogQueryDto, HandsetDto, PatchPriceDto } from './catalog.dto';
import { CatalogService } from './catalog.service';
import { CatalogRepository } from './catalog.repository';
import { CatalogTransaction } from './catalog-transaction';
import { CatalogNormalizer } from './catalog-normalizer';
import { ScopeService } from '../scope/scope.service';
import { AuthEventContext, Principal } from '../auth/auth.types';

describe('catalog listPrice input', () => {
  it.each(['0', '0.01', '54999', '54999.50', '9999999999.99', null])(
    'accepts an exact decimal or an unset listPrice: %s',
    async (listPrice) => {
      expect(
        await validate(
          plainToInstance(PatchPriceDto, { listPrice, rowVersion: 1 }),
        ),
      ).toHaveLength(0);
    },
  );
  it.each([
    -1,
    12.5,
    '-1',
    '1e3',
    'NaN',
    '1.001',
    '10000000000',
    '01',
    '',
    undefined,
  ])('rejects an invalid listPrice: %s', async (listPrice) => {
    expect(
      (
        await validate(
          plainToInstance(PatchPriceDto, { listPrice, rowVersion: 1 }),
        )
      ).length,
    ).toBeGreaterThan(0);
  });
  it('rejects invalid nested variant indexes and prices', async () => {
    const dto = plainToInstance(HandsetDto, {
      brand: { id: 1 },
      model: { name: 'Test' },
      specifications: [],
      colors: [{ id: 1 }],
      variantPrices: [
        { colorIndex: -1, specificationIndex: null, listPrice: '1.001' },
      ],
    });
    expect(
      (await validate(dto)).some((error) => error.property === 'variantPrices'),
    ).toBe(true);
  });
  it('validates RAM/storage filters as positive whole numbers', async () => {
    expect(
      await validate(
        plainToInstance(CatalogQueryDto, { ramGb: '8', storageGb: '128' }),
      ),
    ).toHaveLength(0);
    for (const input of [
      { ramGb: '-1' },
      { storageGb: '1.5' },
      { storageGb: '2147483648' },
    ])
      expect(
        (await validate(plainToInstance(CatalogQueryDto, input))).length,
      ).toBeGreaterThan(0);
  });
});

describe('catalog listPrice writes', () => {
  const actor = {
    id: 1,
    permissions: ['masterdata.manage'],
  } as unknown as Principal;
  const context = { userId: 1 } as AuthEventContext;
  function fixture() {
    const one = jest
      .fn()
      .mockResolvedValue({ id: 2, rowVersion: 3, listPrice: null });
    const manager = {};
    const run = jest.fn(async (_actor, _permission, operation) =>
      operation(manager),
    );
    const service = new CatalogService(
      { one } as unknown as CatalogRepository,
      new CatalogNormalizer(),
      { run } as unknown as CatalogTransaction,
      {} as ScopeService,
    );
    const update = jest.spyOn(service, 'update').mockResolvedValue({
      id: 2,
      isActive: true,
      rowVersion: 4,
      listPrice: '12.50',
    });
    return { service, update, run, manager };
  }
  it('uses the authorized transaction and audited update path with a canonical listPrice', async () => {
    const { service, update, run, manager } = fixture();
    await service.patchPrice(
      2,
      { rowVersion: 3, listPrice: '12.5' },
      actor,
      context,
    );
    expect(run).toHaveBeenCalledWith(
      actor,
      'masterdata.manage',
      expect.any(Function),
    );
    expect(update).toHaveBeenCalledWith(
      manager,
      'skus',
      expect.objectContaining({ id: 2 }),
      { listPrice: '12.50' },
      context,
    );
  });
  it('rejects stale changes before writing', async () => {
    const { service, update } = fixture();
    await expect(
      service.patchPrice(2, { rowVersion: 2, listPrice: '12' }, actor, context),
    ).rejects.toThrow();
    expect(update).not.toHaveBeenCalled();
  });
  it('can clear a listPrice without substituting zero', async () => {
    const { service, update } = fixture();
    await service.patchPrice(
      2,
      { rowVersion: 3, listPrice: null },
      actor,
      context,
    );
    expect(update).toHaveBeenCalledWith(
      expect.anything(),
      'skus',
      expect.anything(),
      { listPrice: null },
      context,
    );
  });
});
