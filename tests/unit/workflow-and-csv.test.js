import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ForbiddenError,
  UnauthorizedError,
  ValidationError,
} from '../../src/lib/constants/errors.js';
import { ROLES } from '../../src/lib/constants/roles.js';
import { hasPermission, PERMISSIONS } from '../../src/lib/auth/rbac.js';
import {
  validateCompletePoInput,
  validateInspectionRequestInput,
  validateSupplierArrivalInput,
} from '../../src/modules/purchase-orders/poValidation.js';
import {
  validateApproveIncomingInput,
  validateCreateIncomingInput,
} from '../../src/modules/incoming/incomingValidation.js';
import {
  buildCsv,
  buildExportFilename,
  sanitizeCsvCell,
} from '../../src/lib/utils/csv.js';
import {
  assertCanExportResource,
  EXPORT_RESOURCES,
} from '../../src/modules/export/exportService.js';

test('Incoming inspection validation enforces good + damaged == physical quantity', () => {
  const validSplit = validateCreateIncomingInput({
    purchaseOrderId: 5,
    notes: '10 pulpen rusak saat bongkar muat',
    items: [
      {
        productId: 1,
        quantity: 100,
        goodQuantity: 90,
        damagedQuantity: 10,
        conditionStatus: 'mixed',
        notes: '10 rusak',
      },
    ],
  });
  assert.equal(validSplit.items[0].quantity, 100);
  assert.equal(validSplit.items[0].goodQuantity, 90);
  assert.equal(validSplit.items[0].damagedQuantity, 10);

  // Sum mismatch must fail
  assert.throws(
    () =>
      validateCreateIncomingInput({
        purchaseOrderId: 5,
        items: [
          {
            productId: 1,
            quantity: 100,
            goodQuantity: 85,
            damagedQuantity: 10,
            conditionStatus: 'mixed',
          },
        ],
      }),
    ValidationError
  );

  // Condition damaged without explicit split defaults good=0, damaged=quantity
  const allDamaged = validateCreateIncomingInput({
    purchaseOrderId: 5,
    items: [{ productId: 2, quantity: 5, conditionStatus: 'damaged' }],
  });
  assert.equal(allDamaged.items[0].goodQuantity, 0);
  assert.equal(allDamaged.items[0].damagedQuantity, 5);
});

test('Manager Incoming approval validation requires explicit Accepted Quantity and caps at ordered and inspected quantities', () => {
  const existingItems = [
    {
      product_id: 1,
      sku: 'STA-001',
      ordered_quantity: 100,
      quantity: 100,
      good_quantity: 90,
      damaged_quantity: 10,
      condition_status: 'mixed',
    },
  ];

  // Null/missing explicit Manager decision must fail under Final WMS rules
  assert.throws(
    () => validateApproveIncomingInput(null, existingItems),
    ValidationError
  );

  // Explicit Manager decision (e.g. 80 accepted) succeeds with explicit discrepancyAction
  const explicitRes = validateApproveIncomingInput(
    {
      items: [
        {
          productId: 1,
          approvedQuantity: 80,
          discrepancyAction: 'refund_claim',
          managerNotes: '20 unit rusak/bermasalah tidak masuk stok',
        },
      ],
      supplierFollowupNotes: 'Ajukan klaim refund ke supplier atas 20 unit rusak',
    },
    existingItems
  );
  assert.equal(explicitRes.decisions[0].approvedQuantity, 80);
  assert.equal(explicitRes.decisions[0].discrepancyAction, 'refund_claim');
  assert.equal(explicitRes.decisions[0].discrepancyQuantity, 20);
  assert.equal(
    explicitRes.supplierFollowupNotes,
    'Ajukan klaim refund ke supplier atas 20 unit rusak'
  );

  // Approving more than physically inspected must fail
  assert.throws(
    () =>
      validateApproveIncomingInput(
        { items: [{ productId: 1, approvedQuantity: 105 }] },
        existingItems
      ),
    ValidationError
  );

  // Approving total 0 across entire report must fail (Manager should reject -> Returned instead)
  assert.throws(
    () =>
      validateApproveIncomingInput(
        { items: [{ productId: 1, approvedQuantity: 0 }] },
        existingItems
      ),
    ValidationError
  );

  // Approving more than ordered PO quantity (even with legacy accept_excess) must fail
  const excessItems = [
    {
      product_id: 1,
      sku: 'STA-001',
      ordered_quantity: 20,
      quantity: 30,
      good_quantity: 30,
      damaged_quantity: 0,
      condition_status: 'excess',
    },
  ];
  assert.throws(
    () =>
      validateApproveIncomingInput(
        { items: [{ productId: 1, approvedQuantity: 25, discrepancyAction: 'none' }] },
        excessItems
      ),
    ValidationError
  );
  assert.throws(
    () =>
      validateApproveIncomingInput(
        { items: [{ productId: 1, approvedQuantity: 25, discrepancyAction: 'accept_excess' }] },
        excessItems
      ),
    ValidationError
  );
});

