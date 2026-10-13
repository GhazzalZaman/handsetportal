import 'server-only';
import { redirect } from 'next/navigation';
import { getSession } from './session';
export async function requireAdmin() {
  const user = await getSession();
  if (!user) redirect('/login?reason=expired');
  if (user.mustChangePassword) redirect('/change-password');
  if (!user.permissions.includes('users.manage')) redirect('/dashboard');
  return user;
}
