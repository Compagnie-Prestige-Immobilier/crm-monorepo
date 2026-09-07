const LOGIN_PATH = '/connexion';

export const SESSION_EXPIRED_PARAM = 'session';
export const SESSION_EXPIRED_VALUE = 'expiree';

let redirecting = false;

export function resetSessionExpiryGuard(): void {
  redirecting = false;
}

export function redirectToLogin(): boolean {
  if (typeof window === 'undefined') return false;
  if (redirecting) return false;
  if (window.location.pathname === LOGIN_PATH) return false;

  redirecting = true;

  const target = new URL(LOGIN_PATH, window.location.origin);
  target.searchParams.set(SESSION_EXPIRED_PARAM, SESSION_EXPIRED_VALUE);

  const from = `${window.location.pathname}${window.location.search}`;
  if (from !== '/' && from !== LOGIN_PATH) target.searchParams.set('suite', from);

  window.location.replace(target.toString());
  return true;
}
