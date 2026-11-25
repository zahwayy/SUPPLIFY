import test from 'node:test';
import assert from 'node:assert/strict';
import { ROLES } from '../../src/lib/constants/roles.js';
import { ValidationError } from '../../src/lib/constants/errors.js';
import { SUPPLIER_APPEAL_STATUSES } from '../../src/lib/constants/statuses.js';
import {
  SUPPLIER_APPEAL_STATUS_META,
  getSupplierAppealStatusMeta,
} from '../../src/lib/utils/labels.js';
import {
  filterProductOptions,
  findSelectedProductOption,
} from '../../src/lib/utils/productSearch.js';
import { validateUpdateOwnProfileInput } from '../../src/modules/users/userValidation.js';
import {
  validateSupplierAppealInput,
  validateAppealReviewInput,
} from '../../src/modules/suppliers/supplierValidation.js';

const SAMPLE_PRODUCTS = [
  { id: 1, sku: 'STA-001', name: 'Spidol Whiteboard Hitam', category_name: 'Alat Tulis' },
  { id: 2, sku: 'PAP-014', name: 'Kertas HVS A4 80gr', category_name: 'Kertas & Percetakan' },
  { id: 3, sku: 'CAT-009', name: 'Cat Akrilik Biru Kobalt', category_name: 'Seni & Lukis' },
];

test('filterProductOptions filters by name, SKU, and category case-insensitively while preserving selected lookup', () => {
  assert.equal(filterProductOptions(SAMPLE_PRODUCTS, '').length, 3);
  assert.equal(filterProductOptions(SAMPLE_PRODUCTS, '   ').length, 3);

  const bySku = filterProductOptions(SAMPLE_PRODUCTS, 'pap-014');
  assert.equal(bySku.length, 1);
  assert.equal(bySku[0].id, 2);

  const byName = filterProductOptions(SAMPLE_PRODUCTS, 'akrilik');
  assert.equal(byName.length, 1);
  assert.equal(byName[0].sku, 'CAT-009');

  const byCategory = filterProductOptions(SAMPLE_PRODUCTS, 'alat tulis');
  assert.equal(byCategory.length, 1);
  assert.equal(byCategory[0].id, 1);

  const emptyResult = filterProductOptions(SAMPLE_PRODUCTS, 'SKU-TIDAK-ADA');
  assert.equal(emptyResult.length, 0);

  // Selected product remains resolvable from full products list even when filtered list is empty
  const selected = findSelectedProductOption(SAMPLE_PRODUCTS, '2');
  assert.equal(selected?.sku, 'PAP-014');
  assert.equal(findSelectedProductOption(SAMPLE_PRODUCTS, ''), null);
});

test('validateUpdateOwnProfileInput enforces allowed profile fields per role', () => {
  const staffOk = validateUpdateOwnProfileInput(
    { name: '  Budi Santoso  ', phone: '0812-3456-7890' },
    { role: ROLES.STAFF }
  );
  assert.equal(staffOk.name, 'Budi Santoso');
  assert.equal(staffOk.phone, '0812-3456-7890');
  assert.equal(staffOk.contactName, null);

  assert.throws(
    () =>
      validateUpdateOwnProfileInput(
        { name: 'A', phone: '' },
        { role: ROLES.STAFF }
      ),
    ValidationError
  );

  assert.throws(
    () =>
      validateUpdateOwnProfileInput(
        { name: 'Budi Santoso', phone: 'abc-not-phone' },
        { role: ROLES.MANAGER }
      ),
    ValidationError
  );

  // Supplier requires phone, contactName, and address
  assert.throws(
    () =>
      validateUpdateOwnProfileInput(
        { name: 'Mitra Karya', phone: '', contactName: '', address: '' },
        { role: ROLES.SUPPLIER }
      ),
    ValidationError
  );

  const supplierOk = validateUpdateOwnProfileInput(
    {
      name: 'Akun Mitra Karya',
      phone: '+62 811 2233 4455',
      contactName: 'Rina Kusuma',
      address: 'Jl. Industri Kreatif No. 18, Bandung',
    },
    { role: ROLES.SUPPLIER }
  );
  assert.equal(supplierOk.contactName, 'Rina Kusuma');
  assert.equal(supplierOk.address, 'Jl. Industri Kreatif No. 18, Bandung');
});

test('validateSupplierAppealInput and validateAppealReviewInput enforce required fields and notes', () => {
  assert.throws(
    () => validateSupplierAppealInput({ appealReason: 'Singkat' }),
    ValidationError
  );

  const validAppeal = validateSupplierAppealInput({
    appealReason:
      'Nomor telepon PIC sebelumnya salah ketik. Kami sertakan kontak dan alamat gudang resmi perusahaan.',
    phone: '081298765432',
    contactName: 'Andi Wijaya',
    additionalNotes: 'NPWP dan SIUP tersedia untuk verifikasi ulang.',
  });
  assert.equal(validAppeal.proposedUpdates.phone, '081298765432');
  assert.equal(validAppeal.proposedUpdates.contactName, 'Andi Wijaya');

  // Rejecting an appeal requires clear admin decision notes
  assert.throws(
    () =>
      validateAppealReviewInput({
        decision: SUPPLIER_APPEAL_STATUSES.REJECTED,
        adminDecisionNotes: 'OK',
      }),
    ValidationError
  );

  const approvedReview = validateAppealReviewInput({
    decision: SUPPLIER_APPEAL_STATUSES.APPROVED,
    adminDecisionNotes: '',
  });
  assert.equal(approvedReview.decision, SUPPLIER_APPEAL_STATUSES.APPROVED);
  assert.equal(approvedReview.adminDecisionNotes, null);

  assert.equal(SUPPLIER_APPEAL_STATUS_META.submitted.label, 'Banding Diajukan');
  assert.equal(getSupplierAppealStatusMeta('under_review').label, 'Ditinjau Admin');
});
