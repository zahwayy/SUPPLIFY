'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Plus,
  Search,
  ArrowDownToLine,
  Eye,
  X,
  AlertTriangle,
  Info,
  ClipboardList,
} from 'lucide-react';
import { createIncomingAction } from '../../modules/incoming/incomingActions.js';
import { formatDate, formatDateTime } from '../../lib/utils/format.js';
import PageHeader from '../shared/PageHeader.jsx';
import StatusPill from '../shared/StatusPill.jsx';
import FeedbackBanner from '../shared/FeedbackBanner.jsx';
import ExportCsvButton from '../shared/ExportCsvButton.jsx';
import Badge from '../ui/Badge.jsx';
import Button from '../ui/Button.jsx';
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
  { value: 'pending', label: 'Menunggu Review' },
  { value: 'approved', label: 'Disetujui' },
  { value: 'rejected', label: 'Ditolak' },
  { value: 'cancelled', label: 'Dibatalkan' },
];

function buildItemEntriesFromPo(po) {
  if (!po || !Array.isArray(po.items)) return [];
  return po.items.map((it) => {
    const orderedQty = Number(it.quantity);
    const approvedQty = Number(it.approved_quantity || 0);
    const remainingQty = Math.max(0, orderedQty - approvedQty);
    const defaultQty = remainingQty > 0 ? remainingQty : orderedQty;
    return {
      included: remainingQty > 0 || approvedQty === 0,
      productId: it.product_id,
      sku: it.sku,
      name: it.product_name,
      unit: it.unit || '',
      rackLocation: it.rack_location || '',
      orderedQty,
      previouslyApprovedQty: approvedQty,
      remainingQty,
      quantity: String(defaultQty),
      goodQuantity: String(defaultQty),
      damagedQuantity: '0',
      conditionStatus: 'good',
      notes: '',
    };
  });
}

