import { redirect } from 'next/navigation';
import { getSession } from '../../lib/session';
import { PortalShell } from '../../components/portal-shell';
import { CatalogBrowser } from '../../components/catalog/browser';
export default async function CatalogPage() {
  const user = await getSession();
  if (!user) redirect('/login?reason=expired');
  if (user.mustChangePassword) redirect('/change-password');
  if (!user.permissions.includes('dashboard.view')) redirect('/dashboard');
  return (
    <PortalShell user={user}>
      <CatalogBrowser permissions={user.permissions} />
    </PortalShell>
  );
}
