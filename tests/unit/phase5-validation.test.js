import test from 'node:test';
import assert from 'node:assert/strict';
import { ValidationError } from '../../src/lib/constants/errors.js';
import { validateCategoryInput } from '../../src/modules/categories/categoryValidation.js';
import { validateProductInput } from '../../src/modules/products/productValidation.js';
import { computeProductStockStatus } from '../../src/modules/products/productService.js';
import { validateCreateInternalUserInput } from '../../src/modules/users/userValidation.js';
import {
  validateCreatePoInput,
  validateShipmentInput,
} from '../../src/modules/purchase-orders/poValidation.js';
import { validateCreateIncomingInput } from '../../src/modules/incoming/incomingValidation.js';
import {
  validateCreateOutgoingInput,
  validateHandoverInput,
} from '../../src/modules/outgoing/outgoingValidation.js';
import { validateCreateDiscrepancyInput } from '../../src/modules/discrepancies/discrepancyValidation.js';
import { validateCreateAdjustmentInput } from '../../src/modules/adjustments/adjustmentValidation.js';

test('Category and Product validations enforce constraints and strip stock edits', () => {
  const cat = validateCategoryInput({ code: 'sta', name: 'Stationery' });
  assert.equal(cat.code, 'STA');

  const prod = validateProductInput({
    sku: 'sta-001',
    name: 'Pensil HB 2',
    categoryId: 1,
    purchasePrice: '2500',
    minimumStock: '10',
    stock: '9999', // must NEVER be accepted by product validation
  });
  assert.equal(prod.sku, 'STA-001');
  assert.equal(prod.purchasePrice, 2500);
  assert.equal(prod.minimumStock, 10);
  assert.equal('stock' in prod, false);

  assert.throws(
    () => validateProductInput({ sku: 'A', name: 'X', categoryId: 0 }),
    ValidationError
  );

  assert.equal(computeProductStockStatus(0, 10, 20), 'Out of Stock');
  assert.equal(computeProductStockStatus(5, 10, 20), 'Severe');
  assert.equal(computeProductStockStatus(15, 10, 20), 'Low');
  assert.equal(computeProductStockStatus(25, 10, 20), 'Normal');
  assert.equal(computeProductStockStatus(5, null, null), 'Min. Belum Diatur');
});

test('User, PO, Shipment, Incoming, Outgoing, Discrepancy, and Adjustment validations enforce business inputs', () => {
  assert.throws(
    () =>
      validateCreateInternalUserInput({
        name: 'Sup',
        email: 'sup@x.com',
        password: 'Password123',
        role: 'supplier', // internal creation must reject supplier
      }),
    ValidationError
  );

  assert.throws(
    () =>
      validateCreatePoInput({
        supplierId: 1,
        orderDate: '2026-11-21',
        expectedArrival: '2026-11-20',
        items: [{ productId: 1, quantity: 5 }],
      }),
    ValidationError
  );

  assert.throws(
    () =>
      validateShipmentInput({
        courierName: 'JNE',
        trackingNumber: '',
        noTrackingReason: '',
      }),
    ValidationError
  );

  assert.throws(
    () => validateCreateIncomingInput({ purchaseOrderId: 0, items: [] }),
    ValidationError
  );

  assert.throws(
    () =>
      validateCreateOutgoingInput({
        shipmentDate: '2026-11-23',
        recipientName: '',
        items: [{ productId: 1, quantity: 2 }],
      }),
    ValidationError
  );

  assert.throws(
    () =>
      validateCreateOutgoingInput({
        shipmentDate: '2026-11-23',
        recipientName: 'PT Pelanggan Jaya',
        items: [
          { productId: 1, quantity: 2 },
          { productId: 1, quantity: 3 },
        ],
      }),
    ValidationError
  );

  const validOutgoing = validateCreateOutgoingInput({
    shipmentDate: '2026-11-23',
    recipientName: 'PT Pelanggan Jaya',
    notes: 'Pengiriman reguler',
    items: [{ productId: 1, quantity: 2 }],
  });
  assert.equal(validOutgoing.recipientName, 'PT Pelanggan Jaya');
  assert.equal(validOutgoing.shipmentDate, '2026-11-23');

  assert.throws(
    () =>
      validateHandoverInput({
        recipientName: 'Budi',
        recipientType: 'internal',
        handoverMethod: 'courier',
        courierName: '',
      }),
    ValidationError
  );

  const disc = validateCreateDiscrepancyInput({
    issueType: 'shortage',
    sourceType: 'incoming',
    sourceId: 10,
    productId: 2,
    expectedQuantity: '20',
    actualQuantity: '18',
    description: 'Kurang 2 pcs pada dus kedua',
  });
  assert.equal(disc.difference, -2);

  const adj = validateCreateAdjustmentInput({
    productId: 2,
    adjustmentType: 'loss',
    direction: 'decrease',
    quantityDelta: '3',
    reason: 'Barang hilang saat stock opname',
  });
  assert.equal(adj.quantityDelta, -3);
});
