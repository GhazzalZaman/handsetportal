import { requireAdmin } from '../../../lib/admin-session';
import { UsersAdmin } from '../../../components/admin/users';
export default async function UsersPage() {
  const user = await requireAdmin();
  return <UsersAdmin actorId={user.id} />;
}
