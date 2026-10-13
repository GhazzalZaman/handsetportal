import { requireAdmin } from '../../../lib/admin-session';
import { CentersAdmin } from '../../../components/admin/centers';
export default async function CentersPage() {
  await requireAdmin();
  return <CentersAdmin />;
}
