'use client';
import { formatListPrice } from '../../lib/format-price';
import { Dialog } from '../dialog';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AddHandset } from './add-handset';
import { CatalogImport } from './import';
import {
  catalogApi,
  choices,
  RecordView,
  Page,
  Detail,
  CatalogErrorView,
  Pager,
} from './shared';
type Kind = 'brands' | 'models' | 'colors' | 'specifications' | 'skus';
export function CatalogBrowser({ permissions }: { permissions: string[] }) {
  const create = permissions.includes('masterdata.create'),
    manage = permissions.includes('masterdata.manage');
  const [kind, setKind] = useState<'skus' | 'brands' | 'models' | 'colors'>(
      'skus',
    ),
    [brand, setBrand] = useState<RecordView | null>(null),
    [search, setSearch] = useState(''),
    [query, setQuery] = useState(''),
    [inactive, setInactive] = useState(false),
    [page, setPage] = useState(1);
  const [rows, setRows] = useState<Page<RecordView>>({
      items: [],
      total: 0,
      page: 1,
      pageSize: 25,
    }),
    [selected, setSelected] = useState<number | null>(null),
    [detail, setDetail] = useState<Detail | null>(null),
    [detailPage, setDetailPage] = useState(1);
  const [add, setAdd] = useState(false),
    [showImport, setShowImport] = useState(false),
    [error, setError] = useState<unknown>(null),
    [busy, setBusy] = useState(false),
    [revision, setRevision] = useState(0);
  const [edit, setEdit] = useState<{ kind: Kind; row: RecordView } | null>(
      null,
    ),
    [editName, setEditName] = useState(''),
    [ram, setRam] = useState(''),
    [storage, setStorage] = useState('');
  const [variant, setVariant] = useState(false),
    [colorOptions, setColorOptions] = useState<RecordView[]>([]),
    [specOptions, setSpecOptions] = useState<RecordView[]>([]),
    [colorId, setColorId] = useState(''),
    [specId, setSpecId] = useState('');
  const [brands, setBrands] = useState<RecordView[]>([]);
  const [filterColors, setFilterColors] = useState<RecordView[]>([]);
  const [filterSpecs, setFilterSpecs] = useState<RecordView[]>([]);
  const [filters, setFilters] = useState({
    colorId: '',
    ramGb: '',
    storageGb: '',
  });
  const [priceEditor, setPriceEditor] = useState<RecordView | null>(null);
  const [listPrice, setPrice] = useState('');
  const [variantPrice, setVariantPrice] = useState('');
  const filterChanged = (field: keyof typeof filters, value: string) => {
    setFilters((old) => ({ ...old, [field]: value }));
    setPage(1);
    setSelected(null);
    setDetail(null);
  };
  async function savePrice() {
    if (!priceEditor) return;
    setBusy(true);
    setError(null);
    try {
      await catalogApi('skus/' + priceEditor.id + '/list-price', 'PATCH', {
        listPrice: listPrice.trim() || null,
        rowVersion: priceEditor.rowVersion,
      });
      setPriceEditor(null);
      setNotice('Price saved.');
      refresh();
    } catch (cause) {
      setError(cause);
    } finally {
      setBusy(false);
    }
  }
  const [newSpec, setNewSpec] = useState(false);
  const detailRef = useRef<HTMLElement>(null);
  useEffect(() => {
    if (detail) detailRef.current?.scrollIntoView({ block: 'start' });
  }, [detail]);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState('');
  const refresh = useCallback(() => setRevision((v) => v + 1), []);
  useEffect(() => {
    let alive = true;
    Promise.all([
      choices('brands', inactive),
      choices('colors', inactive),
      choices('specifications', inactive),
    ])
      .then(([b, c, specs]) => {
        if (alive) {
          setBrands(b);
          setFilterColors(c);
          setFilterSpecs(specs);
        }
      })
      .catch((cause) => {
        if (alive) setError(cause);
      });
    return () => {
      alive = false;
    };
  }, [revision, inactive]);
  useEffect(() => {
    let alive = true;
    setLoading(true);
    const params = new URLSearchParams({
      search: query,
      page: String(page),
      includeInactive: String(inactive),
    });
    if (brand && (kind === 'models' || kind === 'skus'))
      params.set('brandId', String(brand.id));
    if (kind === 'skus')
      for (const [key, value] of Object.entries(filters)) {
        if (value) params.set(key, value);
      }
    catalogApi<Page<RecordView>>(kind + '?' + params)
      .then((r) => {
        if (alive) {
          setRows(r);
          setLoading(false);
        }
      })
      .catch((e) => {
        if (alive) {
          setError(e);
          setLoading(false);
        }
      });
    return () => {
      alive = false;
    };
  }, [kind, brand, query, page, inactive, revision, filters]);
  useEffect(() => {
    let alive = true;
    if (selected !== null)
      catalogApi<Detail>(
        'models/' +
          selected +
          '?page=' +
          detailPage +
          '&includeInactive=' +
          inactive,
      )
        .then((r) => {
          if (alive) setDetail(r);
        })
        .catch((e) => {
          if (alive) setError(e);
        });
    return () => {
      alive = false;
    };
  }, [selected, detailPage, inactive, revision]);
  function startEdit(k: Kind, row: RecordView) {
    setEdit({ kind: k, row });
    setEditName(row.name ?? row.label ?? '');
    setRam(String(row.ramGb ?? ''));
    setStorage(String(row.storageGb ?? ''));
    setError(null);
  }
  async function saveEdit(confirmDistinct = false) {
    if (!edit) return;
    setBusy(true);
    setError(null);
    try {
      await catalogApi(
        edit.kind + '/' + edit.row.id,
        'PATCH',
        edit.kind === 'specifications'
          ? {
              ramGb: ram ? Number(ram) : null,
              storageGb: storage ? Number(storage) : null,
              label: ram || storage ? undefined : editName,
              rowVersion: edit.row.rowVersion,
              confirmDistinct,
            }
          : {
              name: editName,
              rowVersion: edit.row.rowVersion,
              confirmDistinct,
            },
      );
      setEdit(null);
      refresh();
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }
  async function status(k: Kind, row: RecordView) {
    setBusy(true);
    setError(null);
    try {
      await catalogApi(
        k + '/' + row.id + '/' + (row.isActive ? 'deactivate' : 'activate'),
        'POST',
        { rowVersion: row.rowVersion },
      );
      refresh();
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }
  function actions(k: Kind, row: RecordView) {
    return manage ? (
      <div className="catalog-actions">
        {k === 'skus' ? (
          <button
            disabled={busy}
            onClick={() => {
              setPriceEditor(row);
              setPrice(row.listPrice ?? '');
              setError(null);
            }}
          >
            Edit list price
          </button>
        ) : null}
        {k !== 'skus' ? (
          <button disabled={busy} onClick={() => startEdit(k, row)}>
            Edit
          </button>
        ) : null}
        <button disabled={busy} onClick={() => void status(k, row)}>
          {row.isActive ? 'Deactivate' : 'Activate'}
        </button>
      </div>
    ) : null;
  }
  async function openVariant() {
    if (!selected) return;
    setError(null);
    try {
      const all: RecordView[] = [];
      for (let p = 1; ; p++) {
        const d = await catalogApi<Detail>(
          'models/' + selected + '?pageSize=100&page=' + p,
        );
        all.push(...d.specifications.items);
        if (all.length >= d.specifications.total) break;
      }
      setSpecOptions(all);
      setColorOptions(await choices('colors'));
      setVariantPrice('');
      setColorId('');
      setSpecId('');
      setVariant(true);
    } catch (e) {
      setError(e);
    }
  }
  async function saveVariant() {
    if (!selected) return;
    setBusy(true);
    setError(null);
    try {
      await catalogApi('models/' + selected + '/skus', 'POST', {
        colorId: Number(colorId),
        specificationId: specId ? Number(specId) : null,
        listPrice: variantPrice.trim() || null,
      });
      setVariant(false);
      refresh();
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }
  async function saveSpec(confirmDistinct = false) {
    if (!selected) return;
    setBusy(true);
    setError(null);
    try {
      await catalogApi('models/' + selected + '/specifications', 'POST', {
        ramGb: ram ? Number(ram) : null,
        storageGb: storage ? Number(storage) : null,
        label: ram || storage ? undefined : editName,
        confirmDistinct,
      });
      setNewSpec(false);
      refresh();
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="catalog-main">
      <p className="eyebrow">PRODUCT WORKSPACE</p>
      <h1>Handset catalog</h1>
      <p>
        Browse every handset variant in one place. Filter by brand, color, RAM,
        or storage to find the right handset.
      </p>
      <div className="catalog-actions">
        {create ? (
          <button className="button-primary" onClick={() => setAdd(true)}>
            + Add handset
          </button>
        ) : null}
        {manage ? (
          <button onClick={() => setShowImport(!showImport)}>
            {showImport ? 'Close import' : 'Import CSV'}
          </button>
        ) : null}
        {manage && (
          <button
            onClick={() => {
              setKind(kind === 'skus' ? 'brands' : 'skus');
              setBrand(null);
              setPage(1);
              setQuery('');
              setSearch('');
              setDetail(null);
              setSelected(null);
            }}
          >
            {kind === 'skus'
              ? 'Manage catalog records'
              : 'Back to all handsets'}
          </button>
        )}
      </div>
      {notice && <p role="status">{notice}</p>}
      {add ? (
        <AddHandset
          onCancel={() => setAdd(false)}
          onDone={() => {
            setAdd(false);
            setNotice('Handset created. You can now find it in the catalog.');
            refresh();
          }}
        />
      ) : null}
      {showImport && manage ? <CatalogImport onDone={refresh} /> : null}
      <section className="catalog-panel">
        {kind !== 'skus' && (
          <div
            className="catalog-actions catalog-tabs"
            aria-label="Catalog categories"
          >
            {(['brands', 'models', 'colors'] as const).map((k) => (
              <button
                key={k}
                aria-pressed={kind === k}
                onClick={() => {
                  setKind(k);
                  setBrand(null);
                  setPage(1);
                  setSelected(null);
                  setDetail(null);
                }}
              >
                {k[0]!.toUpperCase() + k.slice(1)}
              </button>
            ))}
          </div>
        )}
        <form
          className="variant-filters"
          onSubmit={(e) => {
            e.preventDefault();
            setQuery(search);
            setPage(1);
          }}
        >
          {(kind === 'skus' || kind === 'models') && (
            <label>
              Brand
              <select
                value={brand?.id ?? ''}
                onChange={(event) => {
                  setBrand(
                    brands.find((b) => String(b.id) === event.target.value) ??
                      null,
                  );
                  setPage(1);
                  setSelected(null);
                  setDetail(null);
                }}
              >
                <option value="">All brands</option>
                {brands.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </label>
          )}
          {kind === 'skus' && (
            <>
              <label>
                Color
                <select
                  value={filters.colorId}
                  onChange={(e) => filterChanged('colorId', e.target.value)}
                >
                  <option value="">All colors</option>
                  {filterColors.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                RAM
                <select
                  value={filters.ramGb}
                  onChange={(e) => filterChanged('ramGb', e.target.value)}
                >
                  <option value="">All RAM sizes</option>
                  {[
                    ...new Set(
                      filterSpecs
                        .map((s) => s.ramGb)
                        .filter((n): n is number => n != null),
                    ),
                  ]
                    .sort((a, b) => a - b)
                    .map((n) => (
                      <option key={n} value={n}>
                        {n} GB
                      </option>
                    ))}
                </select>
              </label>
              <label>
                Storage
                <select
                  value={filters.storageGb}
                  onChange={(e) => filterChanged('storageGb', e.target.value)}
                >
                  <option value="">All storage sizes</option>
                  {[
                    ...new Set(
                      filterSpecs
                        .map((s) => s.storageGb)
                        .filter((n): n is number => n != null),
                    ),
                  ]
                    .sort((a, b) => a - b)
                    .map((n) => (
                      <option key={n} value={n}>
                        {n} GB
                      </option>
                    ))}
                </select>
              </label>
            </>
          )}
          <label>
            Search {kind === 'skus' ? 'model or SKU' : kind}
            <input
              placeholder="Type a name or SKU prefix"
              value={search}
              maxLength={100}
              onChange={(e) => setSearch(e.target.value)}
            />
          </label>
          <button>Search</button>
          <button
            type="button"
            onClick={() => {
              setBrand(null);
              setFilters({ colorId: '', ramGb: '', storageGb: '' });
              setSearch('');
              setQuery('');
              setInactive(false);
              setPage(1);
              setSelected(null);
              setDetail(null);
            }}
          >
            Clear filters
          </button>
          {manage ? (
            <label>
              <input
                type="checkbox"
                checked={inactive}
                onChange={(e) => {
                  setInactive(e.target.checked);
                  setPage(1);
                }}
              />
              Include inactive
            </label>
          ) : null}
        </form>
        {brand && kind !== 'skus' ? (
          <p>
            Brand: {brand.name}{' '}
            <button
              onClick={() => {
                setBrand(null);
                setPage(1);
              }}
            >
              All brands
            </button>
          </p>
        ) : null}
        <p className="catalog-hint">
          {kind === 'skus'
            ? `${rows.total} variants. Select a handset to view its specifications and manage variants.`
            : kind === 'brands'
              ? 'Select a brand to explore its models.'
              : kind === 'models'
                ? 'Select a model to view specifications and color variants.'
                : 'Shared colors available when adding handsets.'}
        </p>
        {loading ? (
          <p role="status">Loading {kind === 'skus' ? 'handsets' : kind}...</p>
        ) : (
          <div className="catalog-scroll">
            <table>
              <thead>
                <tr>
                  <th>{kind === 'skus' ? 'Handset' : 'Name'}</th>
                  {kind === 'skus' && (
                    <>
                      <th>Brand</th>
                      <th>RAM</th>
                      <th>Storage</th>
                      <th>Color</th>
                      <th className="price-cell">List price (PKR)</th>
                    </>
                  )}
                  {kind === 'models' ? (
                    <>
                      <th>Brand</th>
                      <th>Specs / colors</th>
                    </>
                  ) : null}
                  <th>Status</th>
                  {manage && <th>Actions</th>}
                </tr>
              </thead>
              <tbody>
                {rows.items.map((row) => (
                  <tr key={row.id}>
                    <td>
                      {kind === 'skus' ? (
                        <>
                          <button
                            onClick={() => {
                              setDetail(null);
                              setSelected(row.modelId!);
                              setDetailPage(1);
                            }}
                          >
                            {row.modelName}
                          </button>
                          <small className="sku-label">{row.skuCode}</small>
                        </>
                      ) : kind === 'brands' ? (
                        <button
                          onClick={() => {
                            setBrand(row);
                            setKind('models');
                            setPage(1);
                            setQuery('');
                            setSearch('');
                          }}
                        >
                          {row.name}
                        </button>
                      ) : kind === 'models' ? (
                        <button
                          onClick={() => {
                            setDetail(null);
                            setSelected(row.id);
                            setDetailPage(1);
                          }}
                        >
                          {row.name}
                        </button>
                      ) : (
                        row.name
                      )}
                    </td>
                    {kind === 'skus' && (
                      <>
                        <td>{row.brandName}</td>
                        <td>
                          {row.specification?.ramGb
                            ? row.specification.ramGb + ' GB'
                            : 'N/A'}
                        </td>
                        <td>
                          {row.specification?.storageGb
                            ? row.specification.storageGb + ' GB'
                            : 'N/A'}
                        </td>
                        <td>{row.color?.name}</td>
                        <td className="price-cell">
                          {row.listPrice == null ? (
                            <span className="unset-price">Not set</span>
                          ) : (
                            formatListPrice(row.listPrice)
                          )}
                        </td>
                      </>
                    )}
                    {kind === 'models' ? (
                      <>
                        <td>{row.brandName}</td>
                        <td>
                          {row.specificationCount} / {row.colorCount}
                        </td>
                      </>
                    ) : null}
                    <td>
                      <span className={row.isActive ? 'badge active' : 'badge'}>
                        {row.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    {manage && <td>{actions(kind, row)}</td>}
                  </tr>
                ))}
              </tbody>
            </table>
            {rows.items.length === 0 ? (
              <p className="empty-state">
                No {kind === 'skus' ? 'handset variants' : kind} found. Try
                another search or change your filters.
              </p>
            ) : null}
          </div>
        )}
        <Pager page={page} total={rows.total} onPage={setPage} />
      </section>
      {detail && selected ? (
        <section ref={detailRef} className="catalog-panel">
          <div className="catalog-actions">
            <h2>{detail.name}</h2>
            <button
              onClick={() => {
                setSelected(null);
                setDetail(null);
              }}
            >
              Close model
            </button>
            {create && detail.isActive ? (
              <>
                <button onClick={() => void openVariant()}>
                  Add color/spec variant
                </button>
                <button
                  onClick={() => {
                    setRam('');
                    setStorage('');
                    setEditName('');
                    setError(null);
                    setNewSpec(true);
                  }}
                >
                  Add specification
                </button>
              </>
            ) : null}
          </div>
          <h3>Specifications</h3>
          <ul>
            {detail.specifications.items.map((s) => (
              <li key={s.id}>
                {s.label} · {s.isActive ? 'Active' : 'Inactive'}
                {actions('specifications', s)}
              </li>
            ))}
          </ul>
          <h3>Variants</h3>
          <div className="catalog-scroll">
            <table>
              <thead>
                <tr>
                  <th>SKU</th>
                  <th>Specification</th>
                  <th>Color</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {detail.skus.items.map((s) => (
                  <tr key={s.id}>
                    <td>{s.skuCode}</td>
                    <td>{s.specification?.label ?? 'None'}</td>
                    <td>{s.color?.name}</td>
                    <td>
                      <span className={s.isActive ? 'badge active' : 'badge'}>
                        {s.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td>{actions('skus', s)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pager
            page={detailPage}
            total={Math.max(detail.specifications.total, detail.skus.total)}
            onPage={setDetailPage}
          />
        </section>
      ) : null}
      {priceEditor && (
        <Dialog
          title="Edit list price"
          onClose={() => setPriceEditor(null)}
          busy={busy}
        >
          <p>
            {priceEditor.modelName ?? priceEditor.skuCode} /{' '}
            {priceEditor.color?.name} /{' '}
            {priceEditor.specification?.label ?? 'No specification'}
          </p>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void savePrice();
            }}
          >
            <label>
              Price (PKR)
              <input
                inputMode="decimal"
                pattern="(?:0|[1-9][0-9]{0,9})(?:[.][0-9]{1,2})?"
                maxLength={13}
                value={listPrice}
                onChange={(e) => setPrice(e.target.value)}
                placeholder="e.g. 54999.00"
                disabled={busy}
              />
            </label>
            <p>Leave blank if the list price is not set.</p>
            <button disabled={busy}>
              {busy ? 'Saving...' : 'Save list price'}
            </button>
          </form>
          <CatalogErrorView error={error} />
        </Dialog>
      )}
      {edit ? (
        <Dialog
          title={`Edit ${edit.row.name ?? edit.row.label}`}
          onClose={() => setEdit(null)}
          busy={busy}
        >
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void saveEdit();
            }}
          >
            {edit.kind === 'specifications' ? (
              <>
                <label>
                  RAM (GB)
                  <input
                    type="number"
                    min="1"
                    value={ram}
                    onChange={(e) => setRam(e.target.value)}
                  />
                </label>
                <label>
                  Storage (GB)
                  <input
                    type="number"
                    min="1"
                    value={storage}
                    onChange={(e) => setStorage(e.target.value)}
                  />
                </label>
              </>
            ) : null}
            {edit.kind !== 'specifications' || (!ram && !storage) ? (
              <label>
                {edit.kind === 'specifications' ? 'Label' : 'Name'}
                <input
                  required
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                />
              </label>
            ) : null}
            <button disabled={busy}>Save</button>
            <button type="button" disabled={busy} onClick={() => setEdit(null)}>
              Cancel
            </button>
          </form>
          <CatalogErrorView
            error={error}
            onConfirm={!create || busy ? undefined : () => void saveEdit(true)}
          />
        </Dialog>
      ) : null}
      {variant ? (
        <Dialog
          title={'Add variant'}
          onClose={() => setVariant(false)}
          busy={busy}
        >
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void saveVariant();
            }}
          >
            <label>
              Specification
              <select
                value={specId}
                onChange={(e) => setSpecId(e.target.value)}
              >
                <option value="">No specification</option>
                {specOptions.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Color
              <select
                required
                value={colorId}
                onChange={(e) => setColorId(e.target.value)}
              >
                <option value="">Select color</option>
                {colorOptions.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              List price (PKR)
              <input
                inputMode="decimal"
                pattern="(?:0|[1-9][0-9]{0,9})(?:[.][0-9]{1,2})?"
                maxLength={13}
                value={variantPrice}
                onChange={(e) => setVariantPrice(e.target.value)}
                placeholder="Optional"
              />
            </label>
            <button disabled={busy}>Add variant</button>
            <button
              type="button"
              disabled={busy}
              onClick={() => setVariant(false)}
            >
              Cancel
            </button>
          </form>
          <CatalogErrorView error={error} onConfirm={undefined} />
        </Dialog>
      ) : null}
      {newSpec ? (
        <Dialog
          title={'Add specification'}
          onClose={() => setNewSpec(false)}
          busy={busy}
        >
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void saveSpec();
            }}
          >
            <label>
              RAM (GB)
              <input
                type="number"
                min="1"
                value={ram}
                onChange={(e) => setRam(e.target.value)}
              />
            </label>
            <label>
              Storage (GB)
              <input
                type="number"
                min="1"
                value={storage}
                onChange={(e) => setStorage(e.target.value)}
              />
            </label>
            {!ram && !storage ? (
              <label>
                Feature-phone label
                <input
                  required
                  maxLength={50}
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                />
              </label>
            ) : null}
            <button disabled={busy}>Add specification</button>
            <button
              type="button"
              disabled={busy}
              onClick={() => setNewSpec(false)}
            >
              Cancel
            </button>
          </form>
          <CatalogErrorView
            error={error}
            onConfirm={!create || busy ? undefined : () => void saveSpec(true)}
          />
        </Dialog>
      ) : null}
      <CatalogErrorView
        error={edit || variant || newSpec || priceEditor ? null : error}
        onConfirm={
          !create || busy
            ? undefined
            : edit
              ? () => void saveEdit(true)
              : newSpec
                ? () => void saveSpec(true)
                : undefined
        }
      />
    </main>
  );
}
