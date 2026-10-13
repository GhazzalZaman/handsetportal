'use client';
import { Icon } from './icon';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { SessionActions } from './session-actions';

export function readable(value: string) {
  const labels: Record<string, string> = {
    'dashboard.view': 'View catalog',
    'masterdata.create': 'Add handsets',
    'masterdata.manage': 'Manage catalog',
    'users.manage': 'Manage users',
    'audit.view': 'View audit history',
  };
  if (labels[value]) return labels[value];
  return value
    .replace(/[_.]/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export function PortalShell({
  user,
  children,
}: {
  user: {
    displayName: string;
    role: string;
    permissions: string[];
    idleExpiresAt: string;
    absoluteExpiresAt: string;
  };
  children: React.ReactNode;
}) {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const links = [
    {
      href: '/inventory',
      name: 'Inventory',
      icon: 'catalog',
      show: user.permissions.includes('dashboard.view'),
    },
    {
      href: '/sales',
      name: 'Sales',
      icon: 'overview',
      show: user.permissions.includes('dashboard.view'),
    },
    { href: '/dashboard', name: 'Overview', icon: 'overview', show: true },
    {
      href: '/catalog',
      name: 'Handset catalog',
      icon: 'catalog',
      show: user.permissions.includes('dashboard.view'),
    },
    {
      href: '/admin/users',
      name: 'Users',
      icon: 'users',
      show: user.permissions.includes('users.manage'),
    },
    {
      href: '/admin/roles',
      name: 'Roles & permissions',
      icon: 'roles',
      show: user.permissions.includes('users.manage'),
    },
    {
      href: '/admin/centers',
      name: 'Centers & clusters',
      icon: 'centers',
      show: user.permissions.includes('users.manage'),
    },
  ].filter((link) => link.show);
  const current = links.find((link) => path === link.href);
  return (
    <div className="portal-shell">
      <a href="#workspace-content" className="skip-link">
        Skip to content
      </a>
      {open && (
        <button
          className="sidebar-scrim"
          aria-label="Close navigation"
          onClick={() => setOpen(false)}
        />
      )}
      <aside
        id="portal-navigation"
        className={`sidebar ${open ? 'is-open' : ''}`}
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            setOpen(false);
            document.querySelector<HTMLButtonElement>('.menu-toggle')?.focus();
          }
        }}
      >
        <Link
          className="brand"
          href="/dashboard"
          onClick={() => setOpen(false)}
        >
          <span className="brand-mark">Jazz</span>
          <span>
            Handset Portal<small>EXPERIENCE CENTERS</small>
          </span>
        </Link>
        <button
          className="mobile-nav-close"
          onClick={() => {
            setOpen(false);
            document.querySelector<HTMLButtonElement>('.menu-toggle')?.focus();
          }}
        >
          Close navigation
        </button>
        <p className="nav-caption">WORKSPACE</p>
        <nav aria-label="Main navigation">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              aria-current={path === link.href ? 'page' : undefined}
              onClick={() => setOpen(false)}
            >
              <span aria-hidden="true" className="nav-icon">
                <Icon name={link.icon} />
              </span>
              {link.name}
            </Link>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="profile">
            <span className="avatar">
              {user.displayName.slice(0, 1).toUpperCase()}
            </span>
            <div>
              <strong>{user.displayName}</strong>
              <small>{readable(user.role)}</small>
            </div>
          </div>
          <Link href="/change-password">Change password</Link>
          <SessionActions
            idleExpiresAt={user.idleExpiresAt}
            absoluteExpiresAt={user.absoluteExpiresAt}
          />
        </div>
      </aside>
      <div className="workspace">
        <header className="topbar">
          <button
            className="menu-toggle"
            aria-label="Toggle navigation"
            aria-expanded={open}
            aria-controls="portal-navigation"
            onClick={() => setOpen(!open)}
          >
            ☰
          </button>
          <div>
            <span className="topbar-parent">Workspace</span>
            <span aria-hidden="true"> / </span>
            <strong>{current?.name ?? 'Overview'}</strong>
          </div>
          <span className="workspace-tag">Jazz Experience Centers</span>
        </header>
        <div id="workspace-content" tabIndex={-1} className="workspace-content">
          {children}
        </div>
        <footer className="workspace-footer">
          Handset Portal <span>Jazz · Experience Centers</span>
        </footer>
      </div>
    </div>
  );
}
