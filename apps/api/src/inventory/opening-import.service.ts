import { Injectable } from '@nestjs/common';
import { Readable } from 'node:stream';
import { parse } from 'csv-parse';
import { CsvUpload, csvSafe } from '../catalog/catalog-import.service';
import { CatalogError } from '../catalog/catalog.error';
import { CatalogNormalizer } from '../catalog/catalog-normalizer';
import { CatalogRepository } from '../catalog/catalog.repository';
import { ExperienceCenter, DataImportBatch } from '../database/entities';
import { Principal, AuthEventContext } from '../auth/auth.types';
import { InventoryService } from './inventory.service';
export const openingHeader = [
  'center_code',
  'brand',
  'model',
  'ram_gb',
  'storage_gb',
  'color',
  'quantity',
];
@Injectable()
export class OpeningImportService {
  constructor(
    private readonly stock: InventoryService,
    private readonly catalog: CatalogRepository,
    private readonly normalizer: CatalogNormalizer,
  ) {}
  async run(
    file: CsvUpload | undefined,
    dryRun: boolean,
    actor: Principal,
    context: AuthEventContext,
  ) {
    if (!file) throw new CatalogError('FILE_REQUIRED');
    if (file.size > 2097152 || file.buffer.length > 2097152)
      throw new CatalogError('FILE_TOO_LARGE', 413);
    if (
      !/\.csv$/i.test(file.originalname) ||
      !['text/csv', 'application/csv', 'application/vnd.ms-excel'].includes(
        file.mimetype,
      )
    )
      throw new CatalogError('INVALID_CSV_FILE');
    const inputs: string[][] = [];
    try {
      new TextDecoder('utf-8', { fatal: true }).decode(file.buffer);
      const parser = Readable.from([file.buffer]).pipe(
        parse({ bom: true, skip_empty_lines: true, max_record_size: 65536 }),
      );
      for await (const row of parser) {
        inputs.push(row as string[]);
        if (inputs.length > 1001) {
          parser.destroy();
          throw Error();
        }
      }
      if (
        JSON.stringify(inputs.shift()) !== JSON.stringify(openingHeader) ||
        !inputs.length
      )
        throw Error();
    } catch {
      throw new CatalogError('INVALID_CSV');
    }
    return this.stock.tx.run(
      actor,
      'inventory.import',
      async (manager, scope) => {
        const pairs = new Set<string>();
        const plans: {
          row: number;
          cells: string[];
          status: string;
          reason?: string;
          centerId?: number;
          skuId?: number;
          quantity?: number;
        }[] = [];
        for (const [index, cells] of inputs.entries()) {
          const plan = {
            row: index + 2,
            cells: cells.map(csvSafe),
            status: 'invalid',
          } as (typeof plans)[number];
          plans.push(plan);
          if (
            cells.length !== 7 ||
            !/^\d+$/.test(cells[6]!) ||
            Number(cells[6]) > 1000000
          ) {
            plan.reason = 'Use the template and a quantity from 0 to 1000000.';
            continue;
          }
          const centerQuery = manager
            .getRepository(ExperienceCenter)
            .createQueryBuilder('center')
            .where('center.code=:code AND center.isActive=:active', {
              code: cells[0]!.trim(),
              active: true,
            });
          const center = await scope
            .applyToQuery(centerQuery, 'center.id')
            .getOne();
          if (!center) {
            plan.reason = 'Center unavailable or outside your scope.';
            continue;
          }
          scope.assertCanEditCenter(center.id);
          const query = this.catalog
            .query('skus', manager)
            .andWhere(
              'brand.nameKey=:brand AND model.nameKey=:model AND color.nameKey=:color',
              {
                brand: this.normalizer.key(cells[1]!),
                model: this.normalizer.key(cells[2]!),
                color: this.normalizer.key(cells[5]!),
              },
            );
          if (!cells[3]!.trim() && !cells[4]!.trim())
            query.andWhere('item.specificationId IS NULL');
          else if (
            !/^\d+$/.test(cells[3]!) ||
            !/^\d+$/.test(cells[4]!) ||
            Number(cells[3]) < 1 ||
            Number(cells[4]) < 1 ||
            Number(cells[3]) > 2147483647 ||
            Number(cells[4]) > 2147483647
          ) {
            plan.reason =
              'RAM and storage must both be positive whole numbers, or both blank.';
            continue;
          } else
            query.andWhere('spec.ramGb=:ram AND spec.storageGb=:storage', {
              ram: Number(cells[3]),
              storage: Number(cells[4]),
            });
          const sku = await query.getOne();
          if (!sku) {
            plan.reason =
              'An active matching variant was not found. Create it in the catalog first.';
            continue;
          }
          const key = center.id + ':' + sku.id;
          if (
            pairs.has(key) ||
            (await this.stock
              .movements(manager, scope, center.id, sku.id)
              .getCount())
          ) {
            plan.reason =
              'Opening stock already exists or this pair is repeated in the file.';
            continue;
          }
          pairs.add(key);
          Object.assign(plan, {
            centerId: center.id,
            skuId: sku.id,
            quantity: Number(cells[6]),
            status: dryRun ? 'ready' : 'imported',
          });
        }
        const accepted = plans.filter((p) => p.centerId !== undefined);
        if (!dryRun) {
          const startedAt = new Date();
          for (const plan of accepted)
            await this.stock.changeStock(
              manager,
              scope,
              {
                centerId: plan.centerId!,
                skuId: plan.skuId!,
                delta: plan.quantity!,
                movementType: 'OPENING',
                receivedFrom: 'WAREHOUSE',
                reference: 'Opening-stock CSV',
              },
              context,
            );
          const batch = await manager.save(
            DataImportBatch,
            manager.create(DataImportBatch, {
              sourceSystem: 'APP',
              kind: 'INVENTORY',
              fileName: 'opening-stock.csv',
              status:
                accepted.length === plans.length
                  ? 'SUCCESS'
                  : accepted.length
                    ? 'PARTIAL'
                    : 'FAILED',
              rowsReceived: plans.length,
              rowsAccepted: accepted.length,
              rowsRejected: plans.length - accepted.length,
              triggeredBy: actor.id,
              createdBy: actor.id,
              updatedBy: actor.id,
              // Use the same clock for both values; the SQL default runs later
              // and can otherwise violate finished_at >= started_at.
              startedAt,
              finishedAt: new Date(),
            }),
          );
          await this.stock.audit(
            manager,
            context,
            'DATA_IMPORT_BATCH',
            batch.id,
            'openingStock',
            null,
            { received: plans.length, accepted: accepted.length },
          );
        }
        return {
          dryRun,
          totals: {
            received: plans.length,
            accepted: accepted.length,
            rejected: plans.length - accepted.length,
          },
          rows: plans.map(({ row, cells, status, reason }) => ({
            row,
            cells,
            status,
            reason,
          })),
        };
      },
    );
  }
}
