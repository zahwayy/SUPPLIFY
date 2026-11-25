import test from 'node:test';
import assert from 'node:assert/strict';
import { getNavigationForRole } from '../../src/lib/constants/navigation.js';
import { hasPermission, PERMISSIONS } from '../../src/lib/auth/rbac.js';
import { ROLES } from '../../src/lib/constants/roles.js';

test('Role-based navigation uses Bahasa Indonesia labels, consolidated inventory hub, and valid RBAC permissions', () => {
  const adminNav = getNavigationForRole(ROLES.ADMIN);
  assert.deepEqual(
    adminNav.map((i) => i.label),
    [
      'Beranda',
      'Produk',
      'Kategori',
      'Pergerakan Stok',
      'Verifikasi Supplier',
      'Manajemen Pengguna',
      'Log Aktivitas',
    ]
  );

  const managerNav = getNavigationForRole(ROLES.MANAGER);
  assert.deepEqual(
    managerNav.map((i) => i.label),
    [
      'Beranda',
      'Produk',
      'Kategori',
      'Pergerakan Stok',
      'Barang Masuk',
      'Barang Keluar',
      'Pesanan Restock',
    ]
  );
  const managerProductItem = managerNav.find((i) => i.href === '/products');
  assert.equal(managerProductItem?.permission, PERMISSIONS.PRODUCTS_MANAGE);
  assert.equal(managerProductItem?.badgeText, undefined);

  const staffNav = getNavigationForRole(ROLES.STAFF);
  assert.deepEqual(
    staffNav.map((i) => i.label),
    [
      'Beranda',
      'Produk',
      'Pergerakan Stok',
      'Pesanan Pembelian (PO)',
      'Barang Masuk',
      'Barang Keluar',
    ]
  );
  const staffProductItem = staffNav.find((i) => i.href === '/products');
  assert.equal(staffProductItem?.permission, PERMISSIONS.PRODUCTS_READ);
  assert.equal(staffProductItem?.badgeText, 'Baca');

  const supplierNav = getNavigationForRole(ROLES.SUPPLIER);
  assert.deepEqual(
    supplierNav.map((i) => i.label),
    ['Beranda', 'Pesanan Pembelian (PO)', 'Pengiriman', 'Riwayat Pengiriman']
  );

  // Every nav item permission must actually be granted to that role in rbac.js
  for (const role of Object.values(ROLES)) {
    const items = getNavigationForRole(role);
    for (const item of items) {
      assert.equal(
        hasPermission({ id: 1, role }, item.permission),
        true,
        `Role ${role} missing permission ${item.permission} for menu ${item.label}`
      );
    }
  }
});
