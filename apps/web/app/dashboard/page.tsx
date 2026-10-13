import { redirect } from 'next/navigation';
import { Icon } from '../../components/icon';
import Link from 'next/link';
import { getSession } from '../../lib/session';
import { PortalShell } from '../../components/portal-shell';
export default async function Dashboard() {
  const user = await getSession();
  if (!user) redirect('/login?reason=expired');
  if (user.mustChangePassword) redirect('/change-password');
  const cards = [
    {
      title: 'Handset catalog',
      href: '/catalog',
      icon: 'catalog',
      description:
        'Browse brands, compare model specifications, and find available color variants.',
      show: user.permissions.includes('dashboard.view'),
    },
    {
      title: 'User management',
      href: '/admin/users',
      icon: 'users',
      description:
        'Create accounts, manage center assignments, and help your team access the portal.',
      show: user.permissions.includes('users.manage'),
    },
    {
      title: 'Roles & permissions',
      href: '/admin/roles',
      icon: 'roles',
      description:
        'Review what each role can do and manage access to portal features.',
      show: user.permissions.includes('users.manage'),
    },
    {
      title: 'Centers & clusters',
      href: '/admin/centers',
      icon: 'centers',
      description:
        'Keep Experience Centers organized and maintain their cluster mappings.',
      show: user.permissions.includes('users.manage'),
    },
  ].filter((card) => card.show);
  return (
    <PortalShell user={user}>
      <main>
        <section className="welcome-banner">
          <p className="eyebrow">YOUR WORKSPACE, CONNECTED</p>
          <h1>Welcome, {user.displayName}</h1>
          <p>
            Manage your handset catalog and keep your team connected. Choose a
            workspace below to get started.
          </p>
        </section>
        <div className="section-heading">
          <h2>Your workspaces</h2>
          <small>Quick access</small>
        </div>
        <div className="quick-grid">
          {cards.map((card) => (
            <Link className="quick-card" key={card.href} href={card.href}>
              <span className="card-icon" aria-hidden="true">
                <Icon name={card.icon} />
              </span>
              <h3>{card.title}</h3>
              <p>{card.description}</p>
              <span className="card-link">Open workspace →</span>
            </Link>
          ))}
        </div>
        {!cards.length && (
          <section className="help-panel">
            <h2>Your account is ready</h2>
            <p>
              Ask your administrator to assign the permissions you need to
              access a workspace.
            </p>
          </section>
        )}
        <section className="help-panel">
          <h3>Need a hand?</h3>
          <p>
            Start with the handset catalog to browse brands and models. For
            account access or center assignments, contact your portal
            administrator.
          </p>
          <Link href="/change-password">Manage your password →</Link>
        </section>
      </main>
    </PortalShell>
  );
}
