import test from 'node:test';
import assert from 'node:assert/strict';
import { ValidationError } from '../../src/lib/constants/errors.js';
import {
  hasValidPurchasePrice,
  assertValidProductPrice,
  validateProductInput,
} from '../../src/modules/products/productValidation.js';
import { computeProductStockStatus } from '../../src/modules/products/productService.js';
import {
  isSecureCookieEnabled,
  getClearedCookieOptions,
  getSessionCookieOptions,
} from '../../src/lib/auth/cookieConfig.js';

test('hasValidPurchasePrice and assertValidProductPrice reject missing, zero, or negative prices', () => {
  assert.equal(hasValidPurchasePrice(null), false);
  assert.equal(hasValidPurchasePrice(undefined), false);
  assert.equal(hasValidPurchasePrice(''), false);
  assert.equal(hasValidPurchasePrice(0), false);
  assert.equal(hasValidPurchasePrice('0'), false);
  assert.equal(hasValidPurchasePrice(-100), false);
  assert.equal(hasValidPurchasePrice('NaN'), false);

  assert.equal(hasValidPurchasePrice('52.00'), true);
  assert.equal(hasValidPurchasePrice(2500), true);

  assert.throws(
    () =>
      assertValidProductPrice({
        sku: 'STA-005',
        name: 'Drawing Pen 0.1 mm',
        purchase_price: null,
      }),
    ValidationError
  );
  assert.throws(
    () =>
      assertValidProductPrice({
        sku: 'ZERO-001',
        name: 'Produk Nol',
        purchase_price: '0',
      }),
    ValidationError
  );
  assert.equal(
    assertValidProductPrice({
      sku: 'TES-001',
      name: 'testing',
      purchase_price: '52.00',
    }),
    52
  );
});

test('validateProductInput validates purchasePrice, sellingPrice, and curated unit options', () => {
  const emptyPriceProd = validateProductInput({
    sku: 'TST-001',
    name: 'Test Item',
    categoryId: 1,
    purchasePrice: '',
    sellingPrice: '15000',
    minimumStock: '5',
    unit: 'pcs',
    rackLocation: 'A-1',
  });
  assert.equal(emptyPriceProd.purchasePrice, null);
  assert.equal(emptyPriceProd.sellingPrice, 15000);
  assert.equal(emptyPriceProd.unit, 'PCS');
  assert.equal(emptyPriceProd.rackLocation, 'A-1');

  assert.throws(
    () =>
      validateProductInput({
        sku: 'TST-002',
        name: 'Zero Price Item',
        categoryId: 1,
        purchasePrice: '0',
      }),
    ValidationError
  );

  assert.throws(
    () =>
      validateProductInput({
        sku: 'TST-003',
        name: 'Negative Price Item',
        categoryId: 1,
        purchasePrice: '-500',
      }),
    ValidationError
  );

  assert.throws(
    () =>
      validateProductInput({
        sku: 'TST-004',
        name: 'Negative Selling Price Item',
        categoryId: 1,
        sellingPrice: '-100',
      }),
    ValidationError
  );

  assert.throws(
    () =>
      validateProductInput({
        sku: 'TST-005',
        name: 'Invalid Unit Item',
        categoryId: 1,
        unit: 'karung',
      }),
    ValidationError
  );

  assert.throws(
    () =>
      validateProductInput(
        {
          sku: 'TST-006',
          name: 'Missing Form Fields',
          categoryId: 1,
          purchasePrice: '',
          sellingPrice: '',
          unit: '',
        },
        { requirePrices: true, requireUnit: true }
      ),
    ValidationError
  );
});

test('computeProductStockStatus tracks 4-tier Out of Stock, Severe, Low, Normal, and Unconfigured states accurately', () => {
  assert.equal(computeProductStockStatus(0, 0, 5), 'Out of Stock');
  assert.equal(computeProductStockStatus(0, 10, 20), 'Out of Stock');
  assert.equal(computeProductStockStatus(10, 10, 20), 'Severe');
  assert.equal(computeProductStockStatus(4, 10, 20), 'Severe');
  assert.equal(computeProductStockStatus(11, 10, 20), 'Low');
  assert.equal(computeProductStockStatus(20, 10, 20), 'Low');
  assert.equal(computeProductStockStatus(21, 10, 20), 'Normal');
  assert.equal(computeProductStockStatus(15, 10), 'Normal');
  assert.equal(computeProductStockStatus(5, null, null), 'Min. Belum Diatur');
});

test('isSecureCookieEnabled disables Secure attribute on localhost HTTP and aligns set/clear options', () => {
  const prevEnv = { ...process.env };
  try {
    delete process.env.COOKIE_SECURE;
    process.env.NODE_ENV = 'production';
    process.env.APP_URL = 'http://localhost:3000';
    assert.equal(isSecureCookieEnabled(), false);

    process.env.APP_URL = 'https://supplify.example.com';
    assert.equal(isSecureCookieEnabled(), true);

    process.env.COOKIE_SECURE = 'false';
    assert.equal(isSecureCookieEnabled(), false);

    const setOpts = getSessionCookieOptions(new Date(Date.now() + 60000));
    const clearOpts = getClearedCookieOptions();
    assert.equal(setOpts.secure, clearOpts.secure);
    assert.equal(setOpts.path, clearOpts.path);
    assert.equal(setOpts.sameSite, clearOpts.sameSite);
    assert.equal(setOpts.httpOnly, clearOpts.httpOnly);
    assert.equal(clearOpts.maxAge, 0);
  } finally {
    process.env = prevEnv;
  }
});
