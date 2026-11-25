export const CONDITION_STATUS_LABELS = Object.freeze({
  good: { label: 'Baik', tone: 'success' },
  partial: { label: 'Sebagian / Kurang', tone: 'warning' },
  damaged: { label: 'Rusak', tone: 'danger' },
  wrong_item: { label: 'Barang Salah', tone: 'danger' },
  excess: { label: 'Melebihi Pesanan', tone: 'info' },
  mixed: { label: 'Sebagian Baik & Bermasalah', tone: 'warning' },
});

export const INCOMING_DISCREPANCY_ACTION_LABELS = Object.freeze({
  none: 'Sesuai / Tidak Perlu Tindak Lanjut',
  refund_claim: 'Ajukan Klaim Refund ke Supplier',
  create_new_po: 'Buat PO Baru (Terpisah) Jika Masih Dibutuhkan',
  return_to_supplier: 'Retur Barang Bermasalah ke Supplier',
  reject_damaged: 'Tolak Barang Rusak (Tidak Masuk Stok)',
  follow_up_supplier: 'Catat Discrepancy untuk Tindak Lanjut Manager',
  close_shortage: 'Tutup Kekurangan Secara Resmi',
  accept_excess: 'Kelebihan Pengiriman (Legacy)',
});

export const DISCREPANCY_ISSUE_LABELS = Object.freeze({
  shortage: { label: 'Kekurangan Jumlah', tone: 'warning' },
  excess: { label: 'Kelebihan Jumlah', tone: 'info' },
  damaged: { label: 'Barang Rusak', tone: 'danger' },
  wrong_item: { label: 'Produk Salah', tone: 'danger' },
  lost: { label: 'Hilang', tone: 'danger' },
  not_received: { label: 'Tidak Diterima', tone: 'danger' },
  other: { label: 'Lainnya', tone: 'neutral' },
});

export const DISCREPANCY_SOURCE_LABELS = Object.freeze({
  incoming: 'Barang Masuk (Incoming)',
  outgoing: 'Barang Keluar (Outgoing)',
  purchase_order: 'Purchase Order',
  stock_count: 'Stock Opname',
});

export const RESOLUTION_TYPE_LABELS = Object.freeze({
  refund: 'Klaim Refund ke Supplier',
  new_po: 'Pembuatan PO Baru (Terpisah)',
  found: 'Barang Ditemukan',
  replacement: 'Penggantian Supplier',
  return: 'Retur Barang',
  adjustment: 'Penyesuaian Stok',
  other: 'Penyelesaian Lainnya',
});

export const REFUND_STATUS_META = Object.freeze({
  none: { label: 'Belum Diajukan', tone: 'neutral' },
  submitted: { label: 'Diajukan ke Supplier', tone: 'warning' },
  approved: { label: 'Disetujui Supplier', tone: 'info' },
  rejected: { label: 'Ditolak Supplier', tone: 'danger' },
  completed: { label: 'Refund Selesai', tone: 'success' },
});

export const ADJUSTMENT_TYPE_LABELS = Object.freeze({
  loss: { label: 'Kehilangan', tone: 'danger' },
  damage: { label: 'Barang Rusak', tone: 'danger' },
  found: { label: 'Barang Ditemukan', tone: 'success' },
  correction: { label: 'Koreksi Stok', tone: 'info' },
  return: { label: 'Retur Layak Simpan', tone: 'primary' },
  other: { label: 'Lainnya', tone: 'neutral' },
});

export const MOVEMENT_TYPE_LABELS = Object.freeze({
  in: { label: 'Barang Masuk (+)', tone: 'success' },
  out: { label: 'Barang Keluar (-)', tone: 'warning' },
  adjustment_in: { label: 'Penyesuaian (+)', tone: 'info' },
  adjustment_out: { label: 'Penyesuaian (-)', tone: 'danger' },
});

export const HANDOVER_METHOD_LABELS = Object.freeze({
  direct: 'Serah Terima Langsung',
  courier: 'Kurir / Ekspedisi',
});

export const RECIPIENT_TYPE_LABELS = Object.freeze({
  internal: 'Internal',
  customer: 'Pelanggan',
  branch: 'Cabang',
  external: 'Pihak Eksternal',
  courier: 'Kurir',
});

