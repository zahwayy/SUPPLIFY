import { query } from '../../lib/db/pool.js';
import {
  PERMISSIONS,
  hasPermission,
  requireAuth,
  requirePermission,
} from '../../lib/auth/rbac.js';
import { ROLES } from '../../lib/constants/roles.js';
import { ForbiddenError, ValidationError } from '../../lib/constants/errors.js';
import {
  buildCsv,
  buildExportFilename,
  formatCsvDate,
  formatCsvTimestamp,
} from '../../lib/utils/csv.js';
import { computeProductStockStatus } from '../products/productService.js';
import {
  getHandoverMethodLabel,
  getRecipientTypeLabel,
  getStockStatusMeta,
} from '../../lib/utils/labels.js';
import { recordAuditEvent } from '../audit/auditService.js';

export const EXPORT_RESOURCES = Object.freeze({
  PRODUCTS: 'products',
  CATEGORIES: 'categories',
  SUPPLIERS: 'suppliers',
  PURCHASE_ORDERS: 'purchase-orders',
  INCOMING: 'incoming',
  OUTGOING: 'outgoing',
});

const ROLE_EXPORT_RESOURCES = Object.freeze({
  [ROLES.ADMIN]: new Set([
    EXPORT_RESOURCES.PRODUCTS,
    EXPORT_RESOURCES.CATEGORIES,
    EXPORT_RESOURCES.SUPPLIERS,
    EXPORT_RESOURCES.PURCHASE_ORDERS,
    EXPORT_RESOURCES.INCOMING,
    EXPORT_RESOURCES.OUTGOING,
  ]),
  [ROLES.MANAGER]: new Set([
    EXPORT_RESOURCES.PRODUCTS,
    EXPORT_RESOURCES.PURCHASE_ORDERS,
    EXPORT_RESOURCES.INCOMING,
    EXPORT_RESOURCES.OUTGOING,
  ]),
  [ROLES.STAFF]: new Set([
    EXPORT_RESOURCES.INCOMING,
    EXPORT_RESOURCES.OUTGOING,
  ]),
  [ROLES.SUPPLIER]: new Set(),
});

const RESOURCE_CONFIG = Object.freeze({
  [EXPORT_RESOURCES.PRODUCTS]: {
    filenamePrefix: 'produk',
    requiredPermissions: [PERMISSIONS.PRODUCTS_READ],
  },
  [EXPORT_RESOURCES.CATEGORIES]: {
    filenamePrefix: 'kategori',
    requiredPermissions: [PERMISSIONS.CATEGORIES_READ],
  },
  [EXPORT_RESOURCES.SUPPLIERS]: {
    filenamePrefix: 'supplier',
    requiredPermissions: [PERMISSIONS.SUPPLIERS_READ],
  },
  [EXPORT_RESOURCES.PURCHASE_ORDERS]: {
    filenamePrefix: 'purchase_orders',
    requiredPermissions: [PERMISSIONS.PO_READ_ALL],
  },
  [EXPORT_RESOURCES.INCOMING]: {
    filenamePrefix: 'barang_masuk',
    requiredPermissions: [PERMISSIONS.TRANSACTIONS_READ],
  },
  [EXPORT_RESOURCES.OUTGOING]: {
    filenamePrefix: 'barang_keluar',
    requiredPermissions: [PERMISSIONS.TRANSACTIONS_READ],
  },
});

const PRODUCT_SORT_COLUMNS = {
  name: 'p.name',
  sku: 'p.sku',
  stock: 'p.stock',
  category: 'c.name',
  updated_at: 'p.updated_at',
};

const PO_STATUS_LABELS = {
  pending: 'Menunggu Konfirmasi',
  confirmed: 'Dikonfirmasi',
  processing: 'Dikonfirmasi (Legacy)',
  preparing: 'Dikonfirmasi (Legacy)',
  in_transit: 'Dalam Pengiriman',
  inspecting: 'Pemeriksaan Fisik',
  delivered: 'Diterima (Legacy)',
  received: 'Diterima',
  returned: 'Dikembalikan',
  completed: 'Selesai (Legacy)',
  rejected: 'Ditolak',
  cancelled: 'Dibatalkan',
};

