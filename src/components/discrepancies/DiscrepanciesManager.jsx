'use client';

import { useActionState, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Plus, Search, AlertTriangle, Eye, X, Info } from 'lucide-react';
import { createDiscrepancyAction } from '../../modules/discrepancies/discrepancyActions.js';
import { formatDateTime } from '../../lib/utils/format.js';
import {
  getDiscrepancyIssueMeta,
  getDiscrepancySourceHref,
  getDiscrepancySourceLabel,
} from '../../lib/utils/labels.js';
import PageHeader from '../shared/PageHeader.jsx';
import SearchableProductSelect from '../shared/SearchableProductSelect.jsx';
import StatusPill from '../shared/StatusPill.jsx';
import FeedbackBanner from '../shared/FeedbackBanner.jsx';
import Button from '../ui/Button.jsx';
import Input from '../ui/Input.jsx';
import Select from '../ui/Select.jsx';
import Modal from '../ui/Modal.jsx';
import { useToast } from '../ui/ToastProvider.jsx';
import Badge from '../ui/Badge.jsx';
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

const emptyActionState = { ok: false, error: null, message: '', fieldErrors: null };

const STATUS_TABS = [
  { value: '', label: 'Semua' },
  { value: 'open', label: 'Terbuka' },
  { value: 'investigating', label: 'Investigasi' },
  { value: 'resolved', label: 'Selesai' },
  { value: 'closed', label: 'Ditutup' },
];

const INITIAL_FORM = {
  issueType: 'shortage',
  sourceType: 'incoming',
  sourceId: '',
  productId: '',
  expectedQuantity: '',
  actualQuantity: '',
  description: '',
};

