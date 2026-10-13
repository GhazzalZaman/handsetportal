'use client';
import { useState } from 'react';
import { catalogApi, CatalogErrorView } from './shared';
interface Result {
  dryRun: boolean;
  totals: Record<string, number>;
  rows: { row: number; status: string; reason?: string; cells: string[] }[];
}
export function CatalogImport({ onDone }: { onDone: () => void }) {
  const [file, setFile] = useState<File | null>(null),
    [result, setResult] = useState<Result | null>(null),
    [error, setError] = useState<unknown>(null),
    [busy, setBusy] = useState(false);
  async function run(dryRun: boolean) {
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      const body = new FormData();
      body.append('file', file);
      setResult(
        await catalogApi<Result>('import?dryRun=' + dryRun, 'POST', body),
      );
      if (!dryRun) onDone();
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="catalog-panel">
      <h2>Import catalog CSV</h2>
      <p>
        Maximum 2 MB and 1000 rows. Preview first; apply imports valid rows and
        skips invalid or possible-duplicate rows.
      </p>
      <a href="/api/v1/catalog/import/template">Download CSV template</a>
      <label className="upload-zone">
        Choose a CSV file
        <input
          type="file"
          accept=".csv,text/csv"
          disabled={busy}
          onChange={(e) => {
            setFile(e.target.files?.[0] ?? null);
            setResult(null);
            setError(null);
          }}
        />
      </label>
      <div className="catalog-actions">
        <button disabled={!file || busy} onClick={() => void run(true)}>
          1. Preview file
        </button>
        <button
          className="button-primary"
          disabled={!result?.dryRun || busy}
          onClick={() => void run(false)}
        >
          2. Import valid rows
        </button>
      </div>
      <CatalogErrorView error={error} />
      {result ? (
        <>
          <p>
            {Object.entries(result.totals)
              .map(([k, v]) => k + ': ' + v)
              .join(' · ')}
          </p>
          <div className="catalog-scroll">
            <table>
              <thead>
                <tr>
                  <th>Row</th>
                  <th>Brand</th>
                  <th>Model</th>
                  <th>RAM</th>
                  <th>Storage</th>
                  <th>Color</th>
                  <th>Result</th>
                </tr>
              </thead>
              <tbody>
                {result.rows.map((r) => (
                  <tr key={r.row}>
                    <td>{r.row}</td>
                    {r.cells.map((cell, i) => (
                      <td key={i}>{cell}</td>
                    ))}
                    <td>
                      {r.status}
                      {r.reason ? ' — ' + r.reason : ''}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : null}
    </section>
  );
}
