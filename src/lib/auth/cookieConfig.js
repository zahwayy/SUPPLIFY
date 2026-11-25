export const SESSION_COOKIE_NAME = 'supplify_session';

export function getSessionTtlMs() {
  const days = Number(process.env.SESSION_TTL_DAYS || '7');
  const safeDays = Number.isFinite(days) && days > 0 ? days : 7;
  return safeDays * 24 * 60 * 60 * 1000;
}

export function isSecureCookieEnabled() {
  if (process.env.COOKIE_SECURE === 'true') return true;
  if (process.env.COOKIE_SECURE === 'false') return false;

  const appUrl = (process.env.APP_URL || '').trim().toLowerCase();
  if (
    appUrl.startsWith('http://localhost') ||
    appUrl.startsWith('http://127.0.0.1') ||
    appUrl.startsWith('http://0.0.0.0')
  ) {
    return false;
  }
  if (appUrl.startsWith('https://')) {
    return true;
  }

  return process.env.NODE_ENV === 'production';
}

export function getSessionCookieOptions(expiresAt) {
  return {
    name: SESSION_COOKIE_NAME,
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    secure: isSecureCookieEnabled(),
    expires: expiresAt,
  };
}

export function getClearedCookieOptions() {
  return {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    secure: isSecureCookieEnabled(),
    maxAge: 0,
  };
}
