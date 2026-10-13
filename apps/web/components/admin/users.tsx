'use client';
import { Dialog } from '../dialog';
import { FormEvent, useEffect, useState } from 'react';
import {
  api,
  catalog,
  Center,
  Cluster,
  message,
  OneTimePassword,
  Page,
  Pager,
  Role,
} from './shared';
interface User {
  id: number;
  username: string;
  displayName: string;
  email: string | null;
  role: Role;
  centerIds: number[];
  clusterIds: number[];
  isActive: boolean;
  lockedUntil: string | null;
  mustChangePassword: boolean;
}
interface Session {
  createdAt: string;
  lastSeenAt: string;
  ipAddress: string;
  userAgent: string;
}
type Editor = {
  id?: number;
  username: string;
  displayName: string;
  email: string;
  roleId: number;
  centerIds: number[];
  clusterIds: number[];
  temporaryPassword: string;
};
export function UsersAdmin({ actorId }: { actorId: number }) {
  const [rows, setRows] = useState<Page<User>>({
      items: [],
      total: 0,
      page: 1,
      pageSize: 25,
    }),
    [page, setPage] = useState(1),
    [version, setVersion] = useState(0);
  const [roles, setRoles] = useState<Role[]>([]),
    [centers, setCenters] = useState<Center[]>([]),
    [clusters, setClusters] = useState<Cluster[]>([]);
  const [filter, setFilter] = useState({
      search: '',
      roleId: '',
      centerId: '',
      clusterId: '',
      isActive: '',
    }),
    [query, setQuery] = useState('');
  const [editor, setEditor] = useState<Editor | null>(null),
    [secret, setSecret] = useState(''),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false),
    [loading, setLoading] = useState(true);
  const [sessions, setSessions] = useState<{
    user: User;
    data: Page<Session>;
    page: number;
  } | null>(null);
  useEffect(() => {
    let active = true;
    Promise.all([
      catalog<Role>('roles'),
      catalog<Center>('centers'),
      catalog<Cluster>('clusters/catalog'),
    ])
      .then(([r, c, k]) => {
        if (active) {
          setRoles(r);
          setCenters(c);
          setClusters(k.filter((x) => x.isActive));
        }
      })
      .catch((e) => {
        if (active) setError(message(e));
      });
    return () => {
      active = false;
    };
  }, []);
  useEffect(() => {
    let active = true;
    setLoading(true);
    api<Page<User>>('users?page=' + page + query)
      .then((r) => {
        if (active) {
          setRows(r);
          setError('');
        }
      })
      .catch((e) => {
        if (active) {
          setError(message(e));
          setRows({ items: [], total: 0, page, pageSize: 25 });
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [page, query, version]);
  const selectedRole = roles.find((r) => r.id === editor?.roleId);
  async function save(event: FormEvent) {
    event.preventDefault();
    if (!editor) return;
    setBusy(true);
    setError('');
    try {
      const base = {
        displayName: editor.displayName,
        email: editor.email || null,
        roleId: editor.roleId,
        centerIds: editor.centerIds,
        clusterIds: editor.clusterIds,
      };
      if (editor.id) await api('users/' + editor.id, 'PATCH', base);
      else {
        const result = await api<{ temporaryPassword: string }>(
          'users',
          'POST',
          {
            ...base,
            username: editor.username,
            ...(editor.temporaryPassword
              ? { temporaryPassword: editor.temporaryPassword }
              : {}),
          },
        );
        setSecret(result.temporaryPassword);
      }
      setEditor(null);
      setVersion((v) => v + 1);
    } catch (e) {
      setError(message(e));
      setEditor((current) =>
        current ? { ...current, temporaryPassword: '' } : null,
      );
    } finally {
      setBusy(false);
    }
  }
  async function action(user: User, kind: string) {
    if (
      ['deactivate', 'reset-password', 'revoke-sessions'].includes(kind) &&
      !window.confirm(kind.replaceAll('-', ' ') + ' for ' + user.username + '?')
    )
      return;
    setBusy(true);
    setError('');
    setSecret('');
    try {
      const result = await api<{ temporaryPassword?: string }>(
        'users/' + user.id + '/' + kind,
        'POST',
        {},
      );
      if (result.temporaryPassword) setSecret(result.temporaryPassword);
      setSessions(null);
      if (!result.temporaryPassword) setVersion((v) => v + 1);
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
    }
  }
  async function viewSessions(user: User, p = 1) {
    setBusy(true);
    setError('');
    try {
      setSessions({
        user,
        page: p,
        data: await api<Page<Session>>(
          'users/' + user.id + '/sessions?page=' + p,
        ),
      });
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
    }
  }
  function toggle(key: 'centerIds' | 'clusterIds', id: number) {
    setEditor((e) =>
      e
        ? {
            ...e,
            [key]: e[key].includes(id)
              ? e[key].filter((x) => x !== id)
              : [...e[key], id],
          }
        : null,
    );
  }
  return (
    <>
      <h1>Users</h1>
      <p>Create accounts, assign access, and manage sessions.</p>
      <p role="alert">{error}</p>
      {secret ? (
        <OneTimePassword
          key={secret}
          value={secret}
          onClose={() => {
            setSecret('');
            setVersion((v) => v + 1);
          }}
        />
      ) : null}
      <fieldset disabled={busy || Boolean(secret)} className="admin-controls">
        <form
          className="admin-filters"
          onSubmit={(e) => {
            e.preventDefault();
            const params = new URLSearchParams();
            for (const [k, v] of Object.entries(filter))
              if (v) params.set(k, v);
            setPage(1);
            setQuery('&' + params.toString());
          }}
        >
          <label>
            Search
            <input
              value={filter.search}
              maxLength={100}
              onChange={(e) => setFilter({ ...filter, search: e.target.value })}
            />
          </label>
          <label>
            Role
            <select
              value={filter.roleId}
              onChange={(e) => setFilter({ ...filter, roleId: e.target.value })}
            >
              <option value="">All roles</option>
              {roles.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Center
            <select
              value={filter.centerId}
              onChange={(e) =>
                setFilter({ ...filter, centerId: e.target.value })
              }
            >
              <option value="">All assignments</option>
              {centers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Cluster
            <select
              value={filter.clusterId}
              onChange={(e) =>
                setFilter({ ...filter, clusterId: e.target.value })
              }
            >
              <option value="">All assignments</option>
              {clusters.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Status
            <select
              value={filter.isActive}
              onChange={(e) =>
                setFilter({ ...filter, isActive: e.target.value })
              }
            >
              <option value="">All</option>
              <option value="true">Active</option>
              <option value="false">Inactive</option>
            </select>
          </label>
          <button>Apply filters</button>
        </form>
        <button
          className="button-primary"
          onClick={() => {
            setError('');
            setEditor({
              username: '',
              displayName: '',
              email: '',
              roleId:
                roles.find((role) => role.code === 'OTHER')?.id ??
                roles[0]?.id ??
                0,
              centerIds: [],
              clusterIds: [],
              temporaryPassword: '',
            });
          }}
        >
          Create user
        </button>
        {editor ? (
          <Dialog
            title={editor.id ? 'Edit user' : 'Create user'}
            onClose={() => setEditor(null)}
            busy={busy}
          >
            {error && <p role="alert">{error}</p>}
            <form onSubmit={save} autoComplete="off">
              {!editor.id ? (
                <label>
                  Username
                  <input
                    required
                    maxLength={100}
                    value={editor.username}
                    onChange={(e) =>
                      setEditor({ ...editor, username: e.target.value })
                    }
                  />
                </label>
              ) : null}
              <label>
                Display name
                <input
                  required
                  maxLength={160}
                  value={editor.displayName}
                  onChange={(e) =>
                    setEditor({ ...editor, displayName: e.target.value })
                  }
                />
              </label>
              <label>
                Email
                <input
                  type="email"
                  maxLength={254}
                  value={editor.email}
                  onChange={(e) =>
                    setEditor({ ...editor, email: e.target.value })
                  }
                />
              </label>
              <label>
                Role
                <select
                  required
                  disabled={editor.id === actorId}
                  value={editor.roleId}
                  onChange={(e) =>
                    setEditor({
                      ...editor,
                      roleId: Number(e.target.value),
                      centerIds: [],
                      clusterIds: [],
                    })
                  }
                >
                  {roles.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name} ({r.scopeType})
                    </option>
                  ))}
                </select>
              </label>
              {selectedRole?.scopeType !== 'ALL' ? (
                <fieldset>
                  <legend>Assigned centers</legend>
                  {centers.map((c) => (
                    <label className="admin-check" key={c.id}>
                      <input
                        type="checkbox"
                        checked={editor.centerIds.includes(c.id)}
                        onChange={() => toggle('centerIds', c.id)}
                      />
                      {c.name}
                    </label>
                  ))}
                </fieldset>
              ) : (
                <p>This role has access to every active center.</p>
              )}
              {['CLUSTER', 'ASSIGNED'].includes(
                selectedRole?.scopeType ?? '',
              ) ? (
                <fieldset>
                  <legend>Assigned clusters</legend>
                  {clusters.map((c) => (
                    <label className="admin-check" key={c.id}>
                      <input
                        type="checkbox"
                        checked={editor.clusterIds.includes(c.id)}
                        onChange={() => toggle('clusterIds', c.id)}
                      />
                      {c.name}
                    </label>
                  ))}
                </fieldset>
              ) : null}
              {!editor.id ? (
                <label>
                  Temporary password (leave blank to generate)
                  <input
                    type="password"
                    autoComplete="new-password"
                    minLength={12}
                    maxLength={128}
                    value={editor.temporaryPassword}
                    onChange={(e) =>
                      setEditor({
                        ...editor,
                        temporaryPassword: e.target.value,
                      })
                    }
                  />
                </label>
              ) : null}
              <div className="admin-actions">
                <button>Save</button>
                <button type="button" onClick={() => setEditor(null)}>
                  Cancel
                </button>
              </div>
            </form>
          </Dialog>
        ) : null}
        {loading ? (
          <p role="status">Loading users…</p>
        ) : (
          <div className="admin-table">
            <table>
              <thead>
                <tr>
                  <th>User</th>
                  <th>Role</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.items.map((u) => (
                  <tr key={u.id}>
                    <td>
                      {u.displayName}
                      <br />
                      <small>
                        {u.username} · {u.email}
                      </small>
                    </td>
                    <td>{u.role.name}</td>
                    <td>
                      <span className={u.isActive ? 'badge active' : 'badge'}>
                        {u.isActive ? 'Active' : 'Inactive'}
                      </span>
                      {u.mustChangePassword
                        ? ' · Password change required'
                        : ''}
                      {u.lockedUntil
                        ? ' · Lock until ' +
                          new Date(u.lockedUntil).toLocaleString()
                        : ''}
                    </td>
                    <td>
                      <div className="admin-actions">
                        <button
                          onClick={() => {
                            setError('');
                            setEditor({
                              id: u.id,
                              username: u.username,
                              displayName: u.displayName,
                              email: u.email ?? '',
                              roleId: u.role.id,
                              centerIds: u.centerIds,
                              clusterIds: u.clusterIds,
                              temporaryPassword: '',
                            });
                          }}
                        >
                          Edit
                        </button>
                        <details className="row-menu">
                          <summary>Account actions</summary>
                          <div>
                            <button
                              disabled={u.id === actorId && u.isActive}
                              onClick={() =>
                                action(
                                  u,
                                  u.isActive ? 'deactivate' : 'activate',
                                )
                              }
                            >
                              {u.isActive ? 'Deactivate' : 'Activate'}
                            </button>
                            <button onClick={() => action(u, 'reset-password')}>
                              Reset password
                            </button>
                            <button onClick={() => action(u, 'unlock')}>
                              Unlock
                            </button>
                            <button onClick={() => viewSessions(u)}>
                              Sessions
                            </button>
                            <button
                              onClick={() => action(u, 'revoke-sessions')}
                            >
                              Revoke sessions
                            </button>
                          </div>
                        </details>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!rows.items.length ? <p>No users found.</p> : null}
          </div>
        )}
        <Pager page={page} total={rows.total} onPage={setPage} />
        {sessions ? (
          <section className="admin-dialog">
            <h2>Sessions: {sessions.user.username}</h2>
            {sessions.data.items.map((s, i) => (
              <p key={i}>
                Created {new Date(s.createdAt).toLocaleString()} · Last seen{' '}
                {new Date(s.lastSeenAt).toLocaleString()} · {s.ipAddress} ·{' '}
                {s.userAgent}
              </p>
            ))}
            {!sessions.data.items.length ? <p>No active sessions.</p> : null}
            <Pager
              page={sessions.page}
              total={sessions.data.total}
              onPage={(p) => viewSessions(sessions.user, p)}
            />
            <button onClick={() => setSessions(null)}>Close</button>
          </section>
        ) : null}
      </fieldset>
    </>
  );
}
