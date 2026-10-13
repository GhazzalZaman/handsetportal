import { redirect } from 'next/navigation';
import { getSession } from '../../lib/session';
import { AuthForm } from '../../components/auth-form';
import { SessionActions } from '../../components/session-actions';
export default async function ChangePasswordPage() {
  const user = await getSession();
  if (!user) redirect('/login?reason=expired');
  return (
    <>
      <AuthForm mode="change-password" />
      <section className="session-actions">
        <SessionActions
          idleExpiresAt={user.idleExpiresAt}
          absoluteExpiresAt={user.absoluteExpiresAt}
        />
      </section>
    </>
  );
}
