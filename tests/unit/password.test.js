import test from 'node:test';
import assert from 'node:assert/strict';
import { hashPassword, verifyPassword } from '../../src/lib/auth/password.js';

test('hashPassword produces bcrypt hash and verifyPassword validates correctly', async () => {
  const plain = 'SupplifyTestPass123!';
  const hash = await hashPassword(plain);

  assert.notEqual(hash, plain);
  assert.equal(hash.startsWith('$2'), true);
  assert.equal(await verifyPassword(plain, hash), true);
  assert.equal(await verifyPassword('WrongPassword', hash), false);
});
