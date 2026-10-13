'use client';
import { Dialog } from '../dialog';
import { useState } from 'react';
import { authFetch, AuthRequestError } from '../../lib/auth-fetch';
export interface Page<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}
export interface Role {
  id: number;
  code: string;
  name: string;
  scopeType: string;
  permissions: string[];
  userCount: number;
}
export interface Center {
  id: number;
  code: string;
  name: string;
  shortName: string | null;
  clusterId: number | null;
  isActive: boolean;
}
export interface Cluster {
  id: number;
  code: string;
  name: string;
  isActive: boolean;
}
export async function api<T>(
  path: string,
  method = 'GET',
  body?: unknown,
): Promise<T> {
  const response = await authFetch('/api/v1/' + path, {
    method,
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  return response.json() as Promise<T>;
}
export async function catalog<T>(path: string): Promise<T[]> {
  const items: T[] = [];
  for (let page = 1; ; page++) {
    const result = await api<Page<T>>(path + '?pageSize=100&page=' + page);
    items.push(...result.items);
    if (items.length >= result.total || !result.items.length) return items;
  }
}
export function message(error: unknown) {
  if (error instanceof AuthRequestError) {
    const codes: Record<string, string> = {
      DUPLICATE_VALUE: 'That username, email, code or name is already in use.',
      SELF_DEACTIVATION: 'You cannot deactivate your own account.',
      SELF_ROLE_CHANGE: 'You cannot change your own role.',
      SELF_PERMISSION_REMOVAL:
        'You cannot remove your own user-management permission.',
      LAST_ADMIN: 'At least one active user administrator must remain.',
      ADMIN_PERMISSIONS_REQUIRED:
        'System administrators must retain users.manage and audit.view.',
      PASSWORD_POLICY:
        'The temporary password does not meet the password policy.',
      CENTER_ASSIGNMENTS_REQUIRED:
        'Assign at least one center and no clusters for this role.',
      CLUSTER_ASSIGNMENTS_REQUIRED: 'Assign at least one cluster.',
      ALL_ASSIGNMENTS_FORBIDDEN: 'An ALL role cannot have assignments.',
      ASSIGNMENTS_REQUIRED: 'Assign at least one center or cluster.',
      INVALID_CENTERS: 'Choose active centers.',
      INVALID_CLUSTERS: 'Choose active clusters.',
      UNKNOWN_PERMISSION: 'One or more permissions are unavailable.',
    };
    return (
      codes[error.code] ??
      (error.status === 403
        ? 'You no longer have permission to perform this action.'
        : error.status === 404
          ? 'The item is unavailable or outside your scope.'
          : 'The request failed. Check the fields and try again.')
    );
  }
  return 'Unable to reach the server. Please try again.';
}
export function Pager({
  page,
  total,
  onPage,
}: {
  page: number;
  total: number;
  onPage: (page: number) => void;
}) {
  return (
    <div className="admin-actions">
      <button disabled={page <= 1} onClick={() => onPage(page - 1)}>
        Previous
      </button>
      <span>
        Page {page} · {total} results
      </span>
      <button disabled={page * 25 >= total} onClick={() => onPage(page + 1)}>
        Next
      </button>
    </div>
  );
}
export function OneTimePassword({
  value,
  onClose,
}: {
  value: string;
  onClose: () => void;
}) {
  const [copied, setCopied] = useState(false),
    [error, setError] = useState('');
  return (
    <Dialog
      title="Save this temporary password"
      onClose={onClose}
      dismissible={false}
    >
      <p>
        This password will not be shown again. Share it securely with the user.
        They must change it after signing in.
      </p>
      <label>
        Temporary password
        <input readOnly value={value} autoComplete="off" />
      </label>
      <div className="admin-actions">
        <button
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(value);
              setCopied(true);
            } catch {
              setError(
                'Copy unavailable. Select and copy the password manually.',
              );
            }
          }}
        >
          {copied ? 'Copied' : 'Copy password'}
        </button>
        <button autoFocus onClick={onClose}>
          I have saved it — close
        </button>
      </div>
      <p role="status">{error}</p>
    </Dialog>
  );
}
