import { Injectable, NotFoundException } from '@nestjs/common';
import {
  DataSource,
  EntityManager,
  ObjectLiteral,
  SelectQueryBuilder,
} from 'typeorm';
import { pktDateBoundary } from '@handset/shared';
import {
  InventoryStock,
  InventoryMovement,
  SalesTransaction,
  HandsetSku,
  HandsetModel,
  ModelSpecification,
  Brand,
  Color,
  ExperienceCenter,
} from '../database/entities';
import { CenterScope } from '../scope/scope.service';
import { InventoryQueryDto } from './inventory.dto';
import { SalesQueryDto } from '../sales/sales.dto';
import { applySalesVisibility } from '../sales/sales-visibility';
import { InventoryConfig } from './inventory.config';
import { CatalogError } from '../catalog/catalog.error';
@Injectable()
export class InventoryRepository {
  constructor(
    readonly db: DataSource,
    private readonly config: InventoryConfig,
  ) {}
  private product<T extends ObjectLiteral>(
    q: SelectQueryBuilder<T>,
    skuAlias: string,
  ) {
    return q
      .innerJoin(HandsetModel, 'model', `model.id=${skuAlias}.modelId`)
      .innerJoin(Brand, 'brand', 'brand.id=model.brandId')
      .innerJoin(Color, 'color', `color.id=${skuAlias}.colorId`)
      .leftJoin(
        ModelSpecification,
        'spec',
        `spec.id=${skuAlias}.specificationId`,
      );
  }
  private filters<T extends ObjectLiteral>(
    q: SelectQueryBuilder<T>,
    dto: InventoryQueryDto,
    scope: CenterScope,
    centerColumn: string,
  ) {
    scope.applyToQuery(q, centerColumn);
    if (dto.centerId) {
      scope.assertCanAccessCenter(dto.centerId);
      q.andWhere(centerColumn + '=:centerId', { centerId: dto.centerId });
    }
    for (const [key, column] of [
      ['brandId', 'brand.id'],
      ['modelId', 'model.id'],
      ['colorId', 'color.id'],
      ['specificationId', 'spec.id'],
      ['skuId', 'sku.id'],
    ] as const)
      if (dto[key]) q.andWhere(column + '=:' + key, { [key]: dto[key] });
    if (dto.search)
      q.andWhere(
        "(model.name LIKE :search ESCAPE '!' OR sku.skuCode LIKE :search ESCAPE '!')",
        { search: '%' + dto.search.replace(/[!%_[]/g, '!$&') + '%' },
      );
    return q;
  }
  private dates<T extends ObjectLiteral>(
    q: SelectQueryBuilder<T>,
    dto: InventoryQueryDto,
    column: string,
  ) {
    try {
      if (dto.dateFrom)
        q.andWhere(column + '>=:from', { from: pktDateBoundary(dto.dateFrom) });
      if (dto.dateTo)
        q.andWhere(column + '<:to', {
          to: new Date(pktDateBoundary(dto.dateTo).getTime() + 86400000),
        });
      if (dto.dateFrom && dto.dateTo && dto.dateFrom > dto.dateTo)
        throw Error();
    } catch {
      throw new CatalogError('INVALID_DATE_RANGE');
    }
  }
  async inventory(scope: CenterScope, dto: InventoryQueryDto) {
    const manager = this.db.manager;
    const q: SelectQueryBuilder<ObjectLiteral> = dto.centerId
      ? manager
          .getRepository(HandsetSku)
          .createQueryBuilder('sku')
          .innerJoin(
            ExperienceCenter,
            'center',
            'center.id=:selectedCenter AND center.isActive=:active',
            { selectedCenter: dto.centerId, active: true },
          )
          .leftJoin(
            InventoryStock,
            'stock',
            'stock.skuId=sku.id AND stock.centerId=center.id',
          )
      : manager
          .getRepository(InventoryStock)
          .createQueryBuilder('stock')
          .innerJoin(HandsetSku, 'sku', 'sku.id=stock.skuId')
          .innerJoin(ExperienceCenter, 'center', 'center.id=stock.centerId');
    this.product(q, 'sku');
    this.filters(q, dto, scope, 'center.id');
    // Include stocked inactive variants for visibility; selected-center zero rows only use active SKUs.
    q.andWhere(
      '(stock.id IS NOT NULL OR (sku.isActive=:active AND model.isActive=:active AND brand.isActive=:active AND color.isActive=:active AND (spec.id IS NULL OR spec.isActive=:active)))',
      { active: true },
    );
    const qty = 'COALESCE(stock.quantityAvailable,0)',
      threshold = 'COALESCE(stock.lowStockThreshold,:defaultThreshold)';
    q.setParameter('defaultThreshold', this.config.values.LOW_STOCK_THRESHOLD);
    if (dto.stockStatus === 'ZERO') q.andWhere(qty + '=0');
    if (dto.stockStatus === 'LOW')
      q.andWhere(qty + '>0 AND ' + qty + '<=' + threshold);
    if (dto.stockStatus === 'IN_STOCK') q.andWhere(qty + '>0');
    const total = Number(
      (await q.clone().select('COUNT(*)', 'total').getRawOne()).total,
    );
    const items = await q
      .select([
        'center.id AS centerId',
        'center.name AS centerName',
        'sku.id AS skuId',
        'sku.skuCode AS skuCode',
        'model.name AS modelName',
        'brand.name AS brandName',
        'color.name AS colorName',
        'spec.label AS specification',
        'sku.listPrice AS listPrice',
        qty + ' AS quantityAvailable',
        threshold + ' AS lowStockThreshold',
        'stock.lastStockUpdateAt AS lastStockUpdateAt',
        'CASE WHEN sku.isActive=1 AND model.isActive=1 AND brand.isActive=1 AND color.isActive=1 AND (spec.id IS NULL OR spec.isActive=1) THEN 1 ELSE 0 END AS isActive',
      ])
      .orderBy('center.id', 'ASC')
      .addOrderBy('sku.id', 'ASC')
      .offset((dto.page - 1) * dto.pageSize)
      .limit(dto.pageSize)
      .getRawMany();
    return {
      items: items.map((row) => ({
        ...row,
        status:
          row.quantityAvailable === 0
            ? 'ZERO'
            : row.quantityAvailable <= row.lowStockThreshold
              ? 'LOW'
              : 'IN_STOCK',
      })),
      total,
      page: dto.page,
      pageSize: dto.pageSize,
    };
  }
  salesQuery(
    scope: CenterScope,
    dto: SalesQueryDto,
    manager: EntityManager = this.db.manager,
  ) {
    const q = applySalesVisibility(
      manager.getRepository(SalesTransaction).createQueryBuilder('sale'),
      'sale',
      dto.includeVoided,
    );
    q.innerJoin(HandsetSku, 'sku', 'sku.id=sale.skuId').innerJoin(
      ExperienceCenter,
      'center',
      'center.id=sale.centerId',
    );
    this.product(q, 'sku');
    this.filters(q, dto, scope, 'sale.centerId');
    this.dates(q, dto, 'sale.soldAt');
    if (dto.salesType)
      q.andWhere('sale.salesType=:salesType', { salesType: dto.salesType });
    return q;
  }
  async sales(scope: CenterScope, dto: SalesQueryDto, id?: string) {
    const q = this.salesQuery(scope, dto);
    if (id) q.andWhere('sale.id=:id', { id });
    const total = await q.getCount();
    const items = await q
      .select([
        'sale.id AS id',
        'sale.centerId AS centerId',
        'center.name AS centerName',
        'sale.skuId AS skuId',
        'model.name AS modelName',
        'brand.name AS brandName',
        'color.name AS colorName',
        'spec.label AS specification',
        'sale.quantity AS quantity',
        'sale.salesType AS salesType',
        'sale.soldAt AS soldAt',
        'sale.saleDate AS saleDate',
        'sale.recordedBy AS recordedBy',
        'sale.createdAt AS createdAt',
        'sale.notes AS notes',
        'sale.listPriceSnapshot AS listPriceSnapshot',
        'sale.voidedAt AS voidedAt',
        'sale.voidedBy AS voidedBy',
        'sale.voidReason AS voidReason',
      ])
      .orderBy('sale.soldAt', 'DESC')
      .addOrderBy('sale.id', 'DESC')
      .offset((dto.page - 1) * dto.pageSize)
      .limit(dto.pageSize)
      .getRawMany();
    const safe = items.map((row) => ({
      ...row,
      id: String(row.id),
      selfVoidUntil: new Date(
        new Date(row.createdAt).getTime() +
          this.config.values.SALE_SELF_VOID_MINUTES * 60000,
      ).toISOString(),
    }));
    if (id) {
      if (!safe[0]) throw new NotFoundException();
      return safe[0];
    }
    return { items: safe, total, page: dto.page, pageSize: dto.pageSize };
  }
  async movements(scope: CenterScope, dto: InventoryQueryDto) {
    const q = this.db
      .getRepository(InventoryMovement)
      .createQueryBuilder('movement')
      .innerJoin(HandsetSku, 'sku', 'sku.id=movement.skuId')
      .innerJoin(ExperienceCenter, 'center', 'center.id=movement.centerId');
    this.product(q, 'sku');
    this.filters(q, dto, scope, 'movement.centerId');
    this.dates(q, dto, 'movement.createdAt');
    const total = await q.getCount();
    const items = await q
      .select([
        'movement.id AS id',
        'movement.centerId AS centerId',
        'center.name AS centerName',
        'movement.skuId AS skuId',
        'sku.skuCode AS skuCode',
        'movement.movementType AS movementType',
        'movement.quantityDelta AS quantityDelta',
        'movement.quantityAfter AS quantityAfter',
        'movement.reasonCode AS reasonCode',
        'movement.note AS note',
        'movement.salesTransactionId AS salesTransactionId',
        'movement.receivedFrom AS receivedFrom',
        'movement.sourceCenterId AS sourceCenterId',
        'movement.reference AS reference',
        'movement.userId AS userId',
        'movement.createdAt AS createdAt',
      ])
      .orderBy('movement.id', 'DESC')
      .offset((dto.page - 1) * dto.pageSize)
      .limit(dto.pageSize)
      .getRawMany();
    return { items, total, page: dto.page, pageSize: dto.pageSize };
  }
}
