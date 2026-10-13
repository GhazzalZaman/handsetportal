import { Injectable } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import {
  InventoryStock,
  InventoryMovement,
  AuditLog,
  ExperienceCenter,
} from '../database/entities';
import { CatalogRepository } from '../catalog/catalog.repository';
import { CatalogError } from '../catalog/catalog.error';
import { CenterScope } from '../scope/scope.service';
import { AuthEventContext, Principal } from '../auth/auth.types';
import { InventoryTransaction } from './inventory-transaction';
import { ReceiptDto, AdjustmentDto } from './inventory.dto';
export interface StockChange {
  centerId: number;
  skuId: number;
  movementType: 'OPENING' | 'RECEIPT' | 'SALE' | 'SALE_REVERSAL' | 'ADJUSTMENT';
  delta?: number;
  newQuantity?: number;
  reasonCode?: string;
  note?: string;
  salesTransactionId?: string;
  receivedFrom?: string;
  sourceCenterId?: number;
  reference?: string;
}
@Injectable()
export class InventoryService {
  constructor(
    readonly tx: InventoryTransaction,
    private readonly catalog: CatalogRepository,
  ) {}
  stock(
    manager: EntityManager,
    scope: CenterScope,
    centerId: number,
    skuId: number,
  ) {
    const query = manager
      .getRepository(InventoryStock)
      .createQueryBuilder('stock')
      .where('stock.centerId=:centerId AND stock.skuId=:skuId', {
        centerId,
        skuId,
      });
    return scope.applyToQuery(query, 'stock.centerId');
  }
  movements(
    manager: EntityManager,
    scope: CenterScope,
    centerId: number,
    skuId: number,
  ) {
    const query = manager
      .getRepository(InventoryMovement)
      .createQueryBuilder('movement')
      .where('movement.centerId=:centerId AND movement.skuId=:skuId', {
        centerId,
        skuId,
      });
    return scope.applyToQuery(query, 'movement.centerId');
  }
  async audit(
    manager: EntityManager,
    context: AuthEventContext,
    type: string,
    id: string,
    field: string,
    before: unknown,
    after: unknown,
  ) {
    await manager.insert(AuditLog, {
      entityType: type,
      entityId: id,
      action: 'UPDATE',
      fieldName: field,
      oldValue: before == null ? null : JSON.stringify(before),
      newValue: after == null ? null : JSON.stringify(after),
      userId: context.userId!,
      changedAt: new Date(),
      requestId: context.requestId,
      ipAddress: context.ip,
    });
  }
  // The only runtime path that inserts or changes stock quantities. Caller owns the transaction.
  async changeStock(
    manager: EntityManager,
    scope: CenterScope,
    input: StockChange,
    context: AuthEventContext,
  ) {
    if (!manager.queryRunner?.isTransactionActive)
      throw Error('Stock changes require an active transaction');
    scope.assertCanAccessCenter(input.centerId);
    if (input.movementType !== 'SALE_REVERSAL')
      await this.catalog.one('skus', input.skuId, false, manager);
    const pair = this.stock(manager, scope, input.centerId, input.skuId);
    if (
      input.movementType === 'OPENING' &&
      (await this.movements(
        manager,
        scope,
        input.centerId,
        input.skuId,
      ).getCount())
    )
      throw new CatalogError('OPENING_STOCK_EXISTS', 409);
    // All runtime stock writers share the transaction lock. The unique pair index is the final defense.
    if (!(await pair.getCount()))
      await manager.insert(InventoryStock, {
        centerId: input.centerId,
        skuId: input.skuId,
        quantityAvailable: 0,
        sourceSystem: 'APP',
        createdBy: context.userId!,
        updatedBy: context.userId!,
      });
    const ids = pair.select('stock.id');
    const update = manager
      .createQueryBuilder()
      .update(InventoryStock)
      .set({
        quantityAvailable:
          input.newQuantity === undefined
            ? () => 'quantity_available + :delta'
            : input.newQuantity,
        lastStockUpdateAt: new Date(),
        updatedAt: new Date(),
        updatedBy: context.userId!,
        sourceSystem: 'APP',
      })
      .where('id IN (' + ids.getQuery() + ')')
      .setParameters(ids.getParameters());
    if (input.newQuantity !== undefined)
      update.andWhere('quantity_available <> :desired', {
        desired: input.newQuantity,
      });
    else {
      if (!Number.isInteger(input.delta)) throw Error('Stock delta required');
      update.setParameter('delta', input.delta);
      if (input.delta! < 0)
        update.andWhere('quantity_available >= :required', {
          required: -input.delta!,
        });
      else
        update.andWhere('quantity_available <= :maximum', {
          maximum: 2147483647 - input.delta!,
        });
    }
    const result = await update
      .output(
        'INSERTED.quantity_available AS quantityAfter, DELETED.quantity_available AS quantityBefore',
      )
      .execute();
    if (result.affected !== 1) {
      const current = await this.stock(
        manager,
        scope,
        input.centerId,
        input.skuId,
      ).getOne();
      throw new CatalogError(
        input.newQuantity !== undefined
          ? 'NO_CHANGE'
          : input.delta! < 0
            ? 'INSUFFICIENT_STOCK'
            : 'STOCK_LIMIT',
        409,
        { available: current?.quantityAvailable ?? 0 },
      );
    }
    const quantityAfter = Number(result.raw[0].quantityAfter),
      quantityBefore = Number(result.raw[0].quantityBefore);
    const movement = await manager.save(
      InventoryMovement,
      manager.create(InventoryMovement, {
        centerId: input.centerId,
        skuId: input.skuId,
        movementType: input.movementType,
        quantityDelta: quantityAfter - quantityBefore,
        quantityAfter,
        reasonCode: input.reasonCode ?? null,
        note: input.note ?? null,
        salesTransactionId: input.salesTransactionId ?? null,
        receivedFrom: input.receivedFrom ?? null,
        sourceCenterId: input.sourceCenterId ?? null,
        reference: input.reference ?? null,
        userId: context.userId!,
        requestId: context.requestId,
      }),
    );
    await this.audit(
      manager,
      context,
      'INVENTORY',
      `${input.centerId}:${input.skuId}`,
      'quantityAvailable',
      quantityBefore,
      quantityAfter,
    );
    await this.audit(
      manager,
      context,
      'INVENTORY_MOVEMENT',
      movement.id,
      'movement',
      null,
      {
        ...input,
        quantityDelta: quantityAfter - quantityBefore,
        quantityAfter,
      },
    );
    return { movementId: movement.id, quantityAvailable: quantityAfter };
  }
  receive(dto: ReceiptDto, actor: Principal, context: AuthEventContext) {
    return this.tx.run(actor, 'inventory.receive', async (manager, scope) => {
      scope.assertCanEditCenter(dto.centerId);
      if (dto.receivedFrom === 'EXPERIENCE_CENTER') {
        if (!dto.sourceCenterId || dto.sourceCenterId === dto.centerId)
          throw new CatalogError('SOURCE_CENTER_REQUIRED');
        scope.assertCanAccessCenter(dto.sourceCenterId);
        const source = manager
          .getRepository(ExperienceCenter)
          .createQueryBuilder('center')
          .where('center.id=:id AND center.isActive=:active', {
            id: dto.sourceCenterId,
            active: true,
          });
        if (!(await scope.applyToQuery(source, 'center.id').getOne()))
          throw new CatalogError('SOURCE_CENTER_REQUIRED');
      } else if (dto.sourceCenterId)
        throw new CatalogError('SOURCE_CENTER_NOT_ALLOWED');
      const results = [];
      for (const item of [...dto.items].sort((a, b) => a.skuId - b.skuId))
        results.push(
          await this.changeStock(
            manager,
            scope,
            {
              ...dto,
              skuId: item.skuId,
              delta: item.quantity,
              movementType: dto.isOpeningStock ? 'OPENING' : 'RECEIPT',
            },
            context,
          ),
        );
      return { items: results };
    });
  }
  adjust(dto: AdjustmentDto, actor: Principal, context: AuthEventContext) {
    return this.tx.run(actor, 'inventory.adjust', async (manager, scope) => {
      scope.assertCanEditCenter(dto.centerId);
      if (dto.reasonCode === 'OTHER' && !dto.note?.trim())
        throw new CatalogError('ADJUSTMENT_NOTE_REQUIRED');
      return this.changeStock(
        manager,
        scope,
        { ...dto, movementType: 'ADJUSTMENT' },
        context,
      );
    });
  }
  threshold(
    centerId: number,
    skuId: number,
    value: number | null,
    actor: Principal,
    context: AuthEventContext,
  ) {
    return this.tx.run(actor, 'inventory.adjust', async (manager, scope) => {
      scope.assertCanEditCenter(centerId);
      const stock = await this.stock(manager, scope, centerId, skuId).getOne();
      if (!stock) throw new CatalogError('RECEIVE_STOCK_FIRST', 409);
      const ids = this.stock(manager, scope, centerId, skuId).select(
        'stock.id',
      );
      await manager
        .createQueryBuilder()
        .update(InventoryStock)
        .set({
          lowStockThreshold: value,
          updatedBy: actor.id,
          updatedAt: new Date(),
        })
        .where('id IN (' + ids.getQuery() + ')')
        .setParameters(ids.getParameters())
        .execute();
      await this.audit(
        manager,
        context,
        'INVENTORY',
        `${centerId}:${skuId}`,
        'lowStockThreshold',
        stock.lowStockThreshold,
        value,
      );
      return { lowStockThreshold: value };
    });
  }
}
