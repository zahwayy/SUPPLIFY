'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Plus,
  Search,
  ClipboardList,
  Trash2,
  Eye,
  X,
  AlertTriangle,
  Info,
} from 'lucide-react';
import { createPoAction } from '../../modules/purchase-orders/poActions.js';
import { STOCK_STATUSES } from '../../lib/constants/statuses.js';
import { getStockStatusMeta } from '../../lib/utils/labels.js';
import { formatCurrencyIDR, formatDate } from '../../lib/utils/format.js';
import PageHeader from '../shared/PageHeader.jsx';
import SearchableProductSelect from '../shared/SearchableProductSelect.jsx';
import StatusPill from '../shared/StatusPill.jsx';
import FeedbackBanner from '../shared/FeedbackBanner.jsx';
import ExportCsvButton from '../shared/ExportCsvButton.jsx';
import Button from '../ui/Button.jsx';
import Input from '../ui/Input.jsx';
import Select from '../ui/Select.jsx';
import Modal from '../ui/Modal.jsx';
import { useToast } from '../ui/ToastProvider.jsx';
import Pagination from '../ui/Pagination.jsx';
import EmptyState from '../ui/EmptyState.jsx';
import { Card, CardContent } from '../ui/Card.jsx';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '../ui/Table.jsx';

const STATUS_TABS = [
  { value: '', label: 'Semua' },
  { value: 'pending', label: 'Pending' },
  { value: 'confirmed', label: 'Confirmed' },
  { value: 'in_transit', label: 'In Transit' },
  { value: 'inspecting', label: 'Inspecting' },
  { value: 'received', label: 'Received' },
  { value: 'returned', label: 'Returned' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'cancelled', label: 'Cancelled' },
];

