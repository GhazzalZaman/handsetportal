'use client';
import { useState } from 'react';
import { Dialog } from '../dialog';
import { request, errorMessage } from './shared';
interface Result {
  dryRun: boolean;
  totals: { received: number; accepted: number; rejected: number };
  rows: { row: number; cells: string[]; status: string; reason?: string }[];
}
export function OpeningImport({
  onClose,
  onDone,
}: {
  onClose: () => void;
  onDone: () => void;
}) {
  const [file, setFile] = useState<File | null>(null),
    [result, setResult] = useState<Result | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  async function run(dryRun: boolean) {
    if (!file || busy) return;
    setBusy(true);
    setError('');
    try {
      const body = new FormData();
      body.append('file', file);
      setResult(
        await request<Result>(
          'inventory/opening-stock/import?dryRun=' + dryRun,
          'POST',
          body,
        ),
      );
      if (!dryRun) onDone();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Dialog title="Import opening stock" onClose={onClose} busy={busy}>
      <p>
        Existing catalog variants only. Each center and variant must have no
        stock movements. Maximum 2 MB and 1000 rows.
      </p>
      <a href="/api/v1/inventory/opening-stock/template">
        Download CSV template
      </a>
      <label className="upload-zone">
        CSV file
        <input
          type="file"
          accept=".csv,text/csv"
          disabled={busy}
          onChange={(e) => {
            setFile(e.target.files?.[0] ?? null);
            setResult(null);
            setError('');
          }}
        />
      </label>
      <div className="catalog-actions">
        <button disabled={busy || !file} onClick={() => void run(true)}>
          Preview
        </button>
        <button
          className="button-primary"
          disabled={busy || !result?.dryRun || !result.totals.accepted}
          onClick={() => void run(false)}
        >
          Import valid rows
        </button>
      </div>
      {error && <p role="alert">{error}</p>}
      {result && (
        <>
          <p role="status">
            {result.dryRun ? 'Preview' : 'Import complete'}:{' '}
            {result.totals.accepted} accepted, {result.totals.rejected}{' '}
            rejected.
          </p>
          <div className="catalog-scroll">
            <table>
              <thead>
                <tr>
                  <th>Row</th>
                  <th>Center / variant</th>
                  <th>Result</th>
                </tr>
              </thead>
              <tbody>
                {result.rows.map((row) => (
                  <tr key={row.row}>
                    <td>{row.row}</td>
                    <td>{row.cells.join(' / ')}</td>
                    <td>
                      {row.status}
                      {row.reason ? ' - ' + row.reason : ''}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </Dialog>
  );
}
