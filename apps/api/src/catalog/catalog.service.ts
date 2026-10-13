import { Injectable } from '@nestjs/common';
import { EntityManager, DeepPartial } from 'typeorm';
import {
  AuditLog,
  HandsetSku,
  HandsetModel,
  InventoryStock,
  ExperienceCenter,
} from '../database/entities';
import { AuthEventContext, Principal } from '../auth/auth.types';
import { ScopeService } from '../scope/scope.service';
import {
  CatalogRepository,
  CatalogRecord,
  Kind,
  target,
  catalogTypes,
  publicRecord,
} from './catalog.repository';
import { CatalogNormalizer } from './catalog-normalizer';
import { CatalogTransaction } from './catalog-transaction';
import { CatalogError } from './catalog.error';
import {
  HandsetDto,
  ReferenceDto,
  SpecificationDto,
  SkuDto,
  PatchPriceDto,
} from './catalog.dto';
@Injectable()
export class CatalogService {
  constructor(
    readonly repo: CatalogRepository,
    readonly normalizer: CatalogNormalizer,
    readonly tx: CatalogTransaction,
    private readonly scopes: ScopeService,
  ) {}
  async audit(
    manager: EntityManager,
    context: AuthEventContext,
    kind: Kind,
    id: number,
    field: string | null,
    before: unknown,
    after: unknown,
    action = 'UPDATE',
  ) {
    await manager.insert(AuditLog, {
      entityType: catalogTypes[kind],
      entityId: String(id),
      fieldName: field,
      oldValue: before == null ? null : JSON.stringify(before),
      newValue: after == null ? null : JSON.stringify(after),
      action,
      userId: context.userId!,
      changedAt: new Date(),
      requestId: context.requestId,
      ipAddress: context.ip,
    });
  }
  async duplicate(
    manager: EntityManager,
    kind: Exclude<Kind, 'skus'>,
    nameKey: string,
    parent: number | undefined,
    confirm: boolean,
    exclude?: number,
  ) {
    const q = manager
      .getRepository(target(kind))
      .createQueryBuilder('item')
      .addSelect('item.nameKey');
    if (parent !== undefined)
      q.where(
        'item.' + (kind === 'models' ? 'brandId' : 'modelId') + ' = :parent',
        { parent },
      );
    if (exclude !== undefined) q.andWhere('item.id <> :exclude', { exclude });
    const rows = await q.getMany();
    const exact = rows.find((row) => row.nameKey === nameKey);
    if (exact)
      throw new CatalogError('DUPLICATE', 409, {
        existing: [publicRecord(exact)],
      });
    const similar = rows.filter((row) =>
      this.normalizer.similar(nameKey, row.nameKey!),
    );
    if (similar.length && !confirm)
      throw new CatalogError('POSSIBLE_DUPLICATE', 409, {
        existing: similar.slice(0, 20).map(publicRecord),
      });
  }
  async insert(
    manager: EntityManager,
    kind: Kind,
    values: DeepPartial<CatalogRecord>,
    context: AuthEventContext,
  ) {
    const row = await manager.getRepository(target(kind)).save({
      ...values,
      createdBy: context.userId!,
      updatedBy: context.userId!,
    });
    await this.audit(
      manager,
      context,
      kind,
      row.id,
      null,
      null,
      publicRecord(row),
      'CREATE',
    );
    return row;
  }
  async named(
    manager: EntityManager,
    kind: 'brands' | 'models' | 'colors',
    name: string,
    context: AuthEventContext,
    confirm = false,
    brandId?: number,
  ) {
    if (kind === 'models')
      await this.repo.one('brands', brandId!, false, manager);
    const normalized = this.normalizer.clean(
      name,
      kind === 'brands' ? 50 : kind === 'colors' ? 40 : 100,
    );
    await this.duplicate(manager, kind, normalized.nameKey, brandId, confirm);
    return this.insert(
      manager,
      kind,
      { ...normalized, ...(kind === 'models' ? { brandId } : {}) },
      context,
    );
  }
  async specification(
    manager: EntityManager,
    modelId: number,
    dto: SpecificationDto,
    context: AuthEventContext,
    confirm = false,
  ) {
    await this.repo.one('models', modelId, false, manager);
    const values = this.normalizer.specification(dto);
    await this.duplicate(
      manager,
      'specifications',
      values.nameKey,
      modelId,
      confirm,
    );
    return this.insert(
      manager,
      'specifications',
      { ...values, modelId },
      context,
    );
  }
  async sku(
    manager: EntityManager,
    modelId: number,
    dto: SkuDto,
    context: AuthEventContext,
  ) {
    const model = await this.repo.one('models', modelId, false, manager);
    const brand = await this.repo.one('brands', model.brandId!, false, manager);
    const color = await this.repo.one('colors', dto.colorId, false, manager);
    const spec = dto.specificationId
      ? await this.repo.one(
          'specifications',
          dto.specificationId,
          false,
          manager,
        )
      : null;
    if (spec && spec.modelId !== modelId)
      throw new CatalogError('SPECIFICATION_MODEL_MISMATCH');
    const existing = manager
      .getRepository(HandsetSku)
      .createQueryBuilder('sku')
      .where('sku.modelId = :model AND sku.colorId = :color', {
        model: modelId,
        color: dto.colorId,
      });
    if (spec)
      existing.andWhere('sku.specificationId = :spec', { spec: spec.id });
    else existing.andWhere('sku.specificationId IS NULL');
    if (await existing.getCount()) throw new CatalogError('DUPLICATE', 409);
    const slug = (s: string) =>
      this.normalizer
        .key(s)
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, '')
        .slice(0, 20) || 'ITEM';
    const base = [
      slug(brand.name!),
      slug(model.name!),
      spec?.ramGb ?? 'NA',
      spec?.storageGb ?? 'NA',
      slug(color.name!),
    ]
      .join('-')
      .slice(0, 90);
    let skuCode = base,
      suffix = 1;
    while (await manager.existsBy(HandsetSku, { skuCode }))
      skuCode = base + '-' + suffix++;
    return this.insert(
      manager,
      'skus',
      {
        modelId,
        colorId: color.id,
        specificationId: spec?.id ?? null,
        skuCode,
        listPrice: dto.listPrice == null ? null : this.listPrice(dto.listPrice),
      },
      context,
    );
  }
  async reference(
    manager: EntityManager,
    kind: 'brands' | 'colors',
    ref: ReferenceDto,
    context: AuthEventContext,
    confirm: boolean,
  ) {
    if (!ref || (ref.id === undefined) === (ref.name === undefined))
      throw new CatalogError('ID_OR_NAME_REQUIRED');
    return ref.id !== undefined
      ? this.repo.one(kind, ref.id, false, manager)
      : this.named(manager, kind, ref.name!, context, confirm);
  }
  async handset(
    manager: EntityManager,
    dto: HandsetDto,
    context: AuthEventContext,
  ) {
    const prices = new Map<string, string | null>();
    for (const entry of dto.variantPrices ?? []) {
      const key = `${entry.colorIndex}:${entry.specificationIndex}`;
      if (
        entry.colorIndex >= dto.colors.length ||
        (dto.specifications.length
          ? entry.specificationIndex === null ||
            entry.specificationIndex >= dto.specifications.length
          : entry.specificationIndex !== null) ||
        prices.has(key)
      )
        throw new CatalogError('INVALID_VARIANT_PRICE');
      prices.set(
        key,
        entry.listPrice == null ? null : this.listPrice(entry.listPrice),
      );
    }
    const confirm = dto.confirmDistinct === true;
    const brand = await this.reference(
      manager,
      'brands',
      dto.brand,
      context,
      confirm,
    );
    const model = await this.named(
      manager,
      'models',
      dto.model.name,
      context,
      confirm,
      brand.id,
    );
    const specifications: CatalogRecord[] = [],
      colors: CatalogRecord[] = [],
      skus: CatalogRecord[] = [];
    for (const input of dto.specifications)
      specifications.push(
        await this.specification(manager, model.id, input, context, confirm),
      );
    for (const [colorIndex, input] of dto.colors.entries()) {
      const color = await this.reference(
        manager,
        'colors',
        input,
        context,
        confirm,
      );
      if (colors.some((c) => c.id === color.id))
        throw new CatalogError('DUPLICATE_COLOR');
      colors.push(color);
      for (const [specIndex, spec] of (specifications.length
        ? specifications
        : [null]
      ).entries())
        skus.push(
          await this.sku(
            manager,
            model.id,
            {
              colorId: color.id,
              specificationId: spec?.id ?? null,
              listPrice:
                prices.get(`${colorIndex}:${spec ? specIndex : null}`) ?? null,
            },
            context,
          ),
        );
    }
    return {
      brand: publicRecord(brand),
      model: publicRecord(model),
      specifications: specifications.map(publicRecord),
      colors: colors.map(publicRecord),
      skus: skus.map(publicRecord),
    };
  }
  async create(
    kind: 'brands' | 'models' | 'colors' | 'specifications' | 'skus',
    dto: {
      name?: string;
      brandId?: number;
      confirmDistinct?: boolean;
    } & SpecificationDto &
      Partial<SkuDto>,
    actor: Principal,
    context: AuthEventContext,
    modelId?: number,
  ) {
    return this.tx.run(actor, 'masterdata.create', async (manager) =>
      publicRecord(
        kind === 'specifications'
          ? await this.specification(
              manager,
              modelId!,
              dto,
              context,
              dto.confirmDistinct,
            )
          : kind === 'skus'
            ? await this.sku(manager, modelId!, dto as SkuDto, context)
            : await this.named(
                manager,
                kind,
                dto.name!,
                context,
                dto.confirmDistinct,
                dto.brandId,
              ),
      ),
    );
  }
  addHandset(dto: HandsetDto, actor: Principal, context: AuthEventContext) {
    return this.tx.run(actor, 'masterdata.create', (manager) =>
      this.handset(manager, dto, context),
    );
  }
  private listPrice(value: string) {
    const [whole, fraction = ''] = value.split('.');
    return whole + '.' + fraction.padEnd(2, '0');
  }
  patchPrice(
    id: number,
    dto: PatchPriceDto,
    actor: Principal,
    context: AuthEventContext,
  ) {
    return this.tx.run(actor, 'masterdata.manage', async (manager) => {
      const row = await this.repo.one('skus', id, true, manager);
      if (row.rowVersion !== dto.rowVersion)
        throw new CatalogError('CONFLICT', 409);
      return this.update(
        manager,
        'skus',
        row,
        {
          listPrice:
            dto.listPrice === null ? null : this.listPrice(dto.listPrice),
        },
        context,
      );
    });
  }
  async update(
    manager: EntityManager,
    kind: Kind,
    row: CatalogRecord,
    values: DeepPartial<CatalogRecord>,
    context: AuthEventContext,
  ) {
    const changed = (Object.keys(values) as (keyof CatalogRecord)[]).some(
      (field) =>
        field !== 'nameKey' &&
        JSON.stringify(row[field]) !== JSON.stringify(values[field]),
    );
    if (!changed) return publicRecord(row);
    for (const field of Object.keys(values) as (keyof CatalogRecord)[])
      if (
        field !== 'nameKey' &&
        JSON.stringify(row[field]) !== JSON.stringify(values[field])
      )
        await this.audit(
          manager,
          context,
          kind,
          row.id,
          field,
          row[field],
          values[field],
        );
    const result = await manager
      .createQueryBuilder()
      .update(target(kind))
      .set({ ...values, updatedBy: context.userId!, updatedAt: new Date() })
      .where('id = :id AND row_version = :version', {
        id: row.id,
        version: row.rowVersion,
      })
      .execute();
    if (result.affected !== 1) throw new CatalogError('CONFLICT', 409);
    return publicRecord(await this.repo.one(kind, row.id, true, manager));
  }
  patch(
    kind: Exclude<Kind, 'skus'>,
    id: number,
    dto: {
      rowVersion: number;
      name?: string;
      confirmDistinct?: boolean;
    } & SpecificationDto,
    actor: Principal,
    context: AuthEventContext,
  ) {
    return this.tx.run(
      actor,
      dto.confirmDistinct
        ? ['masterdata.manage', 'masterdata.create']
        : 'masterdata.manage',
      async (manager) => {
        const row = await this.repo.one(kind, id, true, manager);
        if (row.rowVersion !== dto.rowVersion)
          throw new CatalogError('CONFLICT', 409);
        if (
          dto.confirmDistinct &&
          !actor.permissions.includes('masterdata.create')
        )
          throw new CatalogError('CONFIRM_REQUIRES_CREATE', 403);
        const values =
          kind === 'specifications'
            ? this.normalizer.specification({
                ramGb: dto.ramGb === undefined ? row.ramGb : dto.ramGb,
                storageGb:
                  dto.storageGb === undefined ? row.storageGb : dto.storageGb,
                label: dto.label ?? (row.ramGb == null ? row.label : undefined),
              })
            : this.normalizer.clean(
                dto.name!,
                kind === 'brands' ? 50 : kind === 'colors' ? 40 : 100,
              );
        await this.duplicate(
          manager,
          kind,
          values.nameKey,
          kind === 'models'
            ? row.brandId
            : kind === 'specifications'
              ? row.modelId
              : undefined,
          dto.confirmDistinct === true,
          id,
        );
        return this.update(manager, kind, row, values, context);
      },
    );
  }
  status(
    kind: Kind,
    id: number,
    active: boolean,
    rowVersion: number,
    actor: Principal,
    context: AuthEventContext,
  ) {
    return this.tx.run(actor, 'masterdata.manage', async (manager) => {
      const row = await this.repo.one(kind, id, true, manager);
      if (row.rowVersion !== rowVersion)
        throw new CatalogError('CONFLICT', 409);
      await this.audit(
        manager,
        context,
        kind,
        id,
        'STATUS_ACTION',
        null,
        active ? 'activate' : 'deactivate',
      );
      if (active) {
        if (kind === 'models')
          await this.repo.one('brands', row.brandId!, false, manager);
        if (kind === 'specifications' || kind === 'skus')
          await this.repo.one('models', row.modelId!, false, manager);
        if (kind === 'skus') {
          await this.repo.one('colors', row.colorId!, false, manager);
          if (row.specificationId)
            await this.repo.one(
              'specifications',
              row.specificationId,
              false,
              manager,
            );
        }
      } else {
        const affected = manager
          .getRepository(HandsetSku)
          .createQueryBuilder('sku')
          .innerJoin(HandsetModel, 'model', 'model.id = sku.modelId');
        const column = {
          brands: 'model.brandId',
          models: 'sku.modelId',
          colors: 'sku.colorId',
          specifications: 'sku.specificationId',
          skus: 'sku.id',
        }[kind];
        affected.where(column + ' = :id', { id });
        // Global integrity check required for catalog deactivation. Never expose outside-scope stock.
        const stock = manager
          .getRepository(InventoryStock)
          .createQueryBuilder('stock')
          .innerJoin(HandsetSku, 'sku', 'sku.id = stock.skuId')
          .innerJoin(HandsetModel, 'model', 'model.id = sku.modelId')
          .where(column + ' = :id', { id })
          .andWhere('stock.quantityAvailable > 0');
        if (await stock.getCount()) {
          const scope = await this.scopes.resolve(
            actor.id,
            actor.permissions,
            manager,
          );
          scope.applyToQuery(stock, 'stock.centerId');
          const centers = await stock
            .innerJoin(ExperienceCenter, 'center', 'center.id = stock.centerId')
            .select('center.id', 'centerId')
            .addSelect('center.name', 'centerName')
            .addSelect('SUM(stock.quantityAvailable)', 'quantity')
            .groupBy('center.id')
            .addGroupBy('center.name')
            .orderBy('center.id', 'ASC')
            .take(100)
            .getRawMany();
          throw new CatalogError('HAS_STOCK', 409, {
            centers,
            message:
              'Stock exists. Only centers within your scope are listed; at most 100 centers.',
          });
        }
        if (kind !== 'skus')
          for (const sku of await affected.getMany())
            if (sku.isActive)
              await this.update(
                manager,
                'skus',
                sku,
                { isActive: false },
                context,
              );
        if (kind === 'brands')
          for (const model of await manager.findBy(HandsetModel, {
            brandId: id,
            isActive: true,
          }))
            await this.update(
              manager,
              'models',
              model,
              { isActive: false },
              context,
            );
      }
      return this.update(manager, kind, row, { isActive: active }, context);
    });
  }
}