const TX_STATUS_LABELS = {
  pending: 'Menunggu',
  approved: 'Disetujui',
  rejected: 'Ditolak',
  shipped: 'Dikirim',
  delivered: 'Diterima (Legacy)',
  cancelled: 'Dibatalkan',
};

const SUPPLIER_STATUS_LABELS = {
  pending: 'Menunggu Verifikasi',
  active: 'Aktif',
  rejected: 'Ditolak',
  inactive: 'Nonaktif',
};

function getRequiredExportGatePermission(role) {
  return role === ROLES.STAFF
    ? PERMISSIONS.EXPORT_OWN_TRANSACTIONS
    : PERMISSIONS.EXPORT_CSV;
}

export function canExportResource(user, resource) {
  if (!user || !user.id || !user.role) return false;
  const config = RESOURCE_CONFIG[resource];
  if (!config) return false;

  const allowedSet = ROLE_EXPORT_RESOURCES[user.role];
  if (!allowedSet || !allowedSet.has(resource)) return false;

  if (!hasPermission(user, getRequiredExportGatePermission(user.role))) {
    return false;
  }

  return config.requiredPermissions.every((perm) => hasPermission(user, perm));
}

export function assertCanExportResource(user, resource) {
  requireAuth(user);

  const config = RESOURCE_CONFIG[resource];
  if (!config) {
    throw new ValidationError('Modul ekspor CSV tidak dikenali.');
  }

  const allowedSet = ROLE_EXPORT_RESOURCES[user.role];
  if (!allowedSet || !allowedSet.has(resource)) {
    throw new ForbiddenError('Peran Anda tidak memiliki akses untuk mengekspor data pada modul ini.');
  }

  requirePermission(user, getRequiredExportGatePermission(user.role));

  for (const perm of config.requiredPermissions) {
    requirePermission(user, perm);
  }

  return config;
}

async function queryProductsForExport(filters = {}, client = null) {
  const executor = client || { query };
  const conditions = ['p.deleted_at IS NULL'];
  const params = [];

  if (filters.search) {
    params.push(`%${filters.search}%`);
    conditions.push(`(p.sku ILIKE $${params.length} OR p.name ILIKE $${params.length})`);
  }
  if (
    filters.categoryId &&
    Number.isInteger(Number(filters.categoryId)) &&
    Number(filters.categoryId) > 0
  ) {
    params.push(Number(filters.categoryId));
    conditions.push(`p.category_id = $${params.length}`);
  }
  if (filters.stockStatus === 'out_of_stock') {
    conditions.push('p.stock = 0');
  } else if (filters.stockStatus === 'severe') {
    conditions.push('p.stock > 0 AND p.minimum_stock IS NOT NULL AND p.stock <= p.minimum_stock');
  } else if (filters.stockStatus === 'low') {
    conditions.push(
      'p.stock > 0 AND p.minimum_stock IS NOT NULL AND p.low_stock_threshold IS NOT NULL AND p.stock > p.minimum_stock AND p.stock <= p.low_stock_threshold'
    );
  } else if (filters.stockStatus === 'normal') {
    conditions.push(
      'p.stock > 0 AND p.minimum_stock IS NOT NULL AND ((p.low_stock_threshold IS NOT NULL AND p.stock > p.low_stock_threshold) OR (p.low_stock_threshold IS NULL AND p.stock > p.minimum_stock))'
    );
  } else if (filters.stockStatus === 'unconfigured') {
    conditions.push('p.stock > 0 AND p.minimum_stock IS NULL');
  }

  const whereSql = `WHERE ${conditions.join(' AND ')}`;
  const orderCol = PRODUCT_SORT_COLUMNS[filters.sortBy] || 'p.sku';

  const { rows } = await executor.query(
    `SELECT
       p.sku,
       p.name,
       c.code AS category_code,
       c.name AS category_name,
       p.stock,
       p.minimum_stock,
       p.low_stock_threshold,
       p.unit,
       p.rack_location,
       p.purchase_price,
       p.selling_price,
       p.updated_at
     FROM products p
     INNER JOIN categories c ON c.id = p.category_id
     ${whereSql}
     ORDER BY ${orderCol} ASC, p.id ASC`,
    params
  );

  return rows;
}

