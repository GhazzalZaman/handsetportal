'use client';
import { Dialog } from '../dialog';
import { useEffect, useState } from 'react';
import { catalogApi, choices, RecordView, CatalogErrorView } from './shared';
export function AddHandset({
  onDone,
  onCancel,
}: {
  onDone: () => void;
  onCancel: () => void;
}) {
  const [step, setStep] = useState(0),
    [brands, setBrands] = useState<RecordView[]>([]),
    [colors, setColors] = useState<RecordView[]>([]);
  const [brandId, setBrandId] = useState(''),
    [brandName, setBrandName] = useState(''),
    [model, setModel] = useState('');
  const [specs, setSpecs] = useState([{ ram: '', storage: '' }]),
    [feature, setFeature] = useState(false),
    [colorIds, setColorIds] = useState<number[]>([]),
    [newColors, setNewColors] = useState('');
  const [defaultPrice, setDefaultPrice] = useState('');
  const [prices, setPrices] = useState<Record<string, string>>({});
  const priceKey = (
    spec: { ram: string; storage: string } | null,
    color: string,
  ) => JSON.stringify([spec?.ram ?? '', spec?.storage ?? '', color]);
  const [busy, setBusy] = useState(false),
    [error, setError] = useState<unknown>(null);
  useEffect(() => {
    Promise.all([choices('brands'), choices('colors')])
      .then(([b, c]) => {
        setBrands(b);
        setColors(c);
      })
      .catch(setError);
  }, []);
  const additions = newColors
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const chosen = [
    ...colorIds.map((id) => colors.find((c) => c.id === id)!.name!),
    ...additions,
  ];
  const valid = [
    Boolean(brandId || brandName.trim()),
    Boolean(model.trim()),
    feature ||
      (specs.length > 0 &&
        specs.every(
          (s) =>
            Number.isInteger(Number(s.ram)) &&
            Number(s.ram) > 0 &&
            Number.isInteger(Number(s.storage)) &&
            Number(s.storage) > 0,
        )),
    chosen.length > 0,
    true,
  ][step];
  async function save(confirmDistinct = false) {
    setBusy(true);
    setError(null);
    try {
      await catalogApi('handsets', 'POST', {
        brand: brandId ? { id: Number(brandId) } : { name: brandName },
        model: { name: model },
        specifications: feature
          ? []
          : specs.map((s) => ({
              ramGb: Number(s.ram),
              storageGb: Number(s.storage),
            })),
        colors: [
          ...colorIds.map((id) => ({ id })),
          ...additions.map((name) => ({ name })),
        ],
        variantPrices: (feature ? [null] : specs).flatMap((s, specIndex) =>
          chosen.map((color, colorIndex) => ({
            specificationIndex: s ? specIndex : null,
            colorIndex,
            listPrice:
              (prices[priceKey(s, color)] ?? defaultPrice).trim() || null,
          })),
        ),
        confirmDistinct,
      });
      onDone();
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Dialog title="Add handset" onClose={onCancel} busy={busy}>
      <ol className="stepper" aria-label="Handset setup progress">
        {['Brand', 'Model', 'Specifications', 'Colors', 'Review'].map(
          (name, index) => (
            <li
              key={name}
              aria-current={step === index ? 'step' : undefined}
              className={index < step ? 'complete' : ''}
            >
              {index + 1}. {name}
            </li>
          ),
        )}
      </ol>
      <p>
        Step {step + 1} of 5:{' '}
        {['Brand', 'Model', 'Specifications', 'Colors', 'Review'][step]}
      </p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (busy || !valid) return;
          if (step < 4) setStep(step + 1);
          else void save();
        }}
      >
        {step === 0 ? (
          <>
            <label>
              Existing brand
              <select
                value={brandId}
                onChange={(e) => setBrandId(e.target.value)}
              >
                <option value="">Create a new brand</option>
                {brands.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </label>
            {!brandId ? (
              <label>
                New brand name
                <input
                  required
                  maxLength={50}
                  value={brandName}
                  onChange={(e) => setBrandName(e.target.value)}
                />
              </label>
            ) : null}
          </>
        ) : null}
        {step === 1 ? (
          <label>
            Model name
            <input
              required
              maxLength={100}
              value={model}
              onChange={(e) => setModel(e.target.value)}
            />
          </label>
        ) : null}
        {step === 2 ? (
          <>
            <label>
              <input
                type="checkbox"
                checked={feature}
                onChange={(e) => setFeature(e.target.checked)}
              />{' '}
              Feature phone with no RAM/storage variants
            </label>
            {!feature ? (
              <>
                {specs.map((s, i) => (
                  <div className="catalog-actions" key={i}>
                    <label>
                      RAM (GB)
                      <input
                        type="number"
                        min="1"
                        max="2147483647"
                        required
                        value={s.ram}
                        onChange={(e) =>
                          setSpecs(
                            specs.map((v, j) =>
                              j === i ? { ...v, ram: e.target.value } : v,
                            ),
                          )
                        }
                      />
                    </label>
                    <label>
                      Storage (GB)
                      <input
                        type="number"
                        min="1"
                        max="2147483647"
                        required
                        value={s.storage}
                        onChange={(e) =>
                          setSpecs(
                            specs.map((v, j) =>
                              j === i ? { ...v, storage: e.target.value } : v,
                            ),
                          )
                        }
                      />
                    </label>
                    <button
                      type="button"
                      onClick={() => setSpecs(specs.filter((_, j) => i !== j))}
                    >
                      Remove
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  disabled={specs.length >= 30}
                  onClick={() => setSpecs([...specs, { ram: '', storage: '' }])}
                >
                  Add specification
                </button>
              </>
            ) : null}
          </>
        ) : null}
        {step === 3 ? (
          <>
            <fieldset>
              <legend>Available colors</legend>
              {colors.map((c) => (
                <label key={c.id}>
                  <input
                    type="checkbox"
                    checked={colorIds.includes(c.id)}
                    onChange={(e) =>
                      setColorIds(
                        e.target.checked
                          ? [...colorIds, c.id]
                          : colorIds.filter((id) => id !== c.id),
                      )
                    }
                  />
                  {c.name}
                </label>
              ))}
            </fieldset>
            <label>
              Add new colors (comma-separated)
              <input
                value={newColors}
                onChange={(e) => setNewColors(e.target.value)}
                placeholder="Use an existing color where possible"
              />
            </label>
          </>
        ) : null}
        {step === 4 ? (
          <>
            <h3>
              {brands.find((b) => String(b.id) === brandId)?.name ?? brandName}{' '}
              · {model}
            </h3>
            <p>These variants will become available to all centers.</p>
            <label>
              Default list price (PKR)
              <input
                inputMode="decimal"
                pattern="(?:0|[1-9][0-9]{0,9})(?:[.][0-9]{1,2})?"
                maxLength={13}
                value={defaultPrice}
                onChange={(e) => setDefaultPrice(e.target.value)}
                placeholder="Optional list price for all variants"
              />
            </label>
            <p>
              Set a default, or enter a different list price for any variant
              below. Blank prices will appear as Not set.
            </p>
            <div className="catalog-scroll price-review">
              <table>
                <thead>
                  <tr>
                    <th>Specification</th>
                    <th>Color</th>
                    <th>Price (PKR)</th>
                  </tr>
                </thead>
                <tbody>
                  {(feature ? [null] : specs).flatMap((s, i) =>
                    chosen.map((c, j) => (
                      <tr key={i + '-' + j}>
                        <td>
                          {s
                            ? s.ram + ' GB / ' + s.storage + ' GB'
                            : 'No specification'}
                        </td>
                        <td>{c}</td>
                        <td>
                          <input
                            aria-label={
                              'Price for ' +
                              c +
                              (s
                                ? ' ' +
                                  s.ram +
                                  ' GB RAM / ' +
                                  s.storage +
                                  ' GB storage'
                                : '')
                            }
                            inputMode="decimal"
                            pattern="(?:0|[1-9][0-9]{0,9})(?:[.][0-9]{1,2})?"
                            maxLength={13}
                            value={prices[priceKey(s, c)] ?? defaultPrice}
                            onChange={(e) =>
                              setPrices({
                                ...prices,
                                [priceKey(s, c)]: e.target.value,
                              })
                            }
                            placeholder="Not set"
                          />
                        </td>
                      </tr>
                    )),
                  )}
                </tbody>
              </table>
            </div>
          </>
        ) : null}
        <CatalogErrorView
          error={error}
          onConfirm={busy ? undefined : () => void save(true)}
        />
        <div className="catalog-actions">
          <button type="button" disabled={busy} onClick={onCancel}>
            Cancel
          </button>
          {step > 0 ? (
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                setError(null);
                setStep(step - 1);
              }}
            >
              Back
            </button>
          ) : null}
          <button disabled={busy || !valid}>
            {busy ? 'Saving…' : step === 4 ? 'Create handset' : 'Continue'}
          </button>
        </div>
      </form>
    </Dialog>
  );
}
