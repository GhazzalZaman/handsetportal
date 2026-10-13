'use client';
import { AuthRequestError, authFetch } from '../../lib/auth-fetch';
export interface RecordView {
  id: number;
  name?: string;
  label?: string;
  brandId?: number;
  brandName?: string;
  modelName?: string;
  listPrice?: string | null;
  modelId?: number;
  skuCode?: string;
  ramGb?: number | null;
  storageGb?: number | null;
  isActive: boolean;
  rowVersion: number;
  color?: RecordView;
  specification?: RecordView | null;
  specificationCount?: number;
  colorCount?: number;
}
export interface Page<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}
export interface Detail extends RecordView {
  specifications: Page<RecordView>;
  skus: Page<RecordView>;
}
export async function catalogApi<T>(
  path: string,
  method = 'GET',
  body?: unknown,
): Promise<T> {
  const response = await authFetch('/api/v1/catalog/' + path, {
    method,
    ...(body !== undefined
      ? { body: body instanceof FormData ? body : JSON.stringify(body) }
      : {}),
  });
  return response.json() as Promise<T>;
}
export async function choices(path: string, includeInactive = false) {
  const all: RecordView[] = [];
  for (let page = 1; ; page++) {
    const result = await catalogApi<Page<RecordView>>(
      path +
        '?pageSize=100&page=' +
        page +
        '&includeInactive=' +
        includeInactive,
    );
    all.push(...result.items);
    if (all.length >= result.total || !result.items.length) return all;
  }
}
export function CatalogErrorView({
  error,
  onConfirm,
}: {
  error: unknown;
  onConfirm?: () => void;
}) {
  if (!error) return null;
  const code = error instanceof AuthRequestError ? error.code : 'NETWORK_ERROR';
  const details = (
    error instanceof AuthRequestError ? error.details : null
  ) as {
    existing?: RecordView[];
    centers?: { centerId: number; centerName: string; quantity: number }[];
  } | null;
  const messages: Record<string, string> = {
    DUPLICATE: 'This record already exists. Choose the existing item.',
    POSSIBLE_DUPLICATE:
      'Similar records already exist. Review them before continuing.',
    CONFLICT: 'This record changed. Refresh it before saving again.',
    HAS_STOCK:
      'This item cannot be deactivated because stock remains. Listed centers are limited to your access.',
    INVALID_VARIANT_PRICE:
      'Check the prices assigned to the selected variants.',
    INVALID_SPECIFICATION: 'Use positive whole numbers for RAM and storage.',
    RAM_AND_STORAGE_REQUIRED:
      'Enter both RAM and storage, or leave both empty and enter a label.',
    SPECIFICATION_LABEL_MISMATCH:
      'For RAM/storage specifications, leave the label blank to generate it.',
    INVALID_NAME: 'Enter a valid name within the permitted length.',
    INVALID_CSV:
      'The CSV is malformed. Use the template and at most 1000 rows.',
    FILE_TOO_LARGE: 'The maximum file size is 2 MB.',
    REQUEST_ERROR:
      'The request could not be completed. Check required fields and active parent records.',
  };
  return (
    <div role="alert" className="error">
      <p>
        {messages[code] ?? 'Unable to complete the request. Please try again.'}
      </p>
      {details?.existing?.length ? (
        <ul>
          {details.existing.map((r) => (
            <li key={r.id}>
              {r.name ?? r.label}
              {r.isActive ? '' : ' (inactive)'}
            </li>
          ))}
        </ul>
      ) : null}
      {details?.centers?.length ? (
        <ul>
          {details.centers.map((c) => (
            <li key={c.centerId}>
              {c.centerName}: {c.quantity}
            </li>
          ))}
        </ul>
      ) : null}
      {code === 'POSSIBLE_DUPLICATE' && onConfirm ? (
        <button type="button" onClick={onConfirm}>
          Yes, this is different
        </button>
      ) : null}
    </div>
  );
}
export function Pager({
  page,
  total,
  pageSize = 25,
  onPage,
}: {
  page: number;
  total: number;
  pageSize?: number;
  onPage: (p: number) => void;
}) {
  return (
    <div className="catalog-actions">
      <button disabled={page === 1} onClick={() => onPage(page - 1)}>
        Previous
      </button>
      <span>
        Page {page} · {total} records
      </span>
      <button
        disabled={page * pageSize >= total}
        onClick={() => onPage(page + 1)}
      >
        Next
      </button>
    </div>
  );
}
