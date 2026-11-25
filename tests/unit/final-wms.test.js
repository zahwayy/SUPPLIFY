import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ConflictError,
  ForbiddenError,
  UnauthorizedError,
  ValidationError,
} from '../../src/lib/constants/errors.js';
import { ROLES } from '../../src/lib/constants/roles.js';
import { PO_STATUSES, STOCK_STATUSES, TRANSACTION_STATUSES } from '../../src/lib/constants/statuses.js';
import {
  PERMISSIONS,
  hasPermission,
  requirePermission,
  assertSupplierOwnership,
} from '../../src/lib/auth/rbac.js';
import {
  STOCK_STATUS_META,
  STOCK_STATUS_FILTER_OPTIONS,
  formatAuditSummary,
  getRefundStatusMeta,
  getStockStatusMeta,
} from '../../src/lib/utils/labels.js';
import { buildCsv, sanitizeCsvCell } from '../../src/lib/utils/csv.js';
import { validateProductInput } from '../../src/modules/products/productValidation.js';
import { computeProductStockStatus } from '../../src/modules/products/productService.js';
import {
  validateCreatePoInput,
  validatePoRejectionInput,
} from '../../src/modules/purchase-orders/poValidation.js';
import {
  validateApproveIncomingInput,
  validateCreateIncomingInput,
} from '../../src/modules/incoming/incomingValidation.js';
import {
  validateRefundClaimInput,
  validateRefundStatusUpdateInput,
} from '../../src/modules/discrepancies/discrepancyValidation.js';
import {
  validateCreateOutgoingInput,
  validateHandoverInput,
} from '../../src/modules/outgoing/outgoingValidation.js';
import { validateAdjustmentRejectionInput } from '../../src/modules/adjustments/adjustmentValidation.js';
import {
  EXPORT_RESOURCES,
  assertCanExportResource,
} from '../../src/modules/export/exportService.js';

test('Final WMS RBAC enforces role boundaries for PO, Incoming, Discrepancy, Outgoing, Adjustment, and Export', () => {
  const admin = { id: 1, role: ROLES.ADMIN };
  const manager = { id: 2, role: ROLES.MANAGER };
  const staff = { id: 3, role: ROLES.STAFF };
  const supplier = { id: 4, role: ROLES.SUPPLIER, supplierId: 1 };

  // Manager approves Outgoing & Adjustment & Discrepancy, Staff ships Outgoing & creates Incoming
  assert.equal(hasPermission(manager, PERMISSIONS.PO_CREATE), true);
  assert.equal(hasPermission(staff, PERMISSIONS.PO_CREATE), false);
  assert.equal(hasPermission(manager, PERMISSIONS.TRANSACTIONS_APPROVE), true);
  assert.equal(hasPermission(staff, PERMISSIONS.TRANSACTIONS_APPROVE), false);
  assert.equal(hasPermission(staff, PERMISSIONS.TRANSACTIONS_HANDOVER), true);
  assert.equal(hasPermission(manager, PERMISSIONS.TRANSACTIONS_HANDOVER), false);
  assert.equal(hasPermission(manager, PERMISSIONS.DISCREPANCY_RESOLVE), true);
  assert.equal(hasPermission(staff, PERMISSIONS.DISCREPANCY_RESOLVE), false);
  assert.equal(hasPermission(manager, PERMISSIONS.ADJUSTMENT_APPROVE), true);
  assert.equal(hasPermission(staff, PERMISSIONS.ADJUSTMENT_APPROVE), false);
  assert.equal(hasPermission(supplier, PERMISSIONS.PO_RESPOND_OWN), true);
  assert.equal(hasPermission(staff, PERMISSIONS.PO_RESPOND_OWN), false);

  assert.throws(() => requirePermission(staff, PERMISSIONS.PO_CREATE), ForbiddenError);
  assert.throws(() => requirePermission(manager, PERMISSIONS.TRANSACTIONS_HANDOVER), ForbiddenError);
  assert.throws(() => requirePermission(null, PERMISSIONS.PO_CREATE), UnauthorizedError);

  assert.doesNotThrow(() => assertSupplierOwnership(supplier, 1));
  assert.throws(() => assertSupplierOwnership(supplier, 2), ForbiddenError);

  assert.ok(assertCanExportResource(admin, EXPORT_RESOURCES.CATEGORIES));
  assert.ok(assertCanExportResource(admin, EXPORT_RESOURCES.SUPPLIERS));
  assert.ok(assertCanExportResource(manager, EXPORT_RESOURCES.OUTGOING));
  assert.throws(() => assertCanExportResource(manager, EXPORT_RESOURCES.CATEGORIES), ForbiddenError);
  assert.throws(() => assertCanExportResource(manager, EXPORT_RESOURCES.SUPPLIERS), ForbiddenError);
  assert.ok(assertCanExportResource(staff, EXPORT_RESOURCES.INCOMING));
  assert.ok(assertCanExportResource(staff, EXPORT_RESOURCES.OUTGOING));
  assert.throws(() => assertCanExportResource(staff, EXPORT_RESOURCES.PRODUCTS), ForbiddenError);
  assert.throws(() => assertCanExportResource(supplier, EXPORT_RESOURCES.INCOMING), ForbiddenError);
  assert.throws(() => assertCanExportResource(admin, 'inventory'), ValidationError);
});

