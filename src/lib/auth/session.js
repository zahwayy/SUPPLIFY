import { cookies } from 'next/headers.js';
import {
  SESSION_COOKIE_NAME,
  getSessionCookieOptions,
  getClearedCookieOptions,
} from './cookieConfig.js';
import {
  createSessionRecord,
  findActiveSessionByToken,
  revokeSessionByToken,
} from './sessionStore.js';

export async function createUserSession(userId, client = null) {
  const { rawToken, expiresAt, session } = await createSessionRecord(userId, client);
  const cookieStore = await cookies();
  const options = getSessionCookieOptions(expiresAt);

  cookieStore.set(options.name, rawToken, {
    httpOnly: options.httpOnly,
    sameSite: options.sameSite,
    path: options.path,
    secure: options.secure,
    expires: options.expires,
  });

  return session;
}

export async function getCurrentUser() {
  const cookieStore = await cookies();
  const rawToken = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (!rawToken) return null;

  return findActiveSessionByToken(rawToken);
}

export async function destroyCurrentSession() {
  const cookieStore = await cookies();
  const rawToken = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  try {
    if (rawToken) {
      await revokeSessionByToken(rawToken);
    }
  } finally {
    cookieStore.set(SESSION_COOKIE_NAME, '', getClearedCookieOptions());
  }
}
