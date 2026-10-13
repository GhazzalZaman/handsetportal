import { requireAdmin } from '../../lib/admin-session';
import { PortalShell } from '../../components/portal-shell';
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireAdmin();
  return (
    <PortalShell user={user}>
      <main className="admin">
        <p className="eyebrow">ADMINISTRATION</p>
        {children}
      </main>
    </PortalShell>
  );
}
