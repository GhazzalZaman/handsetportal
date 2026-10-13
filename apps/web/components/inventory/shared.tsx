'use client';
import { AuthRequestError, authFetch } from '../../lib/auth-fetch';
export interface Page<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}
export interface StockRow {
  centerId: number;
  centerName: string;
  skuId: number;
  skuCode: string;
  brandName: string;
  modelName: string;
  colorName: string;
  specification: string | null;
  listPrice: string | number | null;
  quantityAvailable: number;
  lowStockThreshold: number;
  status: string;
  lastStockUpdateAt: string | null;
  isActive: boolean | number;
}
export interface SaleRow {
  id: string;
  centerId: number;
  centerName: string;
  skuId: number;
  modelName: string;
  brandName: string;
  colorName: string;
  specification: string | null;
  quantity: number;
  salesType: string;
  soldAt: string;
  recordedBy: number;
  listPriceSnapshot: string | number | null;
  voidedAt: string | null;
  voidReason: string | null;
  selfVoidUntil: string;
  notes: string | null;
}
export interface Center {
  id: number;
  name: string;
}
export async function request<T>(
  path: string,
  method = 'GET',
  body?: unknown,
): Promise<T> {
  return (
    await authFetch('/api/v1/' + path, {
      method,
      ...(body !== undefined
        ? { body: body instanceof FormData ? body : JSON.stringify(body) }
        : {}),
    })
  ).json() as Promise<T>;
}
export async function centers() {
  const items: Center[] = [];
  for (let page = 1; ; page++) {
    const result = await request<Page<Center>>(
      'centers?pageSize=100&page=' + page,
    );
    items.push(...result.items);
    if (items.length >= result.total || !result.items.length) return items;
  }
}
export function errorMessage(error: unknown) {
  if (!(error instanceof AuthRequestError))
    return 'Unable to reach the server. Please try again.';
  const messages: Record<string, string> = {
    INSUFFICIENT_STOCK:
      'There is not enough stock. Availability has been refreshed.',
    NO_CHANGE: 'The counted quantity is unchanged.',
    STOCK_LIMIT: 'This quantity would exceed the stock limit.',
    OPENING_STOCK_EXISTS:
      'This variant already has stock history. Record a receipt instead.',
    SOURCE_CENTER_REQUIRED: 'Choose a different source Experience Center.',
    SOURCE_CENTER_NOT_ALLOWED:
      'Choose a source center only for an Experience Center receipt.',
    ADJUSTMENT_NOTE_REQUIRED: 'Enter a note for an Other adjustment.',
    VOID_FORBIDDEN:
      'The undo window has ended. Ask an authorized manager to void this sale.',
    BACKDATE_FORBIDDEN: 'You do not have permission to backdate sales.',
    BACKDATE_WINDOW:
      'Choose a permitted recent date and enter a backdating reason.',
    INVALID_SALE_TIME: 'The sale time must not be in the future.',
    IDEMPOTENCY_CONFLICT:
      'This submission was already used for a different sale. Check Sales before recording again.',
    DUPLICATE:
      'This request is already recorded. Check Sales before trying again.',
    RECEIVE_STOCK_FIRST: 'Receive opening stock before setting a threshold.',
    INVALID_CSV: 'Use the exact CSV template and no more than 1000 rows.',
    INVALID_DATE_RANGE: 'Choose a valid date range.',
  };
  return (
    messages[error.code] ??
    (error.status === 403
      ? 'You no longer have permission for this action.'
      : error.status === 404
        ? 'This record is unavailable or outside your scope.'
        : error.status === 429
          ? 'Too many updates. Wait a minute and retry.'
          : 'Check the entered values and try again.')
  );
}
export function dateTime(value: string | null) {
  return value
    ? new Intl.DateTimeFormat('en-PK', {
        dateStyle: 'medium',
        timeStyle: 'short',
        timeZone: 'Asia/Karachi',
      }).format(new Date(value))
    : 'Never';
}
