import { NextResponse } from 'next/server.js';
import {
  SESSION_COOKIE_NAME,
  getClearedCookieOptions,
} from './lib/auth/cookieConfig.js';

const AUTH_ROUTES = ['/login', '/register'];
const PROTECTED_PREFIXES = [
  '/dashboard',
  '/profile',
  '/products',
  '/categories',
  '/inventory',
  '/incoming',
  '/outgoing',
  '/restock-orders',
  '/purchase-orders',
  '/discrepancies',
  '/stock-adjustments',
  '/stock-movements',
  '/supplier-verification',
  '/users',
  '/activity-log',
  '/shipment',
  '/shipment-history',
];

export function middleware(request) {
  const { pathname, searchParams } = request.nextUrl;
  const hasSessionCookie = Boolean(request.cookies.get(SESSION_COOKIE_NAME)?.value);

  const isAuthRoute = AUTH_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`)
  );
  const isProtectedRoute = PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );

  // Preliminary cookie check only; full session & RBAC validation runs on the server.
  if (isProtectedRoute && !hasSessionCookie) {
    const loginUrl = new URL('/login', request.url);
    return NextResponse.redirect(loginUrl);
  }

  if (isProtectedRoute && hasSessionCookie) {
    const res = NextResponse.next();
    res.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    return res;
  }

  // Allow explicit expired / logged-out transitions to render /login cleanly while purging any stale cookie
  if (
    isAuthRoute &&
    hasSessionCookie &&
    (searchParams.has('expired') || searchParams.has('loggedOut'))
  ) {
    const res = NextResponse.next();
    res.cookies.set(SESSION_COOKIE_NAME, '', getClearedCookieOptions());
    res.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    return res;
  }

  // Redirect authenticated-looking visitors away from guest-only pages
  if (isAuthRoute && hasSessionCookie) {
    const dashboardUrl = new URL('/dashboard', request.url);
    return NextResponse.redirect(dashboardUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
