import { redirect } from 'next/navigation';
import { getSession } from '../../lib/session';
import { PortalShell } from '../../components/portal-shell';
import { SalesBrowser } from '../../components/inventory/sales-browser';
export default async function SalesPage() {
  const user = await getSession();
  if (!user) redirect('/login?reason=expired');
  if (user.mustChangePassword) redirect('/change-password');
  if (!user.permissions.includes('dashboard.view')) redirect('/dashboard');
  return (
    <PortalShell user={user}>
      <SalesBrowser permissions={user.permissions} actorId={user.id} />
    </PortalShell>
  );
}
