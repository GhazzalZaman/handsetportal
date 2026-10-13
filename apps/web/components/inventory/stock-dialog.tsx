'use client';
import { FormEvent, useState } from 'react';
import { Dialog } from '../dialog';
import { AuthRequestError } from '../../lib/auth-fetch';
import { Center, StockRow, SaleRow, request, errorMessage } from './shared';
export function StockDialog({
  kind,
  row,
  centerOptions,
  canBackdate,
  onClose,
  onDone,
  onRefresh,
}: {
  kind: 'sale' | 'receipt' | 'adjust' | 'threshold';
  row: StockRow;
  centerOptions: Center[];
  canBackdate: boolean;
  onClose: () => void;
  onDone: (sale?: SaleRow) => void;
  onRefresh: () => void;
}) {
  const [requestId] = useState(() => crypto.randomUUID());
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [available, setAvailable] = useState(row.quantityAvailable),
    [source, setSource] = useState('WAREHOUSE'),
    [backdate, setBackdate] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError('');
    const data = new FormData(event.currentTarget),
      base = { centerId: row.centerId, skuId: row.skuId };
    try {
      if (kind === 'sale') {
        const soldAt = String(data.get('soldAt') ?? '');
        const sale = await request<SaleRow>('sales', 'POST', {
          ...base,
          quantity: Number(data.get('quantity')),
          salesType: data.get('salesType'),
          notes: String(data.get('note') ?? '') || undefined,
          clientRequestId: requestId,
          ...(backdate
            ? {
                soldAt: new Date(soldAt + ':00+05:00').toISOString(),
                backdateReason: data.get('reason'),
              }
            : {}),
        });
        onDone(sale);
      } else if (kind === 'receipt') {
        await request('inventory/receipts', 'POST', {
          centerId: row.centerId,
          items: [{ skuId: row.skuId, quantity: Number(data.get('quantity')) }],
          receivedFrom: source,
          sourceCenterId:
            source === 'EXPERIENCE_CENTER'
              ? Number(data.get('sourceCenter'))
              : undefined,
          reference: String(data.get('reference') ?? '') || undefined,
          isOpeningStock: data.get('opening') === 'on',
        });
        onDone();
      } else if (kind === 'adjust') {
        await request('inventory/adjustments', 'POST', {
          ...base,
          newQuantity: Number(data.get('quantity')),
          reasonCode: data.get('reason'),
          note: String(data.get('note') ?? '') || undefined,
        });
        onDone();
      } else {
        await request(
          `inventory/${row.centerId}/${row.skuId}/threshold`,
          'PATCH',
          {
            lowStockThreshold:
              data.get('quantity') === '' ? null : Number(data.get('quantity')),
          },
        );
        onDone();
      }
    } catch (cause) {
      setError(errorMessage(cause));
      if (
        cause instanceof AuthRequestError &&
        cause.code === 'INSUFFICIENT_STOCK'
      ) {
        setAvailable(
          Number((cause.details as { available?: number })?.available ?? 0),
        );
        onRefresh();
      }
    } finally {
      setBusy(false);
    }
  }
  return (
    <Dialog
      title={
        {
          sale: 'Mark handset sold',
          receipt: 'Receive stock',
          adjust: 'Adjust stock count',
          threshold: 'Low-stock threshold',
        }[kind]
      }
      onClose={onClose}
      busy={busy}
    >
      <p>
        {row.centerName} / {row.modelName} /{' '}
        {row.specification ?? 'No specification'} / {row.colorName}
      </p>
      <form onSubmit={submit}>
        <fieldset disabled={busy} className="admin-controls">
          <p>
            Available: <strong>{available}</strong>
          </p>
          <label>
            {kind === 'adjust'
              ? 'Correct counted quantity'
              : kind === 'threshold'
                ? 'Alert at or below (blank uses default)'
                : 'Quantity'}
            <input
              name="quantity"
              type="number"
              required={kind !== 'threshold'}
              min={kind === 'adjust' || kind === 'threshold' ? 0 : 1}
              max={
                kind === 'sale'
                  ? Math.min(50, available)
                  : kind === 'receipt'
                    ? 1000000
                    : 2147483647
              }
              defaultValue={
                kind === 'adjust'
                  ? available
                  : kind === 'threshold'
                    ? row.lowStockThreshold
                    : 1
              }
            />
          </label>
          {kind === 'sale' && (
            <>
              <label>
                Sales type
                <select name="salesType" required defaultValue="">
                  <option value="" disabled>
                    Select sales type
                  </option>
                  <option value="CASH">Cash</option>
                  <option value="INSTALLMENT">Installment</option>
                  <option value="FNF">FNF</option>
                </select>
              </label>
              <label>
                Note (optional)
                <textarea name="note" maxLength={1000} />
              </label>
              {canBackdate && (
                <>
                  <label>
                    <input
                      type="checkbox"
                      checked={backdate}
                      onChange={(e) => setBackdate(e.target.checked)}
                    />
                    Record an earlier sale time
                  </label>
                  {backdate && (
                    <>
                      <label>
                        Sale time (Pakistan time)
                        <input name="soldAt" type="datetime-local" required />
                      </label>
                      <label>
                        Backdating reason
                        <input name="reason" required maxLength={500} />
                      </label>
                    </>
                  )}
                </>
              )}
            </>
          )}
          {kind === 'receipt' && (
            <>
              <label>
                Received from
                <select
                  value={source}
                  onChange={(e) => setSource(e.target.value)}
                >
                  <option value="WAREHOUSE">Warehouse</option>
                  <option value="EXPERIENCE_CENTER">Experience Center</option>
                </select>
              </label>
              {source === 'EXPERIENCE_CENTER' && (
                <>
                  <label>
                    Source center
                    <select name="sourceCenter" required defaultValue="">
                      <option value="">Select source center</option>
                      {centerOptions
                        .filter((c) => c.id !== row.centerId)
                        .map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                          </option>
                        ))}
                    </select>
                  </label>
                  <p>
                    This records a receipt only; stock is not deducted from the
                    source center.
                  </p>
                </>
              )}
              <label>
                Reference (optional)
                <input name="reference" maxLength={160} />
              </label>
              <label>
                <input name="opening" type="checkbox" />
                Opening stock (only before any movements)
              </label>
            </>
          )}
          {kind === 'adjust' && (
            <>
              <label>
                Reason
                <select name="reason" required defaultValue="">
                  <option value="" disabled>
                    Select reason
                  </option>
                  {[
                    'COUNT_CORRECTION',
                    'DAMAGED',
                    'LOST',
                    'FOUND',
                    'DATA_ENTRY_ERROR',
                    'OTHER',
                  ].map((reason) => (
                    <option key={reason} value={reason}>
                      {reason.replaceAll('_', ' ')}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Note (required for Other)
                <textarea name="note" maxLength={1000} />
              </label>
            </>
          )}
          {error && <p role="alert">{error}</p>}
          <div className="catalog-actions">
            <button
              type="submit"
              disabled={busy || (kind === 'sale' && available < 1)}
            >
              {busy ? 'Saving...' : kind === 'sale' ? 'Record sale' : 'Save'}
            </button>
            <button type="button" onClick={onClose}>
              Cancel
            </button>
          </div>
        </fieldset>
      </form>
    </Dialog>
  );
}
