'use client';

import { useActionState, useRef, useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  ExternalLink,
  Info,
  SlidersHorizontal,
  PlusCircle,
} from 'lucide-react';
import { updateDiscrepancyAction } from '../../modules/discrepancies/discrepancyActions.js';
import { createAdjustmentAction } from '../../modules/adjustments/adjustmentActions.js';
import RefundClaimPanel from './RefundClaimPanel.jsx';
import { formatDateTime, formatCurrencyIDR } from '../../lib/utils/format.js';
import {
  getDiscrepancyIssueMeta,
  getDiscrepancySourceHref,
  getDiscrepancySourceLabel,
  getResolutionTypeLabel,
} from '../../lib/utils/labels.js';
import PageHeader from '../shared/PageHeader.jsx';
import StatusPill from '../shared/StatusPill.jsx';
import FeedbackBanner from '../shared/FeedbackBanner.jsx';
import WorkflowStepper from '../shared/WorkflowStepper.jsx';
import EvidencePanel from '../shared/EvidencePanel.jsx';
import Button from '../ui/Button.jsx';
import Input from '../ui/Input.jsx';
import Select from '../ui/Select.jsx';
import Modal from '../ui/Modal.jsx';
import Dialog from '../ui/Dialog.jsx';
import Badge from '../ui/Badge.jsx';
import { useToast } from '../ui/ToastProvider.jsx';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/Card.jsx';

const emptyActionState = { ok: false, error: null, message: '', fieldErrors: null };

const DISCREPANCY_STEPS = [
  { key: 'open', label: 'Terbuka', sublabel: 'Dilaporkan' },
  { key: 'investigating', label: 'Investigasi', sublabel: 'Pemeriksaan Manager' },
  { key: 'resolved', label: 'Selesai', sublabel: 'Resolusi tercatat' },
  { key: 'closed', label: 'Ditutup', sublabel: 'Kasus ditutup' },
];