async function queryCategoriesForExport(filters = {}, client = null) {
  const executor = client || { query };
  const params = [];
  let whereSql = '';

  if (filters.search) {
    params.push(`%${filters.search}%`);
    whereSql = `WHERE c.name ILIKE $1 OR COALESCE(c.code, '') ILIKE $1`;
  }

  const { rows } = await executor.query(
    `SELECT
       c.code,
       c.name,
       c.description,
       COALESCE(prod_agg.active_product_count, 0)::int AS active_product_count,
       COALESCE(prod_agg.total_product_count, 0)::int AS total_product_count,
       COALESCE(sup_agg.supplier_count, 0)::int AS supplier_count,
       c.created_at
     FROM categories c
     LEFT JOIN LATERAL (
       SELECT
         COUNT(p.id) FILTER (WHERE p.deleted_at IS NULL)::int AS active_product_count,
         COUNT(p.id)::int AS total_product_count
       FROM products p
       WHERE p.category_id = c.id
     ) prod_agg ON TRUE
     LEFT JOIN LATERAL (
       SELECT COUNT(sc.supplier_id)::int AS supplier_count
       FROM supplier_categories sc
       WHERE sc.category_id = c.id
     ) sup_agg ON TRUE
     ${whereSql}
     ORDER BY c.name ASC`,
    params
  );

  return rows;
}

async function querySuppliersForExport(filters = {}, client = null) {
  const executor = client || { query };
  const conditions = [`u.role = 'supplier'`];
  const params = [];

  if (filters.status && ['pending', 'active', 'rejected', 'inactive'].includes(filters.status)) {
    params.push(filters.status);
    conditions.push(`u.status = $${params.length}`);
  }
  if (filters.search) {
    params.push(`%${filters.search}%`);
    conditions.push(
      `(s.company_name ILIKE $${params.length} OR s.contact_name ILIKE $${params.length} OR u.email ILIKE $${params.length})`
    );
  }

  const { rows } = await executor.query(
    `SELECT
       s.company_name,
       s.contact_name,
       u.name AS account_name,
       u.email,
       s.phone,
       s.address,
       u.status,
       COALESCE(cat_agg.category_names, '') AS category_names,
       verifier.name AS verified_by_name,
       s.verified_at,
       s.rejection_reason,
       s.created_at
     FROM suppliers s
     INNER JOIN users u ON u.id = s.user_id
     LEFT JOIN users verifier ON verifier.id = s.verified_by
     LEFT JOIN LATERAL (
       SELECT string_agg(c.name, ', ' ORDER BY c.name ASC) AS category_names
       FROM supplier_categories sc
       INNER JOIN categories c ON c.id = sc.category_id
       WHERE sc.supplier_id = s.id
     ) cat_agg ON TRUE
     WHERE ${conditions.join(' AND ')}
     ORDER BY (u.status = 'pending') DESC, s.created_at DESC`,
    params
  );

  return rows;
}

