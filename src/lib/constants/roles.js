export const ROLES = Object.freeze({
  ADMIN: 'admin',
  MANAGER: 'manager',
  STAFF: 'staff',
  SUPPLIER: 'supplier',
});

export const ALL_ROLES = Object.freeze(Object.values(ROLES));

export const INTERNAL_ROLES = Object.freeze([
  ROLES.ADMIN,
  ROLES.MANAGER,
  ROLES.STAFF,
]);

export const ROLE_LABELS = Object.freeze({
  [ROLES.ADMIN]: 'Admin',
  [ROLES.MANAGER]: 'Warehouse Manager',
  [ROLES.STAFF]: 'Warehouse Staff',
  [ROLES.SUPPLIER]: 'Supplier',
});

export const USER_STATUSES = Object.freeze({
  ACTIVE: 'active',
  PENDING: 'pending',
  REJECTED: 'rejected',
  INACTIVE: 'inactive',
});
