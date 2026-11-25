import { ROLES } from './roles.js';
import { PERMISSIONS } from '../auth/rbac.js';

export const ROLE_NAV_ITEMS = Object.freeze({
  [ROLES.ADMIN]: [
    {
      label: 'Beranda',
      href: '/dashboard',
      icon: 'dashboard',
      group: 'Ringkasan',
      permission: PERMISSIONS.DASHBOARD_ACCESS,
    },
    {
      label: 'Produk',
      href: '/products',
      icon: 'products',
      group: 'Katalog Master',
      permission: PERMISSIONS.PRODUCTS_MANAGE,
    },
    {
      label: 'Kategori',
      href: '/categories',
      icon: 'categories',
      group: 'Katalog Master',
      permission: PERMISSIONS.CATEGORIES_MANAGE,
    },
    {
      label: 'Pergerakan Stok',
      href: '/inventory',
      icon: 'inventory',
      group: 'Katalog Master',
      permission: PERMISSIONS.INVENTORY_READ,
    },
    {
      label: 'Verifikasi Supplier',
      href: '/supplier-verification',
      icon: 'supplierVerify',
      group: 'Administrasi',
      permission: PERMISSIONS.SUPPLIERS_VERIFY,
    },
    {
      label: 'Manajemen Pengguna',
      href: '/users',
      icon: 'users',
      group: 'Administrasi',
      permission: PERMISSIONS.USERS_MANAGE,
    },
    {
      label: 'Log Aktivitas',
      href: '/activity-log',
      icon: 'activity',
      group: 'Administrasi',
      permission: PERMISSIONS.AUDIT_READ,
    },
  ],
  [ROLES.MANAGER]: [
    {
      label: 'Beranda',
      href: '/dashboard',
      icon: 'dashboard',
      group: 'Ringkasan',
      permission: PERMISSIONS.DASHBOARD_ACCESS,
    },
    {
      label: 'Produk',
      href: '/products',
      icon: 'products',
      group: 'Katalog & Persediaan',
      permission: PERMISSIONS.PRODUCTS_MANAGE,
    },
    {
      label: 'Kategori',
      href: '/categories',
      icon: 'categories',
      group: 'Katalog & Persediaan',
      permission: PERMISSIONS.CATEGORIES_MANAGE,
    },
    {
      label: 'Pergerakan Stok',
      href: '/inventory',
      icon: 'inventory',
      group: 'Katalog & Persediaan',
      permission: PERMISSIONS.INVENTORY_READ,
    },
    {
      label: 'Barang Masuk',
      href: '/incoming',
      icon: 'incoming',
      group: 'Operasional Gudang',
      permission: PERMISSIONS.TRANSACTIONS_READ,
    },
    {
      label: 'Barang Keluar',
      href: '/outgoing',
      icon: 'outgoing',
      group: 'Operasional Gudang',
      permission: PERMISSIONS.TRANSACTIONS_READ,
    },
    {
      label: 'Pesanan Restock',
      href: '/restock-orders',
      icon: 'orders',
      group: 'Operasional Gudang',
      permission: PERMISSIONS.PO_CREATE,
    },
  ],
  [ROLES.STAFF]: [
    {
      label: 'Beranda',
      href: '/dashboard',
      icon: 'dashboard',
      group: 'Ringkasan',
      permission: PERMISSIONS.DASHBOARD_ACCESS,
    },
    {
      label: 'Produk',
      href: '/products',
      icon: 'products',
      badgeText: 'Baca',
      group: 'Katalog & Stok',
      permission: PERMISSIONS.PRODUCTS_READ,
    },
    {
      label: 'Pergerakan Stok',
      href: '/inventory',
      icon: 'inventory',
      group: 'Katalog & Stok',
      permission: PERMISSIONS.INVENTORY_READ,
    },
    {
      label: 'Pesanan Pembelian (PO)',
      href: '/purchase-orders',
      icon: 'orders',
      group: 'Tugas Gudang',
      permission: PERMISSIONS.PO_READ_ALL,
    },
    {
      label: 'Barang Masuk',
      href: '/incoming',
      icon: 'incoming',
      group: 'Tugas Gudang',
      permission: PERMISSIONS.TRANSACTIONS_CREATE,
    },
    {
      label: 'Barang Keluar',
      href: '/outgoing',
      icon: 'outgoing',
      group: 'Tugas Gudang',
      permission: PERMISSIONS.TRANSACTIONS_CREATE,
    },
  ],
  [ROLES.SUPPLIER]: [
    {
      label: 'Beranda',
      href: '/dashboard',
      icon: 'dashboard',
      group: 'Ringkasan',
      permission: PERMISSIONS.DASHBOARD_ACCESS,
    },
    {
      label: 'Pesanan Pembelian (PO)',
      href: '/purchase-orders',
      icon: 'orders',
      group: 'Pesanan & Pengiriman',
      permission: PERMISSIONS.PO_RESPOND_OWN,
    },
    {
      label: 'Pengiriman',
      href: '/shipment',
      icon: 'shipment',
      group: 'Pesanan & Pengiriman',
      permission: PERMISSIONS.SHIPMENT_MANAGE_OWN,
    },
    {
      label: 'Riwayat Pengiriman',
      href: '/shipment-history',
      icon: 'movements',
      group: 'Pesanan & Pengiriman',
      permission: PERMISSIONS.SHIPMENT_READ_OWN,
    },
  ],
});

export function getNavigationForRole(role) {
  return ROLE_NAV_ITEMS[role] || [];
}
