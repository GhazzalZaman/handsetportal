import { Injectable } from '@nestjs/common';
import { CatalogError } from './catalog.error';
@Injectable()
export class CatalogNormalizer {
  key(value: string): string {
    return value
      .normalize('NFKD')
      .replace(/\p{M}/gu, '')
      .toLowerCase()
      .replace(/[^\p{L}\p{N}]/gu, '');
  }
  clean(value: string, max: number): { name: string; nameKey: string } {
    const name = value
      .replace(/[\p{Cc}\p{Cf}]/gu, '')
      .replace(/\s+/gu, ' ')
      .trim();
    const nameKey = this.key(name);
    if (!nameKey || name.length > max || nameKey.length > 200)
      throw new CatalogError('INVALID_NAME');
    return { name, nameKey };
  }
  similar(a: string, b: string, containment = true): boolean {
    if (a === b) return false;
    if (containment && (a.includes(b) || b.includes(a))) return true;
    if (Math.min(a.length, b.length) <= 4) return false;
    if (Math.abs(a.length - b.length) > 2) return false;
    let previous = Array.from({ length: b.length + 1 }, (_, i) => i);
    for (let i = 1; i <= a.length; i++) {
      const row = [i];
      for (let j = 1; j <= b.length; j++)
        row[j] = Math.min(
          row[j - 1]! + 1,
          previous[j]! + 1,
          previous[j - 1]! + (a[i - 1] === b[j - 1] ? 0 : 1),
        );
      previous = row;
    }
    return previous[b.length]! <= 2;
  }
  specification(input: {
    ramGb?: number | null;
    storageGb?: number | null;
    label?: string;
  }) {
    const ramGb = input.ramGb ?? null,
      storageGb = input.storageGb ?? null;
    if (
      [ramGb, storageGb].some(
        (v) => v !== null && (!Number.isInteger(v) || v <= 0 || v > 2147483647),
      )
    )
      throw new CatalogError('INVALID_SPECIFICATION');
    if ((ramGb === null) !== (storageGb === null))
      throw new CatalogError('RAM_AND_STORAGE_REQUIRED');
    const generated = ramGb === null ? undefined : `${ramGb}GB/${storageGb}GB`;
    if (
      generated &&
      input.label &&
      this.key(input.label) !== this.key(generated)
    )
      throw new CatalogError('SPECIFICATION_LABEL_MISMATCH');
    const normalized = this.clean(generated ?? input.label ?? '', 50);
    return {
      label: normalized.name,
      nameKey: normalized.nameKey,
      ramGb,
      storageGb,
    };
  }
}
