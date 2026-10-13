import { EntityManager } from 'typeorm';
import { OpeningImportService, openingHeader } from './opening-import.service';
import { InventoryService } from './inventory.service';
import { CatalogRepository } from '../catalog/catalog.repository';
import { CatalogNormalizer } from '../catalog/catalog-normalizer';
import { CenterScope } from '../scope/scope.service';
import { Principal } from '../auth/auth.types';
import { DataImportBatch } from '../database/entities';

it('saves opening stock with batch timestamps satisfying the SQL constraint', async () => {
  const query = {
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    getParameters: () => ({}),
    getOne: async () => ({ id: 1 }),
  };
  const save = jest.fn(async (_entity: unknown, batch: DataImportBatch) => {
    // Missing startedAt would use the later SQL insertion time.
    const start = batch.startedAt ?? new Date(batch.finishedAt!.getTime() + 1);
    if (start > batch.finishedAt!) throw Error('Batch timestamp constraint');
    return { ...batch, id: '1' };
  });
  const manager = {
    getRepository: () => ({ createQueryBuilder: () => query }),
    create: (_entity: unknown, value: unknown) => value,
    save,
  } as unknown as EntityManager;
  const scope = new CenterScope(true, [1], ['inventory.import']);
  const changeStock = jest.fn();
  const stock = {
    tx: {
      run: async (
        _actor: unknown,
        _permission: string,
        work: (m: EntityManager, s: CenterScope) => Promise<unknown>,
      ) => work(manager, scope),
    },
    movements: () => ({ getCount: async () => 0 }),
    changeStock,
    audit: jest.fn(),
  } as unknown as InventoryService;
  const catalog = { query: () => query } as unknown as CatalogRepository;
  const service = new OpeningImportService(
    stock,
    catalog,
    new CatalogNormalizer(),
  );
  const buffer = Buffer.from(
    openingHeader.join(',') + '\nTEST,Brand,Model,8,256,Blue,100\n',
  );
  const result = await service.run(
    {
      buffer,
      size: buffer.length,
      originalname: 'stock.csv',
      mimetype: 'text/csv',
    },
    false,
    { id: 1 } as Principal,
    { userId: 1, ip: '127.0.0.1', requestId: 'test-import' },
  );
  expect(result.totals.accepted).toBe(1);
  expect(changeStock).toHaveBeenCalledTimes(1);
  expect(save).toHaveBeenCalledTimes(1);
});
