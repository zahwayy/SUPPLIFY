import { ROLES } from '../constants/roles.js';
import { ForbiddenError, UnauthorizedError } from '../constants/errors.js';

export const PERMISSIONS = Object.freeze({
  USERS_MANAGE: 'users:manage',
  SUPPLIERS_VERIFY: 'suppliers:verify',
  SUPPLIERS_READ: 'suppliers:read',
  CATEGORIES_MANAGE: 'categories:manage',
  CATEGORIES_READ: 'categories:read',
  PRODUCTS_MANAGE: 'products:manage',
  PRODUCTS_ARCHIVE: 'products:archive',
  PRODUCTS_DELETE: 'products:delete',
  PRODUCTS_READ: 'products:read',
  INVENTORY_READ: 'inventory:read',
  TRANSACTIONS_CREATE: 'transactions:create',
  TRANSACTIONS_APPROVE: 'transactions:approve',
  TRANSACTIONS_HANDOVER: 'transactions:handover',
  TRANSACTIONS_READ: 'transactions:read',
  PO_CREATE: 'po:create',
  PO_FINALIZE_RECEIVE: 'po:finalize_receive',
  PO_READ_ALL: 'po:read_all',
  PO_RESPOND_OWN: 'po:respond_own',
  PO_INSPECT: 'po:inspect',
  SHIPMENT_MANAGE_OWN: 'shipment:manage_own',
  SHIPMENT_READ_OWN: 'shipment:read_own',
  DISCREPANCY_READ: 'discrepancy:read',
  DISCREPANCY_REPORT: 'discrepancy:report',
  DISCREPANCY_RESOLVE: 'discrepancy:resolve',
  ADJUSTMENT_READ: 'adjustment:read',
  ADJUSTMENT_REQUEST: 'adjustment:request',
  ADJUSTMENT_APPROVE: 'adjustment:approve',
  AUDIT_READ: 'audit:read',
  EXPORT_CSV: 'export:csv',
  EXPORT_OWN_TRANSACTIONS: 'export:own_transactions',
  DASHBOARD_ACCESS: 'dashboard:access',
});

export const ROLE_PERMISSIONS = Object.freeze({
  [ROLES.ADMIN]: new Set([
    PERMISSIONS.USERS_MANAGE,
    PERMISSIONS.SUPPLIERS_VERIFY,
    PERMISSIONS.SUPPLIERS_READ,
    PERMISSIONS.CATEGORIES_MANAGE,
    PERMISSIONS.CATEGORIES_READ,
    PERMISSIONS.PRODUCTS_MANAGE,
    PERMISSIONS.PRODUCTS_ARCHIVE,
    PERMISSIONS.PRODUCTS_DELETE,
    PERMISSIONS.PRODUCTS_READ,
    PERMISSIONS.INVENTORY_READ,
    PERMISSIONS.TRANSACTIONS_READ,
    PERMISSIONS.PO_READ_ALL,
    PERMISSIONS.AUDIT_READ,
    PERMISSIONS.EXPORT_CSV,
    PERMISSIONS.DASHBOARD_ACCESS,
  ]),
  [ROLES.MANAGER]: new Set([
    PERMISSIONS.SUPPLIERS_READ,
    PERMISSIONS.CATEGORIES_MANAGE,
    PERMISSIONS.CATEGORIES_READ,
    PERMISSIONS.PRODUCTS_MANAGE,
    PERMISSIONS.PRODUCTS_DELETE,
    PERMISSIONS.PRODUCTS_READ,
    PERMISSIONS.INVENTORY_READ,
    PERMISSIONS.TRANSACTIONS_APPROVE,
    PERMISSIONS.TRANSACTIONS_READ,
    PERMISSIONS.PO_CREATE,
    PERMISSIONS.PO_FINALIZE_RECEIVE,
    PERMISSIONS.PO_READ_ALL,
    PERMISSIONS.DISCREPANCY_READ,
    PERMISSIONS.DISCREPANCY_RESOLVE,
    PERMISSIONS.ADJUSTMENT_READ,
    PERMISSIONS.ADJUSTMENT_APPROVE,
    PERMISSIONS.AUDIT_READ,
    PERMISSIONS.EXPORT_CSV,
    PERMISSIONS.DASHBOARD_ACCESS,
  ]),
  [ROLES.STAFF]: new Set([
    PERMISSIONS.CATEGORIES_READ,
    PERMISSIONS.PRODUCTS_READ,
    PERMISSIONS.INVENTORY_READ,
    PERMISSIONS.TRANSACTIONS_CREATE,
    PERMISSIONS.TRANSACTIONS_HANDOVER,
    PERMISSIONS.TRANSACTIONS_READ,
    PERMISSIONS.PO_READ_ALL,
    PERMISSIONS.PO_INSPECT,
    PERMISSIONS.DISCREPANCY_READ,
    PERMISSIONS.DISCREPANCY_REPORT,
    PERMISSIONS.ADJUSTMENT_READ,
    PERMISSIONS.ADJUSTMENT_REQUEST,
    PERMISSIONS.EXPORT_OWN_TRANSACTIONS,
    PERMISSIONS.DASHBOARD_ACCESS,
  ]),
  [ROLES.SUPPLIER]: new Set([
    PERMISSIONS.PO_RESPOND_OWN,
    PERMISSIONS.SHIPMENT_MANAGE_OWN,
    PERMISSIONS.SHIPMENT_READ_OWN,
    PERMISSIONS.DASHBOARD_ACCESS,
  ]),
});

export function hasPermission(user, permission) {
  if (!user || !user.role) return false;
  const perms = ROLE_PERMISSIONS[user.role];
  return Boolean(perms && perms.has(permission));
}

export function requireAuth(user) {
  if (!user || !user.id) {
    throw new UnauthorizedError();
  }
  return user;
}

export function requireRole(user, allowedRoles) {
  requireAuth(user);
  const allowed = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles];
  if (!allowed.includes(user.role)) {
    throw new ForbiddenError('Peran Anda tidak memiliki akses ke fitur ini.');
  }
  return user;
}

export function requirePermission(user, permission) {
  requireAuth(user);
  if (!hasPermission(user, permission)) {
    throw new ForbiddenError('Anda tidak memiliki izin untuk melakukan operasi ini.');
  }
  return user;
}

export function assertSupplierOwnership(user, resourceSupplierId) {
  requireAuth(user);
  if (user.role !== ROLES.SUPPLIER) return true;
  if (!user.supplierId || Number(user.supplierId) !== Number(resourceSupplierId)) {
    throw new ForbiddenError('Supplier hanya dapat mengakses data miliknya sendiri.');
  }
  return true;
}