async function queryPurchaseOrdersForExport(filters = {}, client = null) {
  const executor = client || { query };
  const conditions = [];
  const params = [];

  if (filters.status) {
    if (filters.status === 'confirmed' || filters.status === 'processing') {
      conditions.push(`po.status IN ('confirmed', 'processing', 'preparing')`);
    } else if (
      [
        'pending',
        'rejected',
        'in_transit',
        'inspecting',
        'delivered',
        'received',
        'returned',
        'completed',
        'cancelled',
      ].includes(filters.status)
    ) {
      params.push(filters.status);
      conditions.push(`po.status = $${params.length}`);
    }
  }
  if (filters.search) {
    params.push(`%${filters.search}%`);
    conditions.push(
      `(po.po_code ILIKE $${params.length} OR s.company_name ILIKE $${params.length})`
    );
  }

  const whereSql = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const { rows } = await executor.query(
    `SELECT
       po.po_code,
       s.company_name AS supplier_name,
       po.order_date,
       po.expected_arrival,
       po.status,
       creator.name AS created_by_name,
       sd.courier_name,
       sd.tracking_number,
       po.arrival_confirmed_at,
       po.inspection_requested_at,
       po.completed_at,
       po.notes,
       po.created_at,
       COALESCE(item_agg.item_count, 0)::int AS item_count,
       COALESCE(item_agg.total_quantity, 0)::int AS total_quantity,
       COALESCE(inc_agg.total_approved_quantity, 0)::int AS total_approved_quantity
     FROM purchase_orders po
     INNER JOIN suppliers s ON s.id = po.supplier_id
     INNER JOIN users creator ON creator.id = po.created_by
     LEFT JOIN shipment_details sd ON sd.purchase_order_id = po.id
     LEFT JOIN LATERAL (
       SELECT
         COUNT(poi.id)::int AS item_count,
         COALESCE(SUM(poi.quantity), 0)::int AS total_quantity
       FROM purchase_order_items poi
       WHERE poi.purchase_order_id = po.id
     ) item_agg ON TRUE
     LEFT JOIN LATERAL (
       SELECT
         COALESCE(
           SUM(COALESCE(ti.approved_quantity, ti.quantity)) FILTER (WHERE t.status = 'approved'),
           0
         )::int AS total_approved_quantity
       FROM transactions t
       LEFT JOIN transaction_items ti ON ti.transaction_id = t.id
       WHERE t.purchase_order_id = po.id
         AND t.type = 'incoming'
     ) inc_agg ON TRUE
     ${whereSql}
     ORDER BY po.created_at DESC, po.id DESC`,
    params
  );

  return rows;
}

async function queryIncomingForExport(filters = {}, { createdByUserId = null } = {}, client = null) {
  const executor = client || { query };
  const conditions = [`t.type = 'incoming'`];
  const params = [];

  if (createdByUserId) {
    params.push(Number(createdByUserId));
    conditions.push(`t.created_by = $${params.length}`);
  }
  if (
    filters.status &&
    ['pending', 'approved', 'rejected', 'cancelled'].includes(filters.status)
  ) {
    params.push(filters.status);
    conditions.push(`t.status = $${params.length}`);
  }
  if (filters.search) {
    params.push(`%${filters.search}%`);
    conditions.push(
      `(t.transaction_code ILIKE $${params.length} OR po.po_code ILIKE $${params.length} OR s.company_name ILIKE $${params.length})`
    );
  }

  const whereSql = `WHERE ${conditions.join(' AND ')}`;

  const { rows } = await executor.query(
    `SELECT
       t.transaction_code,
       po.po_code,
       po.status AS po_status,
       s.company_name AS supplier_name,
       t.status,
       creator.name AS created_by_name,
       proc.name AS processed_by_name,
       t.transaction_date,
       t.processed_at,
       t.notes,
       t.rejection_reason,
       COUNT(ti.id)::int AS item_count,
       COALESCE(SUM(ti.quantity), 0)::int AS total_received_quantity,
       COALESCE(SUM(COALESCE(ti.good_quantity, ti.quantity)), 0)::int AS total_good_quantity,
       COALESCE(SUM(COALESCE(ti.damaged_quantity, 0)), 0)::int AS total_damaged_quantity,
       COALESCE(SUM(ti.approved_quantity), 0)::int AS total_approved_quantity
     FROM transactions t
     INNER JOIN purchase_orders po ON po.id = t.purchase_order_id
     INNER JOIN suppliers s ON s.id = po.supplier_id
     INNER JOIN users creator ON creator.id = t.created_by
     LEFT JOIN users proc ON proc.id = t.processed_by
     LEFT JOIN transaction_items ti ON ti.transaction_id = t.id
     ${whereSql}
     GROUP BY t.id, po.po_code, po.status, s.company_name, creator.name, proc.name
     ORDER BY t.transaction_date DESC, t.id DESC`,
    params
  );

  return rows;
}