export const STOCK_STATUS_META = Object.freeze({
  'Out of Stock': { label: 'Habis', tone: 'neutral' },
  Severe: { label: 'Kritis', tone: 'danger' },
  Low: { label: 'Menipis', tone: 'warning' },
  Normal: { label: 'Aman', tone: 'success' },
  'Min. Belum Diatur': { label: 'Min. Belum Diatur', tone: 'neutral' },
});

export const STOCK_STATUS_FILTER_OPTIONS = Object.freeze([
  { value: 'out_of_stock', label: `${STOCK_STATUS_META['Out of Stock'].label} (0)` },
  { value: 'severe', label: `${STOCK_STATUS_META.Severe.label} (<= Min)` },
  { value: 'low', label: STOCK_STATUS_META.Low.label },
  { value: 'normal', label: STOCK_STATUS_META.Normal.label },
  { value: 'unconfigured', label: STOCK_STATUS_META['Min. Belum Diatur'].label },
]);

export const SUPPLIER_APPEAL_STATUS_META = Object.freeze({
  submitted: { label: 'Banding Diajukan', tone: 'warning' },
  under_review: { label: 'Ditinjau Admin', tone: 'info' },
  approved: { label: 'Banding Disetujui', tone: 'success' },
  rejected: { label: 'Banding Ditolak', tone: 'danger' },
});

export const AUDIT_ENTITY_LABELS = Object.freeze({
  user: 'Akun Pengguna',
  supplier: 'Mitra Supplier',
  supplier_appeal: 'Banding Registrasi Supplier',
  category: 'Kategori',
  product: 'Produk',
  purchase_order: 'Pesanan Pembelian (PO)',
  transaction: 'Transaksi Gudang',
  discrepancy_report: 'Laporan Selisih Stok',
  stock_adjustment: 'Penyesuaian Stok',
  evidence_file: 'Lampiran Bukti',
});

