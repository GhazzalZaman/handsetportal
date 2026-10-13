import { Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { EntityManager } from 'typeorm';
import { SalesTransaction } from '../database/entities';
import { CatalogRepository } from '../catalog/catalog.repository';
import { CatalogError } from '../catalog/catalog.error';
import { CenterScope } from '../scope/scope.service';
import { AuthEventContext, Principal } from '../auth/auth.types';
import { Clock } from '../auth/clock';
import { InventoryService } from '../inventory/inventory.service';
import { InventoryConfig } from '../inventory/inventory.config';
import { SaleDto } from './sales.dto';
import { saleTime } from './sales-time';
import { applySalesVisibility } from './sales-visibility';
@Injectable()
export class SalesService {
  constructor(
    private readonly stock: InventoryService,
    private readonly catalog: CatalogRepository,
    private readonly clock: Clock,
    private readonly config: InventoryConfig,
  ) {}
  query(manager: EntityManager, scope: CenterScope, includeVoided = false) {
    const query = applySalesVisibility(
      manager.getRepository(SalesTransaction).createQueryBuilder('sale'),
      'sale',
      includeVoided,
    );
    return scope.applyToQuery(query, 'sale.centerId');
  }
  record(dto: SaleDto, actor: Principal, context: AuthEventContext) {
    return this.stock.tx.run(
      actor,
      'sales.record',
      async (manager, scope, permissions) => {
        scope.assertCanEditCenter(dto.centerId);
        const existing = await this.query(manager, scope, true)
          .andWhere('sale.clientRequestId=:requestId', {
            requestId: dto.clientRequestId,
          })
          .getOne();
        if (existing) {
          if (
            existing.recordedBy !== actor.id ||
            existing.centerId !== dto.centerId ||
            existing.skuId !== dto.skuId ||
            existing.quantity !== dto.quantity ||
            existing.salesType !== dto.salesType ||
            existing.dispatchSource !== (dto.dispatchSource ?? 'WAREHOUSE') ||
            (existing.notes ?? '') !== (dto.notes ?? '') ||
            (dto.soldAt &&
              existing.soldAt.getTime() !== new Date(dto.soldAt).getTime())
          )
            throw new CatalogError('IDEMPOTENCY_CONFLICT', 409);
          return this.result(existing);
        }
        const sku = await this.catalog.one('skus', dto.skuId, false, manager);
        const time = saleTime(
          this.clock.now(),
          dto.soldAt,
          dto.backdateReason,
          permissions.includes('sales.backdate'),
          this.config.values.SALES_BACKDATE_MAX_DAYS,
        );
        const sale = await manager.save(
          SalesTransaction,
          manager.create(SalesTransaction, {
            centerId: dto.centerId,
            skuId: dto.skuId,
            quantity: dto.quantity,
            salesType: dto.salesType,
            dispatchSource: dto.dispatchSource ?? 'WAREHOUSE',
            notes: dto.notes ?? null,
            ...time,
            recordedBy: actor.id,
            sourceSystem: 'APP',
            externalRef: randomUUID(),
            clientRequestId: dto.clientRequestId,
            listPriceSnapshot: sku.listPrice ?? null,
            createdBy: actor.id,
            updatedBy: actor.id,
            createdAt: this.clock.now(),
            updatedAt: this.clock.now(),
          }),
        );
        await this.stock.changeStock(
          manager,
          scope,
          {
            centerId: dto.centerId,
            skuId: dto.skuId,
            delta: -dto.quantity,
            movementType: 'SALE',
            salesTransactionId: sale.id,
            note: dto.backdateReason,
          },
          context,
        );
        await this.stock.audit(
          manager,
          context,
          'SALE',
          sale.id,
          'record',
          null,
          {
            centerId: dto.centerId,
            skuId: dto.skuId,
            quantity: dto.quantity,
            salesType: dto.salesType,
            ...time,
            listPriceSnapshot: sku.listPrice,
            backdateReason: dto.backdateReason,
          },
        );
        return this.result(sale);
      },
    );
  }
  private result(sale: SalesTransaction) {
    return {
      ...sale,
      selfVoidUntil: new Date(
        sale.createdAt.getTime() +
          this.config.values.SALE_SELF_VOID_MINUTES * 60000,
      ).toISOString(),
    };
  }
  void(
    id: string,
    reason: string,
    actor: Principal,
    context: AuthEventContext,
  ) {
    return this.stock.tx.run(
      actor,
      'dashboard.view',
      async (manager, scope, permissions) => {
        const sale = await this.query(manager, scope, true)
          .andWhere('sale.id=:id', { id })
          .getOne();
        if (!sale) throw new NotFoundException();
        const self =
          sale.recordedBy === actor.id &&
          this.clock.now().getTime() >= sale.createdAt.getTime() &&
          this.clock.now().getTime() <=
            sale.createdAt.getTime() +
              this.config.values.SALE_SELF_VOID_MINUTES * 60000;
        if (!permissions.includes('sales.void') && !self)
          throw new CatalogError('VOID_FORBIDDEN', 403);
        // The explicit self-void rule authorizes a scoped reader to undo their own recent sale.
        scope.assertCanEditCenter(
          sale.centerId,
          self ? 'dashboard.view' : 'sales.void',
        );
        if (sale.voidedAt) return this.result(sale);
        const ids = this.query(manager, scope)
          .select('sale.id')
          .andWhere('sale.id=:id', { id });
        const result = await manager
          .createQueryBuilder()
          .update(SalesTransaction)
          .set({
            voidedAt: this.clock.now(),
            voidedBy: actor.id,
            voidReason: reason,
            updatedBy: actor.id,
            updatedAt: this.clock.now(),
          })
          .where('id IN (' + ids.getQuery() + ')')
          .setParameters(ids.getParameters())
          .execute();
        if (result.affected !== 1) throw new CatalogError('CONFLICT', 409);
        await this.stock.changeStock(
          manager,
          scope,
          {
            centerId: sale.centerId,
            skuId: sale.skuId,
            delta: sale.quantity,
            movementType: 'SALE_REVERSAL',
            salesTransactionId: id,
            note: reason,
          },
          context,
        );
        await this.stock.audit(manager, context, 'SALE', id, 'void', null, {
          reason,
          voidedBy: actor.id,
          voidedAt: this.clock.now(),
        });
        return this.result(
          (await this.query(manager, scope, true)
            .andWhere('sale.id=:id', { id })
            .getOne())!,
        );
      },
    );
  }
}
