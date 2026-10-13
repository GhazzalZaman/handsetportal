import { redirect } from 'next/navigation';
import { getSession } from '../../lib/session';
import { PortalShell } from '../../components/portal-shell';
import { InventoryBrowser } from '../../components/inventory/inventory-browser';
export default async function InventoryPage() {
  const user = await getSession();
  if (!user) redirect('/login?reason=expired');
  if (user.mustChangePassword) redirect('/change-password');
  if (!user.permissions.includes('dashboard.view')) redirect('/dashboard');
  return (
    <PortalShell user={user}>
      <InventoryBrowser permissions={user.permissions} />
    </PortalShell>
  );
}