export default function IncomingManager({
  overview,
  canCreate = false,
  canExport = false,
  preselectedPoId = '',
  initialFilters,
}) {
  const router = useRouter();
  const toast = useToast();
  const [search, setSearch] = useState(initialFilters.search || '');
  const [status, setStatus] = useState(initialFilters.status || '');
  const [showCreateModal, setShowCreateModal] = useState(Boolean(preselectedPoId));
  const [feedback, setFeedback] = useState(null);
  const [formError, setFormError] = useState(null);
  const [isPending, startTransition] = useTransition();

  const eligiblePos = overview.eligiblePos || [];
  const [selectedPoId, setSelectedPoId] = useState(
    preselectedPoId && eligiblePos.some((p) => String(p.id) === String(preselectedPoId))
      ? String(preselectedPoId)
      : ''
  );
  const [receivingDate, setReceivingDate] = useState(
    new Date().toISOString().slice(0, 10)
  );
  const [notes, setNotes] = useState('');
  const [itemEntries, setItemEntries] = useState(() => {
    const found = eligiblePos.find((p) => String(p.id) === String(preselectedPoId));
    return buildItemEntriesFromPo(found);
  });

  const selectedPo = eligiblePos.find((p) => String(p.id) === String(selectedPoId)) || null;
  const hasActiveFilters = Boolean(initialFilters.search || initialFilters.status);

  function handleSelectPo(poIdValue) {
    setSelectedPoId(poIdValue);
    setFormError(null);
    const found = eligiblePos.find((p) => String(p.id) === String(poIdValue));
    setItemEntries(buildItemEntriesFromPo(found));
  }

  function pushFilters(overrides = {}) {
    const next = { search, status, page: 1, ...overrides };
    const params = new URLSearchParams();
    if (next.search?.trim()) params.set('search', next.search.trim());
    if (next.status) params.set('status', next.status);
    if (next.page && next.page > 1) params.set('page', String(next.page));
    router.push(`/incoming${params.toString() ? `?${params.toString()}` : ''}`);
  }

  function resetFilters() {
    setSearch('');
    setStatus('');
    router.push('/incoming');
  }

  const includedEntries = itemEntries.filter((it) => it.included);
  const totalReceived = includedEntries.reduce(
    (sum, it) => sum + (Number(it.quantity) > 0 ? Number(it.quantity) : 0),
    0
  );
  const totalGood = includedEntries.reduce(
    (sum, it) => sum + (Number(it.goodQuantity) >= 0 ? Number(it.goodQuantity) : 0),
    0
  );
  const totalDamaged = includedEntries.reduce(
    (sum, it) => sum + (Number(it.damagedQuantity) >= 0 ? Number(it.damagedQuantity) : 0),
    0
  );
  const hasAnyDiff = includedEntries.some(
    (it) =>
      Number(it.quantity) !== Number(it.remainingQty || it.orderedQty) ||
      Number(it.damagedQuantity) > 0 ||
      it.conditionStatus !== 'good'
  );
  const hasInvalidQty =
    includedEntries.length === 0 ||
    includedEntries.some((it) => {
      const q = Number(it.quantity);
      const g = Number(it.goodQuantity);
      const d = Number(it.damagedQuantity);
      return (
        !Number.isInteger(q) ||
        q <= 0 ||
        !Number.isInteger(g) ||
        g < 0 ||
        !Number.isInteger(d) ||
        d < 0 ||
        g + d !== q
      );
    });

  function handleCreateSubmit(e) {
    e.preventDefault();
    setFormError(null);
    if (includedEntries.length === 0) {
      setFormError('Pilih minimal satu produk yang diperiksa pada pengiriman ini.');
      return;
    }
    if (hasInvalidQty) {
      setFormError(
        'Pastikan jumlah diterima aktual > 0 serta jumlah baik + rusak/bermasalah sama dengan jumlah aktual diterima.'
      );
      return;
    }

    startTransition(async () => {
      const res = await createIncomingAction({
        purchaseOrderId: Number(selectedPoId),
        receivingDate,
        notes,
        items: includedEntries.map((it) => ({
          productId: Number(it.productId),
          quantity: Number(it.quantity),
          goodQuantity: Number(it.goodQuantity),
          damagedQuantity: Number(it.damagedQuantity),
          conditionStatus: it.conditionStatus,
          notes: it.notes,
        })),
      });
      if (res.ok) {
        setShowCreateModal(false);
        setSelectedPoId('');
        setItemEntries([]);
        setReceivingDate(new Date().toISOString().slice(0, 10));
        setNotes('');
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
        title="Barang Masuk"
        description="Pencatatan pemeriksaan fisik barang masuk dari Purchase Order dan persetujuan masuk stok oleh Manager."
        actions={
          <>
            {canExport && (
              <ExportCsvButton
                resource="incoming"
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
                Catat Pemeriksaan Masuk
              </Button>
            )}
          </>
        }
      />

      <FeedbackBanner feedback={feedback} onDismiss={() => setFeedback(null)} />

      {/* Staff Contextual Cue for Eligible POs */}
      {canCreate && eligiblePos.length > 0 && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-[#3243DD]/25 bg-[#EEF1FD]/70 px-4 py-3 text-sm">
          <div className="flex items-start gap-2.5">
            <ClipboardList className="h-4 w-4 mt-0.5 text-[#3243DD] shrink-0" aria-hidden="true" />
            <div>
              <p className="font-semibold text-slate-900">
                {eligiblePos.length} Purchase Order siap diperiksa secara fisik
              </p>
              <p className="text-xs text-slate-600">
                Catat jumlah fisik dan kondisi barang sebelum diajukan ke Manager untuk masuk stok.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              if (!selectedPoId && eligiblePos[0]) {
                handleSelectPo(String(eligiblePos[0].id));
              }
              setShowCreateModal(true);
            }}
            className="shrink-0 text-xs font-semibold text-[#3243DD] hover:underline cursor-pointer text-left sm:text-right"
          >
            Buka form pemeriksaan
          </button>
        </div>
      )}

      {/* Quick Status Tabs + Search */}
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
                placeholder="INC-..., PO-..., atau supplier..."
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
                <TableHead>Kode Incoming</TableHead>
                <TableHead>Referensi PO</TableHead>
                <TableHead>Supplier</TableHead>
                <TableHead>Diterima / Disetujui</TableHead>
                <TableHead>Diperiksa Oleh</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Tanggal</TableHead>
                <TableHead className="text-right">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {overview.items.map((tx) => (
                <TableRow key={tx.id}>
                  <TableCell className="font-mono text-xs font-semibold text-[#3243DD] whitespace-nowrap">
                    <Link href={`/incoming/${tx.id}`} className="hover:underline">
                      {tx.transaction_code}
                    </Link>
                    {tx.has_issue && (
                      <p className="font-sans text-[11px] font-medium text-amber-700">
                        Ada catatan ketidaksesuaian
                      </p>
                    )}
                  </TableCell>
                  <TableCell className="font-mono text-xs whitespace-nowrap">
                    <Link
                      href={`/purchase-orders/${tx.purchase_order_id}`}
                      className="text-slate-800 hover:text-[#3243DD] hover:underline"
                    >
                      {tx.po_code}
                    </Link>
                  </TableCell>
                  <TableCell className="text-xs font-semibold text-slate-900">
                    {tx.supplier_name}
                  </TableCell>
                  <TableCell className="text-xs tabular-nums whitespace-nowrap">
                    <p>
                      {tx.item_count} SKU ({tx.total_quantity} fisik)
                    </p>
                    {tx.status === 'approved' ? (
                      <p className="text-[11px] font-semibold text-emerald-700">
                        Disetujui: {tx.total_approved_quantity} unit
                      </p>
                    ) : Number(tx.total_damaged_quantity) > 0 ? (
                      <p className="text-[11px] font-medium text-red-700">
                        Bermasalah: {tx.total_damaged_quantity} unit
                      </p>
                    ) : null}
                  </TableCell>
                  <TableCell className="text-xs text-slate-700">
                    {tx.created_by_name}
                  </TableCell>
                  <TableCell>
                    <StatusPill status={tx.status} />
                  </TableCell>
                  <TableCell className="text-xs text-slate-600 tabular-nums whitespace-nowrap">
                    {formatDateTime(tx.transaction_date)}
                  </TableCell>
                  <TableCell className="text-right whitespace-nowrap">
                    <Link
                      href={`/incoming/${tx.id}`}
                      className={`inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                        !canCreate && tx.status === 'pending'
                          ? 'bg-[#3243DD] text-white hover:bg-[#2635BC]'
                          : 'border border-slate-200 bg-white text-slate-700 hover:border-[#3243DD] hover:text-[#3243DD]'
                      }`}
                    >
                      <Eye className="h-3.5 w-3.5" aria-hidden="true" />
                      {!canCreate && tx.status === 'pending' ? 'Tinjau Penerimaan' : 'Lihat Detail'}
                    </Link>
                  </TableCell>
                </TableRow>
              ))}
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
          icon={ArrowDownToLine}
          title={
            hasActiveFilters
              ? 'Tidak Ada Pemeriksaan Sesuai Filter'
              : 'Belum Ada Pemeriksaan Barang Masuk'
          }
          description={
            hasActiveFilters
              ? 'Ubah filter status atau kata kunci pencarian untuk melihat data lainnya.'
              : 'Laporan pemeriksaan fisik akan muncul setelah Staff mencatat penerimaan barang dari Purchase Order.'
          }
          action={
            hasActiveFilters ? (
              <Button variant="secondary" onClick={resetFilters}>
                Reset Filter
              </Button>
            ) : (
              canCreate &&
              eligiblePos.length > 0 && (
                <Button variant="primary" onClick={() => setShowCreateModal(true)}>
                  <Plus className="h-4 w-4" aria-hidden="true" />
                  Catat Pemeriksaan Masuk
                </Button>
              )
            )
          }
        />
      )}

      {/* Create Incoming Inspection Report Modal (Staff only) */}
      {canCreate && (
        <Modal
          open={showCreateModal}
          onClose={() => setShowCreateModal(false)}
          title="Catat Pemeriksaan Barang Masuk"
          description="Masukkan jumlah aktual hasil pemeriksaan fisik berdasarkan Purchase Order yang siap diperiksa."
          maxWidthClass="max-w-4xl"
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

            {eligiblePos.length === 0 ? (
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 space-y-2">
                <p className="font-semibold">
                  Belum ada Purchase Order yang siap diperiksa secara fisik
                </p>
                <p className="text-xs leading-relaxed">
                  Laporan Incoming dibuat untuk Purchase Order berstatus{' '}
                  <strong>Inspecting</strong> (atau <strong>Returned</strong> yang siap
                  diperiksa ulang) yang belum memiliki Incoming berstatus Pending atau
                  Approved.
                </p>
                <Link
                  href="/purchase-orders"
                  className="inline-flex items-center text-xs font-semibold text-[#3243DD] hover:underline"
                >
                  Periksa daftar Purchase Orders
                </Link>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 items-end">
                  <div className="sm:col-span-2">
                    <Select
                      label="Purchase Order Referensi"
                      value={selectedPoId}
                      onChange={(e) => handleSelectPo(e.target.value)}
                      required
                      placeholder="Pilih Purchase Order (Inspecting)..."
                      options={eligiblePos.map((po) => ({
                        value: String(po.id),
                        label: `${po.po_code} — ${po.supplier_name}`,
                      }))}
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="inc-receiving-date"
                      className="block text-xs sm:text-sm font-medium text-slate-700 mb-1.5"
                    >
                      Tanggal Penerimaan <span className="text-[#FF3D8B]">*</span>
                    </label>
                    <input
                      id="inc-receiving-date"
                      type="date"
                      required
                      value={receivingDate}
                      onChange={(e) => setReceivingDate(e.target.value)}
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-[#3243DD] focus:outline-none focus:ring-2 focus:ring-[#3243DD]/20"
                    />
                  </div>
                </div>

                {selectedPo && (
                  <div className="rounded-lg border border-slate-200 bg-[#F4F5F8] px-3.5 py-2.5 space-y-1.5 text-xs">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <span className="text-slate-500">Supplier: </span>
                        <strong className="text-slate-900">{selectedPo.supplier_name}</strong>
                        {selectedPo.courier_name && (
                          <span className="ml-2 text-slate-600">
                            • Kurir: {selectedPo.courier_name}
                            {selectedPo.tracking_number ? ` (${selectedPo.tracking_number})` : ''}
                          </span>
                        )}
                      </div>
                      <span className="text-slate-600">
                        Tanggal PO: {formatDate(selectedPo.order_date)}
                      </span>
                    </div>
                    {selectedPo.arrival_notes && (
                      <p className="text-slate-700">
                        <span className="font-semibold">Info Kedatangan Supplier:</span>{' '}
                        {selectedPo.arrival_notes}
                      </p>
                    )}
                    {selectedPo.inspection_request_notes && (
                      <p className="text-[#3243DD]">
                        <span className="font-semibold">Arahan Manager:</span>{' '}
                        {selectedPo.inspection_request_notes}
                      </p>
                    )}
                  </div>
                )}

                {itemEntries.length > 0 && (
                  <div className="space-y-2.5">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-xs sm:text-sm font-semibold text-slate-800">
                        Hasil Pemeriksaan Fisik ({includedEntries.length} dari {itemEntries.length}{' '}
                        SKU dipilih)
                      </p>
                      {hasAnyDiff && (
                        <Badge tone="warning" icon={AlertTriangle}>
                          Ada ketidaksesuaian / barang bermasalah
                        </Badge>
                      )}
                    </div>

                    <div className="space-y-2.5 max-h-80 overflow-y-auto pr-1">
                      {itemEntries.map((entry, idx) => {
                        const actualNum = Number(entry.quantity);
                        const goodNum = Number(entry.goodQuantity);
                        const damagedNum = Number(entry.damagedQuantity);
                        const expectedRef =
                          entry.remainingQty > 0 ? entry.remainingQty : entry.orderedQty;
                        const diff = Number.isFinite(actualNum) ? actualNum - expectedRef : 0;
                        const sumMismatch =
                          entry.included &&
                          Number.isFinite(actualNum) &&
                          Number.isFinite(goodNum) &&
                          Number.isFinite(damagedNum) &&
                          goodNum + damagedNum !== actualNum;

                        return (
                          <div
                            key={entry.productId}
                            className={`rounded-xl border p-3 space-y-2.5 ${
                              !entry.included
                                ? 'border-slate-200 bg-slate-50/70 opacity-65'
                                : sumMismatch
                                ? 'border-red-300 bg-red-50/40'
                                : diff !== 0 || damagedNum > 0
                                ? 'border-amber-300 bg-amber-50/40'
                                : 'border-slate-200 bg-[#F4F5F8]'
                            }`}
                          >
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <label className="inline-flex items-center gap-2 cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={entry.included}
                                  onChange={(e) => {
                                    const checked = e.target.checked;
                                    setItemEntries((prev) =>
                                      prev.map((it, i) =>
                                        i === idx ? { ...it, included: checked } : it
                                      )
                                    );
                                  }}
                                  className="h-4 w-4 rounded border-slate-300 text-[#3243DD] focus:ring-[#3243DD]"
                                />
                                <span className="font-mono text-xs font-semibold text-[#3243DD]">
                                  {entry.sku}
                                </span>
                                <span className="text-sm font-semibold text-slate-900">
                                  {entry.name}
                                </span>
                                {entry.rackLocation && (
                                  <span className="rounded bg-white px-1.5 py-0.5 text-[11px] font-medium text-slate-600 border border-slate-200">
                                    Rak: {entry.rackLocation}
                                  </span>
                                )}
                              </label>
                              <div className="text-xs text-slate-600 tabular-nums flex flex-wrap gap-2">
                                <span>
                                  Dipesan: <strong>{entry.orderedQty}</strong>
                                </span>
                                {entry.previouslyApprovedQty > 0 && (
                                  <span className="text-emerald-700">
                                    • Disetujui sblmnya: <strong>{entry.previouslyApprovedQty}</strong>
                                  </span>
                                )}
                                <span className="text-amber-800">
                                  • Sisa: <strong>{entry.remainingQty}</strong> {entry.unit || 'unit'}
                                </span>
                              </div>
                            </div>

                            {entry.included && (
                              <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-start">
                                <div className="sm:col-span-2">
                                  <label className="block text-[11px] font-medium text-slate-600 mb-1">
                                    Diterima Fisik <span className="text-[#FF3D8B]">*</span>
                                  </label>
                                  <input
                                    type="number"
                                    min="1"
                                    step="1"
                                    required
                                    value={entry.quantity}
                                    onChange={(e) => {
                                      const val = e.target.value;
                                      setItemEntries((prev) =>
                                        prev.map((it, i) => {
                                          if (i !== idx) return it;
                                          const qNum = Number(val);
                                          const prevDamaged = Math.min(
                                            Number(it.damagedQuantity) || 0,
                                            Math.max(0, qNum || 0)
                                          );
                                          const nextGood =
                                            Number.isInteger(qNum) && qNum >= 0
                                              ? Math.max(0, qNum - prevDamaged)
                                              : 0;
                                          const ref = it.remainingQty > 0 ? it.remainingQty : it.orderedQty;
                                          let nextCond = it.conditionStatus;
                                          if (prevDamaged > 0 && nextGood > 0) nextCond = 'mixed';
                                          else if (prevDamaged > 0 && nextGood === 0) nextCond = 'damaged';
                                          else if (qNum > 0 && qNum < ref) nextCond = 'partial';
                                          else if (qNum > ref) nextCond = 'excess';
                                          else nextCond = 'good';
                                          return {
                                            ...it,
                                            quantity: val,
                                            goodQuantity: String(nextGood),
                                            damagedQuantity: String(prevDamaged),
                                            conditionStatus: nextCond,
                                          };
                                        })
                                      );
                                    }}
                                    className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-sm tabular-nums focus:border-[#3243DD] focus:outline-none"
                                  />
                                </div>

                                <div className="sm:col-span-2">
                                  <label className="block text-[11px] font-medium text-emerald-700 mb-1">
                                    Jumlah Baik <span className="text-[#FF3D8B]">*</span>
                                  </label>
                                  <input
                                    type="number"
                                    min="0"
                                    max={actualNum > 0 ? actualNum : undefined}
                                    step="1"
                                    required
                                    value={entry.goodQuantity}
                                    onChange={(e) => {
                                      const val = e.target.value;
                                      setItemEntries((prev) =>
                                        prev.map((it, i) => {
                                          if (i !== idx) return it;
                                          const qNum = Number(it.quantity) || 0;
                                          const gNum = Number(val);
                                          const nextDamaged =
                                            Number.isInteger(gNum) && gNum >= 0 && gNum <= qNum
                                              ? qNum - gNum
                                              : it.damagedQuantity;
                                          const dNum = Number(nextDamaged) || 0;
                                          let nextCond = it.conditionStatus;
                                          if (dNum > 0 && gNum > 0) nextCond = 'mixed';
                                          else if (dNum > 0 && gNum === 0) nextCond = 'damaged';
                                          return {
                                            ...it,
                                            goodQuantity: val,
                                            damagedQuantity: String(nextDamaged),
                                            conditionStatus: nextCond,
                                          };
                                        })
                                      );
                                    }}
                                    className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-sm tabular-nums focus:border-[#3243DD] focus:outline-none"
                                  />
                                </div>

                                <div className="sm:col-span-2">
                                  <label className="block text-[11px] font-medium text-red-700 mb-1">
                                    Rusak / Masalah
                                  </label>
                                  <input
                                    type="number"
                                    min="0"
                                    max={actualNum > 0 ? actualNum : undefined}
                                    step="1"
                                    required
                                    value={entry.damagedQuantity}
                                    onChange={(e) => {
                                      const val = e.target.value;
                                      setItemEntries((prev) =>
                                        prev.map((it, i) => {
                                          if (i !== idx) return it;
                                          const qNum = Number(it.quantity) || 0;
                                          const dNum = Number(val);
                                          const nextGood =
                                            Number.isInteger(dNum) && dNum >= 0 && dNum <= qNum
                                              ? qNum - dNum
                                              : it.goodQuantity;
                                          const gNum = Number(nextGood) || 0;
                                          let nextCond = it.conditionStatus;
                                          if (dNum > 0 && gNum > 0) nextCond = 'mixed';
                                          else if (dNum > 0 && gNum === 0) nextCond = 'damaged';
                                          return {
                                            ...it,
                                            damagedQuantity: val,
                                            goodQuantity: String(nextGood),
                                            conditionStatus: nextCond,
                                          };
                                        })
                                      );
                                    }}
                                    className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-sm tabular-nums focus:border-[#3243DD] focus:outline-none"
                                  />
                                </div>

                                <div className="sm:col-span-3">
                                  <label className="block text-[11px] font-medium text-slate-600 mb-1">
                                    Kondisi Barang
                                  </label>
                                  <select
                                    value={entry.conditionStatus}
                                    onChange={(e) => {
                                      const val = e.target.value;
                                      setItemEntries((prev) =>
                                        prev.map((it, i) =>
                                          i === idx ? { ...it, conditionStatus: val } : it
                                        )
                                      );
                                    }}
                                    className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-sm focus:border-[#3243DD] focus:outline-none"
                                  >
                                    <option value="good">Baik</option>
                                    <option value="partial">Sebagian / Kurang</option>
                                    <option value="mixed">Sebagian Baik &amp; Bermasalah</option>
                                    <option value="damaged">Rusak</option>
                                    <option value="wrong_item">Barang Salah</option>
                                    <option value="excess">Melebihi Pesanan</option>
                                  </select>
                                </div>

                                <div className="sm:col-span-3">
                                  <label className="block text-[11px] font-medium text-slate-600 mb-1">
                                    Catatan Pemeriksaan
                                  </label>
                                  <input
                                    type="text"
                                    value={entry.notes}
                                    onChange={(e) => {
                                      const val = e.target.value;
                                      setItemEntries((prev) =>
                                        prev.map((it, i) =>
                                          i === idx ? { ...it, notes: val } : it
                                        )
                                      );
                                    }}
                                    placeholder="Contoh: 10 unit rusak kemasan"
                                    className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-sm focus:border-[#3243DD] focus:outline-none"
                                  />
                                </div>
                              </div>
                            )}

                            {sumMismatch && (
                              <p className="text-xs font-medium text-red-700">
                                Jumlah Baik ({entry.goodQuantity}) + Rusak/Bermasalah (
                                {entry.damagedQuantity}) harus sama dengan Diterima Fisik (
                                {entry.quantity}).
                              </p>
                            )}
                          </div>
                        );
                      })}
                    </div>

                    {/* Review Summary Strip */}
                    <div className="rounded-lg border border-slate-200 bg-slate-50 px-3.5 py-2.5 flex flex-wrap items-center justify-between gap-2 text-xs">
                      <span className="text-slate-700 tabular-nums">
                        Total fisik: <strong>{totalReceived}</strong> • Baik:{' '}
                        <strong className="text-emerald-700">{totalGood}</strong> •
                        Bermasalah:{' '}
                        <strong className="text-red-700">{totalDamaged}</strong> unit
                      </span>
                      <span className="inline-flex items-center gap-1 text-slate-500">
                        <Info className="h-3.5 w-3.5 text-[#3243DD]" aria-hidden="true" />
                        Stok hanya berubah setelah disetujui Manager
                      </span>
                    </div>
                  </div>
                )}

                <div>
                  <label className="block text-xs sm:text-sm font-medium text-slate-700 mb-1">
                    Catatan Pemeriksaan Umum (Opsional)
                  </label>
                  <textarea
                    rows={2}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Ringkasan pemeriksaan barang masuk, nomor surat jalan, atau catatan kondisi kemasan..."
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-[#3243DD] focus:outline-none focus:ring-2 focus:ring-[#3243DD]/20"
                  />
                  <p className="mt-1 text-[11px] text-slate-500">
                    Setelah laporan dikirim, Anda dapat melampirkan foto bukti pemeriksaan
                    pada halaman detail Incoming.
                  </p>
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
              {eligiblePos.length > 0 && (
                <Button
                  type="submit"
                  variant="primary"
                  loading={isPending}
                  disabled={!selectedPoId || hasInvalidQty}
                >
                  Kirim Pemeriksaan
                </Button>
              )}
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