async function queryOutgoingForExport(filters = {}, { createdByUserId = null } = {}, client = null) {
  const executor = client || { query };
  const conditions = [`t.type = 'outgoing'`];
  const params = [];

  if (createdByUserId) {
    params.push(Number(createdByUserId));
    conditions.push(`t.created_by = $${params.length}`);
  }
  if (
    filters.status &&
    ['pending', 'approved', 'rejected', 'shipped', 'delivered', 'cancelled'].includes(
      filters.status
    )
  ) {
    params.push(filters.status);
    conditions.push(`t.status = $${params.length}`);
  }
  if (filters.search) {
    params.push(`%${filters.search}%`);
    conditions.push(
      `(t.transaction_code ILIKE $${params.length} OR COALESCE(hd.recipient_name, t.recipient_name, '') ILIKE $${params.length} OR COALESCE(t.notes, '') ILIKE $${params.length})`
    );
  }

  const whereSql = `WHERE ${conditions.join(' AND ')}`;

  const { rows } = await executor.query(
    `SELECT
       t.transaction_code,
       t.status,
       t.shipment_date,
       t.notes,
       creator.name AS created_by_name,
       proc.name AS processed_by_name,
       t.transaction_date,
       t.processed_at,
       t.shipped_at,
       t.delivered_at,
       COALESCE(hd.recipient_name, t.recipient_name) AS recipient_name,
       hd.recipient_type,
       hd.handover_method,
       hd.courier_name,
       hd.tracking_number,
       COUNT(ti.id)::int AS item_count,
       COALESCE(SUM(ti.quantity), 0)::int AS total_quantity
     FROM transactions t
     INNER JOIN users creator ON creator.id = t.created_by
     LEFT JOIN users proc ON proc.id = t.processed_by
     LEFT JOIN handover_details hd ON hd.transaction_id = t.id
     LEFT JOIN transaction_items ti ON ti.transaction_id = t.id
     ${whereSql}
     GROUP BY t.id, creator.name, proc.name, hd.recipient_name, hd.recipient_type,
              hd.handover_method, hd.courier_name, hd.tracking_number
     ORDER BY t.transaction_date DESC, t.id DESC`,
    params
  );

  return rows;
}

