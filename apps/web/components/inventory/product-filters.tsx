'use client';
import { useEffect, useState } from 'react';
import { choices, RecordView } from '../catalog/shared';
import { Center, errorMessage } from './shared';
export interface Filters {
  centerId: string;
  brandId: string;
  modelId: string;
  colorId: string;
  specificationId: string;
  search: string;
}
export const emptyFilters: Filters = {
  centerId: '',
  brandId: '',
  modelId: '',
  colorId: '',
  specificationId: '',
  search: '',
};
export function ProductFilters({
  value,
  onChange,
  centerOptions,
}: {
  value: Filters;
  onChange: (value: Filters) => void;
  centerOptions: Center[];
}) {
  const [brands, setBrands] = useState<RecordView[]>([]),
    [models, setModels] = useState<RecordView[]>([]),
    [colors, setColors] = useState<RecordView[]>([]),
    [specs, setSpecs] = useState<RecordView[]>([]),
    [error, setError] = useState('');
  useEffect(() => {
    let live = true;
    Promise.all([
      choices('brands'),
      choices('models'),
      choices('colors'),
      choices('specifications'),
    ])
      .then(([b, m, c, s]) => {
        if (live) {
          setBrands(b);
          setModels(m);
          setColors(c);
          setSpecs(s);
        }
      })
      .catch((e) => {
        if (live) setError(errorMessage(e));
      });
    return () => {
      live = false;
    };
  }, []);
  return (
    <>
      <label>
        Experience Center
        <select
          value={value.centerId}
          onChange={(e) => onChange({ ...value, centerId: e.target.value })}
        >
          <option value="">All assigned centers</option>
          {centerOptions.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </label>
      <label>
        Brand
        <select
          value={value.brandId}
          onChange={(e) =>
            onChange({
              ...value,
              brandId: e.target.value,
              modelId: '',
              specificationId: '',
            })
          }
        >
          <option value="">All brands</option>
          {brands.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </select>
      </label>
      <label>
        Model
        <select
          value={value.modelId}
          onChange={(e) =>
            onChange({ ...value, modelId: e.target.value, specificationId: '' })
          }
        >
          <option value="">All models</option>
          {models
            .filter(
              (m) => !value.brandId || m.brandId === Number(value.brandId),
            )
            .map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
        </select>
      </label>
      <label>
        Color
        <select
          value={value.colorId}
          onChange={(e) => onChange({ ...value, colorId: e.target.value })}
        >
          <option value="">All colors</option>
          {colors.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </label>
      <label>
        Specification
        <select
          value={value.specificationId}
          onChange={(e) =>
            onChange({ ...value, specificationId: e.target.value })
          }
        >
          <option value="">All specifications</option>
          {specs
            .filter(
              (s) => !value.modelId || s.modelId === Number(value.modelId),
            )
            .map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
                {!value.modelId
                  ? ' / ' + (models.find((m) => m.id === s.modelId)?.name ?? '')
                  : ''}
              </option>
            ))}
        </select>
      </label>
      <label>
        Search model or SKU
        <input
          value={value.search}
          maxLength={100}
          onChange={(e) => onChange({ ...value, search: e.target.value })}
        />
      </label>
      {error && <p role="alert">{error}</p>}
    </>
  );
}
