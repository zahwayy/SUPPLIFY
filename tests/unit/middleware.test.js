import test from 'node:test';
import assert from 'node:assert/strict';
import { NextRequest } from 'next/server.js';
import { middleware } from '../../src/middleware.js';
import { SESSION_COOKIE_NAME } from '../../src/lib/auth/cookieConfig.js';

test('Middleware redirects unauthenticated requests on all protected role routes to /login', () => {
  const protectedPaths = [
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

  for (const path of protectedPaths) {
    const req = new NextRequest(`http://localhost:3000${path}`);
    const res = middleware(req);
    assert.equal(res.status, 307, `Expected redirect for ${path}`);
    assert.equal(new URL(res.headers.get('location')).pathname, '/login');
  }
});

test('Middleware redirects cookie-holding visitors away from /login and /register to /dashboard', () => {
  const req = new NextRequest('http://localhost:3000/login', {
    headers: { cookie: `${SESSION_COOKIE_NAME}=sample-token` },
  });
  const res = middleware(req);

  assert.equal(res.status, 307);
  assert.equal(new URL(res.headers.get('location')).pathname, '/dashboard');
});

test('Middleware allows /login?expired=1 and /login?loggedOut=1 while clearing stale session cookies', () => {
  for (const query of ['expired=1', 'loggedOut=1']) {
    const req = new NextRequest(`http://localhost:3000/login?${query}`, {
      headers: { cookie: `${SESSION_COOKIE_NAME}=stale-token` },
    });
    const res = middleware(req);

    assert.equal(res.status, 200);
    assert.equal(res.headers.get('location'), null);
    const setCookie = res.headers.get('set-cookie') || '';
    assert.match(setCookie, new RegExp(`${SESSION_COOKIE_NAME}=;`));
    assert.match(setCookie, /Max-Age=0/i);
  }
});
