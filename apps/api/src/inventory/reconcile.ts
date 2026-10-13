import { DataSource } from 'typeorm';
import {
  InventoryStock,
  InventoryMovement,
  ExperienceCenter,
} from '../database/entities';
import { CenterScope } from '../scope/scope.service';
export async function reconcileInventory(db: DataSource) {
  // Operator-only CLI: intentionally includes inactive centers, with explicit scope predicates.
  return db.transaction('SERIALIZABLE', async (manager) => {
    const scope = new CenterScope(
      true,
      (await manager.find(ExperienceCenter, { select: { id: true } })).map(
        (c) => c.id,
      ),
      [],
    );
    const totals = scope
      .applyToQuery(
        manager.getRepository(InventoryMovement).createQueryBuilder('movement'),
        'movement.centerId',
      )
      .select('movement.centerId', 'centerId')
      .addSelect('movement.skuId', 'skuId')
      .addSelect('SUM(CAST(movement.quantityDelta AS bigint))', 'quantity')
      .groupBy('movement.centerId')
      .addGroupBy('movement.skuId');
    const stock = scope
      .applyToQuery(
        manager.getRepository(InventoryStock).createQueryBuilder('stock'),
        'stock.centerId',
      )
      .leftJoin(
        '(' + totals.getQuery() + ')',
        'ledger',
        'ledger.centerId=stock.centerId AND ledger.skuId=stock.skuId',
      )
      .setParameters(totals.getParameters())
      .select('stock.centerId', 'centerId')
      .addSelect('stock.skuId', 'skuId')
      .addSelect('stock.quantityAvailable', 'quantity')
      .addSelect('COALESCE(ledger.quantity,0)', 'ledgerQuantity')
      .andWhere('stock.quantityAvailable<>COALESCE(ledger.quantity,0)');
    const missing = scope
      .applyToQuery(
        manager.getRepository(InventoryMovement).createQueryBuilder('movement'),
        'movement.centerId',
      )
      .leftJoin(
        InventoryStock,
        'stock',
        'stock.centerId=movement.centerId AND stock.skuId=movement.skuId',
      )
      .andWhere('stock.id IS NULL');
    const missingRows = await missing
      .select('movement.centerId', 'centerId')
      .addSelect('movement.skuId', 'skuId')
      .addSelect(
        'SUM(CAST(movement.quantityDelta AS bigint))',
        'ledgerQuantity',
      )
      .groupBy('movement.centerId')
      .addGroupBy('movement.skuId')
      .getRawMany();
    return [
      ...(await stock.getRawMany()),
      ...missingRows.map((row) => ({ ...row, quantity: null })),
    ];
  });
}