test('PO arrival, inspection request, and official completion validations work correctly', () => {
  const arrival = validateSupplierArrivalInput({
    arrivalNotes: 'Tahap 1 tiba di gudang barat',
  });
  assert.equal(arrival.arrivalNotes, 'Tahap 1 tiba di gudang barat');

  const insp = validateInspectionRequestInput({
    notes: 'Periksa segel karton dan hitung fisik',
  });
  assert.equal(insp.notes, 'Periksa segel karton dan hitung fisik');

  // Completing with remaining obligations requires formal settlement notes
  assert.throws(
    () => validateCompletePoInput({ completionNotes: '' }, { hasRemaining: true }),
    ValidationError
  );
  const completedWithNotes = validateCompletePoInput(
    { completionNotes: 'Sisa 10 unit diselesaikan lewat kredit nota' },
    { hasRemaining: true }
  );
  assert.equal(
    completedWithNotes.completionNotes,
    'Sisa 10 unit diselesaikan lewat kredit nota'
  );
});

test('CSV export RBAC matches role matrix: Admin (6), Manager (4), Staff (own incoming/outgoing only), Supplier (none)', () => {
  const admin = { id: 1, role: ROLES.ADMIN };
  const manager = { id: 2, role: ROLES.MANAGER };
  const staff = { id: 3, role: ROLES.STAFF };
  const supplier = { id: 4, role: ROLES.SUPPLIER, supplierId: 10 };

  assert.equal(hasPermission(admin, PERMISSIONS.EXPORT_CSV), true);
  assert.equal(hasPermission(manager, PERMISSIONS.EXPORT_CSV), true);
  assert.equal(hasPermission(staff, PERMISSIONS.EXPORT_CSV), false);
  assert.equal(hasPermission(staff, PERMISSIONS.EXPORT_OWN_TRANSACTIONS), true);
  assert.equal(hasPermission(supplier, PERMISSIONS.EXPORT_CSV), false);

  for (const resource of Object.values(EXPORT_RESOURCES)) {
    assert.ok(assertCanExportResource(admin, resource));
    assert.throws(() => assertCanExportResource(supplier, resource), ForbiddenError);
    assert.throws(() => assertCanExportResource(null, resource), UnauthorizedError);
  }

  for (const res of [
    EXPORT_RESOURCES.PRODUCTS,
    EXPORT_RESOURCES.PURCHASE_ORDERS,
    EXPORT_RESOURCES.INCOMING,
    EXPORT_RESOURCES.OUTGOING,
  ]) {
    assert.ok(assertCanExportResource(manager, res));
  }
  assert.throws(() => assertCanExportResource(manager, EXPORT_RESOURCES.CATEGORIES), ForbiddenError);
  assert.throws(() => assertCanExportResource(manager, EXPORT_RESOURCES.SUPPLIERS), ForbiddenError);

  assert.ok(assertCanExportResource(staff, EXPORT_RESOURCES.INCOMING));
  assert.ok(assertCanExportResource(staff, EXPORT_RESOURCES.OUTGOING));
  for (const res of [
    EXPORT_RESOURCES.PRODUCTS,
    EXPORT_RESOURCES.CATEGORIES,
    EXPORT_RESOURCES.SUPPLIERS,
    EXPORT_RESOURCES.PURCHASE_ORDERS,
  ]) {
    assert.throws(() => assertCanExportResource(staff, res), ForbiddenError);
  }

  assert.throws(
    () => assertCanExportResource(admin, 'inventory'),
    ValidationError
  );
  assert.throws(
    () => assertCanExportResource(admin, 'users_passwords'),
    ValidationError
  );
});

test('CSV builder emits UTF-8 BOM, RFC 4180 escaping, formula sanitization, and clean filenames', () => {
  const csv = buildCsv(
    [
      { header: 'SKU', key: 'sku' },
      { header: 'Nama Produk', key: 'name' },
      { header: 'Perubahan', key: 'delta' },
      { header: 'Catatan', key: 'notes' },
    ],
    [
      {
        sku: 'STA-001',
        name: 'Pulpen Gel "Hitam", 0.5mm',
        delta: -5,
        notes: '=CMD|"/C calc"!A0',
      },
    ]
  );

  // UTF-8 BOM for Microsoft Excel compatibility
  assert.equal(csv.startsWith('\uFEFF'), true);
  // RFC 4180 quoting for quotes & commas
  assert.equal(csv.includes('"Pulpen Gel ""Hitam"", 0.5mm"'), true);
  // Pure negative numbers remain numeric
  assert.equal(csv.includes(',-5,'), true);
  // Formula injection neutralized
  assert.equal(csv.includes("'=CMD"), true);
  assert.equal(sanitizeCsvCell('+SUM(A1:A2)'), "'+SUM(A1:A2)");
  assert.equal(sanitizeCsvCell(-12), '-12');

  // Empty data produces clean header-only CSV
  const emptyCsv = buildCsv([{ header: 'SKU', key: 'sku' }], []);
  assert.equal(emptyCsv, '\uFEFFSKU\r\n');

  const filename = buildExportFilename('purchase_orders', new Date('2026-11-21T00:00:00Z'));
  assert.equal(filename, 'purchase_orders_2026-11-21.csv');
});
