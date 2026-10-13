'use client';
import { Icon } from '../icon';
import { Dialog } from '../dialog';
import { readable } from '../portal-shell';
import { useEffect, useState } from 'react';
import { api, catalog, message, Role } from './shared';
export function RolesAdmin() {
  const [roles, setRoles] = useState<Role[]>([]),
    [permissions, setPermissions] = useState<
      { code: string; description: string }[]
    >([]),
    [editing, setEditing] = useState<Role | null>(null),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false),
    [status, setStatus] = useState('');
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let active = true;
    Promise.all([
      catalog<Role>('roles'),
      catalog<{ code: string; description: string }>('permissions'),
    ])
      .then(([r, p]) => {
        if (active) {
          setRoles(r);
          setPermissions(p);
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
  }, []);
  async function save() {
    if (!editing) return;
    setBusy(true);
    setError('');
    try {
      await api('roles/' + editing.id + '/permissions', 'PUT', {
        permissionCodes: editing.permissions,
      });
      setRoles(await catalog<Role>('roles'));
      setEditing(null);
      setStatus(
        'Permissions saved. Existing sessions use these permissions on their next request.',
      );
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <h1>Roles and permissions</h1>
      <p>
        Role codes and scope types are fixed. Permission changes apply
        immediately.
      </p>
      <p role="alert">{error}</p>
      <p role="status">{status}</p>
      {loading && <p role="status">Loading roles...</p>}
      <div className="role-grid">
        {roles.map((r) => (
          <article className="role-card" key={r.id}>
            <span className="card-icon" aria-hidden="true">
              <Icon name="roles" />
            </span>
            <h2>{r.name}</h2>
            <p>
              {r.userCount} users /{' '}
              {r.scopeType === 'ALL'
                ? 'All centers'
                : readable(r.scopeType) + ' centers'}
            </p>
            <div className="permission-list">
              {r.permissions.length ? (
                r.permissions.map((code) => (
                  <span key={code}>{readable(code)}</span>
                ))
              ) : (
                <small>No permissions assigned</small>
              )}
            </div>
            <button
              disabled={busy}
              onClick={() => {
                setEditing({ ...r, permissions: [...r.permissions] });
                setError('');
                setStatus('');
              }}
            >
              Edit permissions
            </button>
          </article>
        ))}
      </div>
      {editing ? (
        <Dialog
          title={editing.name}
          onClose={() => setEditing(null)}
          busy={busy}
        >
          <p>
            Select the actions this role can perform. Changes apply immediately.
          </p>
          {error && <p role="alert">{error}</p>}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void save();
            }}
          >
            <fieldset disabled={busy}>
              <legend>Permissions</legend>
              {permissions.map((p) => (
                <label className="admin-check" key={p.code}>
                  <input
                    type="checkbox"
                    checked={editing.permissions.includes(p.code)}
                    onChange={() =>
                      setEditing({
                        ...editing,
                        permissions: editing.permissions.includes(p.code)
                          ? editing.permissions.filter((c) => c !== p.code)
                          : [...editing.permissions, p.code],
                      })
                    }
                  />
                  <span>
                    <strong>{readable(p.code)}</strong>
                    <small className="permission-description">
                      {p.description}
                    </small>
                  </span>
                </label>
              ))}
              <div className="admin-actions">
                <button>Save permissions</button>
                <button type="button" onClick={() => setEditing(null)}>
                  Cancel
                </button>
              </div>
            </fieldset>
          </form>
        </Dialog>
      ) : null}
    </>
  );
}
