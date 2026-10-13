'use client';
import { Dialog } from '../dialog';
import { FormEvent, useEffect, useState } from 'react';
import { api, catalog, Center, Cluster, message, Page, Pager } from './shared';
export function CentersAdmin() {
  const [rows, setRows] = useState<Page<Center>>({
      items: [],
      page: 1,
      pageSize: 25,
      total: 0,
    }),
    [clusters, setClusters] = useState<Cluster[]>([]),
    [page, setPage] = useState(1),
    [version, setVersion] = useState(0),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState('');
  const [center, setCenter] = useState<Partial<Center> | null>(null),
    [cluster, setCluster] = useState<Partial<Cluster> | null>(null);
  useEffect(() => {
    let active = true;
    setLoading(true);
    Promise.all([
      api<Page<Center>>('centers?page=' + page),
      catalog<Cluster>('clusters/catalog'),
    ])
      .then(([c, k]) => {
        if (active) {
          setRows(c);
          setClusters(k);
          setLoading(false);
        }
      })
      .catch((e) => {
        if (active) {
          setError(message(e));
          setLoading(false);
        }
      });
    return () => {
      active = false;
    };
  }, [page, version]);
  async function save(event: FormEvent, kind: 'centers' | 'clusters') {
    event.preventDefault();
    const item = kind === 'centers' ? center : cluster;
    if (!item) return;
    if (
      item.isActive === false &&
      !window.confirm('Deactivate this item? History is retained.')
    )
      return;
    setBusy(true);
    setError('');
    try {
      const base =
        kind === 'centers'
          ? {
              name: center!.name,
              shortName: center!.shortName || null,
              clusterId: center!.clusterId ?? null,
            }
          : { name: cluster!.name };
      await api(
        kind + (item.id ? '/' + item.id : ''),
        item.id ? 'PATCH' : 'POST',
        {
          ...base,
          ...(item.id ? { isActive: item.isActive } : { code: item.code }),
        },
      );
      setNotice(kind === 'centers' ? 'Center saved.' : 'Cluster saved.');
      setCenter(null);
      setCluster(null);
      setVersion((v) => v + 1);
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <h1>Centers and clusters</h1>
      <p>
        Only active centers in your scope are listed. Cluster deactivation
        removes access through that cluster; direct center assignments remain
        effective.
      </p>
      <p role="alert">{error}</p>
      {notice && <p role="status">{notice}</p>}
      {loading && <p role="status">Loading centers and clusters...</p>}
      <fieldset disabled={busy} className="admin-controls">
        <div className="admin-actions">
          <button
            className="button-primary"
            onClick={() => {
              setCenter({
                code: '',
                name: '',
                shortName: '',
                clusterId: null,
                isActive: true,
              });
              setCluster(null);
              setError('');
            }}
          >
            Add center
          </button>
          <button
            onClick={() => {
              setCluster({ code: '', name: '', isActive: true });
              setCenter(null);
              setError('');
            }}
          >
            Add cluster
          </button>
        </div>
        {center ? (
          <Dialog
            title={center.id ? 'Edit center' : 'Add center'}
            onClose={() => setCenter(null)}
            busy={busy}
          >
            {error && <p role="alert">{error}</p>}
            <form onSubmit={(e) => save(e, 'centers')}>
              {!center.id ? (
                <label>
                  Code
                  <input
                    required
                    maxLength={40}
                    pattern="[A-Za-z0-9_-]+"
                    value={center.code}
                    onChange={(e) =>
                      setCenter({ ...center, code: e.target.value })
                    }
                  />
                </label>
              ) : null}
              <label>
                Name
                <input
                  required
                  maxLength={160}
                  value={center.name}
                  onChange={(e) =>
                    setCenter({ ...center, name: e.target.value })
                  }
                />
              </label>
              <label>
                Short name
                <input
                  maxLength={60}
                  value={center.shortName ?? ''}
                  onChange={(e) =>
                    setCenter({ ...center, shortName: e.target.value })
                  }
                />
              </label>
              <label>
                Cluster
                <select
                  value={center.clusterId ?? ''}
                  onChange={(e) =>
                    setCenter({
                      ...center,
                      clusterId: e.target.value ? Number(e.target.value) : null,
                    })
                  }
                >
                  <option value="">Unassigned</option>
                  {clusters
                    .filter((c) => c.isActive || c.id === center.clusterId)
                    .map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                        {!c.isActive ? ' (inactive)' : ''}
                      </option>
                    ))}
                </select>
              </label>
              {center.id ? (
                <label className="admin-check">
                  <input
                    type="checkbox"
                    checked={center.isActive}
                    onChange={(e) =>
                      setCenter({ ...center, isActive: e.target.checked })
                    }
                  />
                  Active
                </label>
              ) : null}
              <div className="admin-actions">
                <button>Save center</button>
                <button type="button" onClick={() => setCenter(null)}>
                  Cancel
                </button>
              </div>
            </form>
          </Dialog>
        ) : null}
        {cluster ? (
          <Dialog
            title={cluster.id ? 'Edit cluster' : 'Add cluster'}
            onClose={() => setCluster(null)}
            busy={busy}
          >
            {error && <p role="alert">{error}</p>}
            <form onSubmit={(e) => save(e, 'clusters')}>
              {!cluster.id ? (
                <label>
                  Code
                  <input
                    required
                    maxLength={40}
                    pattern="[A-Za-z0-9_-]+"
                    value={cluster.code}
                    onChange={(e) =>
                      setCluster({ ...cluster, code: e.target.value })
                    }
                  />
                </label>
              ) : null}
              <label>
                Name
                <input
                  required
                  maxLength={120}
                  value={cluster.name}
                  onChange={(e) =>
                    setCluster({ ...cluster, name: e.target.value })
                  }
                />
              </label>
              {cluster.id ? (
                <label className="admin-check">
                  <input
                    type="checkbox"
                    checked={cluster.isActive}
                    onChange={(e) =>
                      setCluster({ ...cluster, isActive: e.target.checked })
                    }
                  />
                  Active
                </label>
              ) : null}
              <div className="admin-actions">
                <button>Save cluster</button>
                <button type="button" onClick={() => setCluster(null)}>
                  Cancel
                </button>
              </div>
            </form>
          </Dialog>
        ) : null}
        <div className="admin-table">
          <table>
            <thead>
              <tr>
                <th>Code</th>
                <th>Center</th>
                <th>Short name</th>
                <th>Cluster</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {rows.items.map((c) => (
                <tr key={c.id}>
                  <td>{c.code}</td>
                  <td>{c.name}</td>
                  <td>{c.shortName}</td>
                  <td>
                    {clusters.find((k) => k.id === c.clusterId)?.name ??
                      'Unassigned'}
                  </td>
                  <td>
                    <button
                      onClick={() => {
                        setCenter(c);
                        setCluster(null);
                        setError('');
                      }}
                    >
                      Edit
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Pager page={page} total={rows.total} onPage={setPage} />
        <h2>Cluster catalog</h2>
        <p>
          Empty clusters are listed here so administrators can map centers to
          them.
        </p>
        <div className="admin-table">
          <table>
            <thead>
              <tr>
                <th>Code</th>
                <th>Name</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {clusters.map((c) => (
                <tr key={c.id}>
                  <td>{c.code}</td>
                  <td>{c.name}</td>
                  <td>{c.isActive ? 'Active' : 'Inactive'}</td>
                  <td>
                    <button
                      onClick={() => {
                        setCluster(c);
                        setCenter(null);
                        setError('');
                      }}
                    >
                      Edit
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </fieldset>
    </>
  );
}