test('Product validation enforces lowStockThreshold > minimumStock and edit mode allows omitted SKU', () => {
  const created = validateProductInput({
    sku: 'FIN-001',
    name: 'Kertas Gambar A3',
    categoryId: 1,
    purchasePrice: '45000',
    minimumStock: '10',
    lowStockThreshold: '25',
    unit: 'rim',
    rackLocation: 'R-01',
  });
  assert.equal(created.sku, 'FIN-001');
  assert.equal(created.minimumStock, 10);
  assert.equal(created.lowStockThreshold, 25);

  assert.throws(
    () =>
      validateProductInput({
        sku: 'FIN-002',
        name: 'Threshold Sama Dengan Min',
        categoryId: 1,
        minimumStock: '10',
        lowStockThreshold: '10',
      }),
    ValidationError
  );

  assert.throws(
    () =>
      validateProductInput({
        sku: 'FIN-003',
        name: 'Threshold Tanpa Min',
        categoryId: 1,
        lowStockThreshold: '20',
      }),
    ValidationError
  );

  // Edit mode permits updating fields without re-submitting SKU
  const edited = validateProductInput(
    {
      name: 'Kertas Gambar A3 Revised',
      categoryId: 1,
      minimumStock: '10',
      lowStockThreshold: '25',
    },
    { isEdit: true }
  );
  assert.equal(edited.name, 'Kertas Gambar A3 Revised');
});

test('4-tier Stock Status classifies Out of Stock (Gray), Severe (Red), Low (Yellow), and Normal (Green)', () => {
  assert.equal(computeProductStockStatus(0, 10, 20), STOCK_STATUSES.OUT_OF_STOCK);
  assert.equal(computeProductStockStatus(1, 10, 20), STOCK_STATUSES.SEVERE);
  assert.equal(computeProductStockStatus(10, 10, 20), STOCK_STATUSES.SEVERE);
  assert.equal(computeProductStockStatus(11, 10, 20), STOCK_STATUSES.LOW);
  assert.equal(computeProductStockStatus(20, 10, 20), STOCK_STATUSES.LOW);
  assert.equal(computeProductStockStatus(21, 10, 20), STOCK_STATUSES.NORMAL);

  assert.equal(STOCK_STATUS_META[STOCK_STATUSES.OUT_OF_STOCK].tone, 'neutral');
  assert.equal(STOCK_STATUS_META[STOCK_STATUSES.OUT_OF_STOCK].label, 'Habis');
  assert.equal(getStockStatusMeta(STOCK_STATUSES.SEVERE).tone, 'danger');
  assert.equal(getStockStatusMeta(STOCK_STATUSES.SEVERE).label, 'Kritis');
  assert.equal(getStockStatusMeta(STOCK_STATUSES.LOW).tone, 'warning');
  assert.equal(getStockStatusMeta(STOCK_STATUSES.LOW).label, 'Menipis');
  assert.equal(getStockStatusMeta(STOCK_STATUSES.NORMAL).tone, 'success');
  assert.equal(getStockStatusMeta(STOCK_STATUSES.NORMAL).label, 'Aman');

  assert.deepEqual(
    STOCK_STATUS_FILTER_OPTIONS.map((o) => o.label),
    ['Habis (0)', 'Kritis (<= Min)', 'Menipis', 'Aman', 'Min. Belum Diatur']
  );
  assert.equal(formatAuditSummary({ stockStatusAfter: 'Low' }).includes('Status Stok: Menipis'), true);
});

test('PO Final WMS statuses and validations handle rejection reason and separated New PO links', () => {
  assert.equal(PO_STATUSES.INSPECTING, 'inspecting');
  assert.equal(PO_STATUSES.RECEIVED, 'received');
  assert.equal(PO_STATUSES.RETURNED, 'returned');

  const newPo = validateCreatePoInput({
    supplierId: 1,
    orderDate: '2026-11-23',
    expectedArrival: '2026-11-30',
    referencePoId: 12,
    sourceDiscrepancyId: 4,
    notes: 'PO terpisah pengganti unit kurang',
    items: [{ productId: 1, quantity: 10 }],
  });
  assert.equal(newPo.referencePoId, 12);
  assert.equal(newPo.sourceDiscrepancyId, 4);

  assert.throws(() => validatePoRejectionInput({ rejectionReason: 'No' }), ValidationError);
  const validRej = validatePoRejectionInput({
    rejectionReason: 'Stok bahan baku di supplier sedang kosong.',
  });
  assert.match(validRej.rejectionReason, /kosong/);
});

