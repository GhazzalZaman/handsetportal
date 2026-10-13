import { requireAdmin } from '../../../lib/admin-session';
import { RolesAdmin } from '../../../components/admin/roles';
export default async function RolesPage() {
  await requireAdmin();
  return <RolesAdmin />;
}