export const AUDIT_ACTION_LABELS = Object.freeze({
  USER_LOGIN: { label: 'Login Berhasil', tone: 'info' },
  USER_LOGOUT: { label: 'Logout Akun', tone: 'neutral' },
  USER_LOGIN_FAILED: { label: 'Login Gagal', tone: 'warning' },
  USER_CREATED: { label: 'Akun Internal Dibuat', tone: 'primary' },
  USER_STATUS_UPDATED: { label: 'Status Akun Diubah', tone: 'warning' },
  PROFILE_UPDATED: { label: 'Profil Diperbarui', tone: 'info' },
  SUPPLIER_REGISTERED: { label: 'Pendaftaran Supplier', tone: 'info' },
  SUPPLIER_APPROVED: { label: 'Supplier Disetujui', tone: 'success' },
  SUPPLIER_REJECTED: { label: 'Supplier Ditolak', tone: 'danger' },
  SUPPLIER_APPEAL_SUBMITTED: { label: 'Banding Registrasi Diajukan', tone: 'warning' },
  SUPPLIER_APPEAL_UPDATED: { label: 'Informasi Banding Diperbarui', tone: 'info' },
  SUPPLIER_APPEAL_UNDER_REVIEW: { label: 'Banding Ditinjau Admin', tone: 'info' },
  SUPPLIER_APPEAL_APPROVED: { label: 'Banding Supplier Disetujui', tone: 'success' },
  SUPPLIER_APPEAL_REJECTED: { label: 'Banding Supplier Ditolak', tone: 'danger' },
  CATEGORY_CREATED: { label: 'Kategori Dibuat', tone: 'primary' },
  CATEGORY_UPDATED: { label: 'Kategori Diperbarui', tone: 'info' },
  CATEGORY_DELETED: { label: 'Kategori Dihapus', tone: 'warning' },
  PRODUCT_CREATED: { label: 'Produk Ditambahkan', tone: 'primary' },
  PRODUCT_UPDATED: { label: 'Produk Diperbarui', tone: 'info' },
  PRODUCT_DELETED: { label: 'Produk Dihapus', tone: 'warning' },
  PRODUCT_ARCHIVED: { label: 'Produk Diarsipkan', tone: 'warning' },
  PRODUCT_RESTORED: { label: 'Produk Diaktifkan Kembali', tone: 'success' },
  PO_CREATED: { label: 'PO Dibuat', tone: 'primary' },
  PO_CONFIRMED: { label: 'PO Dikonfirmasi Supplier', tone: 'success' },
  PO_REJECTED: { label: 'PO Ditolak Supplier', tone: 'danger' },
  PO_PREPARING: { label: 'PO Sedang Disiapkan', tone: 'info' },
  PO_SHIPMENT_SUBMITTED: { label: 'Data Pengiriman Dikirim', tone: 'primary' },
  PO_ARRIVAL_CONFIRMED: { label: 'Kedatangan Dikonfirmasi Supplier', tone: 'info' },
  PO_INSPECTING: { label: 'PO Dalam Pemeriksaan (Inspecting)', tone: 'warning' },
  PO_INSPECTION_REQUESTED: { label: 'Manager Informasikan Staff Pemeriksaan', tone: 'primary' },
  PO_DELIVERED: { label: 'Barang PO Tiba di Gudang', tone: 'info' },
  PO_RECEIVED: { label: 'PO Ditetapkan Received', tone: 'success' },
  PO_RETURNED: { label: 'PO Ditetapkan Returned', tone: 'danger' },
  PO_COMPLETED: { label: 'PO Selesai (Completed)', tone: 'success' },
  PO_CANCELLED: { label: 'PO Dibatalkan', tone: 'neutral' },
  CSV_EXPORTED: { label: 'Data Diekspor ke CSV', tone: 'info' },
  INCOMING_CREATED: { label: 'Incoming Diajukan', tone: 'primary' },
  INCOMING_APPROVED: { label: 'Incoming Disetujui', tone: 'success' },
  INCOMING_REJECTED: { label: 'Incoming Ditolak', tone: 'danger' },
  INCOMING_CANCELLED: { label: 'Incoming Dibatalkan', tone: 'neutral' },
  OUTGOING_CREATED: { label: 'Outgoing Diajukan', tone: 'primary' },
  OUTGOING_UPDATED: { label: 'Outgoing Pending Diubah', tone: 'info' },
  OUTGOING_DELETED: { label: 'Outgoing Pending Dihapus', tone: 'warning' },
  OUTGOING_APPROVED: { label: 'Outgoing Disetujui', tone: 'success' },
  OUTGOING_REJECTED: { label: 'Outgoing Ditolak', tone: 'danger' },
  OUTGOING_CANCELLED: { label: 'Outgoing Dibatalkan', tone: 'neutral' },
  OUTGOING_SHIPPED: { label: 'Outgoing Dikirim (Shipped)', tone: 'primary' },
  OUTGOING_HANDOVER_SHIPPED: { label: 'Outgoing Dikirim (Shipped)', tone: 'primary' },
  OUTGOING_HANDOVER_RECORDED: { label: 'Serah Terima Outgoing', tone: 'primary' },
  OUTGOING_DELIVERED: { label: 'Outgoing Diterima', tone: 'success' },
  DISCREPANCY_CREATED: { label: 'Discrepancy Dilaporkan', tone: 'warning' },
  DISCREPANCY_REPORTED: { label: 'Discrepancy Dilaporkan', tone: 'warning' },
  DISCREPANCY_UPDATED: { label: 'Discrepancy Ditindaklanjuti', tone: 'info' },
  DISCREPANCY_REFUND_CLAIMED: { label: 'Klaim Refund Diajukan', tone: 'warning' },
  DISCREPANCY_REFUND_UPDATED: { label: 'Status Klaim Refund Diperbarui', tone: 'info' },
  ADJUSTMENT_REQUESTED: { label: 'Adjustment Diajukan', tone: 'warning' },
  ADJUSTMENT_APPROVED: { label: 'Adjustment Disetujui', tone: 'success' },
  ADJUSTMENT_REJECTED: { label: 'Adjustment Ditolak', tone: 'danger' },
  EVIDENCE_UPLOADED: { label: 'Bukti Diunggah', tone: 'info' },
  EVIDENCE_DELETED: { label: 'Bukti Dihapus', tone: 'warning' },
});

export function getConditionMeta(value) {
  return CONDITION_STATUS_LABELS[value] || { label: value || 'Baik', tone: 'neutral' };
}

export function getIncomingDiscrepancyActionLabel(value) {
  return INCOMING_DISCREPANCY_ACTION_LABELS[value] || '—';
}

export function getDiscrepancyIssueMeta(value) {
  return DISCREPANCY_ISSUE_LABELS[value] || { label: value || 'Lainnya', tone: 'warning' };
}

export function getDiscrepancySourceLabel(value) {
  return DISCREPANCY_SOURCE_LABELS[value] || value || '—';
}

export function getResolutionTypeLabel(value) {
  return RESOLUTION_TYPE_LABELS[value] || value || 'Selesai';
}

export function getAdjustmentTypeMeta(value) {
  return ADJUSTMENT_TYPE_LABELS[value] || { label: value || 'Lainnya', tone: 'info' };
}

