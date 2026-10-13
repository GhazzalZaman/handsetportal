import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { ReceiptDto, ThresholdDto } from './inventory.dto';
import { SaleDto, VoidDto } from '../sales/sales.dto';
import { inventoryEnvironment } from './inventory.config';
describe('inventory validation', () => {
  it('rejects duplicate SKU receipt items', async () => {
    const dto = plainToInstance(ReceiptDto, {
      centerId: 1,
      receivedFrom: 'WAREHOUSE',
      items: [
        { skuId: 1, quantity: 1 },
        { skuId: 1, quantity: 2 },
      ],
    });
    expect((await validate(dto)).some((e) => e.property === 'items')).toBe(
      true,
    );
  });
  it('bounds sales quantities and requires idempotency and sales type', async () => {
    const dto = plainToInstance(SaleDto, {
      centerId: 1,
      skuId: 1,
      quantity: 51,
    });
    const errors = await validate(dto);
    expect(errors.map((e) => e.property)).toEqual(
      expect.arrayContaining(['quantity', 'salesType', 'clientRequestId']),
    );
  });
  it('rejects ambiguous sale timestamps and blank void reasons', async () => {
    expect(
      (
        await validate(
          plainToInstance(SaleDto, {
            centerId: 1,
            skuId: 1,
            quantity: 1,
            salesType: 'CASH',
            clientRequestId: '062fa600-2505-4ce9-b9a4-eef7d3b48379',
            soldAt: '2026-03-01T12:00:00',
          }),
        )
      ).some((e) => e.property === 'soldAt'),
    ).toBe(true);
    expect(
      await validate(plainToInstance(VoidDto, { reason: '   ' })),
    ).not.toHaveLength(0);
  });
  it('allows an unset or zero threshold, rejects missing and negative thresholds', async () => {
    for (const value of [null, 0, 3])
      expect(
        await validate(
          plainToInstance(ThresholdDto, { lowStockThreshold: value }),
        ),
      ).toHaveLength(0);
    for (const value of [undefined, -1])
      expect(
        await validate(
          plainToInstance(ThresholdDto, { lowStockThreshold: value }),
        ),
      ).not.toHaveLength(0);
  });
  it('validates inventory settings at startup', () => {
    expect(inventoryEnvironment({})).toEqual({
      LOW_STOCK_THRESHOLD: 3,
      SALES_BACKDATE_MAX_DAYS: 3,
      SALE_SELF_VOID_MINUTES: 10,
    });
    expect(
      inventoryEnvironment({ LOW_STOCK_THRESHOLD: 0 }).LOW_STOCK_THRESHOLD,
    ).toBe(0);
    for (const env of [
      { LOW_STOCK_THRESHOLD: -1 },
      { SALES_BACKDATE_MAX_DAYS: 'bad' },
      { SALE_SELF_VOID_MINUTES: 0 },
    ])
      expect(() => inventoryEnvironment(env)).toThrow();
  });
});
