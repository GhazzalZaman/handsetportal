'use client';
import { FormEvent, useState } from 'react';
import { authFetch, AuthRequestError } from '../lib/auth-fetch';
export function AuthForm({
  mode,
  expired = false,
}: {
  mode: 'login' | 'change-password';
  expired?: boolean;
}) {
  const [error, setError] = useState(''),
    [pending, setPending] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setPending(true);
    const form = event.currentTarget;
    const data = new FormData(form);
    const body =
      mode === 'login'
        ? {
            username: String(data.get('username') ?? ''),
            password: String(data.get('password') ?? ''),
          }
        : {
            currentPassword: String(data.get('currentPassword') ?? ''),
            newPassword: String(data.get('newPassword') ?? ''),
          };
    try {
      const response = await authFetch('/api/v1/auth/' + mode, {
        method: 'POST',
        body: JSON.stringify(body),
      });
      const user = (await response.json()) as { mustChangePassword: boolean };
      window.location.replace(
        user.mustChangePassword ? '/change-password' : '/dashboard',
      );
    } catch (cause) {
      setError(
        cause instanceof AuthRequestError && cause.status === 429
          ? 'Too many attempts. Please try again later.'
          : cause instanceof AuthRequestError &&
              cause.code === 'PASSWORD_POLICY'
            ? 'Choose a longer, uncommon password that differs from your username and current password.'
            : mode === 'login'
              ? 'Unable to sign in. Check your credentials and try again.'
              : 'Unable to change your password. Check your current password and try again.',
      );
    } finally {
      for (const input of Array.from(
        form.querySelectorAll<HTMLInputElement>('input[type="password"]'),
      ))
        input.value = '';
      setPending(false);
    }
  }
  return (
    <div className="auth-layout">
      <aside className="auth-story">
        <div className="brand">
          <span className="brand-mark">Jazz</span>
          <span>
            Handset Portal<small>EXPERIENCE CENTERS</small>
          </span>
        </div>
        <h2>
          One place.
          <br />
          Every connection.
        </h2>
        <p>
          A simpler way to manage handsets, organize your centers, and support
          your team.
        </p>
        <div className="auth-features">
          <span>A shared handset catalog</span>
          <span>Organized teams and centers</span>
          <span>Secure access for your role</span>
        </div>
      </aside>
      <main className="auth-main">
        <p className="eyebrow">JAZZ EXPERIENCE CENTERS</p>
        <h1>{mode === 'login' ? 'Welcome back' : 'Change your password'}</h1>
        {mode === 'login' && (
          <p>Sign in to your Experience Center workspace.</p>
        )}
        {expired && (
          <p role="status">
            Your session expired or is no longer valid. Please sign in again.
          </p>
        )}
        {mode === 'change-password' && (
          <p>
            Choose an uncommon password of at least 12 characters. Your other
            sessions will be signed out.
          </p>
        )}
        <form onSubmit={submit}>
          {mode === 'login' ? (
            <>
              <label htmlFor="username">Username</label>
              <input
                id="username"
                name="username"
                autoComplete="username"
                maxLength={100}
                required
                autoFocus
              />
              <label htmlFor="password">Password</label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                maxLength={128}
                required
              />
            </>
          ) : (
            <>
              <label htmlFor="currentPassword">Current password</label>
              <input
                id="currentPassword"
                name="currentPassword"
                type="password"
                autoComplete="current-password"
                maxLength={128}
                required
              />
              <label htmlFor="newPassword">New password</label>
              <input
                id="newPassword"
                name="newPassword"
                type="password"
                autoComplete="new-password"
                minLength={12}
                maxLength={128}
                required
              />
            </>
          )}
          <button disabled={pending} type="submit">
            {pending
              ? 'Please wait…'
              : mode === 'login'
                ? 'Sign in'
                : 'Change password'}
          </button>
          {error && <p role="alert">{error}</p>}
        </form>
        <p className="auth-note">
          Need help accessing your account? Contact your portal administrator.
        </p>
      </main>
    </div>
  );
}
