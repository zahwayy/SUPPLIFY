import test from 'node:test';
import assert from 'node:assert/strict';
import {
  validateLoginInput,
  validateSupplierRegistrationInput,
} from '../../src/modules/auth/authValidation.js';
import { ValidationError } from '../../src/lib/constants/errors.js';

test('validateLoginInput normalizes email and rejects invalid inputs', () => {
  const valid = validateLoginInput({
    email: '  Admin@Supplify.Local ',
    password: 'Password123!',
  });
  assert.equal(valid.email, 'admin@supplify.local');
  assert.equal(valid.password, 'Password123!');

  assert.throws(
    () => validateLoginInput({ email: 'not-an-email', password: '' }),
    ValidationError
  );
});

test('validateSupplierRegistrationInput checks required fields, categoryIds, and password confirmation', () => {
  const valid = validateSupplierRegistrationInput({
    name: 'Budi Santoso',
    email: 'budi@vendor.co.id',
    password: 'StrongPassword123',
    confirmPassword: 'StrongPassword123',
    companyName: 'PT Alat Tulis Jaya',
    contactName: 'Budi',
    phone: '08123456789',
    address: 'Jl. Gudang Raya No. 12, Jakarta',
    categoryIds: ['1', '2', '1'],
  });
  assert.equal(valid.email, 'budi@vendor.co.id');
  assert.equal(valid.companyName, 'PT Alat Tulis Jaya');
  assert.deepEqual(valid.categoryIds, [1, 2]);

  assert.throws(
    () =>
      validateSupplierRegistrationInput({
        name: 'Budi Santoso',
        email: 'budi@vendor.co.id',
        password: 'StrongPassword123',
        confirmPassword: 'StrongPassword123',
        companyName: 'PT Alat Tulis Jaya',
        contactName: 'Budi',
        phone: '08123456789',
        address: 'Jl. Gudang Raya No. 12, Jakarta',
        categoryIds: [],
      }),
    ValidationError
  );

  assert.throws(
    () =>
      validateSupplierRegistrationInput({
        name: 'B',
        email: 'bad',
        password: 'short',
        confirmPassword: 'mismatch',
        companyName: '',
        contactName: '',
        phone: '12',
        address: 'abc',
      }),
    ValidationError
  );
});