export default function DiscrepanciesManager({
  overview,
  canReport = false,
  initialFilters,
  embedded = false,
  basePath = '/discrepancies',
}) {
  const router = useRouter();
  const toast = useToast();
  const [search, setSearch] = useState(initialFilters.search || '');
  const [status, setStatus] = useState(initialFilters.status || '');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [formValues, setFormValues] = useState(INITIAL_FORM);
  const [productSelectError, setProductSelectError] = useState('');
  const [feedback, setFeedback] = useState(null);

  const [createState, createAction, isPending] = useActionState(
    async (prev, fd) => {
      const res = await createDiscrepancyAction(prev, fd);
      if (res.ok) {
        setShowCreateModal(false);
        setFormValues(INITIAL_FORM);
        setFeedback({ type: 'success', text: res.message });
      } else if (res?.error) {
        toast.error(res.error);
      }
      return res;
    },
    emptyActionState
  );

  const hasActiveFilters = Boolean(initialFilters.search || initialFilters.status);

  function pushFilters(overrides = {}) {
    const next = { search, status, page: 1, ...overrides };
    const params = new URLSearchParams();
    if (embedded) params.set('tab', 'discrepancies');
    if (next.search?.trim()) params.set('search', next.search.trim());
    if (next.status) params.set('status', next.status);
    if (next.page && next.page > 1) params.set('page', String(next.page));
    router.push(`${basePath}${params.toString() ? `?${params.toString()}` : ''}`);
  }

  function resetFilters() {
    setSearch('');
    setStatus('');
    router.push(embedded ? `${basePath}?tab=discrepancies` : basePath);
  }

  const incomingTx = (overview.recentTransactions || []).filter(
    (t) => t.type === 'incoming'
  );
  const outgoingTx = (overview.recentTransactions || []).filter(
    (t) => t.type === 'outgoing'
  );

  const hasBothQty =
    formValues.expectedQuantity !== '' && formValues.actualQuantity !== '';
  const liveDiff = hasBothQty
    ? Number(formValues.actualQuantity) - Number(formValues.expectedQuantity)
    : null;

  return (
    <div className="space-y-5">
      {!embedded ? (
        <PageHeader
          title="Selisih Stok"
          description={
            canReport
              ? 'Catat ketidaksesuaian jumlah, kondisi barang rusak, atau kendala pengiriman untuk ditindaklanjuti Manager.'
              : 'Tinjau laporan ketidaksesuaian barang, catat hasil investigasi, dan tentukan tindak lanjut penyelesaian.'
          }
          actions={
            canReport ? (
              <Button variant="primary" onClick={() => setShowCreateModal(true)}>
                <Plus className="h-4 w-4" aria-hidden="true" />
                Laporkan Selisih Stok
              </Button>
            ) : null
          }
        />
      ) : (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <p className="text-xs sm:text-sm text-slate-600">
            {canReport
              ? 'Catat ketidaksesuaian jumlah, kondisi barang rusak, atau kendala pengiriman untuk ditindaklanjuti Manager.'
              : 'Tinjau laporan ketidaksesuaian barang, catat hasil investigasi, dan tentukan tindak lanjut penyelesaian.'}
          </p>
          {canReport && (
            <Button
              variant="primary"
              onClick={() => setShowCreateModal(true)}
              className="shrink-0 self-start sm:self-auto"
            >
              <Plus className="h-4 w-4" aria-hidden="true" />
              Laporkan Selisih Stok
            </Button>
          )}
        </div>
      )}

      <FeedbackBanner feedback={feedback} onDismiss={() => setFeedback(null)} />

      {/* Status Tabs + Search */}
      <Card variant="neutral">
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
                placeholder="DSC-..., SKU, atau kode transaksi..."
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
                <TableHead>Kode Issue</TableHead>
                <TableHead>Jenis &amp; Sumber</TableHead>
                <TableHead>Produk</TableHead>
                <TableHead>Selisih</TableHead>
                <TableHead>Pelapor</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {overview.items.map((row) => {
                const issueMeta = getDiscrepancyIssueMeta(row.issue_type);
                const sourceHref = getDiscrepancySourceHref(row);
                const sourceRef =
                  row.transaction_code ||
                  row.po_code ||
                  getDiscrepancySourceLabel(row.source_type);
                const refundStatus = row.refund_status || 'none';
                const refundLabel =
                  refundStatus === 'submitted'
                    ? 'Refund: Diajukan'
                    : refundStatus === 'approved'
                    ? 'Refund: Disetujui'
                    : refundStatus === 'rejected'
                    ? 'Refund: Ditolak'
                    : refundStatus === 'completed'
                    ? 'Refund: Selesai'
                    : null;

                return (
                  <TableRow key={row.id}>
                    <TableCell className="font-mono text-xs font-semibold text-[#3243DD] whitespace-nowrap">
                      <Link
                        href={`/discrepancies/${row.id}`}
                        className="hover:underline"
                      >
                        {row.issue_code}
                      </Link>
                    </TableCell>
                    <TableCell className="text-xs">
                      <Badge tone={issueMeta.tone}>{issueMeta.label}</Badge>
                      <p className="mt-1 text-slate-500">
                        {sourceHref ? (
                          <Link
                            href={sourceHref}
                            className="font-mono text-[#3243DD] hover:underline"
                          >
                            {sourceRef}
                          </Link>
                        ) : (
                          <span>{sourceRef}</span>
                        )}
                      </p>
                      {(row.po_code || row.supplier_name || row.follow_up_po_code) && (
                        <p className="mt-1 text-[11px] text-slate-500 space-x-1.5">
                          {row.po_code && row.resolved_purchase_order_id && (
                            <Link
                              href={`/purchase-orders/${row.resolved_purchase_order_id}`}
                              className="font-mono text-slate-700 hover:text-[#3243DD] hover:underline"
                            >
                              {row.po_code}
                            </Link>
                          )}
                          {row.supplier_name && <span>• {row.supplier_name}</span>}
                          {row.follow_up_po_id && row.follow_up_po_code && (
                            <Link
                              href={`/purchase-orders/${row.follow_up_po_id}`}
                              className="inline-block rounded bg-[#EEF1FD] px-1.5 py-0.5 font-mono text-[10px] font-semibold text-[#3243DD] hover:underline"
                            >
                              PO Baru: {row.follow_up_po_code}
                            </Link>
                          )}
                        </p>
                      )}
                    </TableCell>
                    <TableCell>
                      <Link
                        href={`/products/${row.product_id}`}
                        className="font-semibold text-slate-900 hover:text-[#3243DD]"
                      >
                        {row.product_name}
                      </Link>
                      <p className="font-mono text-xs text-slate-500">
                        {row.sku}
                        {row.rack_location ? (
                          <span className="ml-1.5 font-sans text-[11px]">
                            • Rak: {row.rack_location}
                          </span>
                        ) : null}
                      </p>
                    </TableCell>
                    <TableCell className="text-xs tabular-nums whitespace-nowrap">
                      {row.difference !== null ? (
                        <span
                          className={`font-bold ${
                            row.difference < 0
                              ? 'text-red-700'
                              : row.difference > 0
                              ? 'text-amber-700'
                              : 'text-slate-700'
                          }`}
                        >
                          {row.difference > 0 ? `+${row.difference}` : row.difference}{' '}
                          <span className="font-normal text-slate-500">
                            {row.unit || ''}
                          </span>
                        </span>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-xs">
                      <p className="text-slate-800">{row.reported_by_name}</p>
                      <p className="text-[11px] text-slate-500 tabular-nums">
                        {formatDateTime(row.reported_at)}
                      </p>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col items-start gap-1">
                        <StatusPill status={row.status} />
                        {refundLabel && (
                          <StatusPill status={refundStatus} labelOverride={refundLabel} />
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-right whitespace-nowrap">
                      <Link
                        href={`/discrepancies/${row.id}`}
                        className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:border-[#3243DD] hover:text-[#3243DD] transition-colors"
                      >
                        <Eye className="h-3.5 w-3.5" aria-hidden="true" />
                        {!canReport && ['open', 'investigating'].includes(row.status)
                          ? 'Tinjau'
                          : 'Lihat Detail'}
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
          icon={AlertTriangle}
          title={
            hasActiveFilters
              ? 'Tidak Ada Laporan Selisih Stok yang Cocok'
              : 'Belum Ada Laporan Selisih Stok'
          }
          description={
            hasActiveFilters
              ? 'Ubah pilihan status atau kata kunci pencarian untuk melihat laporan lainnya.'
              : 'Apabila ditemukan selisih jumlah, barang rusak, atau masalah pengiriman, catat laporan di sini untuk ditindaklanjuti.'
          }
          action={
            hasActiveFilters ? (
              <Button variant="secondary" onClick={resetFilters}>
                Reset Pencarian
              </Button>
            ) : canReport ? (
              <Button variant="primary" onClick={() => setShowCreateModal(true)}>
                <Plus className="h-4 w-4" aria-hidden="true" />
                Laporkan Selisih Stok
              </Button>
            ) : null
          }
        />
      )}

      {/* Create Discrepancy Modal (Staff only) */}
      {canReport && (
      <Modal
        open={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        title="Laporkan Ketidaksesuaian (Discrepancy)"
        description="Catat detail temuan ketidaksesuaian barang agar dapat diinvestigasi oleh Warehouse Manager."
        maxWidthClass="max-w-2xl"
      >
        <form
          action={createAction}
          onSubmit={(e) => {
            if (!formValues.productId) {
              e.preventDefault();
              setProductSelectError('Pilih produk terkait terlebih dahulu.');
              document.getElementById('discrepancy-product-select')?.focus();
              return;
            }
            setProductSelectError('');
          }}
          className="space-y-4"
        >
          <div className="flex items-start gap-2 rounded-lg border border-[#3243DD]/20 bg-[#EEF1FD]/70 px-3.5 py-2.5 text-xs text-slate-700">
            <Info className="h-4 w-4 mt-0.5 text-[#3243DD] shrink-0" aria-hidden="true" />
            <span>
              Laporan Discrepancy <strong>tidak mengubah stok secara otomatis</strong>.
              Jika stok perlu dikoreksi, gunakan alur Stock Adjustment resmi.
            </span>
          </div>

          {createState.error && (
            <div
              role="alert"
              className="rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-700"
            >
              {createState.error}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <Select
              name="issueType"
              label="Jenis Masalah"
              required
              value={formValues.issueType}
              onChange={(e) =>
                setFormValues((prev) => ({ ...prev, issueType: e.target.value }))
              }
              options={[
                { value: 'shortage', label: 'Kekurangan Jumlah (Shortage)' },
                { value: 'excess', label: 'Kelebihan Jumlah (Excess)' },
                { value: 'damaged', label: 'Barang Rusak (Damaged)' },
                { value: 'wrong_item', label: 'Produk Salah (Wrong Item)' },
                { value: 'lost', label: 'Hilang (Lost)' },
                { value: 'not_received', label: 'Tidak Diterima (Not Received)' },
                { value: 'other', label: 'Lainnya' },
              ]}
            />

            <Select
              name="sourceType"
              label="Sumber Laporan"
              required
              value={formValues.sourceType}
              onChange={(e) =>
                setFormValues((prev) => ({
                  ...prev,
                  sourceType: e.target.value,
                  sourceId: '',
                }))
              }
              options={[
                { value: 'incoming', label: 'Transaksi Incoming' },
                { value: 'outgoing', label: 'Transaksi Outgoing' },
                { value: 'purchase_order', label: 'Purchase Order' },
                { value: 'stock_count', label: 'Stock Opname / Gudang' },
              ]}
            />
          </div>

          {formValues.sourceType !== 'stock_count' && (
            <Select
              name="sourceId"
              label="Referensi Transaksi / PO"
              required
              value={formValues.sourceId}
              onChange={(e) =>
                setFormValues((prev) => ({ ...prev, sourceId: e.target.value }))
              }
              placeholder="Pilih referensi..."
              options={
                formValues.sourceType === 'incoming'
                  ? incomingTx.map((t) => ({
                      value: String(t.id),
                      label: `${t.transaction_code} (${t.status})`,
                    }))
                  : formValues.sourceType === 'outgoing'
                  ? outgoingTx.map((t) => ({
                      value: String(t.id),
                      label: `${t.transaction_code} (${t.status})`,
                    }))
                  : (overview.recentPos || []).map((p) => ({
                      value: String(p.id),
                      label: `${p.po_code} (${p.status})`,
                    }))
              }
              error={createState.fieldErrors?.sourceId}
            />
          )}

          <SearchableProductSelect
            id="discrepancy-product-select"
            name="productId"
            label="Produk Terkait"
            required
            value={formValues.productId}
            onChange={(val) => {
              setProductSelectError('');
              setFormValues((prev) => ({ ...prev, productId: val }));
            }}
            placeholder="Cari nama atau SKU produk..."
            products={overview.products || []}
            getOptionMeta={(p) =>
              `${p.sku} • Stok: ${p.stock} ${p.unit || 'unit'}${p.rack_location ? ` • Rak: ${p.rack_location}` : ''}`
            }
            error={productSelectError || createState.fieldErrors?.productId}
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <Input
              name="expectedQuantity"
              type="number"
              min="0"
              step="1"
              label="Jumlah Diharapkan (Opsional)"
              placeholder="Contoh: 50"
              value={formValues.expectedQuantity}
              onChange={(e) =>
                setFormValues((prev) => ({ ...prev, expectedQuantity: e.target.value }))
              }
            />
            <Input
              name="actualQuantity"
              type="number"
              min="0"
              step="1"
              label="Jumlah Aktual (Opsional)"
              placeholder="Contoh: 45"
              value={formValues.actualQuantity}
              onChange={(e) =>
                setFormValues((prev) => ({ ...prev, actualQuantity: e.target.value }))
              }
            />
          </div>

          {liveDiff !== null && Number.isFinite(liveDiff) && (
            <div className="rounded-lg bg-[#F4F5F8] border border-slate-200 px-3.5 py-2 text-xs flex items-center justify-between">
              <span className="text-slate-600">Selisih Terhitung (Aktual − Diharapkan):</span>
              <strong
                className={`tabular-nums ${
                  liveDiff < 0
                    ? 'text-red-700'
                    : liveDiff > 0
                    ? 'text-amber-700'
                    : 'text-emerald-700'
                }`}
              >
                {liveDiff > 0 ? `+${liveDiff}` : liveDiff} unit
              </strong>
            </div>
          )}

          <div>
            <label
              htmlFor="disc-desc"
              className="block text-xs sm:text-sm font-medium text-slate-700 mb-1"
            >
              Deskripsi Kronologi &amp; Temuan <span className="text-[#FF3D8B]">*</span>
            </label>
            <textarea
              id="disc-desc"
              name="description"
              rows={3}
              required
              value={formValues.description}
              onChange={(e) =>
                setFormValues((prev) => ({ ...prev, description: e.target.value }))
              }
              placeholder="Jelaskan kondisi barang, kronologi temuan, atau selisih yang ditemukan..."
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-[#3243DD] focus:outline-none focus:ring-2 focus:ring-[#3243DD]/20"
            />
            {createState.fieldErrors?.description && (
              <p className="mt-1 text-xs font-medium text-red-600">
                {createState.fieldErrors.description}
              </p>
            )}
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <Button
              variant="secondary"
              onClick={() => setShowCreateModal(false)}
              disabled={isPending}
            >
              Batal
            </Button>
            <Button type="submit" variant="primary" loading={isPending}>
              Kirim Laporan
            </Button>
          </div>
        </form>
      </Modal>
      )}
    </div>
  );
}
