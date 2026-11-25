'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Plus,
  Search,
  ArrowUpFromLine,
  Trash2,
  Eye,
  X,
  AlertTriangle,
  Info,
} from 'lucide-react';
import { createOutgoingAction } from '../../modules/outgoing/outgoingActions.js';
import { formatCurrencyIDR, formatDate, formatDateTime } from '../../lib/utils/format.js';
import { getHandoverMethodLabel } from '../../lib/utils/labels.js';
import PageHeader from '../shared/PageHeader.jsx';
import SearchableProductSelect from '../shared/SearchableProductSelect.jsx';
import StatusPill from '../shared/StatusPill.jsx';
import FeedbackBanner from '../shared/FeedbackBanner.jsx';
import ExportCsvButton from '../shared/ExportCsvButton.jsx';
import Button from '../ui/Button.jsx';
import Input from '../ui/Input.jsx';
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
  { value: 'pending', label: 'Menunggu Approval' },
  { value: 'approved', label: 'Disetujui (Siap Picking)' },
  { value: 'shipped', label: 'Shipped' },
  { value: 'rejected', label: 'Ditolak' },
];

export default function OutgoingManager({
  overview,
  canCreate = false,
  canExport = false,
  initialFilters,
}) {
  const router = useRouter();
  const toast = useToast();
  const [search, setSearch] = useState(initialFilters.search || '');
  const [status, setStatus] = useState(initialFilters.status || '');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [feedback, setFeedback] = useState(null);
  const [formError, setFormError] = useState(null);
  const [isPending, startTransition] = useTransition();

  const [shipmentDate, setShipmentDate] = useState(() =>
    new Date().toISOString().slice(0, 10)
  );
  const [recipientName, setRecipientName] = useState('');
  const [notes, setNotes] = useState('');
  const [items, setItems] = useState([{ productId: '', quantity: '1' }]);

  const availableProducts = overview.availableProducts || [];
  const productMap = new Map(availableProducts.map((p) => [String(p.id), p]));
  const hasActiveFilters = Boolean(initialFilters.search || initialFilters.status);

  function pushFilters(overrides = {}) {
    const next = { search, status, page: 1, ...overrides };
    const params = new URLSearchParams();
    if (next.search?.trim()) params.set('search', next.search.trim());
    if (next.status) params.set('status', next.status);
    if (next.page && next.page > 1) params.set('page', String(next.page));
    router.push(`/outgoing${params.toString() ? `?${params.toString()}` : ''}`);
  }

  function resetFilters() {
    setSearch('');
    setStatus('');
    router.push('/outgoing');
  }

  function addRow() {
    setItems((prev) => [...prev, { productId: '', quantity: '1' }]);
  }

  function removeRow(index) {
    setItems((prev) => prev.filter((_, i) => i !== index));
  }

  // Real-time stock & duplicate checks
  const productIdCounts = new Map();
  for (const row of items) {
    if (row.productId) {
      productIdCounts.set(row.productId, (productIdCounts.get(row.productId) || 0) + 1);
    }
  }

  const rowChecks = items.map((row) => {
    const prod = row.productId ? productMap.get(row.productId) : null;
    const qty = Number(row.quantity);
    const price =
      prod && prod.purchase_price !== null && prod.purchase_price !== undefined
        ? Number(prod.purchase_price)
        : null;
    const hasValidPrice = price !== null && Number.isFinite(price) && price > 0;
    const isDuplicate = row.productId && productIdCounts.get(row.productId) > 1;
    const isInvalidQty = !Number.isInteger(qty) || qty <= 0;
    const isOverStock = prod && Number.isFinite(qty) && qty > Number(prod.stock);
    const isMissingPrice = Boolean(prod && !hasValidPrice);
    const subtotal = hasValidPrice && qty > 0 && Number.isFinite(qty) ? price * qty : null;
    return {
      prod,
      qty,
      price,
      hasValidPrice,
      subtotal,
      isDuplicate,
      isInvalidQty,
      isOverStock,
      isMissingPrice,
    };
  });

  const hasValidationIssue =
    items.some((r) => !r.productId) ||
    rowChecks.some(
      (c) => c.isDuplicate || c.isInvalidQty || c.isOverStock || c.isMissingPrice
    );

  const totalUnits = rowChecks.reduce(
    (sum, c) => sum + (c.qty > 0 && Number.isFinite(c.qty) ? c.qty : 0),
    0
  );
  const totalNominal = rowChecks.reduce((sum, c) => sum + (c.subtotal || 0), 0);

  function handleCreateSubmit(e) {
    e.preventDefault();
    setFormError(null);
    if (!shipmentDate || recipientName.trim().length < 2) {
      setFormError('Tanggal pengiriman dan Nama Customer / Penerima (minimal 2 karakter) wajib diisi.');
      return;
    }
    if (hasValidationIssue) {
      setFormError(
        'Periksa kembali pilihan produk, harga produk valid (> Rp 0), duplikasi, dan jumlah barang tidak melebihi stok tersedia.'
      );
      return;
    }

    startTransition(async () => {
      const res = await createOutgoingAction({
        shipmentDate,
        recipientName: recipientName.trim(),
        notes,
        items: items.map((i) => ({
          productId: Number(i.productId),
          quantity: Number(i.quantity),
        })),
      });
      if (res.ok) {
        setShowCreateModal(false);
        setShipmentDate(new Date().toISOString().slice(0, 10));
        setRecipientName('');
        setNotes('');
        setItems([{ productId: '', quantity: '1' }]);
        setFeedback({ type: 'success', text: res.message });
        router.refresh();
      } else {
        setFormError(res.error);
        toast.error(res.error);
      }
    });
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Barang Keluar"
        description="Pengajuan pengeluaran barang, persetujuan Manager, dan pencatatan pengiriman keluar gudang."
        actions={
          <>
            {canExport && (
              <ExportCsvButton
                resource="outgoing"
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
                Ajukan Pengeluaran
              </Button>
            )}
          </>
        }
      />

      <FeedbackBanner feedback={feedback} onDismiss={() => setFeedback(null)} />

      {/* Status Tabs + Search */}
      <Card>
        <CardContent className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex flex-wrap gap-1.5">
            {STATUS_TABS.map((tab) => (
              <button
                key={tab.value}
                type="button"
                onClick={() => {
                  setStatus(tab.value);
                  pushFilters({ status: tab.value });
                }}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold border transition-colors cursor-pointer ${
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
            className="flex gap-2 w-full md:w-auto"
          >
            <div className="relative flex-1 md:w-64">
              <Search
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400"
                aria-hidden="true"
              />
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="OUT-..., nama penerima..."
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
        </CardContent>
      </Card>

      {overview.items.length > 0 ? (
        <div className="space-y-4">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Kode Outgoing</TableHead>
                <TableHead className="hidden md:table-cell">Total Barang</TableHead>
                <TableHead className="hidden lg:table-cell">Diajukan Oleh</TableHead>
                <TableHead className="hidden md:table-cell">Customer / Penerima</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="hidden lg:table-cell">Tgl Pengiriman</TableHead>
                <TableHead className="text-right">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {overview.items.map((tx) => {
                const actionLabel =
                  !canCreate && tx.status === 'pending'
                    ? 'Tinjau Pengajuan'
                    : canCreate && tx.status === 'approved'
                    ? 'Catat Pengiriman'
                    : canCreate && tx.status === 'pending'
                    ? 'Ubah Pengajuan'
                    : 'Lihat Detail';
                const isHighlightAction =
                  (!canCreate && tx.status === 'pending') ||
                  (canCreate && tx.status === 'approved');

                return (
                  <TableRow key={tx.id}>
                    <TableCell className="font-mono text-xs font-semibold text-[#3243DD] whitespace-nowrap">
                      <Link href={`/outgoing/${tx.id}`} className="hover:underline">
                        {tx.transaction_code}
                      </Link>
                      <p className="mt-0.5 font-sans text-[11px] font-normal text-slate-500 whitespace-normal md:hidden">
                        {tx.item_count} SKU ({tx.total_quantity} unit) •{' '}
                        {tx.recipient_name || 'Belum ditentukan'}
                      </p>
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-xs tabular-nums whitespace-nowrap">
                      {tx.item_count} SKU ({tx.total_quantity} unit)
                    </TableCell>
                    <TableCell className="hidden lg:table-cell text-xs text-slate-700">
                      {tx.created_by_name}
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-xs">
                      {tx.recipient_name ? (
                        <div>
                          <p className="font-semibold text-slate-900">
                            {tx.recipient_name}
                          </p>
                          <p className="text-[11px] text-slate-500">
                            {tx.handover_method
                              ? getHandoverMethodLabel(tx.handover_method)
                              : 'Menunggu pengiriman'}
                          </p>
                        </div>
                      ) : (
                        <span className="text-slate-400">Belum ditentukan</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <StatusPill status={tx.status} />
                    </TableCell>
                    <TableCell className="hidden lg:table-cell text-xs text-slate-600 tabular-nums whitespace-nowrap">
                      <div>
                        <p className="font-medium text-slate-800">
                          {tx.shipment_date
                            ? formatDate(tx.shipment_date)
                            : formatDate(tx.transaction_date)}
                        </p>
                        <p className="text-[10px] text-slate-400">
                          Dibuat {formatDateTime(tx.transaction_date)}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell className="text-right whitespace-nowrap">
                      <Link
                        href={`/outgoing/${tx.id}`}
                        className={`inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                          isHighlightAction
                            ? 'bg-[#3243DD] text-white hover:bg-[#2635BC]'
                            : 'border border-slate-200 bg-white text-slate-700 hover:border-[#3243DD] hover:text-[#3243DD]'
                        }`}
                      >
                        <Eye className="h-3.5 w-3.5" aria-hidden="true" />
                        {actionLabel}
                      </Link>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>

          <Pagination
            page={overview.page}
            totalPages={overview.totalPages}
            onPageChange={(nextPage) => pushFilters({ page: nextPage })}
          />
        </div>
      ) : (
        <EmptyState
          icon={ArrowUpFromLine}
          title={
            hasActiveFilters
              ? 'Tidak Ada Outgoing Sesuai Filter'
              : 'Belum Ada Transaksi Barang Keluar'
          }
          description={
            hasActiveFilters
              ? 'Ubah filter status atau kata kunci pencarian untuk melihat transaksi lainnya.'
              : 'Ajukan permintaan pengeluaran barang ketika ada kebutuhan distribusi atau pengambilan dari gudang.'
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
                  Ajukan Outgoing
                </Button>
              )
            )
          }
        />
      )}

      {/* Create Outgoing Modal (Staff) */}
      {canCreate && (
        <Modal
          open={showCreateModal}
          onClose={() => setShowCreateModal(false)}
          title="Ajukan Pengeluaran Barang"
          description="Isi tanggal pengiriman, penerima, dan daftar barang keluar. Stok gudang akan dikurangi otomatis saat pengiriman dicatat."
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

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Input
                name="shipmentDate"
                type="date"
                label="Tanggal Pengiriman"
                required
                value={shipmentDate}
                onChange={(e) => setShipmentDate(e.target.value)}
              />
              <Input
                name="recipientName"
                label="Nama Customer / Penerima"
                required
                minLength={2}
                value={recipientName}
                onChange={(e) => setRecipientName(e.target.value)}
                placeholder="Contoh: PT Maju Jaya / Divisi Operasional"
              />
            </div>

            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <label className="text-xs sm:text-sm font-semibold text-slate-800">
                  Daftar Barang Keluar <span className="text-[#FF3D8B]">*</span>
                </label>
                <Button type="button" variant="secondary" size="sm" onClick={addRow}>
                  <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                  Tambah Item
                </Button>
              </div>

              <div className="space-y-2.5 max-h-64 overflow-y-auto pr-1">
                {items.map((row, idx) => {
                  const check = rowChecks[idx];
                  const hasRowError =
                    check.isDuplicate ||
                    check.isOverStock ||
                    check.isInvalidQty ||
                    check.isMissingPrice;

                  return (
                    <div
                      key={idx}
                      className={`rounded-xl border p-2.5 space-y-1.5 ${
                        hasRowError
                          ? 'border-red-300 bg-red-50/40'
                          : 'border-slate-200 bg-[#F4F5F8]'
                      }`}
                    >
                      <div className="flex flex-col sm:grid sm:grid-cols-[1fr_100px_auto] gap-2 sm:items-center">
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
                          ariaLabel={`Produk baris ${idx + 1}`}
                          placeholder="Cari nama atau SKU produk..."
                          products={availableProducts}
                          isOptionDisabled={(p) => Number(p.stock) <= 0}
                          getOptionMeta={(p) => {
                            const hasPrice =
                              p.purchase_price !== null &&
                              p.purchase_price !== undefined &&
                              Number(p.purchase_price) > 0;
                            const priceLabel = hasPrice
                              ? formatCurrencyIDR(p.purchase_price)
                              : 'HARGA BELUM DIATUR';
                            return `${p.sku} • Stok: ${p.stock} ${p.unit || 'unit'}${p.rack_location ? ` • Rak: ${p.rack_location}` : ''} • ${priceLabel}`;
                          }}
                          getOptionBadge={(p) =>
                            Number(p.stock) <= 0
                              ? { text: 'HABIS', toneClass: 'bg-slate-200 text-slate-700' }
                              : null
                          }
                        />

                        <div className="flex items-center gap-2 sm:contents">
                          <input
                            type="number"
                            min="1"
                            max={check.prod ? check.prod.stock : undefined}
                            step="1"
                            required
                            aria-label={`Jumlah baris ${idx + 1}`}
                            value={row.quantity}
                            onChange={(e) => {
                              const val = e.target.value;
                              setItems((prev) =>
                                prev.map((it, i) =>
                                  i === idx ? { ...it, quantity: val } : it
                                )
                              );
                            }}
                            className="flex-1 min-w-0 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm tabular-nums focus:border-[#3243DD] focus:outline-none"
                          />

                          {items.length > 1 && (
                            <button
                              type="button"
                              onClick={() => removeRow(idx)}
                              className="min-h-[40px] min-w-[40px] inline-flex items-center justify-center rounded-lg p-2 text-red-600 hover:bg-red-100 cursor-pointer shrink-0"
                              aria-label="Hapus baris item"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                      </div>

                      {check.prod && !hasRowError && (
                        <p className="text-[11px] text-slate-500 px-1 tabular-nums">
                          {check.prod.rack_location && (
                            <span className="font-medium text-slate-700">
                              Rak: {check.prod.rack_location} •{' '}
                            </span>
                          )}
                          Stok: <strong>{check.prod.stock}</strong> → Sisa:{' '}
                          <strong className="text-slate-800">
                            {Number(check.prod.stock) - check.qty}
                          </strong>{' '}
                          {check.prod.unit || 'unit'}
                          {check.subtotal !== null && (
                            <span>
                              {' '}• Subtotal:{' '}
                              <strong className="text-slate-800">
                                {formatCurrencyIDR(check.subtotal)}
                              </strong>
                            </span>
                          )}
                        </p>
                      )}
                      {check.isMissingPrice && (
                        <p className="flex items-center gap-1 text-xs font-medium text-red-700 px-1">
                          <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                          Produk belum memiliki harga beli valid (&gt; Rp 0). Minta Admin/Manager mengatur harga terlebih dahulu.
                        </p>
                      )}
                      {check.isOverStock && (
                        <p className="flex items-center gap-1 text-xs font-medium text-red-700 px-1">
                          <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                          Melebihi stok tersedia ({check.prod?.stock} {check.prod?.unit || 'unit'}).
                        </p>
                      )}
                      {check.isDuplicate && (
                        <p className="flex items-center gap-1 text-xs font-medium text-red-700 px-1">
                          <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                          Produk ini sudah dipilih pada baris lain. Gabungkan jumlahnya.
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>

              <div className="rounded-lg border border-slate-200 bg-slate-50 px-3.5 py-2 flex flex-wrap items-center justify-between gap-2 text-xs">
                <span className="text-slate-600 tabular-nums">
                  Total Permintaan: <strong>{items.length} baris</strong> •{' '}
                  <strong className="text-[#3243DD]">{totalUnits}</strong>{' '}
                  unit{totalNominal > 0 ? ` • Estimasi: ${formatCurrencyIDR(totalNominal)}` : ''}
                </span>
                <span className="inline-flex items-center gap-1 text-slate-500">
                  <Info className="h-3.5 w-3.5 text-[#3243DD]" aria-hidden="true" />
                  Stok berkurang saat pengiriman dicatat
                </span>
              </div>
            </div>

            <div>
              <label
                htmlFor="out-notes"
                className="block text-xs sm:text-sm font-medium text-slate-700 mb-1"
              >
                Tujuan / Catatan Pengeluaran
              </label>
              <textarea
                id="out-notes"
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Contoh: Permintaan unit desain grafis / pengiriman cabang Bandung..."
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-[#3243DD] focus:outline-none focus:ring-2 focus:ring-[#3243DD]/20"
              />
            </div>

            <div className="flex justify-end gap-2.5 pt-2 border-t border-slate-100">
              <Button
                variant="secondary"
                onClick={() => setShowCreateModal(false)}
                disabled={isPending}
              >
                Batal
              </Button>
              <Button
                type="submit"
                variant="primary"
                loading={isPending}
                disabled={hasValidationIssue}
              >
                Ajukan Outgoing
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