export function getMovementTypeMeta(value) {
  return MOVEMENT_TYPE_LABELS[value] || { label: value || 'Pergerakan', tone: 'neutral' };
}

export function getHandoverMethodLabel(value) {
  return HANDOVER_METHOD_LABELS[value] || value || '—';
}

export function getRecipientTypeLabel(value) {
  return RECIPIENT_TYPE_LABELS[value] || value || '—';
}

export function getStockStatusMeta(value) {
  return STOCK_STATUS_META[value] || { label: value || 'Tidak Diketahui', tone: 'neutral' };
}

export function getRefundStatusMeta(value) {
  return REFUND_STATUS_META[value || 'none'] || REFUND_STATUS_META.none;
}

export function getSupplierAppealStatusMeta(value) {
  return (
    SUPPLIER_APPEAL_STATUS_META[value] || {
      label: value || 'Belum Ada Banding',
      tone: 'neutral',
    }
  );
}

export function getAuditActionMeta(action) {
  if (AUDIT_ACTION_LABELS[action]) {
    return AUDIT_ACTION_LABELS[action];
  }
  const readable = String(action || 'Aktivitas')
    .toLowerCase()
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
  return { label: readable, tone: 'neutral' };
}

export function getAuditEntityLabel(entityType) {
  return AUDIT_ENTITY_LABELS[entityType] || entityType || 'Sistem';
}

const SUMMARY_FIELD_LABELS = {
  status: 'Status',
  stock_status: 'Status Stok',
  stockStatusAfter: 'Status Stok',
  sku: 'SKU',
  name: 'Nama',
  code: 'Kode',
  poCode: 'Kode PO',
  po_code: 'Kode PO',
  transactionCode: 'Kode Transaksi',
  transaction_code: 'Kode Transaksi',
  issueCode: 'Kode Issue',
  adjustmentCode: 'Kode Adjustment',
  companyName: 'Perusahaan',
  company_name: 'Perusahaan',
  email: 'Email',
  phone: 'Telepon',
  contactName: 'Penanggung Jawab',
  address: 'Alamat',
  role: 'Peran',
  courierName: 'Kurir',
  trackingNumber: 'Resi',
  quantityDelta: 'Perubahan Stok',
  reason: 'Alasan',
  rejectionReason: 'Alasan Penolakan',
  appealReason: 'Penjelasan Banding',
  adminDecisionNotes: 'Catatan Peninjauan',
  originalName: 'Lampiran',
  recipientName: 'Penerima',
  itemCount: 'Jumlah Item',
};

export function formatAuditSummary(newState, metadata) {
  const source =
    newState && typeof newState === 'object'
      ? newState
      : metadata && typeof metadata === 'object'
      ? metadata
      : null;

  if (!source) return '—';

  const entries = Object.entries(source)
    .filter(
      ([key, val]) =>
        val !== null &&
        val !== undefined &&
        val !== '' &&
        !['id', 'userId', 'actorId', 'targetId', 'password', 'passwordHash'].includes(key) &&
        typeof val !== 'object'
    )
    .slice(0, 4);

  if (entries.length === 0) return 'Perubahan tercatat';

  return entries
    .map(([key, val]) => {
      const label = SUMMARY_FIELD_LABELS[key] || key.replace(/_/g, ' ');
      const displayVal =
        key === 'stock_status' || key === 'stockStatusAfter'
          ? getStockStatusMeta(val).label
          : val;
      return `${label}: ${displayVal}`;
    })
    .join(' • ');
}

export function getMovementSourceHref(row) {
  if (row?.transaction_id) {
    if (row.transaction_type === 'incoming' || row.movement_type === 'in') {
      return `/incoming/${row.transaction_id}`;
    }
    if (row.transaction_type === 'outgoing' || row.movement_type === 'out') {
      return `/outgoing/${row.transaction_id}`;
    }
  }
  if (row?.stock_adjustment_id) {
    return '/stock-adjustments';
  }
  return null;
}

export function getDiscrepancySourceHref(report) {
  if (!report) return null;
  if (report.transaction_id) {
    if (report.source_type === 'incoming') return `/incoming/${report.transaction_id}`;
    if (report.source_type === 'outgoing') return `/outgoing/${report.transaction_id}`;
  }
  if (report.purchase_order_id) {
    return `/purchase-orders/${report.purchase_order_id}`;
  }
  return null;
}