export async function generateCsvExport(user, resource, rawFilters = {}, client = null) {
  const config = assertCanExportResource(user, resource);
  const filters = {
    search: typeof rawFilters?.search === 'string' ? rawFilters.search.trim() : '',
    status: typeof rawFilters?.status === 'string' ? rawFilters.status.trim() : '',
    categoryId: rawFilters?.categoryId ? Number(rawFilters.categoryId) : '',
    stockStatus:
      typeof rawFilters?.stockStatus === 'string' ? rawFilters.stockStatus.trim() : '',
    sortBy: typeof rawFilters?.sortBy === 'string' ? rawFilters.sortBy.trim() : 'sku',
  };

  // Security enforcement: Staff may ONLY export transactions created by themselves,
  // regardless of any query/filter parameters passed in the request.
  const createdByUserId = user.role === ROLES.STAFF ? Number(user.id) : null;

  let columns;
  let rows;

  if (resource === EXPORT_RESOURCES.PRODUCTS) {
    rows = await queryProductsForExport(filters, client);
    columns = [
      { header: 'SKU', key: 'sku' },
      { header: 'Nama Produk', key: 'name' },
      { header: 'Kategori', key: 'category_name' },
      { header: 'Kode Kategori', key: 'category_code' },
      { header: 'Stok Saat Ini', key: 'stock' },
      { header: 'Stok Minimum', key: 'minimum_stock' },
      { header: 'Batas Stok Rendah', key: 'low_stock_threshold' },
      {
        header: 'Status Stok',
        value: (r) =>
          getStockStatusMeta(
            computeProductStockStatus(r.stock, r.minimum_stock, r.low_stock_threshold)
          ).label,
      },
      { header: 'Satuan', key: 'unit' },
      { header: 'Lokasi Rak', key: 'rack_location' },
      {
        header: 'Harga Beli (IDR)',
        value: (r) =>
          r.purchase_price !== null && r.purchase_price !== undefined
            ? Number(r.purchase_price)
            : '',
      },
      {
        header: 'Harga Jual (IDR)',
        value: (r) =>
          r.selling_price !== null && r.selling_price !== undefined
            ? Number(r.selling_price)
            : '',
      },
      { header: 'Diperbarui Pada', value: (r) => formatCsvTimestamp(r.updated_at) },
    ];
  } else if (resource === EXPORT_RESOURCES.CATEGORIES) {
    rows = await queryCategoriesForExport(filters, client);
    columns = [
      { header: 'Kode Kategori', key: 'code' },
      { header: 'Nama Kategori', key: 'name' },
      { header: 'Deskripsi', key: 'description' },
      { header: 'Produk Terkait', key: 'active_product_count' },
      { header: 'Supplier Terkait', key: 'supplier_count' },
      { header: 'Dibuat Pada', value: (r) => formatCsvTimestamp(r.created_at) },
    ];
  } else if (resource === EXPORT_RESOURCES.SUPPLIERS) {
    rows = await querySuppliersForExport(filters, client);
    columns = [
      { header: 'Nama Perusahaan', key: 'company_name' },
      { header: 'Penanggung Jawab (PIC)', key: 'contact_name' },
      { header: 'Nama Akun', key: 'account_name' },
      { header: 'Email', key: 'email' },
      { header: 'Nomor Telepon', key: 'phone' },
      { header: 'Alamat Perusahaan', key: 'address' },
      { header: 'Kategori Barang', key: 'category_names' },
      {
        header: 'Status Verifikasi',
        value: (r) => SUPPLIER_STATUS_LABELS[r.status] || r.status,
      },
      { header: 'Diverifikasi Oleh', key: 'verified_by_name' },
      { header: 'Tanggal Verifikasi', value: (r) => formatCsvTimestamp(r.verified_at) },
      { header: 'Tanggal Pendaftaran', value: (r) => formatCsvTimestamp(r.created_at) },
    ];
  } else if (resource === EXPORT_RESOURCES.PURCHASE_ORDERS) {
    rows = await queryPurchaseOrdersForExport(filters, client);
    columns = [
      { header: 'Kode PO', key: 'po_code' },
      { header: 'Supplier', key: 'supplier_name' },
      { header: 'Tanggal Pemesanan', value: (r) => formatCsvDate(r.order_date) },
      { header: 'Estimasi Kedatangan', value: (r) => formatCsvDate(r.expected_arrival) },
      { header: 'Status PO', value: (r) => PO_STATUS_LABELS[r.status] || r.status },
      { header: 'Jumlah SKU', key: 'item_count' },
      { header: 'Total Qty Dipesan', key: 'total_quantity' },
      { header: 'Total Qty Disetujui', key: 'total_approved_quantity' },
      {
        header: 'Sisa Kewajiban',
        value: (r) =>
          Math.max(0, Number(r.total_quantity || 0) - Number(r.total_approved_quantity || 0)),
      },
      { header: 'Kurir', key: 'courier_name' },
      { header: 'Nomor Resi', key: 'tracking_number' },
      {
        header: 'Konfirmasi Kedatangan Supplier',
        value: (r) => formatCsvTimestamp(r.arrival_confirmed_at),
      },
      {
        header: 'Instruksi Pemeriksaan Staff',
        value: (r) => formatCsvTimestamp(r.inspection_requested_at),
      },
      { header: 'Tanggal Selesai', value: (r) => formatCsvTimestamp(r.completed_at) },
      { header: 'Dibuat Oleh', key: 'created_by_name' },
      { header: 'Catatan', key: 'notes' },
    ];
  } else if (resource === EXPORT_RESOURCES.INCOMING) {
    rows = await queryIncomingForExport(filters, { createdByUserId }, client);
    columns = [
      { header: 'Kode Transaksi Masuk', key: 'transaction_code' },
      { header: 'Referensi PO', key: 'po_code' },
      { header: 'Status PO', value: (r) => PO_STATUS_LABELS[r.po_status] || r.po_status },
      { header: 'Supplier', key: 'supplier_name' },
      { header: 'Status', value: (r) => TX_STATUS_LABELS[r.status] || r.status },
      { header: 'Jumlah SKU', key: 'item_count' },
      { header: 'Total Diterima Fisik', key: 'total_received_quantity' },
      { header: 'Total Kondisi Baik', key: 'total_good_quantity' },
      { header: 'Total Rusak / Bermasalah', key: 'total_damaged_quantity' },
      {
        header: 'Total Disetujui Masuk Stok',
        value: (r) => (r.status === 'approved' ? r.total_approved_quantity : ''),
      },
      { header: 'Diajukan Oleh', key: 'created_by_name' },
      { header: 'Diproses Oleh', key: 'processed_by_name' },
      { header: 'Tanggal Pengajuan', value: (r) => formatCsvTimestamp(r.transaction_date) },
      { header: 'Tanggal Diproses', value: (r) => formatCsvTimestamp(r.processed_at) },
      { header: 'Catatan Pemeriksaan', key: 'notes' },
      { header: 'Alasan Penolakan', key: 'rejection_reason' },
    ];
  } else {
    rows = await queryOutgoingForExport(filters, { createdByUserId }, client);
    columns = [
      { header: 'Kode Transaksi Keluar', key: 'transaction_code' },
      { header: 'Status', value: (r) => TX_STATUS_LABELS[r.status] || r.status },
      { header: 'Jumlah SKU', key: 'item_count' },
      { header: 'Total Qty', key: 'total_quantity' },
      { header: 'Penerima', key: 'recipient_name' },
      {
        header: 'Tipe Penerima',
        value: (r) => (r.recipient_type ? getRecipientTypeLabel(r.recipient_type) : ''),
      },
      {
        header: 'Metode Serah Terima',
        value: (r) => (r.handover_method ? getHandoverMethodLabel(r.handover_method) : ''),
      },
      { header: 'Kurir', key: 'courier_name' },
      { header: 'Nomor Resi', key: 'tracking_number' },
      { header: 'Diajukan Oleh', key: 'created_by_name' },
      { header: 'Diproses Oleh', key: 'processed_by_name' },
      { header: 'Tanggal Pengajuan', value: (r) => formatCsvTimestamp(r.transaction_date) },
      { header: 'Rencana Kirim', value: (r) => formatCsvDate(r.shipment_date) },
      { header: 'Tanggal Diproses', value: (r) => formatCsvTimestamp(r.processed_at) },
      { header: 'Tanggal Diserahkan', value: (r) => formatCsvTimestamp(r.shipped_at) },
      { header: 'Tanggal Diterima', value: (r) => formatCsvTimestamp(r.delivered_at) },
      { header: 'Catatan', key: 'notes' },
    ];
  }

  const csv = buildCsv(columns, rows);
  const filename = buildExportFilename(config.filenamePrefix);

  if (!client) {
    await recordAuditEvent({
      actorId: user.id,
      actorRole: user.role,
      action: 'CSV_EXPORTED',
      entityType: resource.replace(/-/g, '_'),
      entityId: null,
      metadata: {
        resource,
        rowCount: rows.length,
        scopedToCreator: Boolean(createdByUserId),
        filename,
      },
    });
  }

  return {
    resource,
    filename,
    csv,
    rowCount: rows.length,
  };
}