test('Incoming inspection & Manager Accepted Quantity enforce strict single-decision bounds', () => {
  const created = validateCreateIncomingInput({
    purchaseOrderId: 8,
    receivingDate: '2026-11-23',
    notes: 'Pemeriksaan fisik lengkap',
    items: [
      {
        productId: 2,
        quantity: 20,
        goodQuantity: 15,
        damagedQuantity: 5,
        conditionStatus: 'mixed',
      },
    ],
  });
  assert.equal(created.receivingDate, '2026-11-23');
  assert.equal(created.items[0].goodQuantity, 15);
  assert.equal(created.items[0].damagedQuantity, 5);

  const items = [
    {
      product_id: 2,
      sku: 'STA-002',
      ordered_quantity: 20,
      quantity: 20,
      good_quantity: 15,
      damaged_quantity: 5,
    },
  ];
  const accepted = validateApproveIncomingInput(
    {
      items: [
        {
          productId: 2,
          approvedQuantity: 14,
          discrepancyAction: 'create_new_po',
          managerNotes: '14 masuk stok, 6 sisanya klaim/PO baru',
        },
      ],
    },
    items
  );
  assert.equal(accepted.decisions[0].approvedQuantity, 14);
  assert.equal(accepted.decisions[0].discrepancyQuantity, 6);
  assert.equal(accepted.decisions[0].discrepancyAction, 'create_new_po');
});

test('Discrepancy Refund Claim validations require details and mandatory rejection reason', () => {
  assert.throws(
    () => validateRefundClaimInput({ refundAmount: '-100', refundNotes: 'ok' }),
    ValidationError
  );
  const claim = validateRefundClaimInput({
    refundAmount: '250000',
    refundNotes: 'Klaim refund 5 rim kertas A4 yang basah saat tiba di gudang.',
  });
  assert.equal(claim.refundAmount, 250000);

  assert.throws(
    () =>
      validateRefundStatusUpdateInput({
        refundStatus: 'rejected',
        refundNotes: 'no',
      }),
    ValidationError
  );
  const approvedRefund = validateRefundStatusUpdateInput({
    refundStatus: 'approved',
    refundAmount: '250000',
    refundNotes: 'Supplier menyetujui transfer refund.',
  });
  assert.equal(approvedRefund.refundStatus, 'approved');
  assert.equal(getRefundStatusMeta('submitted').label, 'Diajukan ke Supplier');
});

test('Outgoing Shipped workflow validations enforce shipmentDate, recipientName, and Stock Adjustment rejection reason', () => {
  assert.equal(TRANSACTION_STATUSES.SHIPPED, 'shipped');

  assert.throws(
    () =>
      validateCreateOutgoingInput({
        shipmentDate: '2026-02-30',
        recipientName: 'PT Customer',
        items: [{ productId: 1, quantity: 2 }],
      }),
    ValidationError
  );

  const validOut = validateCreateOutgoingInput({
    shipmentDate: '2026-11-24',
    recipientName: 'CV Sinar Harapan',
    notes: 'Pengiriman proyek kantor',
    items: [{ productId: 1, quantity: 3 }],
  });
  assert.equal(validOut.shipmentDate, '2026-11-24');
  assert.equal(validOut.recipientName, 'CV Sinar Harapan');

  const handover = validateHandoverInput(
    { handoverMethod: 'courier', courierName: 'JNE Cargo', trackingNumber: 'JNE-123' },
    { fallbackRecipientName: 'CV Sinar Harapan' }
  );
  assert.equal(handover.recipientName, 'CV Sinar Harapan');
  assert.equal(handover.recipientType, 'customer');

  assert.throws(
    () => validateAdjustmentRejectionInput({ rejectionReason: 'abc' }),
    ValidationError
  );
  const adjRej = validateAdjustmentRejectionInput({
    rejectionReason: 'Perlu stock opname ulang pada rak A-2.',
  });
  assert.match(adjRej.rejectionReason, /stock opname ulang/);
});

test('CSV export neutralizes formula injection and formats escaping cleanly', () => {
  assert.equal(sanitizeCsvCell('=CMD("calc")'), `"'=CMD(""calc"")"`);
  assert.equal(sanitizeCsvCell('+SUM(A1:A2)'), `'+SUM(A1:A2)`);
  assert.equal(sanitizeCsvCell('-5'), '-5');
  const csv = buildCsv(
    [
      { header: 'SKU', key: 'sku' },
      { header: 'Catatan', key: 'notes' },
    ],
    [{ sku: 'STA-001', notes: 'Aman, "bersegel"' }]
  );
  assert.match(csv, /^\uFEFFSKU,Catatan/);
  assert.match(csv, /"Aman, ""bersegel"""/);
});