export default function DiscrepancyDetailView({
  report,
  evidence,
  canReport = false,
  canResolve,
  canRequestAdjustment,
}) {
  const toast = useToast();
  const [feedback, setFeedback] = useState(null);
  const [showAdjModal, setShowAdjModal] = useState(false);
  const [showConfirmResolveDialog, setShowConfirmResolveDialog] = useState(false);
  const resolveFormRef = useRef(null);
  const confirmedResolveRef = useRef(false);

  const [resolveForm, setResolveForm] = useState({
    status: report.status === 'open' ? 'investigating' : report.status,
    investigationNotes: report.investigation_notes || '',
    resolutionType: report.resolution_type || 'adjustment',
    resolutionNotes: report.resolution_notes || '',
  });

  const [adjForm, setAdjForm] = useState({
    adjustmentType: report.issue_type === 'damaged' ? 'damage' : 'loss',
    direction: report.difference && report.difference > 0 ? 'increase' : 'decrease',
    quantityDelta: report.difference ? String(Math.abs(report.difference)) : '1',
    reason: `Tindak lanjut laporan ${report.issue_code}`,
  });

  const [updateState, updateAction, isUpdating] = useActionState(
    async (prev, fd) => {
      const res = await updateDiscrepancyAction(prev, fd);
      if (res.ok) {
        setFeedback({ type: 'success', text: res.message });
      } else if (res?.error) {
        toast.error(res.error);
      }
      return res;
    },
    emptyActionState
  );

  const [adjState, adjAction, isRequestingAdj] = useActionState(
    async (prev, fd) => {
      const res = await createAdjustmentAction(prev, fd);
      if (res.ok) {
        setShowAdjModal(false);
        setFeedback({ type: 'success', text: res.message });
      } else if (res?.error) {
        toast.error(res.error);
      }
      return res;
    },
    emptyActionState
  );

  function handleResolveSubmit(e) {
    if (
      ['resolved', 'closed'].includes(resolveForm.status) &&
      !confirmedResolveRef.current
    ) {
      e.preventDefault();
      setShowConfirmResolveDialog(true);
      return;
    }
    confirmedResolveRef.current = false;
  }

  const issueMeta = getDiscrepancyIssueMeta(report.issue_type);
  const sourceHref = getDiscrepancySourceHref(report);
  const sourceCode = report.transaction_code || report.po_code;
  const needsResolutionNotes = ['resolved', 'closed'].includes(resolveForm.status);

  return (
    <div className="space-y-5">
      <PageHeader
        title={`Discrepancy ${report.issue_code}`}
        description={`Produk: ${report.product_name} (${report.sku}) • Dilaporkan oleh ${report.reported_by_name}`}
        breadcrumbs={[
          { label: 'Dashboard', href: '/dashboard' },
          { label: 'Discrepancies', href: '/discrepancies' },
          { label: report.issue_code },
        ]}
        badge={<StatusPill status={report.status} />}
        actions={
          <div className="flex flex-wrap gap-2">
            <Link
              href="/discrepancies"
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs sm:text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
            >
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              Kembali
            </Link>
            {canResolve && (
              <Link
                href={`/restock-orders?referencePoId=${report.resolved_purchase_order_id || report.purchase_order_id || ''}&sourceDiscrepancyId=${report.id}&supplierId=${report.supplier_id || ''}&productId=${report.product_id}&qty=${report.difference < 0 ? Math.abs(report.difference) : ''}`}
                className="inline-flex items-center gap-1.5 rounded-lg bg-[#3243DD] px-3.5 py-2 text-xs sm:text-sm font-semibold text-white hover:bg-[#2635BC] transition-colors"
              >
                <PlusCircle className="h-4 w-4" aria-hidden="true" />
                Buat PO Baru (Terpisah)
              </Link>
            )}
            {canRequestAdjustment && (
              <Button variant="secondary" onClick={() => setShowAdjModal(true)}>
                <SlidersHorizontal className="h-4 w-4" aria-hidden="true" />
                Ajukan Stock Adjustment
              </Button>
            )}
          </div>
        }
      />

      <WorkflowStepper steps={DISCREPANCY_STEPS} currentKey={report.status} />

      <FeedbackBanner feedback={feedback} onDismiss={() => setFeedback(null)} />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Detail Temuan Discrepancy</CardTitle>
            </CardHeader>
            <CardContent className="space-y-5 text-sm">
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone={issueMeta.tone}>{issueMeta.label}</Badge>
                <Badge tone="info">
                  Sumber: {getDiscrepancySourceLabel(report.source_type)}
                </Badge>
                {sourceCode &&
                  (sourceHref ? (
                    <Link
                      href={sourceHref}
                      className="inline-flex items-center gap-1 rounded-full border border-[#3243DD]/25 bg-[#EEF1FD] px-2.5 py-0.5 font-mono text-xs font-semibold text-[#3243DD] hover:bg-[#3243DD] hover:text-white transition-colors"
                    >
                      {sourceCode}
                      <ExternalLink className="h-3 w-3" aria-hidden="true" />
                    </Link>
                  ) : (
                    <Badge tone="primary" className="font-mono">
                      {sourceCode}
                    </Badge>
                  ))}
              </div>

              <div className="rounded-xl border border-slate-200 bg-white p-3.5 flex flex-wrap items-center justify-between gap-2 text-xs">
                <div>
                  <p className="text-slate-500">Produk Terkait</p>
                  <Link
                    href={`/products/${report.product_id}`}
                    className="mt-0.5 inline-flex items-center gap-1 text-sm font-semibold text-slate-900 hover:text-[#3243DD]"
                  >
                    {report.product_name}
                    <span className="font-mono text-xs text-[#3243DD]">
                      ({report.sku})
                    </span>
                    <ExternalLink className="h-3 w-3 text-[#3243DD]" aria-hidden="true" />
                  </Link>
                  {(report.rack_location || report.unit) && (
                    <p className="mt-0.5 text-[11px] text-slate-500">
                      {report.rack_location ? `Rak: ${report.rack_location}` : ''}
                      {report.rack_location && report.unit ? ' • ' : ''}
                      {report.unit ? `Satuan: ${report.unit}` : ''}
                    </p>
                  )}
                </div>
                <div className="text-right text-slate-500 tabular-nums">
                  <p>Dilaporkan</p>
                  <p className="font-medium text-slate-700">
                    {formatDateTime(report.reported_at)}
                  </p>
                </div>
              </div>

              <div className="space-y-3 rounded-xl bg-[#F4F5F8] border border-slate-200/80 p-4">
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                  <div>
                    <p className="text-xs text-slate-500">Dipesan / Diharapkan</p>
                    <p className="mt-0.5 text-lg font-bold text-slate-900 tabular-nums">
                      {report.expected_quantity ?? '—'}{' '}
                      {report.expected_quantity !== null && report.unit && (
                        <span className="text-xs font-normal text-slate-500">{report.unit}</span>
                      )}
                    </p>
                  </div>
                  {report.inspected_quantity !== null && report.inspected_quantity !== undefined && (
                    <div>
                      <p className="text-xs text-slate-500">Diperiksa Staff</p>
                      <p className="mt-0.5 text-lg font-bold text-slate-900 tabular-nums">
                        {report.inspected_quantity}{' '}
                        {report.unit && (
                          <span className="text-xs font-normal text-slate-500">{report.unit}</span>
                        )}
                      </p>
                    </div>
                  )}
                  {report.accepted_quantity !== null && report.accepted_quantity !== undefined && (
                    <div>
                      <p className="text-xs text-slate-500">Diterima (Accepted)</p>
                      <p className="mt-0.5 text-lg font-bold text-emerald-700 tabular-nums">
                        {report.accepted_quantity}{' '}
                        {report.unit && (
                          <span className="text-xs font-normal text-slate-500">{report.unit}</span>
                        )}
                      </p>
                    </div>
                  )}
                  <div>
                    <p className="text-xs text-slate-500">Aktual Layak</p>
                    <p className="mt-0.5 text-lg font-bold text-slate-900 tabular-nums">
                      {report.actual_quantity ?? '—'}{' '}
                      {report.actual_quantity !== null && report.unit && (
                        <span className="text-xs font-normal text-slate-500">{report.unit}</span>
                      )}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">Selisih</p>
                    <p
                      className={`mt-0.5 text-lg font-bold tabular-nums ${
                        report.difference < 0
                          ? 'text-red-700'
                          : report.difference > 0
                          ? 'text-amber-700'
                          : 'text-slate-900'
                      }`}
                    >
                      {report.difference !== null && report.difference !== undefined
                        ? report.difference > 0
                          ? `+${report.difference}`
                          : report.difference
                        : '—'}{' '}
                      {report.difference !== null && report.difference !== undefined && report.unit && (
                        <span className="text-xs font-normal text-slate-500">{report.unit}</span>
                      )}
                    </p>
                  </div>
                </div>
                {(report.po_code ||
                  report.supplier_name ||
                  report.follow_up_po_code ||
                  (report.purchase_price !== null && report.purchase_price !== undefined)) && (
                  <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 pt-2.5 border-t border-slate-200/80 text-xs text-slate-600">
                    {report.po_code && (
                      <span>
                        PO Referensi:{' '}
                        {report.resolved_purchase_order_id ? (
                          <Link
                            href={`/purchase-orders/${report.resolved_purchase_order_id}`}
                            className="font-mono font-semibold text-[#3243DD] hover:underline"
                          >
                            {report.po_code}
                          </Link>
                        ) : (
                          <strong className="font-mono">{report.po_code}</strong>
                        )}
                      </span>
                    )}
                    {report.supplier_name && (
                      <span>
                        Supplier: <strong className="text-slate-800">{report.supplier_name}</strong>
                      </span>
                    )}
                    {report.purchase_price !== null && report.purchase_price !== undefined && (
                      <span>
                        Harga Beli/Unit:{' '}
                        <strong className="text-slate-800 tabular-nums">
                          {formatCurrencyIDR(report.purchase_price)}
                        </strong>
                      </span>
                    )}
                    {report.follow_up_po_id && report.follow_up_po_code && (
                      <span>
                        PO Baru Terpisah:{' '}
                        <Link
                          href={`/purchase-orders/${report.follow_up_po_id}`}
                          className="font-mono font-semibold text-[#3243DD] hover:underline"
                        >
                          {report.follow_up_po_code}
                        </Link>
                      </span>
                    )}
                  </div>
                )}
              </div>

              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Deskripsi Kronologi
                </p>
                <p className="mt-1.5 text-slate-800 leading-relaxed">
                  {report.description}
                </p>
              </div>

              {report.investigation_notes && (
                <div className="pt-3 border-t border-slate-100">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Catatan Investigasi Manager
                  </p>
                  <p className="mt-1.5 text-slate-800 leading-relaxed">
                    {report.investigation_notes}
                  </p>
                </div>
              )}

              {report.resolution_notes && (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-950">
                  <p className="text-xs font-semibold uppercase tracking-wide text-emerald-800">
                    Penyelesaian — {getResolutionTypeLabel(report.resolution_type)}
                  </p>
                  <p className="mt-1 text-sm leading-relaxed">
                    {report.resolution_notes}
                  </p>
                  <p className="mt-1.5 text-xs text-emerald-700 tabular-nums">
                    Diselesaikan oleh {report.resolved_by_name} pada{' '}
                    {formatDateTime(report.resolved_at)}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          <EvidencePanel
            entityType="discrepancy"
            entityId={report.id}
            files={evidence}
            title="Bukti Discrepancy"
            helperNote="Unggah foto kerusakan, selisih barang, atau dokumen pendukung investigasi."
            canUpload={canReport && report.status !== 'closed'}
            canDelete={canReport && !['resolved', 'closed'].includes(report.status)}
          />
        </div>

        <aside className="space-y-5">
          <RefundClaimPanel report={report} canManageRefund={canResolve} />
          {canResolve && report.status !== 'closed' && (
            <Card highlight>
              <CardHeader>
                <CardTitle className="text-sm">Investigasi &amp; Resolusi (Manager)</CardTitle>
              </CardHeader>
              <CardContent>
                <form
                  ref={resolveFormRef}
                  action={updateAction}
                  onSubmit={handleResolveSubmit}
                  className="space-y-3.5"
                >
                  <input type="hidden" name="discrepancyId" value={report.id} />

                  <div className="rounded-lg border border-slate-200 bg-[#F4F5F8] p-2.5 text-[11px] text-slate-600 flex items-start gap-2">
                    <Info className="h-3.5 w-3.5 mt-0.5 text-[#3243DD] shrink-0" />
                    <span>
                      Menyelesaikan laporan ini tidak mengubah stok secara otomatis.
                      Gunakan tombol <strong>Ajukan Stock Adjustment</strong> jika stok
                      perlu dikoreksi.
                    </span>
                  </div>

                  {updateState.error && (
                    <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                      {updateState.error}
                    </div>
                  )}

                  <Select
                    name="status"
                    label="Status Tindak Lanjut"
                    required
                    value={resolveForm.status}
                    onChange={(e) =>
                      setResolveForm((prev) => ({ ...prev, status: e.target.value }))
                    }
                    options={[
                      { value: 'investigating', label: 'Investigasi' },
                      { value: 'resolved', label: 'Selesai (Resolved)' },
                      { value: 'closed', label: 'Ditutup (Closed)' },
                    ]}
                  />

                  <div>
                    <label
                      htmlFor="inv-notes"
                      className="block text-xs sm:text-sm font-medium text-slate-700 mb-1"
                    >
                      Catatan Investigasi
                    </label>
                    <textarea
                      id="inv-notes"
                      name="investigationNotes"
                      rows={2}
                      value={resolveForm.investigationNotes}
                      onChange={(e) =>
                        setResolveForm((prev) => ({
                          ...prev,
                          investigationNotes: e.target.value,
                        }))
                      }
                      placeholder="Hasil pemeriksaan histori stok atau bukti..."
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-[#3243DD] focus:outline-none focus:ring-2 focus:ring-[#3243DD]/20"
                    />
                  </div>

                  <Select
                    name="resolutionType"
                    label="Jenis Penyelesaian"
                    value={resolveForm.resolutionType}
                    onChange={(e) =>
                      setResolveForm((prev) => ({
                        ...prev,
                        resolutionType: e.target.value,
                      }))
                    }
                    options={[
                      { value: 'refund', label: 'Klaim Refund ke Supplier' },
                      { value: 'new_po', label: 'Pembuatan PO Baru (Terpisah)' },
                      { value: 'found', label: 'Barang Ditemukan' },
                      { value: 'replacement', label: 'Penggantian Supplier' },
                      { value: 'return', label: 'Retur Barang' },
                      { value: 'adjustment', label: 'Penyesuaian Stok (Adjustment)' },
                      { value: 'other', label: 'Lainnya' },
                    ]}
                  />

                  <div>
                    <label
                      htmlFor="res-notes"
                      className="block text-xs sm:text-sm font-medium text-slate-700 mb-1"
                    >
                      Catatan Penyelesaian
                      {needsResolutionNotes && (
                        <span className="ml-0.5 text-[#FF3D8B]">*</span>
                      )}
                    </label>
                    <textarea
                      id="res-notes"
                      name="resolutionNotes"
                      rows={2}
                      required={needsResolutionNotes}
                      value={resolveForm.resolutionNotes}
                      onChange={(e) =>
                        setResolveForm((prev) => ({
                          ...prev,
                          resolutionNotes: e.target.value,
                        }))
                      }
                      placeholder="Ringkasan keputusan dan tindak lanjut..."
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-[#3243DD] focus:outline-none focus:ring-2 focus:ring-[#3243DD]/20"
                    />
                  </div>

                  <Button
                    type="submit"
                    variant="primary"
                    loading={isUpdating}
                    className="w-full"
                  >
                    Simpan Tindak Lanjut
                  </Button>
                </form>
              </CardContent>
            </Card>
          )}
        </aside>
      </div>

      {/* Request Stock Adjustment Modal linked to this Discrepancy */}
      {canRequestAdjustment && (
        <Modal
          open={showAdjModal}
          onClose={() => setShowAdjModal(false)}
          title="Ajukan Stock Adjustment dari Discrepancy"
          description={`Produk: ${report.product_name} (${report.sku}). Pengajuan akan masuk ke antrean Stock Adjustments untuk ditinjau reviewer lain.`}
        >
          <form action={adjAction} className="space-y-3.5">
            <input type="hidden" name="productId" value={report.product_id} />
            <input type="hidden" name="discrepancyId" value={report.id} />
            {adjState.error && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {adjState.error}
              </div>
            )}
            <Select
              name="adjustmentType"
              label="Jenis Penyesuaian"
              required
              value={adjForm.adjustmentType}
              onChange={(e) =>
                setAdjForm((prev) => ({ ...prev, adjustmentType: e.target.value }))
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
                value={adjForm.direction}
                onChange={(e) =>
                  setAdjForm((prev) => ({ ...prev, direction: e.target.value }))
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
                value={adjForm.quantityDelta}
                onChange={(e) =>
                  setAdjForm((prev) => ({ ...prev, quantityDelta: e.target.value }))
                }
              />
            </div>
            <div>
              <label
                htmlFor="disc-adj-reason"
                className="block text-xs sm:text-sm font-medium text-slate-700 mb-1"
              >
                Alasan Penyesuaian <span className="text-[#FF3D8B]">*</span>
              </label>
              <textarea
                id="disc-adj-reason"
                name="reason"
                rows={2}
                required
                value={adjForm.reason}
                onChange={(e) =>
                  setAdjForm((prev) => ({ ...prev, reason: e.target.value }))
                }
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-[#3243DD] focus:outline-none focus:ring-2 focus:ring-[#3243DD]/20"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <Button
                variant="secondary"
                onClick={() => setShowAdjModal(false)}
                disabled={isRequestingAdj}
              >
                Batal
              </Button>
              <Button type="submit" variant="primary" loading={isRequestingAdj}>
                Ajukan Penyesuaian
              </Button>
            </div>
          </form>
        </Modal>
      )}

      <Dialog
        open={showConfirmResolveDialog}
        onClose={() => setShowConfirmResolveDialog(false)}
        onConfirm={() => {
          confirmedResolveRef.current = true;
          setShowConfirmResolveDialog(false);
          resolveFormRef.current?.requestSubmit();
        }}
        title={
          resolveForm.status === 'closed'
            ? 'Tutup Laporan Discrepancy?'
            : 'Selesaikan Laporan Discrepancy?'
        }
        message={`Menetapkan ${report.issue_code} (${report.sku}) menjadi "${resolveForm.status}" menandakan tindak lanjut Manager telah selesai. Catatan dan bukti tidak akan dapat diubah setelah berstatus Closed. Lanjutkan?`}
        confirmLabel={resolveForm.status === 'closed' ? 'Ya, Tutup Kasus' : 'Ya, Selesaikan'}
        confirmVariant="primary"
        loading={isUpdating}
      />
    </div>
  );
}
