'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Dialog } from '../dialog';
import { Pager } from '../catalog/shared';
import { ProductFilters, emptyFilters } from './product-filters';
import {
  Page,
  SaleRow,
  Center,
  centers,
  request,
  errorMessage,
  dateTime,
} from './shared';
import { formatListPrice } from '../../lib/format-price';
export function SalesBrowser({
  permissions,
  actorId,
}: {
  permissions: string[];
  actorId: number;
}) {
  const [filter, setFilter] = useState(emptyFilters),
    [centerOptions, setCenters] = useState<Center[]>([]),
    [params, setParams] = useState(''),
    [page, setPage] = useState(1),
    [version, setVersion] = useState(0),
    [rows, setRows] = useState<Page<SaleRow>>({
      items: [],
      total: 0,
      page: 1,
      pageSize: 25,
    }),
    [error, setError] = useState(''),
    [notice, setNotice] = useState(''),
    [loading, setLoading] = useState(true),
    [target, setTarget] = useState<SaleRow | null>(null),
    [busy, setBusy] = useState(false),
    [now, setNow] = useState(Date.now());
  useEffect(() => {
    let live = true;
    centers()
      .then((items) => {
        if (live) {
          setCenters(items);
          if (items.length === 1) {
            setFilter({ ...emptyFilters, centerId: String(items[0]!.id) });
            setParams('centerId=' + items[0]!.id);
          }
        }
      })
      .catch((e) => {
        if (live) setError(errorMessage(e));
      });
    return () => {
      live = false;
    };
  }, []);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 10000);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => {
    let live = true;
    setLoading(true);
    request<Page<SaleRow>>('sales?page=' + page + '&' + params)
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
  }, [params, page, version]);
  return (
    <main className="catalog-main">
      <p className="eyebrow">SALES WORKSPACE</p>
      <h1>Recorded sales</h1>
      <p>
        Corrections are made by voiding a sale and recording it again. Voiding
        restores its stock.
      </p>
      <Link className="button" href="/inventory">
        Back to inventory
      </Link>
      {notice && <p role="status">{notice}</p>}
      {error && !target && <p role="alert">{error}</p>}
      <section className="catalog-panel">
        <form
          className="variant-filters"
          onSubmit={(e) => {
            e.preventDefault();
            const data = new FormData(e.currentTarget),
              query = new URLSearchParams();
            for (const [key, value] of Object.entries(filter))
              if (value) query.set(key, value);
            for (const key of ['dateFrom', 'dateTo', 'salesType']) {
              const value = String(data.get(key) ?? '');
              if (value) query.set(key, value);
            }
            query.set('includeVoided', String(data.get('voided') === 'on'));
            setParams(query.toString());
            setPage(1);
            setError('');
          }}
        >
          <ProductFilters
            value={filter}
            onChange={setFilter}
            centerOptions={centerOptions}
          />
          <label>
            From date (PKT)
            <input type="date" name="dateFrom" />
          </label>
          <label>
            To date (PKT)
            <input type="date" name="dateTo" />
          </label>
          <label>
            Sales type
            <select name="salesType">
              <option value="">All types</option>
              <option value="CASH">Cash</option>
              <option value="INSTALLMENT">Installment</option>
              <option value="FNF">FNF</option>
            </select>
          </label>
          <label>
            <input type="checkbox" name="voided" />
            Include voided sales
          </label>
          <button>Apply filters</button>
        </form>
        {loading ? (
          <p role="status">Loading sales...</p>
        ) : (
          <>
            <div className="catalog-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Sale / date (PKT)</th>
                    <th>Center</th>
                    <th>Handset</th>
                    <th>Qty / type</th>
                    <th>List price at sale</th>
                    <th>Status</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.items.map((sale) => (
                    <tr
                      key={sale.id}
                      className={sale.voidedAt ? 'voided-row' : ''}
                    >
                      <td>
                        #{sale.id}
                        <br />
                        <small>{dateTime(sale.soldAt)}</small>
                      </td>
                      <td>{sale.centerName}</td>
                      <td>
                        {sale.brandName} {sale.modelName}
                        <small className="sku-label">
                          {sale.specification ?? 'N/A'} / {sale.colorName}
                        </small>
                      </td>
                      <td>
                        {sale.quantity} / {sale.salesType}
                      </td>
                      <td>{formatListPrice(sale.listPriceSnapshot)}</td>
                      <td>
                        <span
                          className={'badge ' + (sale.voidedAt ? '' : 'active')}
                        >
                          {sale.voidedAt ? 'Voided' : 'Recorded'}
                        </span>
                        {sale.voidedAt && (
                          <small className="sku-label">{sale.voidReason}</small>
                        )}
                      </td>
                      <td>
                        {!sale.voidedAt &&
                          (permissions.includes('sales.void') ||
                            (sale.recordedBy === actorId &&
                              new Date(sale.selfVoidUntil).getTime() >
                                now)) && (
                            <button
                              onClick={() => {
                                setTarget(sale);
                                setError('');
                              }}
                            >
                              Void
                            </button>
                          )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!rows.items.length && (
                <p className="empty-state">No sales match these filters.</p>
              )}
            </div>
            <Pager page={page} total={rows.total} onPage={setPage} />
          </>
        )}
      </section>
      {target && (
        <Dialog
          title={'Void sale #' + target.id}
          onClose={() => setTarget(null)}
          busy={busy}
        >
          <p>
            This restores {target.quantity} handset(s) to {target.centerName}.
          </p>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              if (busy) return;
              const reason = String(
                new FormData(e.currentTarget).get('reason'),
              );
              setBusy(true);
              setError('');
              try {
                await request('sales/' + target.id + '/void', 'POST', {
                  reason,
                });
                setTarget(null);
                setNotice('Sale voided and stock restored.');
                setVersion((v) => v + 1);
              } catch (cause) {
                setError(errorMessage(cause));
              } finally {
                setBusy(false);
              }
            }}
          >
            <label>
              Reason
              <textarea
                name="reason"
                required
                maxLength={500}
                disabled={busy}
              />
            </label>
            {error && <p role="alert">{error}</p>}
            <button disabled={busy}>
              {busy ? 'Voiding...' : 'Void sale and restore stock'}
            </button>
          </form>
        </Dialog>
      )}
    </main>
  );
}
