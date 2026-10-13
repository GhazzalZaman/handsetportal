import { Injectable, NotFoundException } from '@nestjs/common';
import { DataSource, EntityTarget, In } from 'typeorm';
import {
  Brand,
  Color,
  HandsetModel,
  ModelSpecification,
  HandsetSku,
} from '../database/entities';
import { CatalogQueryDto } from './catalog.dto';
import { CatalogNormalizer } from './catalog-normalizer';
import { pageResult } from '../admin/admin.dto';
export type Kind = 'brands' | 'models' | 'colors' | 'specifications' | 'skus';
export interface CatalogRecord {
  id: number;
  name?: string;
  label?: string;
  nameKey?: string;
  brandId?: number;
  modelId?: number;
  colorId?: number;
  specificationId?: number | null;
  ramGb?: number | null;
  storageGb?: number | null;
  skuCode?: string;
  listPrice?: string | null;
  isActive: boolean;
  rowVersion: number;
  createdAt: Date;
  updatedAt: Date;
  createdBy: number | null;
  updatedBy: number | null;
}
export const catalogEntities = {
  brands: Brand,
  models: HandsetModel,
  colors: Color,
  specifications: ModelSpecification,
  skus: HandsetSku,
};
export const catalogTypes = {
  brands: 'BRAND',
  models: 'MODEL',
  colors: 'COLOR',
  specifications: 'SPECIFICATION',
  skus: 'SKU',
};
export function target(kind: Kind) {
  return catalogEntities[kind] as EntityTarget<CatalogRecord>;
}
export function publicRecord(row: CatalogRecord) {
  const {
    nameKey: _key,
    createdBy: _creator,
    updatedBy: _editor,
    createdAt: _created,
    updatedAt: _updated,
    ...safe
  } = row;
  void _key;
  void _creator;
  void _editor;
  void _created;
  void _updated;
  return safe;
}
@Injectable()
export class CatalogRepository {
  constructor(
    readonly db: DataSource,
    private readonly normalizer: CatalogNormalizer,
  ) {}
  // Catalog masters are GLOBAL. CenterScope intentionally does not apply here.
  query(kind: Kind, manager = this.db.manager, includeInactive = false) {
    const q = manager.getRepository(target(kind)).createQueryBuilder('item');
    if (!includeInactive)
      q.andWhere('item.isActive = :catalogActive', { catalogActive: true });
    if (['models', 'specifications', 'skus'].includes(kind)) {
      if (kind === 'models')
        q.innerJoin(Brand, 'brand', 'brand.id = item.brandId');
      else
        q.innerJoin(HandsetModel, 'model', 'model.id = item.modelId').innerJoin(
          Brand,
          'brand',
          'brand.id = model.brandId',
        );
      if (!includeInactive) {
        q.andWhere('brand.isActive = :catalogActive');
        if (kind !== 'models') q.andWhere('model.isActive = :catalogActive');
      }
    }
    if (kind === 'skus') {
      q.innerJoin(Color, 'color', 'color.id = item.colorId').leftJoin(
        ModelSpecification,
        'spec',
        'spec.id = item.specificationId',
      );
      if (!includeInactive)
        q.andWhere(
          'color.isActive = :catalogActive AND (item.specificationId IS NULL OR spec.isActive = :catalogActive)',
        );
    }
    return q;
  }
  async one(
    kind: Kind,
    id: number,
    includeInactive = false,
    manager = this.db.manager,
  ) {
    const row = await this.query(kind, manager, includeInactive)
      .andWhere('item.id = :id', { id })
      .getOne();
    if (!row) throw new NotFoundException();
    return row;
  }
  async list(
    kind: Kind,
    dto: CatalogQueryDto,
    permissions: string[],
    manager = this.db.manager,
  ) {
    const include =
      permissions.includes('masterdata.manage') && dto.includeInactive === true;
    const q = this.query(kind, manager, include);
    if (include && dto.isActive !== undefined)
      q.andWhere('item.isActive = :active', { active: dto.isActive });
    if (dto.search) {
      const value = this.normalizer.key(dto.search);
      if (!value) q.andWhere('1 = 0');
      else if (kind === 'skus')
        q.andWhere(
          '(model.nameKey LIKE :search OR item.skuCode LIKE :skuSearch)',
          {
            search: value + '%',
            skuSearch: dto.search.replace(/[!%_[]/g, '!$&') + '%',
          },
        );
      else q.andWhere('item.nameKey LIKE :search', { search: value + '%' });
    }
    if (dto.brandId && ['models', 'skus', 'specifications'].includes(kind))
      q.andWhere('brand.id = :brandId', { brandId: dto.brandId });
    for (const field of ['modelId', 'colorId', 'specificationId'] as const)
      if (
        dto[field] &&
        (kind === 'skus' || (field === 'modelId' && kind === 'specifications'))
      )
        q.andWhere('item.' + field + ' = :' + field, { [field]: dto[field] });
    if (kind === 'skus') {
      if (dto.ramGb !== undefined)
        q.andWhere('spec.ramGb = :ramGb', { ramGb: dto.ramGb });
      if (dto.storageGb !== undefined)
        q.andWhere('spec.storageGb = :storageGb', { storageGb: dto.storageGb });
    }
    const [rows, total] = await q
      .orderBy('item.id', 'ASC')
      .skip((dto.page - 1) * dto.pageSize)
      .take(dto.pageSize)
      .getManyAndCount();
    if (kind === 'skus') {
      const [models, colors, specs] = await Promise.all([
        manager.findBy(HandsetModel, {
          id: In([...new Set(rows.map((row) => row.modelId!))]),
        }),
        manager.findBy(Color, {
          id: In([...new Set(rows.map((row) => row.colorId!))]),
        }),
        manager.findBy(ModelSpecification, {
          id: In([
            ...new Set(
              rows.flatMap((row) =>
                row.specificationId ? [row.specificationId] : [],
              ),
            ),
          ]),
        }),
      ]);
      const brands = await manager.findBy(Brand, {
        id: In([...new Set(models.map((model) => model.brandId))]),
      });
      const modelById = new Map(models.map((model) => [model.id, model]));
      const brandById = new Map(brands.map((brand) => [brand.id, brand]));
      const colorById = new Map(colors.map((color) => [color.id, color]));
      const specById = new Map(specs.map((spec) => [spec.id, spec]));
      return pageResult(
        rows.map((row) => {
          const model = modelById.get(row.modelId!)!;
          const brand = brandById.get(model.brandId)!;
          return {
            ...publicRecord(row),
            modelName: model.name,
            brandId: brand.id,
            brandName: brand.name,
            color: publicRecord(colorById.get(row.colorId!)!),
            specification: row.specificationId
              ? publicRecord(specById.get(row.specificationId)!)
              : null,
          };
        }),
        total,
        dto,
      );
    }
    const items = await Promise.all(
      rows.map(async (row) => {
        const safe = publicRecord(row);
        if (kind === 'models') {
          const brand = await manager.findOneByOrFail(Brand, {
            id: row.brandId,
          });
          const specs = await this.query('specifications', manager, include)
            .andWhere('item.modelId = :modelId', { modelId: row.id })
            .getCount();
          const colors = await this.query('skus', manager, include)
            .select('COUNT(DISTINCT item.colorId)', 'count')
            .andWhere('item.modelId = :modelId', { modelId: row.id })
            .getRawOne<{ count: number }>();
          return {
            ...safe,
            brandName: brand.name,
            specificationCount: specs,
            colorCount: Number(colors?.count ?? 0),
          };
        }
        return safe;
      }),
    );
    return pageResult(items, total, dto);
  }
  async detail(
    kind: 'brands' | 'models',
    id: number,
    dto: CatalogQueryDto,
    permissions: string[],
  ) {
    const include =
      permissions.includes('masterdata.manage') && dto.includeInactive === true;
    const item = publicRecord(await this.one(kind, id, include));
    if (kind === 'brands') return item;
    const query = Object.assign(new CatalogQueryDto(), dto, { modelId: id });
    return {
      ...item,
      specifications: await this.list('specifications', query, permissions),
      skus: await this.list('skus', query, permissions),
    };
  }
  async lookups(dto: CatalogQueryDto) {
    const brands = await this.list('brands', dto, []),
      colors = await this.list('colors', dto, []);
    return {
      brands: {
        ...brands,
        items: await Promise.all(
          brands.items.map(async (b) => ({
            id: b.id,
            name: b.name,
            modelCount: await this.query('models')
              .andWhere('item.brandId = :id', { id: b.id })
              .getCount(),
          })),
        ),
      },
      colors: {
        ...colors,
        items: colors.items.map((c) => ({ id: c.id, name: c.name })),
      },
    };
  }
}
