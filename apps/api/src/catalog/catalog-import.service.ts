import { Injectable } from '@nestjs/common';
import { Readable } from 'node:stream';
import { parse } from 'csv-parse';
import { EntityManager } from 'typeorm';
import { DataImportBatch, AuditLog } from '../database/entities';
import { AuthEventContext, Principal } from '../auth/auth.types';
import { CatalogService } from './catalog.service';
import { CatalogRecord, Kind, target } from './catalog.repository';
import { CatalogError } from './catalog.error';
export function csvSafe(value: string) {
  return /^[\s\p{Cc}]*[=+@-]/u.test(value) ? "'" + value : value;
}
export interface CsvUpload {
  buffer: Buffer;
  originalname: string;
  mimetype: string;
  size: number;
}
interface Input {
  brand: string;
  model: string;
  color: string;
  ramGb: number | null;
  storageGb: number | null;
}
interface RowResult {
  row: number;
  status:
    | 'would create'
    | 'already exists'
    | 'possible duplicate'
    | 'invalid'
    | 'created';
  reason?: string;
  cells: string[];
  input?: Input;
}
@Injectable()
export class CatalogImportService {
  constructor(private readonly catalog: CatalogService) {}
  async parse(file: CsvUpload | undefined): Promise<string[][]> {
    if (
      !file ||
      file.size > 2 * 1024 * 1024 ||
      file.buffer.length > 2 * 1024 * 1024
    )
      throw new CatalogError(
        file ? 'FILE_TOO_LARGE' : 'FILE_REQUIRED',
        file ? 413 : 400,
      );
    if (
      !/\.csv$/i.test(file.originalname) ||
      !['text/csv', 'application/csv', 'application/vnd.ms-excel'].includes(
        file.mimetype,
      )
    )
      throw new CatalogError('INVALID_CSV_FILE');
    try {
      new TextDecoder('utf-8', { fatal: true }).decode(file.buffer);
      const parser = Readable.from([file.buffer]).pipe(
        parse({ bom: true, skip_empty_lines: true, max_record_size: 65536 }),
      );
      const rows: string[][] = [];
      for await (const row of parser) {
        rows.push(row as string[]);
        if (rows.length > 1001) {
          parser.destroy();
          throw Error('Too many rows');
        }
      }
      if (
        JSON.stringify(rows.shift()) !==
          JSON.stringify(['brand', 'model', 'ram_gb', 'storage_gb', 'color']) ||
        !rows.length
      )
        throw Error('Invalid header');
      return rows;
    } catch {
      throw new CatalogError('INVALID_CSV', 400, {
        message:
          'Use the exact template header, valid UTF-8 CSV, and at most 1000 data rows.',
      });
    }
  }
  async plan(manager: EntityManager, rows: string[][]): Promise<RowResult[]> {
    const state = {} as Record<Kind, CatalogRecord[]>;
    for (const kind of [
      'brands',
      'models',
      'colors',
      'specifications',
      'skus',
    ] as Kind[]) {
      const q = manager.getRepository(target(kind)).createQueryBuilder('item');
      if (kind !== 'skus') q.addSelect('item.nameKey');
      state[kind] = await q.getMany();
    }
    let virtual = -1;
    const output: RowResult[] = [];
    for (const [index, cells] of rows.entries()) {
      const staged: { kind: Kind; row: CatalogRecord }[] = [];
      try {
        if (cells.length !== 5) throw new CatalogError('INVALID_COLUMNS');
        const integer = (s: string) =>
          s.trim() === ''
            ? null
            : /^[1-9]\d*$/.test(s.trim())
              ? Number(s)
              : NaN;
        const input: Input = {
          brand: cells[0]!,
          model: cells[1]!,
          ramGb: integer(cells[2]!),
          storageGb: integer(cells[3]!),
          color: cells[4]!,
        };
        const find = (
          kind: Exclude<Kind, 'skus'>,
          name: string,
          parent?: number,
          values: Partial<CatalogRecord> = {},
        ) => {
          const normalized = this.catalog.normalizer.clean(
            name,
            kind === 'brands'
              ? 50
              : kind === 'colors'
                ? 40
                : kind === 'models'
                  ? 100
                  : 50,
          );
          const related = state[kind].filter(
            (r) =>
              parent === undefined ||
              (kind === 'models' ? r.brandId : r.modelId) === parent,
          );
          const exact = related.find((r) => r.nameKey === normalized.nameKey);
          if (exact) {
            if (!exact.isActive) throw new CatalogError('INACTIVE_REFERENCE');
            return exact;
          }
          if (
            related.some((r) =>
              this.catalog.normalizer.similar(normalized.nameKey, r.nameKey!),
            )
          )
            throw new CatalogError('POSSIBLE_DUPLICATE');
          const row = {
            id: virtual--,
            ...normalized,
            ...values,
            isActive: true,
          } as CatalogRecord;
          staged.push({ kind, row });
          return row;
        };
        const brand = find('brands', input.brand),
          model = find('models', input.model, brand.id, { brandId: brand.id }),
          color = find('colors', input.color);
        let spec: CatalogRecord | null = null;
        if (input.ramGb !== null || input.storageGb !== null) {
          const values = this.catalog.normalizer.specification(input);
          spec = find('specifications', values.label, model.id, {
            ...values,
            modelId: model.id,
          });
        }
        const sku = state.skus.find(
          (s) =>
            s.modelId === model.id &&
            s.colorId === color.id &&
            s.specificationId === (spec?.id ?? null),
        );
        if (sku && !sku.isActive) throw new CatalogError('INACTIVE_REFERENCE');
        if (!sku)
          staged.push({
            kind: 'skus',
            row: {
              id: virtual--,
              modelId: model.id,
              colorId: color.id,
              specificationId: spec?.id ?? null,
              isActive: true,
            } as CatalogRecord,
          });
        for (const item of staged) state[item.kind].push(item.row);
        output.push({
          row: index + 2,
          status: staged.length ? 'would create' : 'already exists',
          cells: cells.map(csvSafe),
          input,
        });
      } catch (error) {
        output.push({
          row: index + 2,
          status:
            error instanceof CatalogError && error.code === 'POSSIBLE_DUPLICATE'
              ? 'possible duplicate'
              : 'invalid',
          reason: error instanceof CatalogError ? error.code : 'INVALID_ROW',
          cells: cells.map(csvSafe),
        });
      }
    }
    return output;
  }
  private async applyRow(
    manager: EntityManager,
    input: Input,
    context: AuthEventContext,
  ) {
    const get = async (
      kind: 'brands' | 'models' | 'colors',
      name: string,
      brandId?: number,
    ) => {
      const nameKey = this.catalog.normalizer.key(name);
      const found = await manager.findOneBy(target(kind), {
        nameKey,
        ...(brandId ? { brandId } : {}),
      });
      return (
        found ??
        this.catalog.named(manager, kind, name, context, false, brandId)
      );
    };
    const brand = await get('brands', input.brand),
      model = await get('models', input.model, brand.id),
      color = await get('colors', input.color);
    let specificationId: number | null = null;
    if (input.ramGb !== null) {
      const values = this.catalog.normalizer.specification(input);
      const spec =
        (await manager.findOneBy(target('specifications'), {
          modelId: model.id,
          nameKey: values.nameKey,
        })) ??
        (await this.catalog.specification(manager, model.id, input, context));
      specificationId = spec.id;
    }
    await this.catalog.sku(
      manager,
      model.id,
      { colorId: color.id, specificationId },
      context,
    );
  }
  async run(
    file: CsvUpload | undefined,
    dryRun: boolean,
    actor: Principal,
    context: AuthEventContext,
  ) {
    const rows = await this.parse(file);
    return this.catalog.tx.run(actor, 'masterdata.manage', async (manager) => {
      const results = await this.plan(manager, rows);
      let batchId: string | undefined;
      if (!dryRun) {
        const startedAt = new Date();
        for (const result of results)
          if (result.status === 'would create') {
            await this.applyRow(manager, result.input!, context);
            result.status = 'created';
          }
        const rejected = results.filter((r) =>
          ['invalid', 'possible duplicate'].includes(r.status),
        ).length;
        const batch = await manager.save(DataImportBatch, {
          kind: 'MASTER',
          sourceSystem: 'CATALOG_CSV',
          fileName: 'catalog.csv',
          startedAt,
          finishedAt: new Date(),
          status: rejected ? 'PARTIAL' : 'SUCCESS',
          rowsReceived: results.length,
          rowsAccepted: results.length - rejected,
          rowsRejected: rejected,
          triggeredBy: actor.id,
          createdBy: actor.id,
          updatedBy: actor.id,
        });
        batchId = batch.id;
        await manager.insert(AuditLog, {
          entityType: 'IMPORT_BATCH',
          entityId: batch.id,
          action: 'CREATE',
          fieldName: null,
          oldValue: null,
          newValue: JSON.stringify({
            kind: 'MASTER',
            rowsReceived: results.length,
            rowsAccepted: results.length - rejected,
          }),
          userId: actor.id,
          changedAt: new Date(),
          requestId: context.requestId,
          ipAddress: context.ip,
        });
      }
      return {
        dryRun,
        batchId,
        totals: {
          rows: results.length,
          created: results.filter((r) => r.status === 'created').length,
          wouldCreate: results.filter((r) => r.status === 'would create')
            .length,
          alreadyExists: results.filter((r) => r.status === 'already exists')
            .length,
          possibleDuplicate: results.filter(
            (r) => r.status === 'possible duplicate',
          ).length,
          invalid: results.filter((r) => r.status === 'invalid').length,
        },
        rows: results.map(({ input: _input, ...r }) => {
          void _input;
          return r;
        }),
      };
    });
  }
}
