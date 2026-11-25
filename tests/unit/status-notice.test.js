import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createSignedStatusToken,
  verifySignedStatusToken,
} from '../../src/lib/auth/statusNotice.js';

test('Signed status notice token verifies valid payload and rejects tampered tokens', () => {
  process.env.SESSION_SECRET = 'test-secret-for-status-notice-verification';
  const token = createSignedStatusToken({ userId: 42, expectedStatus: 'pending' });

  const verified = verifySignedStatusToken(token);
  assert.ok(verified);
  assert.equal(verified.userId, '42');
  assert.equal(verified.expectedStatus, 'pending');

  // Tamper payload
  const [, sig] = token.split('.');
  const fakePayload = Buffer.from(
    JSON.stringify({ userId: '1', expectedStatus: 'active', exp: Date.now() + 60000 })
  ).toString('base64url');
  assert.equal(verifySignedStatusToken(`${fakePayload}.${sig}`), null);
  assert.equal(verifySignedStatusToken('invalid'), null);
});