export default function PurchaseOrdersManager({
  catalog,
  suppliers = [],
  products = [],
  canCreate = false,
  canExport = false,
  isSupplier = false,
  preselectedProductId = '',
  prefillContext = null,
  basePath = '/purchase-orders',
  title = 'Purchase Orders',
  description = 'Pantau pesanan pengadaan, konfirmasi Supplier, dan status pengiriman barang.',
  initialFilters,
}) {
  const router = useRouter();
  const toast = useToast();
  const [search, setSearch] = useState(initialFilters.search || '');
  const [status, setStatus] = useState(initialFilters.status || '');
  const resolvedPreProd =
    canCreate &&
    (prefillContext?.productId || preselectedProductId) &&
    products.some(
      (p) => String(p.id) === String(prefillContext?.productId || preselectedProductId)
    )
      ? String(prefillContext?.productId || preselectedProductId)
      : '';
  const resolvedPreSupplier =
    canCreate &&
    prefillContext?.supplierId &&
    suppliers.some((s) => String(s.id) === String(prefillContext.supplierId))
      ? String(prefillContext.supplierId)
      : '';
  const [showCreateModal, setShowCreateModal] = useState(
    Boolean(resolvedPreProd || prefillContext?.referencePoId || prefillContext?.sourceDiscrepancyId)
  );
  const [feedback, setFeedback] = useState(null);
  const [formError, setFormError] = useState(null);
  const [isPending, startTransition] = useTransition();

  // Create PO Form State
  const [supplierId, setSupplierId] = useState(resolvedPreSupplier);
  const [orderDate, setOrderDate] = useState(new Date().toISOString().slice(0, 10));
  const [expectedArrival, setExpectedArrival] = useState('');
  const [referencePoId, setReferencePoId] = useState(
    prefillContext?.referencePoId ? String(prefillContext.referencePoId) : ''
  );
  const [sourceDiscrepancyId, setSourceDiscrepancyId] = useState(
    prefillContext?.sourceDiscrepancyId
      ? String(prefillContext.sourceDiscrepancyId)
      : ''
  );
  const [notes, setNotes] = useState(() => {
    if (prefillContext?.referencePoCode || prefillContext?.sourceDiscrepancyCode) {
      const parts = [];
      if (prefillContext.referencePoCode) {
        parts.push(`PO baru terpisah referensi ${prefillContext.referencePoCode}`);
      }
      if (prefillContext.sourceDiscrepancyCode) {
        parts.push(`tindak lanjut ${prefillContext.sourceDiscrepancyCode}`);
      }
      return parts.join(' • ');
    }
    return '';
  });
  const [items, setItems] = useState([
    {
      productId: resolvedPreProd,
      quantity: prefillContext?.quantity && Number(prefillContext.quantity) > 0
        ? String(prefillContext.quantity)
        : '10',
    },
  ]);

  const hasActiveFilters = Boolean(initialFilters.search || initialFilters.status);

  function pushFilters(overrides = {}) {
    const next = { search, status, page: 1, ...overrides };
    const params = new URLSearchParams();
    if (next.search?.trim()) params.set('search', next.search.trim());
    if (next.status) params.set('status', next.status);
    if (next.page && next.page > 1) params.set('page', String(next.page));
    router.push(`${basePath}${params.toString() ? `?${params.toString()}` : ''}`);
  }

  function resetFilters() {
    setSearch('');
    setStatus('');
    router.push(basePath);
  }

  function addRow() {
    setItems((prev) => [...prev, { productId: '', quantity: '1' }]);
  }

  function removeRow(index) {
    setItems((prev) => prev.filter((_, idx) => idx !== index));
  }

  const productMap = new Map(products.map((p) => [String(p.id), p]));

  const productIdCounts = new Map();
  for (const r of items) {
    if (r.productId) {
      productIdCounts.set(r.productId, (productIdCounts.get(r.productId) || 0) + 1);
    }
  }
  const hasDuplicate = items.some(
    (r) => r.productId && productIdCounts.get(r.productId) > 1
  );
  const hasInvalidQty = items.some(
    (r) => !Number.isInteger(Number(r.quantity)) || Number(r.quantity) <= 0
  );
  const rowDetails = items.map((r) => {
    const prod = r.productId ? productMap.get(String(r.productId)) : null;
    const price = prod && prod.purchase_price !== null && prod.purchase_price !== undefined
      ? Number(prod.purchase_price)
      : null;
    const hasValidPrice = price !== null && Number.isFinite(price) && price > 0;
    const qty = Number(r.quantity) > 0 ? Number(r.quantity) : 0;
    const subtotal = hasValidPrice ? price * qty : null;
    return { prod, price, hasValidPrice, qty, subtotal };
  });
  const hasInvalidPrice = rowDetails.some((d) => d.prod && !d.hasValidPrice);
  const totalUnits = items.reduce(
    (sum, r) => sum + (Number(r.quantity) > 0 ? Number(r.quantity) : 0),
    0
  );
  const totalNominal = rowDetails.reduce((sum, d) => sum + (d.subtotal || 0), 0);

  function handleCreateSubmit(e) {
    e.preventDefault();
    setFormError(null);
    if (items.some((r) => !r.productId)) {
      setFormError('Pilih produk pada setiap baris pesanan terlebih dahulu.');
      return;
    }
    if (hasDuplicate) {
      setFormError('Terdapat produk yang dipilih lebih dari satu kali. Gabungkan jumlah pesanannya.');
      return;
    }
    if (hasInvalidQty) {
      setFormError('Jumlah pesanan setiap item harus berupa angka bulat lebih besar dari 0.');
      return;
    }
    if (hasInvalidPrice) {
      setFormError(
        'Terdapat produk yang belum memiliki harga beli valid (> Rp 0). Atur harga beli pada menu Products terlebih dahulu.'
      );
      return;
    }

    startTransition(async () => {
      const res = await createPoAction({
        supplierId: Number(supplierId),
        orderDate,
        expectedArrival: expectedArrival || null,
        notes,
        referencePoId: referencePoId ? Number(referencePoId) : null,
        sourceDiscrepancyId: sourceDiscrepancyId ? Number(sourceDiscrepancyId) : null,
        items: items.map((i) => ({
          productId: Number(i.productId),
          quantity: Number(i.quantity),
        })),
      });

      if (res.ok) {
        setShowCreateModal(false);
        setSupplierId('');
        setExpectedArrival('');
        setReferencePoId('');
        setSourceDiscrepancyId('');
        setNotes('');
        setItems([{ productId: '', quantity: '10' }]);
        setFeedback({ type: 'success', text: res.message });
      } else {
        setFormError(res.error);
        toast.error(res.error);
      }
    });
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title={title}
        description={description}
        actions={
          <>
            {canExport && (
              <ExportCsvButton
                resource="purchase-orders"
                filters={{
                  search: initialFilters.search,
                  status: initialFilters.status,
                }}
                onFeedback={setFeedback}
              />
            )}
            {canCreate && (
              <Button variant="primary" onClick={() => setShowCreateModal(true)}>
                <Plus className="h-4 w-4" aria-hidden="true" />
                Buat Purchase Order
              </Button>
            )}
          </>
        }
      />

      <FeedbackBanner feedback={feedback} onDismiss={() => setFeedback(null)} />

      {/* Status Filter Pills + Search */}
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
            <div className="flex flex-wrap gap-1.5">
              {STATUS_TABS.map((tab) => (
                <button
                  key={tab.value}
                  type="button"
                  onClick={() => {
                    setStatus(tab.value);
                    pushFilters({ status: tab.value });
                  }}
                  className={`rounded-lg px-2.5 py-1.5 text-xs font-semibold border transition-colors cursor-pointer ${
                    status === tab.value
                      ? 'bg-[#3243DD] text-white border-[#3243DD]'
                      : 'bg-white text-slate-600 border-slate-200 hover:border-[#3243DD]/40 hover:text-slate-900'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                pushFilters();
              }}
              className="flex gap-2 w-full lg:w-auto"
            >
              <div className="relative flex-1 lg:w-60">
                <Search
                  className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400"
                  aria-hidden="true"
                />
                <input
                  type="search"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder={isSupplier ? 'Cari kode PO...' : 'Kode PO atau supplier...'}
                  className="w-full rounded-lg border border-slate-300 bg-white py-2 pl-9 pr-3 text-sm focus:border-[#3243DD] focus:outline-none focus:ring-2 focus:ring-[#3243DD]/20"
                />
              </div>
              <Button type="submit" variant="secondary">
                Cari
              </Button>
              {hasActiveFilters && (
                <Button
                  type="button"
                  variant="ghost"
                  onClick={resetFilters}
                  aria-label="Reset filter"
                  title="Reset filter"
                >
                  <X className="h-4 w-4" aria-hidden="true" />
                </Button>
              )}
            </form>
          </div>
        </CardContent>
      </Card>

      {catalog.items.length > 0 ? (
        <div className="space-y-4">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Kode PO</TableHead>
                {!isSupplier && <TableHead>Supplier</TableHead>}
                <TableHead>Tanggal &amp; Estimasi</TableHead>
                <TableHead>Item / Pemenuhan</TableHead>
                <TableHead>Status PO</TableHead>
                {!isSupplier && <TableHead>Tahap Penerimaan (Incoming)</TableHead>}
                <TableHead className="text-right">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {catalog.items.map((po) => {
                const approvedQty = Number(po.total_approved_quantity || 0);
                const orderedQty = Number(po.total_quantity || 0);
                const remainingQty = Math.max(0, orderedQty - approvedQty);

                const primaryCta =
                  isSupplier && po.status === 'pending'
                    ? 'Konfirmasi'
                    : isSupplier && ['processing', 'confirmed', 'preparing'].includes(po.status)
                    ? 'Kirim Barang'
                    : isSupplier && po.status === 'in_transit' && !po.arrival_confirmed_at
                    ? 'Konfirmasi Tiba'
                    : 'Lihat Detail';
                const highlightCta = primaryCta !== 'Lihat Detail';

                return (
                  <TableRow key={po.id}>
                    <TableCell className="font-mono text-xs font-semibold text-[#3243DD] whitespace-nowrap">
                      <Link href={`/purchase-orders/${po.id}`} className="hover:underline">
                        {po.po_code}
                      </Link>
                      {po.reference_po_code && (
                        <p className="font-sans text-[11px] font-medium text-amber-700">
                          PO Baru (Ref: {po.reference_po_code})
                        </p>
                      )}
                      {po.courier_name && (
                        <p className="font-sans text-[11px] font-normal text-slate-500">
                          {po.courier_name}
                        </p>
                      )}
                    </TableCell>
                    {!isSupplier && (
                      <TableCell className="font-semibold text-slate-900">
                        {po.supplier_name}
                      </TableCell>
                    )}
                    <TableCell className="text-xs tabular-nums whitespace-nowrap">
                      <p className="text-slate-800">{formatDate(po.order_date)}</p>
                      <p className="text-[11px] text-slate-500">
                        Est: {formatDate(po.expected_arrival)}
                      </p>
                    </TableCell>
                    <TableCell className="text-xs tabular-nums whitespace-nowrap">
                      <p className="font-medium text-slate-800">
                        {po.item_count} SKU ({orderedQty} unit)
                      </p>
                      {approvedQty > 0 && (
                        <p className="text-[11px] text-emerald-700">
                          Diterima: {approvedQty}/{orderedQty}
                          {remainingQty > 0 ? ` (Selisih ${remainingQty})` : ''}
                        </p>
                      )}
                    </TableCell>
                    <TableCell>
                      <StatusPill status={po.status} />
                      {po.status === 'in_transit' && po.arrival_confirmed_at && (
                        <p className="mt-1 text-[11px] font-medium text-amber-700">
                          {po.inspection_requested_at
                            ? 'Instruksi periksa aktif'
                            : 'Supplier konfirmasi tiba'}
                        </p>
                      )}
                    </TableCell>
                    {!isSupplier && (
                      <TableCell className="text-xs whitespace-nowrap">
                        {po.pending_incoming_code ? (
                          <div className="flex flex-col gap-1 items-start">
                            <Link
                              href={`/incoming/${po.pending_incoming_id}`}
                              className="font-mono font-semibold text-[#3243DD] hover:underline"
                            >
                              {po.pending_incoming_code}
                            </Link>
                            <StatusPill status="pending" />
                          </div>
                        ) : ['received', 'completed'].includes(po.status) ? (
                          <span className="text-xs font-medium text-emerald-700">
                            {po.approved_incoming_count > 0
                              ? `${approvedQty > 0 ? `${approvedQty} unit masuk stok` : 'Penerimaan disetujui'}`
                              : 'Diterima'}
                          </span>
                        ) : po.status === 'returned' ? (
                          <span className="text-xs font-semibold text-red-700">
                            Pesanan dikembalikan
                          </span>
                        ) : po.status === 'inspecting' ? (
                          <span className="text-xs font-semibold text-[#3243DD]">
                            Sedang diperiksa Staff
                          </span>
                        ) : po.status === 'in_transit' && po.arrival_confirmed_at ? (
                          <span className="text-xs font-medium text-amber-700">
                            Tiba • Menunggu arahan periksa
                          </span>
                        ) : (
                          <span className="text-slate-400">Belum masuk tahap penerimaan</span>
                        )}
                      </TableCell>
                    )}
                    <TableCell className="text-right whitespace-nowrap">
                      <Link
                        href={`/purchase-orders/${po.id}`}
                        className={`inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                          highlightCta
                            ? 'bg-[#3243DD] text-white hover:bg-[#2635BC]'
                            : 'border border-slate-200 bg-white text-slate-700 hover:border-[#3243DD] hover:text-[#3243DD]'
                        }`}
                      >
                        <Eye className="h-3.5 w-3.5" aria-hidden="true" />
                        {primaryCta}
                      </Link>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>

          <Pagination
            page={catalog.page}
            totalPages={catalog.totalPages}
            onPageChange={(nextPage) => pushFilters({ page: nextPage })}
          />
        </div>
      ) : (
        <EmptyState
          icon={ClipboardList}
          title={
            hasActiveFilters
              ? 'Tidak Ada Purchase Order Sesuai Filter'
              : 'Belum Ada Purchase Order'
          }
          description={
            hasActiveFilters
              ? 'Ubah filter status atau kata kunci pencarian untuk melihat pesanan lainnya.'
              : isSupplier
              ? 'Purchase Order yang diterbitkan untuk perusahaan Anda akan tampil di sini.'
              : 'Buat Purchase Order baru untuk memesan pengadaan barang kepada supplier terverifikasi.'
          }
          action={
            hasActiveFilters ? (
              <Button variant="secondary" onClick={resetFilters}>
                Reset Filter
              </Button>
            ) : (
              canCreate && (
                <Button variant="primary" onClick={() => setShowCreateModal(true)}>
                  <Plus className="h-4 w-4" aria-hidden="true" />
                  Buat Purchase Order
                </Button>
              )
            )
          }
        />
      )}

      {/* Create PO Modal (Manager only) */}
      {canCreate && (
        <Modal
          open={showCreateModal}
          onClose={() => setShowCreateModal(false)}
          title="Buat Purchase Order Baru"
          description="Pilih supplier terverifikasi dan daftar produk yang akan dipesan untuk restock gudang."
          maxWidthClass="max-w-2xl"
        >
          <form onSubmit={handleCreateSubmit} className="space-y-4">
            {formError && (
              <div
                role="alert"
                className="rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-700"
              >
                {formError}
              </div>
            )}

            {(prefillContext?.referencePoCode || prefillContext?.sourceDiscrepancyCode) && (
              <div className="rounded-xl border border-[#3243DD]/25 bg-[#EEF1FD]/70 px-3.5 py-2.5 text-xs text-slate-800 space-y-0.5">
                <p className="font-semibold text-[#3243DD]">
                  Pembuatan PO Baru Terpisah
                </p>
                <p>
                  PO ini diterbitkan dengan nomor baru terpisah
                  {prefillContext?.referencePoCode
                    ? ` (referensi PO: ${prefillContext.referencePoCode})`
                    : ''}
                  {prefillContext?.sourceDiscrepancyCode
                    ? ` untuk menindaklanjuti ${prefillContext.sourceDiscrepancyCode}`
                    : ''}
                  . PO sebelumnya tetap tersimpan tanpa dibuka kembali.
                </p>
              </div>
            )}

            {suppliers.length === 0 ? (
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                Belum ada mitra Supplier berstatus Aktif. Pastikan Admin telah menyetujui
                verifikasi Supplier sebelum membuat Purchase Order.
              </div>
            ) : (
              <>
                <Select
                  label="Supplier Terverifikasi"
                  value={supplierId}
                  onChange={(e) => setSupplierId(e.target.value)}
                  required
                  placeholder="Pilih supplier aktif..."
                  options={suppliers.map((s) => ({
                    value: String(s.id),
                    label: `${s.company_name} — PIC: ${s.contact_name}`,
                  }))}
                />

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <Input
                    type="date"
                    label="Tanggal Pemesanan"
                    value={orderDate}
                    onChange={(e) => setOrderDate(e.target.value)}
                    required
                  />
                  <Input
                    type="date"
                    label="Estimasi Kedatangan (Opsional)"
                    value={expectedArrival}
                    min={orderDate}
                    onChange={(e) => setExpectedArrival(e.target.value)}
                  />
                </div>

                <div className="space-y-2.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs sm:text-sm font-semibold text-slate-800">
                      Daftar Produk Pesanan <span className="text-[#FF3D8B]">*</span>
                    </label>
                    <Button type="button" variant="secondary" size="sm" onClick={addRow}>
                      <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                      Tambah Item
                    </Button>
                  </div>

                  <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                    {items.map((row, idx) => {
                      const isDup =
                        row.productId && productIdCounts.get(row.productId) > 1;
                      const detail = rowDetails[idx];
                      const missingPrice = Boolean(detail?.prod && !detail.hasValidPrice);
                      return (
                        <div
                          key={idx}
                          className={`rounded-xl border p-2 space-y-1 ${
                            isDup || missingPrice
                              ? 'border-red-300 bg-red-50/40'
                              : 'border-slate-200 bg-[#F4F5F8]'
                          }`}
                        >
                          <div className="grid grid-cols-1 sm:grid-cols-[1fr_100px_auto] gap-2 items-center">
                            <SearchableProductSelect
                              value={row.productId}
                              onChange={(val) => {
                                setItems((prev) =>
                                  prev.map((it, i) =>
                                    i === idx ? { ...it, productId: val } : it
                                  )
                                );
                              }}
                              required
                              ariaLabel={`Produk pesanan ${idx + 1}`}
                              placeholder="Cari nama atau SKU produk..."
                              products={products}
                              getOptionMeta={(p) => {
                                const hasPrice =
                                  p.purchase_price !== null &&
                                  p.purchase_price !== undefined &&
                                  Number(p.purchase_price) > 0;
                                const priceTag = hasPrice
                                  ? formatCurrencyIDR(p.purchase_price)
                                  : 'HARGA BELUM DIATUR';
                                return `${p.sku} • Stok: ${p.stock} ${p.unit || 'unit'} • ${priceTag}`;
                              }}
                              getOptionBadge={(p) => {
                                if (Number(p.stock) === 0) {
                                  return {
                                    text: getStockStatusMeta(STOCK_STATUSES.OUT_OF_STOCK).label.toUpperCase(),
                                    toneClass: 'bg-slate-200 text-slate-700',
                                  };
                                }
                                if (
                                  p.minimum_stock !== null &&
                                  Number(p.stock) <= Number(p.minimum_stock)
                                ) {
                                  return {
                                    text: getStockStatusMeta(STOCK_STATUSES.SEVERE).label.toUpperCase(),
                                    toneClass: 'bg-red-100 text-red-700',
                                  };
                                }
                                if (
                                  p.minimum_stock !== null &&
                                  p.low_stock_threshold !== null &&
                                  p.low_stock_threshold !== undefined &&
                                  Number(p.stock) <= Number(p.low_stock_threshold)
                                ) {
                                  return {
                                    text: getStockStatusMeta(STOCK_STATUSES.LOW).label.toUpperCase(),
                                    toneClass: 'bg-amber-100 text-amber-800',
                                  };
                                }
                                return null;
                              }}
                            />
                            <input
                              type="number"
                              min="1"
                              step="1"
                              required
                              aria-label={`Jumlah pesanan ${idx + 1}`}
                              value={row.quantity}
                              onChange={(e) => {
                                const val = e.target.value;
                                setItems((prev) =>
                                  prev.map((it, i) =>
                                    i === idx ? { ...it, quantity: val } : it
                                  )
                                );
                              }}
                              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm tabular-nums focus:border-[#3243DD] focus:outline-none"
                            />
                            {items.length > 1 && (
                              <button
                                type="button"
                                onClick={() => removeRow(idx)}
                                className="rounded-lg p-2 text-red-600 hover:bg-red-100 cursor-pointer"
                                aria-label="Hapus baris item"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            )}
                          </div>
                          {detail?.prod && detail.hasValidPrice && !isDup && (
                            <p className="text-[11px] text-slate-600 px-1 tabular-nums">
                              Harga: <strong>{formatCurrencyIDR(detail.price)}</strong>/{detail.prod.unit || 'unit'}
                              {detail.subtotal !== null && (
                                <span> • Subtotal: <strong className="text-slate-900">{formatCurrencyIDR(detail.subtotal)}</strong></span>
                              )}
                            </p>
                          )}
                          {missingPrice && (
                            <p className="flex items-center gap-1 text-xs font-medium text-red-700 px-1">
                              <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                              Produk ini belum memiliki harga beli valid (&gt; Rp 0). Atur harga di menu Products terlebih dahulu.
                            </p>
                          )}
                          {isDup && (
                            <p className="flex items-center gap-1 text-xs font-medium text-red-700 px-1">
                              <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                              Produk duplikat. Gabungkan jumlah pada satu baris.
                            </p>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  <div className="rounded-lg border border-slate-200 bg-slate-50 px-3.5 py-2 flex flex-wrap items-center justify-between gap-2 text-xs">
                    <span className="text-slate-600 tabular-nums">
                      Ringkasan: <strong>{items.length} baris</strong> •{' '}
                      <strong className="text-[#3243DD]">
                        {totalUnits}
                      </strong>{' '}
                      unit{totalNominal > 0 ? ` • Estimasi: ${formatCurrencyIDR(totalNominal)}` : ''}
                    </span>
                    <span className="inline-flex items-center gap-1 text-slate-500">
                      <Info className="h-3.5 w-3.5 text-[#3243DD]" aria-hidden="true" />
                      Harga dikunci (snapshot) saat PO dibuat • Stok tidak berubah
                    </span>
                  </div>
                </div>

                <div>
                  <label
                    htmlFor="po-notes"
                    className="block text-xs sm:text-sm font-medium text-slate-700 mb-1"
                  >
                    Catatan PO (Opsional)
                  </label>
                  <textarea
                    id="po-notes"
                    rows={2}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Instruksi pengemasan, jam penerimaan gudang, atau catatan khusus..."
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-[#3243DD] focus:outline-none focus:ring-2 focus:ring-[#3243DD]/20"
                  />
                </div>
              </>
            )}

            <div className="flex justify-end gap-2.5 pt-2 border-t border-slate-100">
              <Button
                variant="secondary"
                onClick={() => setShowCreateModal(false)}
                disabled={isPending}
              >
                Batal
              </Button>
              {suppliers.length > 0 && (
                <Button
                  type="submit"
                  variant="primary"
                  loading={isPending}
                  disabled={hasDuplicate || hasInvalidQty || hasInvalidPrice}
                >
                  Terbitkan Purchase Order
                </Button>
              )}
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
