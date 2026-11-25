import crypto from 'node:crypto';
import { cookies } from 'next/headers.js';

export const STATUS_NOTICE_COOKIE_NAME = 'supplify_status_notice';
const STATUS_NOTICE_TTL_MS = 60 * 60 * 1000;

function signPayload(encoded) {
  const secret = process.env.SESSION_SECRET || '';
  return crypto.createHmac('sha256', secret).update(encoded).digest('base64url');
}

export function createSignedStatusToken({ userId, expectedStatus }) {
  const payload = {
    userId: String(userId),
    expectedStatus: String(expectedStatus),
    exp: Date.now() + STATUS_NOTICE_TTL_MS,
  };
  const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = signPayload(encoded);
  return `${encoded}.${sig}`;
}

export function verifySignedStatusToken(token) {
  if (!token || typeof token !== 'string' || !token.includes('.')) return null;
  const [encoded, sig] = token.split('.');
  if (!encoded || !sig) return null;

  const expectedSig = signPayload(encoded);
  const sigBuf = Buffer.from(sig);
  const expBuf = Buffer.from(expectedSig);
  if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
    return null;
  }

  try {
    const parsed = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8'));
    if (!parsed?.userId || !parsed?.expectedStatus || parsed.exp < Date.now()) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export async function setStatusNoticeCookie({ userId, expectedStatus }) {
  const token = createSignedStatusToken({ userId, expectedStatus });
  const cookieStore = await cookies();
  cookieStore.set(STATUS_NOTICE_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    secure: process.env.NODE_ENV === 'production',
    maxAge: Math.floor(STATUS_NOTICE_TTL_MS / 1000),
  });
}

export async function readStatusNoticeCookie() {
  const cookieStore = await cookies();
  const raw = cookieStore.get(STATUS_NOTICE_COOKIE_NAME)?.value;
  return verifySignedStatusToken(raw);
}
