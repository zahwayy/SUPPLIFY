import test from 'node:test';
import assert from 'node:assert/strict';
import {
  PERMISSIONS,
  hasPermission,
  requireAuth,
  requireRole,
  requirePermission,
  assertSupplierOwnership,
} from '../../src/lib/auth/rbac.js';
import { ROLES } from '../../src/lib/constants/roles.js';
import { ForbiddenError, UnauthorizedError } from '../../src/lib/constants/errors.js';

test('RBAC role permissions match updated Supplify four-role boundaries', () => {
  const admin = { id: 1, role: ROLES.ADMIN };
  const manager = { id: 2, role: ROLES.MANAGER };
  const staff = { id: 3, role: ROLES.STAFF };
  const supplier = { id: 4, role: ROLES.SUPPLIER, supplierId: 10 };

  // Admin: manages users, products (CRU + archive + delete), categories, supplier verification; does NOT approve transactions
  assert.equal(hasPermission(admin, PERMISSIONS.USERS_MANAGE), true);
  assert.equal(hasPermission(admin, PERMISSIONS.PRODUCTS_MANAGE), true);
  assert.equal(hasPermission(admin, PERMISSIONS.PRODUCTS_ARCHIVE), true);
  assert.equal(hasPermission(admin, PERMISSIONS.PRODUCTS_DELETE), true);
  assert.equal(hasPermission(admin, PERMISSIONS.CATEGORIES_MANAGE), true);
  assert.equal(hasPermission(admin, PERMISSIONS.SUPPLIERS_VERIFY), true);
  assert.equal(hasPermission(admin, PERMISSIONS.TRANSACTIONS_APPROVE), false);

  // Manager: full product CRUD (Create, Read, Update, Delete; NO archive) and categories, approves transactions, creates POs, resolves discrepancies & adjustments; does NOT perform staff operational execution
  assert.equal(hasPermission(manager, PERMISSIONS.PRODUCTS_READ), true);
  assert.equal(hasPermission(manager, PERMISSIONS.PRODUCTS_MANAGE), true);
  assert.equal(hasPermission(manager, PERMISSIONS.PRODUCTS_ARCHIVE), false);
  assert.equal(hasPermission(manager, PERMISSIONS.PRODUCTS_DELETE), true);
  assert.equal(hasPermission(manager, PERMISSIONS.CATEGORIES_MANAGE), true);
  assert.equal(hasPermission(manager, PERMISSIONS.CATEGORIES_READ), true);
  assert.equal(hasPermission(manager, PERMISSIONS.EXPORT_CSV), true);
  assert.equal(hasPermission(manager, PERMISSIONS.TRANSACTIONS_APPROVE), true);
  assert.equal(hasPermission(manager, PERMISSIONS.TRANSACTIONS_HANDOVER), false);
  assert.equal(hasPermission(manager, PERMISSIONS.PO_CREATE), true);
  assert.equal(hasPermission(manager, PERMISSIONS.DISCREPANCY_READ), true);
  assert.equal(hasPermission(manager, PERMISSIONS.DISCREPANCY_REPORT), false);
  assert.equal(hasPermission(manager, PERMISSIONS.DISCREPANCY_RESOLVE), true);
  assert.equal(hasPermission(manager, PERMISSIONS.ADJUSTMENT_READ), true);
  assert.equal(hasPermission(manager, PERMISSIONS.ADJUSTMENT_REQUEST), false);
  assert.equal(hasPermission(manager, PERMISSIONS.ADJUSTMENT_APPROVE), true);

  // Staff: read-only products/inventory, PO read/inspect, creates transactions, handover, discrepancy & adjustment requests, exports OWN transactions only; CANNOT manage products or approve
  assert.equal(hasPermission(staff, PERMISSIONS.PRODUCTS_READ), true);
  assert.equal(hasPermission(staff, PERMISSIONS.INVENTORY_READ), true);
  assert.equal(hasPermission(staff, PERMISSIONS.PO_READ_ALL), true);
  assert.equal(hasPermission(staff, PERMISSIONS.PRODUCTS_MANAGE), false);
  assert.equal(hasPermission(staff, PERMISSIONS.TRANSACTIONS_CREATE), true);
  assert.equal(hasPermission(staff, PERMISSIONS.TRANSACTIONS_HANDOVER), true);
  assert.equal(hasPermission(staff, PERMISSIONS.DISCREPANCY_READ), true);
  assert.equal(hasPermission(staff, PERMISSIONS.DISCREPANCY_REPORT), true);
  assert.equal(hasPermission(staff, PERMISSIONS.DISCREPANCY_RESOLVE), false);
  assert.equal(hasPermission(staff, PERMISSIONS.ADJUSTMENT_READ), true);
  assert.equal(hasPermission(staff, PERMISSIONS.ADJUSTMENT_REQUEST), true);
  assert.equal(hasPermission(staff, PERMISSIONS.TRANSACTIONS_APPROVE), false);
  assert.equal(hasPermission(staff, PERMISSIONS.ADJUSTMENT_APPROVE), false);
  assert.equal(hasPermission(staff, PERMISSIONS.EXPORT_CSV), false);
  assert.equal(hasPermission(staff, PERMISSIONS.EXPORT_OWN_TRANSACTIONS), true);

  // Supplier: only own POs & Shipments + dashboard; zero CSV export
  assert.equal(hasPermission(supplier, PERMISSIONS.PO_RESPOND_OWN), true);
  assert.equal(hasPermission(supplier, PERMISSIONS.SHIPMENT_MANAGE_OWN), true);
  assert.equal(hasPermission(supplier, PERMISSIONS.SHIPMENT_READ_OWN), true);
  assert.equal(hasPermission(supplier, PERMISSIONS.INVENTORY_READ), false);
  assert.equal(hasPermission(supplier, PERMISSIONS.TRANSACTIONS_CREATE), false);
  assert.equal(hasPermission(supplier, PERMISSIONS.EXPORT_CSV), false);
  assert.equal(hasPermission(supplier, PERMISSIONS.EXPORT_OWN_TRANSACTIONS), false);
});

test('requireAuth and requirePermission throw typed errors for unauthorized access', () => {
  assert.throws(() => requireAuth(null), UnauthorizedError);
  assert.throws(
    () => requireRole({ id: 3, role: ROLES.STAFF }, [ROLES.ADMIN]),
    ForbiddenError
  );
  assert.doesNotThrow(
    () => requirePermission({ id: 2, role: ROLES.MANAGER }, PERMISSIONS.PRODUCTS_DELETE)
  );
  assert.throws(
    () => requirePermission({ id: 2, role: ROLES.MANAGER }, PERMISSIONS.PRODUCTS_ARCHIVE),
    ForbiddenError
  );
  assert.throws(
    () => requirePermission({ id: 3, role: ROLES.STAFF }, PERMISSIONS.PRODUCTS_MANAGE),
    ForbiddenError
  );
  assert.throws(
    () => requirePermission({ id: 3, role: ROLES.STAFF }, PERMISSIONS.PRODUCTS_DELETE),
    ForbiddenError
  );
  assert.throws(
    () => requirePermission({ id: 3, role: ROLES.STAFF }, PERMISSIONS.TRANSACTIONS_APPROVE),
    ForbiddenError
  );
});

test('assertSupplierOwnership blocks cross-supplier access', () => {
  const supplierA = { id: 4, role: ROLES.SUPPLIER, supplierId: 10 };
  assert.equal(assertSupplierOwnership(supplierA, 10), true);
  assert.throws(() => assertSupplierOwnership(supplierA, 99), ForbiddenError);
});
