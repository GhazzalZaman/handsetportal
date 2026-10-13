'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Pager } from '../catalog/shared';
import { StockDialog } from './stock-dialog';
import { OpeningImport } from './opening-import';
import { ProductFilters, emptyFilters, Filters } from './product-filters';
import {
  Page,
  StockRow,
  SaleRow,
  Center,
  centers,
  request,
  errorMessage,
  dateTime,
} from './shared';
import { formatListPrice } from '../../lib/format-price';
export function InventoryBrowser({ permissions }: { permissions: string[] }) {
  const [filter, setFilter] = useState(emptyFilters),
    [query, setQuery] = useState(emptyFilters),
    [status, setStatus] = useState(''),
    [appliedStatus, setAppliedStatus] = useState(''),
    [page, setPage] = useState(1),
    [revision, setRevision] = useState(0);
  const [centerOptions, setCenters] = useState<Center[]>([]),
    [ready, setReady] = useState(false),
    [rows, setRows] = useState<Page<StockRow>>({
      items: [],
      total: 0,
      page: 1,
      pageSize: 25,
    }),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(''),
    [notice, setNotice] = useState('');
  const [editor, setEditor] = useState<{
      kind: 'sale' | 'receipt' | 'adjust' | 'threshold';
      row: StockRow;
    } | null>(null),
    [showImport, setShowImport] = useState(false),
    [undo, setUndo] = useState<SaleRow | null>(null),
    [undoBusy, setUndoBusy] = useState(false);
  useEffect(() => {
    let live = true;
    centers()
      .then((items) => {
        if (live) {
          setCenters(items);
          if (items.length === 1) {
            const f = { ...emptyFilters, centerId: String(items[0]!.id) };
            setFilter(f);
            setQuery(f);
          }
          setReady(true);
        }
      })
      .catch((e) => {
        if (live) {
          setError(errorMessage(e));
          setLoading(false);
        }
      });
    return () => {
      live = false;
    };
  }, []);
  useEffect(() => {
    if (!ready) return;
    let live = true;
    setLoading(true);
    setError('');
    const params = new URLSearchParams({ page: String(page) });
    for (const [key, value] of Object.entries(query))
      if (value) params.set(key, value);
    if (appliedStatus) params.set('stockStatus', appliedStatus);
    request<Page<StockRow>>('inventory?' + params)
      .then((data) => {
        if (live) setRows(data);
      })
      .catch((e) => {
        if (live) {
          setError(errorMessage(e));
          setRows({ items: [], total: 0, page, pageSize: 25 });
        }
      })
      .finally(() => {
        if (live) setLoading(false);
      });
    return () => {
      live = false;
    };
  }, [query, appliedStatus, page, revision, ready]);
  useEffect(() => {
    if (!undo) return;
    const timer = setTimeout(
      () => setUndo(null),
      Math.max(0, new Date(undo.selfVoidUntil).getTime() - Date.now()),
    );
    return () => clearTimeout(timer);
  }, [undo]);
  const refresh = () => setRevision((v) => v + 1);
  const change = (value: Filters) => {
    setFilter(value);
  };
  async function undoSale() {
    if (!undo || undoBusy) return;
    setUndoBusy(true);
    try {
      await request('sales/' + undo.id + '/void', 'POST', {
        reason: 'Undo immediately after recording',
      });
      setUndo(null);
      setNotice('Sale voided. Stock has been restored.');
      refresh();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setUndoBusy(false);
    }
  }
  return (
    <main className="catalog-main">
      <p className="eyebrow">STOCK WORKSPACE</p>
      <h1>Inventory</h1>
      <p>
        Select a center to see every active handset variant, including variants
        with no stock yet.
      </p>
      <div className="catalog-actions">
        <Link className="button" href="/sales">
          View sales
        </Link>
        {permissions.includes('inventory.import') && (
          <button onClick={() => setShowImport(true)}>
            Import opening stock
          </button>
        )}
      </div>
      {notice && (
        <div className="stock-notice" role="status">
          {notice}
          {undo && (
            <button disabled={undoBusy} onClick={() => void undoSale()}>
              Undo sale
            </button>
          )}
        </div>
      )}
      {error && <p role="alert">{error}</p>}
      <section className="catalog-panel">
        <form
          className="variant-filters"
          onSubmit={(e) => {
            e.preventDefault();
            setQuery({ ...filter });
            setAppliedStatus(status);
            setPage(1);
          }}
        >
          <ProductFilters
            value={filter}
            onChange={change}
            centerOptions={centerOptions}
          />
          <label>
            Stock status
            <select value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="">Any status</option>
              <option value="IN_STOCK">In stock</option>
              <option value="LOW">Low stock</option>
              <option value="ZERO">Zero stock</option>
            </select>
          </label>
          <button>Apply filters</button>
        </form>
        {loading ? (
          <p role="status">Loading inventory...</p>
        ) : (
          <>
            <div className="catalog-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Center</th>
                    <th>Brand / model</th>
                    <th>Specification</th>
                    <th>Color</th>
                    <th>List price</th>
                    <th>Qty</th>
                    <th>Status</th>
                    <th>Last updated (PKT)</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.items.map((row) => (
                    <tr key={row.centerId + ':' + row.skuId}>
                      <td>{row.centerName}</td>
                      <td>
                        {row.brandName}
                        <br />
                        <strong>{row.modelName}</strong>
                      </td>
                      <td>{row.specification ?? 'N/A'}</td>
                      <td>{row.colorName}</td>
                      <td className="price-cell">
                        {formatListPrice(row.listPrice)}
                      </td>
                      <td>
                        <strong>{row.quantityAvailable}</strong>
                      </td>
                      <td>
                        <span
                          className={
                            'badge ' +
                            (row.status === 'IN_STOCK'
                              ? 'active'
                              : row.status === 'LOW'
                                ? 'warning'
                                : '')
                          }
                        >
                          {row.status.replaceAll('_', ' ')}
                        </span>
                        {!row.isActive && (
                          <small className="sku-label">Inactive variant</small>
                        )}
                      </td>
                      <td>{dateTime(row.lastStockUpdateAt)}</td>
                      <td>
                        <div className="catalog-actions">
                          {permissions.includes('sales.record') &&
                            !!row.isActive && (
                              <button
                                disabled={row.quantityAvailable < 1}
                                onClick={() => setEditor({ kind: 'sale', row })}
                              >
                                Mark sold
                              </button>
                            )}
                          {permissions.includes('inventory.receive') &&
                            !!row.isActive && (
                              <button
                                onClick={() =>
                                  setEditor({ kind: 'receipt', row })
                                }
                              >
                                Receive
                              </button>
                            )}
                          {permissions.includes('inventory.adjust') && (
                            <>
                              <button
                                disabled={!row.isActive}
                                onClick={() =>
                                  setEditor({ kind: 'adjust', row })
                                }
                              >
                                Adjust
                              </button>
                              <button
                                onClick={() =>
                                  setEditor({ kind: 'threshold', row })
                                }
                              >
                                Threshold
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!rows.items.length && (
                <p className="empty-state">
                  No stock matches these filters. Select an Experience Center to
                  receive a new variant.
                </p>
              )}
            </div>
            <Pager page={page} total={rows.total} onPage={setPage} />
          </>
        )}
      </section>
      {editor && (
        <StockDialog
          {...editor}
          centerOptions={centerOptions}
          canBackdate={permissions.includes('sales.backdate')}
          onClose={() => setEditor(null)}
          onRefresh={refresh}
          onDone={(sale) => {
            setEditor(null);
            setNotice(
              sale ? 'Sale recorded. Stock updated.' : 'Inventory updated.',
            );
            setUndo(sale ?? null);
            refresh();
          }}
        />
      )}
      {showImport && (
        <OpeningImport onClose={() => setShowImport(false)} onDone={refresh} />
      )}
    </main>
  );
}
