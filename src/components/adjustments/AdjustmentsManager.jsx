'use client';

import { useActionState, useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Plus,
  Search,
  SlidersHorizontal,
  CheckCircle2,
  XCircle,
  X,
  AlertTriangle,
  ExternalLink,
} from 'lucide-react';
import {
  createAdjustmentAction,
  approveAdjustmentAction,
  rejectAdjustmentAction,
} from '../../modules/adjustments/adjustmentActions.js';
import { formatDateTime } from '../../lib/utils/format.js';
import {
  getAdjustmentTypeMeta,
  getStockStatusMeta,
} from '../../lib/utils/labels.js';
import PageHeader from '../shared/PageHeader.jsx';
import StatusPill from '../shared/StatusPill.jsx';
import FeedbackBanner from '../shared/FeedbackBanner.jsx';
import Button from '../ui/Button.jsx';
import Input from '../ui/Input.jsx';
import Select from '../ui/Select.jsx';
import Modal from '../ui/Modal.jsx';
import Dialog from '../ui/Dialog.jsx';
import { useToast } from '../ui/ToastProvider.jsx';
import Badge from '../ui/Badge.jsx';
import SearchableProductSelect from '../shared/SearchableProductSelect.jsx';
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
  { value: 'pending', label: 'Menunggu' },
  { value: 'approved', label: 'Disetujui' },
  { value: 'rejected', label: 'Ditolak' },
];

const INITIAL_FORM = {
  productId: '',
  discrepancyId: '',
  adjustmentType: 'correction',
  direction: 'decrease',
  quantityDelta: '1',
  reason: '',
};

export default function AdjustmentsManager({
  overview,
  currentUserId,
  canRequest = false,
  canApprove = false,
  initialFilters,
  embedded = false,
  basePath = '/stock-adjustments',
}) {
  const router = useRouter();
  const toast = useToast();
  const [search, setSearch] = useState(initialFilters.search || '');
  const [status, setStatus] = useState(initialFilters.status || '');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [formValues, setFormValues] = useState(INITIAL_FORM);
  const [productSelectError, setProductSelectError] = useState('');
  const [dialogAction, setDialogAction] = useState(null);
  const [dialogError, setDialogError] = useState(null);
  const [rejectTarget, setRejectTarget] = useState(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [rejectError, setRejectError] = useState(null);
  const [feedback, setFeedback] = useState(null);
  const [isMutating, startTransition] = useTransition();

  const [createState, createAction, isCreating] = useActionState(
    async (prev, fd) => {
      const res = await createAdjustmentAction(prev, fd);
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
    if (embedded) params.set('tab', 'adjustments');
    if (next.search?.trim()) params.set('search', next.search.trim());
    if (next.status) params.set('status', next.status);
    if (next.page && next.page > 1) params.set('page', String(next.page));
    router.push(`${basePath}${params.toString() ? `?${params.toString()}` : ''}`);
  }

  function resetFilters() {
    setSearch('');
    setStatus('');
    router.push(embedded ? `${basePath}?tab=adjustments` : basePath);
  }

  function handleConfirm() {
    if (!dialogAction) return;
    setDialogError(null);
    startTransition(async () => {
      const res = await approveAdjustmentAction(dialogAction.item.id);
      if (res.ok) {
        setDialogAction(null);
        setDialogError(null);
        setFeedback({ type: 'success', text: res.message });
        router.refresh();
        const alerts = res.data?.lowStockAlerts || [];
        if (alerts.length > 0) {
          const item = alerts[0];
          const statusLabel = getStockStatusMeta(item.stockStatusAfter).label;
          toast.warning(
            `Peringatan Status Stok (${statusLabel}): ${item.name} kini tersisa ${item.stockAfter} ${item.unit || 'unit'}.`,
            { title: `Status Stok ${statusLabel}` }
          );
        }
      } else {
        const msg = res.error || 'Gagal menyetujui penyesuaian stok.';
        setDialogError(msg);
        setFeedback({ type: 'error', text: msg });
        toast.error(msg);
      }
    });
  }

  function handleRejectSubmit(e) {
    e.preventDefault();
    if (!rejectTarget) return;
    setRejectError(null);
    startTransition(async () => {
      const res = await rejectAdjustmentAction(rejectTarget.id, { rejectionReason });
      if (res.ok) {
        setRejectTarget(null);
        setRejectionReason('');
        setRejectError(null);
        setFeedback({ type: 'success', text: res.message });
        toast.success(res.message);
        router.refresh();
      } else {
        const msg = res.error || 'Gagal menolak penyesuaian stok.';
        setRejectError(msg);
        toast.error(msg);
      }
    });
  }

  // Live stock impact preview for Create Adjustment modal
  const selectedProd = (overview.products || []).find(
    (p) => String(p.id) === String(formValues.productId)
  );
  const qtyNum = Number(formValues.quantityDelta);
  const signedDelta =
    Number.isFinite(qtyNum) && qtyNum > 0
      ? formValues.direction === 'increase'
        ? qtyNum
        : -qtyNum
      : 0;
  const projectedStock = selectedProd
    ? Number(selectedProd.stock) + signedDelta
    : null;
  const wouldGoNegative = projectedStock !== null && projectedStock < 0;

  // Dialog item projected stock
  const dialogItem = dialogAction?.item || null;
  const dialogProjected =
    dialogItem && dialogAction?.mode === 'approve'
      ? Number(dialogItem.current_stock) + Number(dialogItem.quantity_delta)
      : null;

  return (
    <div className="space-y-5">
      {!embedded ? (
        <PageHeader
          title="Penyesuaian Stok"
          description={
            canApprove
              ? 'Tinjau dan setujui atau tolak pengajuan penyesuaian stok dari Warehouse Staff. Setiap persetujuan tercatat pada Pergerakan Stok.'
              : 'Ajukan penyesuaian stok resmi dari hasil stock opname atau selisih stok untuk ditinjau dan disetujui Warehouse Manager.'
          }
          actions={
            canRequest ? (
              <Button variant="primary" onClick={() => setShowCreateModal(true)}>
                <Plus className="h-4 w-4" aria-hidden="true" />
                Ajukan Penyesuaian
              </Button>
            ) : null
          }
        />
      ) : (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <p className="text-xs sm:text-sm text-slate-600">
            {canApprove
              ? 'Tinjau dan setujui atau tolak pengajuan penyesuaian stok dari Warehouse Staff. Setiap persetujuan tercatat pada Pergerakan Stok.'
              : 'Ajukan penyesuaian stok resmi dari hasil stock opname atau selisih stok untuk ditinjau dan disetujui Warehouse Manager.'}
          </p>
          {canRequest && (
            <Button
              variant="primary"
              onClick={() => setShowCreateModal(true)}
              className="shrink-0 self-start sm:self-auto"
            >
              <Plus className="h-4 w-4" aria-hidden="true" />
              Ajukan Penyesuaian
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
                placeholder="ADJ-..., SKU, atau alasan..."
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
                <TableHead>Kode</TableHead>
                <TableHead>Produk</TableHead>
                <TableHead>Jenis</TableHead>
                <TableHead>Perubahan</TableHead>
                <TableHead>Dampak Stok</TableHead>
                <TableHead>Alasan &amp; Pengaju</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {overview.items.map((adj) => {
                const isSelf = Number(adj.requested_by) === Number(currentUserId);
                const typeMeta = getAdjustmentTypeMeta(adj.adjustment_type);
                const estAfter =
                  Number(adj.current_stock) + Number(adj.quantity_delta);
                const isNegPending = adj.status === 'pending' && estAfter < 0;

                return (
                  <TableRow key={adj.id}>
                    <TableCell className="font-mono text-xs font-semibold text-[#3243DD] whitespace-nowrap">
                      {adj.adjustment_code}
                      {adj.discrepancy_code && (
                        <p className="mt-0.5 font-sans text-[11px] font-normal">
                          <Link
                            href={`/discrepancies/${adj.discrepancy_id}`}
                            className="inline-flex items-center gap-0.5 text-slate-500 hover:text-[#3243DD] hover:underline"
                          >
                            Ref: {adj.discrepancy_code}
                            <ExternalLink className="h-2.5 w-2.5" />
                          </Link>
                        </p>
                      )}
                    </TableCell>
                    <TableCell>
                      <Link
                        href={`/products/${adj.product_id}`}
                        className="font-semibold text-slate-900 hover:text-[#3243DD]"
                      >
                        {adj.product_name}
                      </Link>
                      <p className="font-mono text-xs text-slate-500">
                        {adj.sku}
                        {adj.rack_location ? (
                          <span className="ml-1.5 font-sans text-[11px]">
                            • Rak: {adj.rack_location}
                          </span>
                        ) : null}
                      </p>
                    </TableCell>
                    <TableCell>
                      <Badge tone={typeMeta.tone}>{typeMeta.label}</Badge>
                    </TableCell>
                    <TableCell
                      className={`font-bold tabular-nums whitespace-nowrap ${
                        adj.quantity_delta > 0 ? 'text-emerald-700' : 'text-red-700'
                      }`}
                    >
                      {adj.quantity_delta > 0
                        ? `+${adj.quantity_delta}`
                        : adj.quantity_delta}{' '}
                      <span className="text-xs font-normal text-slate-500">
                        {adj.unit || ''}
                      </span>
                    </TableCell>
                    <TableCell className="text-xs tabular-nums whitespace-nowrap">
                      {adj.stock_before !== null && adj.stock_after !== null ? (
                        <span>
                          {adj.stock_before}{' '}
                          <strong className="text-slate-900">{adj.stock_after}</strong>{' '}
                          <span className="text-slate-500">{adj.unit || ''}</span>
                        </span>
                      ) : adj.status === 'pending' ? (
                        <div>
                          <span className="text-slate-600">
                            {adj.current_stock}{' '}
                            <strong
                              className={
                                isNegPending ? 'text-red-700' : 'text-[#3243DD]'
                              }
                            >
                              {estAfter}
                            </strong>{' '}
                            <span className="text-slate-500">{adj.unit || ''}</span>
                          </span>
                          <p className="text-[10px] text-slate-400">
                            {isNegPending ? 'Stok tidak mencukupi' : 'Estimasi bila disetujui'}
                          </p>
                        </div>
                      ) : (
                        <span className="text-slate-500">
                          Stok kini: {adj.current_stock} {adj.unit || ''}
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-xs max-w-xs">
                      <p className="text-slate-800 leading-snug">{adj.reason}</p>
                      <p className="mt-0.5 text-[11px] text-slate-500">
                        Oleh {adj.requested_by_name} • {formatDateTime(adj.created_at)}
                      </p>
                      {adj.status === 'rejected' && adj.rejection_reason && (
                        <p className="mt-1 rounded bg-red-50 px-2 py-1 text-[11px] font-medium text-red-700 border border-red-200/70">
                          Alasan Penolakan: {adj.rejection_reason}
                        </p>
                      )}
                    </TableCell>
                    <TableCell>
                      <StatusPill status={adj.status} />
                    </TableCell>
                    <TableCell className="text-right whitespace-nowrap">
                      {canApprove && adj.status === 'pending' && !isSelf && (
                        <div className="inline-flex items-center gap-1.5">
                          <Button
                            variant="primary"
                            size="sm"
                            disabled={isNegPending}
                            title={
                              isNegPending
                                ? 'Tidak dapat disetujui karena stok akan menjadi negatif'
                                : 'Setujui penyesuaian stok'
                            }
                            onClick={() => {
                              setDialogError(null);
                              setDialogAction({ mode: 'approve', item: adj });
                            }}
                          >
                            <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                            Setujui
                          </Button>
                          <Button
                            variant="danger"
                            size="sm"
                            onClick={() => {
                              setRejectError(null);
                              setRejectionReason('');
                              setRejectTarget(adj);
                            }}
                          >
                            <XCircle className="h-3.5 w-3.5" aria-hidden="true" />
                            Tolak
                          </Button>
                        </div>
                      )}
                      {adj.status === 'pending' && (!canApprove || isSelf) && (
                        <span className="text-[11px] font-medium text-amber-700">
                          {canApprove ? 'Menunggu reviewer lain' : 'Menunggu review Manager'}
                        </span>
                      )}
                      {adj.status !== 'pending' && adj.reviewed_by_name && (
                        <span className="text-[11px] text-slate-500">
                          Oleh {adj.reviewed_by_name}
                        </span>
                      )}
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
          icon={SlidersHorizontal}
          title={
            hasActiveFilters
              ? 'Tidak Ada Penyesuaian Stok yang Cocok'
              : 'Belum Ada Pengajuan Penyesuaian Stok'
          }
          description={
            hasActiveFilters
              ? 'Ubah pilihan status atau kata kunci pencarian untuk melihat catatan lainnya.'
              : 'Ajukan Penyesuaian Stok ketika ditemukan selisih stok nyata, kehilangan, atau barang rusak yang perlu dikoreksi secara resmi.'
          }
          action={
            hasActiveFilters ? (
              <Button variant="secondary" onClick={resetFilters}>
                Reset Pencarian
              </Button>
            ) : canRequest ? (
              <Button variant="primary" onClick={() => setShowCreateModal(true)}>
                <Plus className="h-4 w-4" aria-hidden="true" />
                Ajukan Penyesuaian
              </Button>
            ) : null
          }
        />
      )}

      {/* Create Adjustment Modal with Live Before -> After Preview (Staff only) */}
      {canRequest && (
      <Modal
        open={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        title="Ajukan Stock Adjustment"
        description="Pengajuan dibuat berstatus Menunggu dan membutuhkan persetujuan reviewer yang berbeda dari pengaju."
      >
        <form
          action={createAction}
          onSubmit={(e) => {
            if (!formValues.productId) {
              e.preventDefault();
              setProductSelectError('Pilih produk terlebih dahulu.');
              document.getElementById('adjustment-product-select')?.focus();
              return;
            }
            setProductSelectError('');
          }}
          className="space-y-3.5"
        >
          {createState.error && (
            <div
              role="alert"
              className="rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-700"
            >
              {createState.error}
            </div>
          )}

          <SearchableProductSelect
            id="adjustment-product-select"
            name="productId"
            label="Produk"
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

          <Select
            name="discrepancyId"
            label="Referensi Discrepancy (Opsional)"
            value={formValues.discrepancyId}
            onChange={(e) =>
              setFormValues((prev) => ({ ...prev, discrepancyId: e.target.value }))
            }
            placeholder="Tidak terhubung ke discrepancy"
            options={(overview.discrepancies || []).map((d) => ({
              value: String(d.id),
              label: `${d.issue_code} — ${d.sku}`,
            }))}
          />

          <Select
            name="adjustmentType"
            label="Jenis Penyesuaian"
            required
            value={formValues.adjustmentType}
            onChange={(e) =>
              setFormValues((prev) => ({ ...prev, adjustmentType: e.target.value }))
            }
            options={[
              { value: 'loss', label: 'Kehilangan (Loss)' },
              { value: 'damage', label: 'Barang Rusak (Damage)' },
              { value: 'found', label: 'Barang Ditemukan (Found)' },
              { value: 'correction', label: 'Koreksi Stok (Correction)' },
              { value: 'return', label: 'Retur Layak Simpan (Return)' },
              { value: 'other', label: 'Lainnya' },
            ]}
          />

          <div className="grid grid-cols-2 gap-3">
            <Select
              name="direction"
              label="Arah Perubahan"
              required
              value={formValues.direction}
              onChange={(e) =>
                setFormValues((prev) => ({ ...prev, direction: e.target.value }))
              }
              options={[
                { value: 'decrease', label: 'Kurangi Stok (-)' },
                { value: 'increase', label: 'Tambah Stok (+)' },
              ]}
            />
            <Input
              name="quantityDelta"
              type="number"
              min="1"
              step="1"
              label="Jumlah Unit"
              required
              value={formValues.quantityDelta}
              onChange={(e) =>
                setFormValues((prev) => ({ ...prev, quantityDelta: e.target.value }))
              }
              error={createState.fieldErrors?.quantityDelta}
            />
          </div>

          {/* Live Stock Impact Preview */}
          {selectedProd && (
            <div
              className={`rounded-xl border p-3.5 text-xs ${
                wouldGoNegative
                  ? 'border-red-300 bg-red-50 text-red-900'
                  : 'border-slate-200 bg-[#F4F5F8] text-slate-700'
              }`}
            >
              <p className="font-semibold text-slate-900 mb-2">
                Pratinjau Dampak Stok ({selectedProd.sku}
                {selectedProd.rack_location ? ` • Rak: ${selectedProd.rack_location}` : ''}
                {selectedProd.unit ? ` • Satuan: ${selectedProd.unit}` : ''})
              </p>
              <div className="grid grid-cols-3 gap-2 tabular-nums">
                <div>
                  <p className="text-[11px] text-slate-500">Stok Saat Ini</p>
                  <p className="text-base font-bold text-slate-900">
                    {selectedProd.stock}
                  </p>
                </div>
                <div>
                  <p className="text-[11px] text-slate-500">Penyesuaian</p>
                  <p
                    className={`text-base font-bold ${
                      signedDelta > 0 ? 'text-emerald-700' : 'text-red-700'
                    }`}
                  >
                    {signedDelta > 0 ? `+${signedDelta}` : signedDelta}
                  </p>
                </div>
                <div>
                  <p className="text-[11px] text-slate-500">Setelah Disetujui</p>
                  <p
                    className={`text-base font-bold ${
                      wouldGoNegative ? 'text-red-700' : 'text-[#3243DD]'
                    }`}
                  >
                    {projectedStock}
                  </p>
                </div>
              </div>
              {wouldGoNegative && (
                <p className="mt-2 flex items-center gap-1 font-semibold text-red-700">
                  <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                  Pengurangan melebihi stok saat ini. Stok tidak boleh menjadi negatif.
                </p>
              )}
            </div>
          )}

          <div>
            <label
              htmlFor="adj-reason"
              className="block text-xs sm:text-sm font-medium text-slate-700 mb-1"
            >
              Alasan Penyesuaian <span className="text-[#FF3D8B]">*</span>
            </label>
            <textarea
              id="adj-reason"
              name="reason"
              rows={2}
              required
              value={formValues.reason}
              onChange={(e) =>
                setFormValues((prev) => ({ ...prev, reason: e.target.value }))
              }
              placeholder="Jelaskan dasar temuan, hasil stock opname, atau referensi discrepancy..."
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-[#3243DD] focus:outline-none focus:ring-2 focus:ring-[#3243DD]/20"
            />
            {createState.fieldErrors?.reason && (
              <p className="mt-1 text-xs font-medium text-red-600">
                {createState.fieldErrors.reason}
              </p>
            )}
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <Button
              variant="secondary"
              onClick={() => setShowCreateModal(false)}
              disabled={isCreating}
            >
              Batal
            </Button>
            <Button
              type="submit"
              variant="primary"
              loading={isCreating}
              disabled={wouldGoNegative}
            >
              Ajukan Adjustment
            </Button>
          </div>
        </form>
      </Modal>
      )}

      {/* Review Approve Confirmation Dialog */}
      <Dialog
        open={Boolean(dialogAction)}
        onClose={() => {
          if (!isMutating) {
            setDialogAction(null);
            setDialogError(null);
          }
        }}
        onConfirm={handleConfirm}
        title="Setujui Stock Adjustment"
        message={`Menyetujui ${dialogItem?.adjustment_code} akan langsung memperbarui stok produk dan mencatatnya pada Stock Movement. Tindakan ini tidak dapat dibatalkan.`}
        confirmLabel="Setujui & Ubah Stok"
        confirmVariant="primary"
        loading={isMutating}
      >
        {dialogError && (
          <div
            role="alert"
            className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-700"
          >
            {dialogError}
          </div>
        )}
        {dialogItem && dialogAction?.mode === 'approve' && (
          <div className="rounded-xl border border-slate-200 bg-[#F4F5F8] p-3.5 text-xs space-y-2">
            <div className="flex justify-between gap-2">
              <span className="text-slate-500">Produk</span>
              <strong className="text-slate-900 text-right">
                {dialogItem.product_name} ({dialogItem.sku})
              </strong>
            </div>
            <div className="flex justify-between gap-2 tabular-nums">
              <span className="text-slate-500">Perubahan Stok</span>
              <strong
                className={
                  dialogItem.quantity_delta > 0 ? 'text-emerald-700' : 'text-red-700'
                }
              >
                {dialogItem.current_stock} {dialogProjected} (
                {dialogItem.quantity_delta > 0
                  ? `+${dialogItem.quantity_delta}`
                  : dialogItem.quantity_delta}
                )
              </strong>
            </div>
            <div className="flex justify-between gap-2">
              <span className="text-slate-500">Pengaju</span>
              <span className="font-medium text-slate-800">
                {dialogItem.requested_by_name}
              </span>
            </div>
            <div className="pt-1.5 border-t border-slate-200">
              <p className="text-slate-500">Alasan:</p>
              <p className="mt-0.5 text-slate-800">{dialogItem.reason}</p>
            </div>
          </div>
        )}
      </Dialog>

      {/* Reject Stock Adjustment Modal (Mandatory Rejection Reason) */}
      <Modal
        open={Boolean(rejectTarget)}
        onClose={() => !isMutating && setRejectTarget(null)}
        title={`Tolak Stock Adjustment ${rejectTarget?.adjustment_code || ''}`}
        description="Penolakan tidak akan mengubah stok produk. Alasan penolakan wajib diisi minimal 5 karakter."
      >
        <form onSubmit={handleRejectSubmit} className="space-y-4">
          {rejectError && (
            <div
              role="alert"
              className="rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-700"
            >
              {rejectError}
            </div>
          )}
          <div>
            <label
              htmlFor="adj-reject-reason"
              className="block text-xs sm:text-sm font-medium text-slate-700 mb-1.5"
            >
              Alasan Penolakan <span className="text-[#FF3D8B]">*</span>
            </label>
            <textarea
              id="adj-reject-reason"
              rows={3}
              required
              minLength={5}
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              placeholder="Contoh: Selisih fisik masih memerlukan pengecekan ulang pada rak penyimpanan..."
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-[#3243DD] focus:outline-none focus:ring-2 focus:ring-[#3243DD]/20"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <Button
              variant="secondary"
              onClick={() => setRejectTarget(null)}
              disabled={isMutating}
            >
              Batal
            </Button>
            <Button type="submit" variant="danger" loading={isMutating}>
              Tolak Adjustment
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
