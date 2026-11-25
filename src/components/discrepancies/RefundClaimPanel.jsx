'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Receipt, ExternalLink, PlusCircle, AlertCircle } from 'lucide-react';
import {
  submitRefundClaimAction,
  updateRefundClaimStatusAction,
} from '../../modules/discrepancies/discrepancyActions.js';
import { formatCurrencyIDR, formatDateTime } from '../../lib/utils/format.js';
import { getRefundStatusMeta } from '../../lib/utils/labels.js';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../ui/Card.jsx';
import Badge from '../ui/Badge.jsx';
import Button from '../ui/Button.jsx';
import Input from '../ui/Input.jsx';
import Select from '../ui/Select.jsx';
import Modal from '../ui/Modal.jsx';
import FeedbackBanner from '../shared/FeedbackBanner.jsx';
import { useToast } from '../ui/ToastProvider.jsx';

function buildNewPoHref(report) {
  const params = new URLSearchParams();
  if (report?.resolved_purchase_order_id) {
    params.set('referencePoId', String(report.resolved_purchase_order_id));
  } else if (report?.purchase_order_id) {
    params.set('referencePoId', String(report.purchase_order_id));
  }
  if (report?.id) {
    params.set('sourceDiscrepancyId', String(report.id));
  }
  if (report?.supplier_id) {
    params.set('supplierId', String(report.supplier_id));
  }
  if (report?.product_id) {
    params.set('productId', String(report.product_id));
  }
  const shortfall =
    report?.expected_quantity !== null && report?.accepted_quantity !== null
      ? Math.max(0, Number(report.expected_quantity) - Number(report.accepted_quantity))
      : report?.difference !== null && Number(report.difference) < 0
      ? Math.abs(Number(report.difference))
      : 0;
  if (shortfall > 0) {
    params.set('qty', String(shortfall));
  }
  return `/restock-orders?${params.toString()}`;
}

export default function RefundClaimPanel({ report, canManageRefund = false }) {
  const router = useRouter();
  const toast = useToast();
  const [isPending, startTransition] = useTransition();

  const refundStatus = report?.refund_status || 'none';
  const refundMeta = getRefundStatusMeta(refundStatus);

  const shortfallQty =
    report?.expected_quantity !== null && report?.accepted_quantity !== null
      ? Math.max(0, Number(report.expected_quantity) - Number(report.accepted_quantity))
      : report?.difference !== null && Number(report.difference) < 0
      ? Math.abs(Number(report.difference))
      : 0;

  const suggestedEstimate =
    shortfallQty > 0 && Number(report?.purchase_price || 0) > 0
      ? String(Math.round(shortfallQty * Number(report.purchase_price)))
      : '';

  const [showClaimModal, setShowClaimModal] = useState(false);
  const [showUpdateModal, setShowUpdateModal] = useState(false);
  const [feedback, setFeedback] = useState(null);

  const [claimAmount, setClaimAmount] = useState(
    report?.refund_amount !== null && report?.refund_amount !== undefined
      ? String(report.refund_amount)
      : suggestedEstimate
  );
  const [claimNotes, setClaimNotes] = useState('');

  const [nextStatus, setNextStatus] = useState(
    refundStatus === 'approved' ? 'completed' : 'approved'
  );
  const [updateAmount, setUpdateAmount] = useState(
    report?.refund_amount !== null && report?.refund_amount !== undefined
      ? String(report.refund_amount)
      : ''
  );
  const [updateNotes, setUpdateNotes] = useState('');

  const canSubmitClaim = canManageRefund && ['none', 'rejected'].includes(refundStatus);
  const canUpdateClaim = canManageRefund && ['submitted', 'approved'].includes(refundStatus);
  const newPoHref = buildNewPoHref(report);

  function openClaimModal() {
    setFeedback(null);
    setClaimAmount(
      report?.refund_amount !== null && report?.refund_amount !== undefined
        ? String(report.refund_amount)
        : suggestedEstimate
    );
    setClaimNotes(
      shortfallQty > 0
        ? `Klaim refund atas selisih/kerusakan ${shortfallQty} ${report?.unit || 'unit'} (${report?.sku || 'produk'}) pada ${report?.po_code || report?.issue_code}.`
        : ''
    );
    setShowClaimModal(true);
  }

  function openUpdateModal() {
    setFeedback(null);
    setNextStatus(refundStatus === 'approved' ? 'completed' : 'approved');
    setUpdateAmount(
      report?.refund_amount !== null && report?.refund_amount !== undefined
        ? String(report.refund_amount)
        : ''
    );
    setUpdateNotes('');
    setShowUpdateModal(true);
  }

  function handleSubmitClaim(e) {
    e.preventDefault();
    setFeedback(null);
    const fd = new FormData();
    fd.set('discrepancyId', String(report.id));
    fd.set('refundAmount', claimAmount.trim());
    fd.set('refundNotes', claimNotes.trim());

    startTransition(async () => {
      const res = await submitRefundClaimAction(null, fd);
      if (res.ok) {
        setShowClaimModal(false);
        toast.success(res.message);
        router.refresh();
      } else {
        setFeedback({
          type: 'error',
          text: res.error || 'Gagal mengajukan klaim refund.',
          fieldErrors: res.fieldErrors,
        });
      }
    });
  }

  function handleUpdateRefundStatus(e) {
    e.preventDefault();
    setFeedback(null);
    const fd = new FormData();
    fd.set('discrepancyId', String(report.id));
    fd.set('refundStatus', nextStatus);
    fd.set('refundAmount', updateAmount.trim());
    fd.set('refundNotes', updateNotes.trim());

    startTransition(async () => {
      const res = await updateRefundClaimStatusAction(null, fd);
      if (res.ok) {
        setShowUpdateModal(false);
        toast.success(res.message);
        router.refresh();
      } else {
        setFeedback({
          type: 'error',
          text: res.error || 'Gagal memperbarui status klaim refund.',
          fieldErrors: res.fieldErrors,
        });
      }
    });
  }

  const nextStatusOptions =
    refundStatus === 'submitted'
      ? [
          { value: 'approved', label: 'Disetujui Supplier' },
          { value: 'completed', label: 'Refund Selesai' },
          { value: 'rejected', label: 'Ditolak Supplier (Wajib Alasan)' },
        ]
      : [
          { value: 'completed', label: 'Refund Selesai' },
          { value: 'rejected', label: 'Ditolak Supplier (Wajib Alasan)' },
        ];

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-2">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Receipt className="h-4 w-4 text-[#3243DD]" aria-hidden="true" />
                Klaim Refund &amp; PO Baru
              </CardTitle>
              <CardDescription>
                Keputusan manual Manager. Tidak otomatis mengubah stok maupun PO lama.
              </CardDescription>
            </div>
            <Badge tone={refundMeta.tone}>{refundMeta.label}</Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="rounded-lg border border-slate-200 bg-[#F4F5F8] p-3 space-y-1.5 text-xs">
            <div className="flex items-center justify-between gap-2">
              <span className="text-slate-500">Supplier Terkait</span>
              <span className="font-medium text-slate-900">
                {report?.supplier_name || '—'}
              </span>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-slate-500">Referensi PO</span>
              {report?.resolved_purchase_order_id && report?.po_code ? (
                <Link
                  href={`/purchase-orders/${report.resolved_purchase_order_id}`}
                  className="font-mono font-semibold text-[#3243DD] hover:underline"
                >
                  {report.po_code}
                </Link>
              ) : (
                <span className="text-slate-700">{report?.po_code || '—'}</span>
              )}
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-slate-500">Nominal Klaim Refund</span>
              <span className="font-semibold text-slate-900 tabular-nums">
                {report?.refund_amount !== null && report?.refund_amount !== undefined
                  ? formatCurrencyIDR(report.refund_amount)
                  : '—'}
              </span>
            </div>
            {report?.follow_up_po_id && report?.follow_up_po_code && (
              <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-200">
                <span className="text-slate-500">PO Baru Terpisah</span>
                <Link
                  href={`/purchase-orders/${report.follow_up_po_id}`}
                  className="inline-flex items-center gap-1 font-mono font-semibold text-[#3243DD] hover:underline"
                >
                  {report.follow_up_po_code}
                  <ExternalLink className="h-3 w-3" aria-hidden="true" />
                </Link>
              </div>
            )}
          </div>

          {report?.refund_notes && (
            <div className="rounded-lg border border-slate-200 bg-white p-3 text-xs text-slate-700">
              <p className="font-semibold text-slate-900 mb-1">Catatan Klaim Refund</p>
              <p className="whitespace-pre-line">{report.refund_notes}</p>
              {report.refund_requested_by_name && (
                <p className="mt-1.5 text-[11px] text-slate-400">
                  Diajukan oleh {report.refund_requested_by_name} •{' '}
                  {formatDateTime(report.refund_requested_at)}
                </p>
              )}
            </div>
          )}

          {canManageRefund && (
            <div className="space-y-2 pt-1">
              {canSubmitClaim && (
                <Button variant="primary" className="w-full" onClick={openClaimModal}>
                  <Receipt className="h-4 w-4" aria-hidden="true" />
                  {refundStatus === 'rejected'
                    ? 'Ajukan Ulang Klaim Refund'
                    : 'Ajukan Klaim Refund ke Supplier'}
                </Button>
              )}
              {canUpdateClaim && (
                <Button variant="secondary" className="w-full" onClick={openUpdateModal}>
                  Perbarui Status Klaim Refund
                </Button>
              )}
              <Link
                href={newPoHref}
                className="w-full inline-flex items-center justify-center gap-2 rounded-lg border border-[#3243DD]/40 bg-[#EEF1FD] px-3.5 py-2 text-xs sm:text-sm font-semibold text-[#3243DD] hover:bg-[#E1E7FC] transition-colors"
              >
                <PlusCircle className="h-4 w-4" aria-hidden="true" />
                Buat PO Baru (Terpisah)
              </Link>
              <p className="text-[11px] text-slate-500 leading-relaxed">
                PO baru akan memiliki nomor PO sendiri sebagai transaksi terpisah tanpa
                mengubah PO lama.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      <Modal
        open={showClaimModal}
        onClose={() => !isPending && setShowClaimModal(false)}
        title="Ajukan Klaim Refund ke Supplier"
        description="Klaim refund dicatat berdasarkan barang yang tidak diterima atau rusak. Stok gudang tidak berubah."
      >
        <form onSubmit={handleSubmitClaim} className="space-y-4">
          <FeedbackBanner feedback={feedback} onDismiss={() => setFeedback(null)} />

          <div className="rounded-lg border border-blue-200 bg-blue-50/70 p-3 text-xs text-blue-900 flex items-start gap-2">
            <AlertCircle className="h-4 w-4 text-[#3243DD] shrink-0 mt-0.5" aria-hidden="true" />
            <span>
              Tidak ada pengurangan/penambahan stok otomatis maupun pembuatan PO baru otomatis
              saat klaim refund diajukan.
            </span>
          </div>

          <Input
            label="Estimasi Nominal Refund (Rp) — Opsional"
            type="number"
            min="1"
            step="1"
            value={claimAmount}
            onChange={(e) => setClaimAmount(e.target.value)}
            placeholder="Contoh: 150000"
            error={feedback?.fieldErrors?.refundAmount || null}
            helperText={
              suggestedEstimate
                ? `Referensi harga beli × selisih (${shortfallQty} ${report?.unit || 'unit'}): ${formatCurrencyIDR(suggestedEstimate)}`
                : 'Kosongkan jika nominal belum disepakati dengan supplier.'
            }
          />

          <div>
            <label
              htmlFor="refund-claim-notes"
              className="block text-xs sm:text-sm font-medium text-slate-700 mb-1.5"
            >
              Rincian &amp; Alasan Klaim Refund{' '}
              <span className="text-[#FF3D8B]" aria-hidden="true">
                *
              </span>
            </label>
            <textarea
              id="refund-claim-notes"
              required
              minLength={5}
              rows={3}
              value={claimNotes}
              onChange={(e) => setClaimNotes(e.target.value)}
              placeholder="Jelaskan unit rusak/kurang dan permohonan pengembalian dana ke supplier..."
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-[#3243DD] focus:outline-none focus:ring-2 focus:ring-[#3243DD]/20"
            />
            {feedback?.fieldErrors?.refundNotes && (
              <p className="mt-1 text-xs font-medium text-red-600">
                {feedback.fieldErrors.refundNotes}
              </p>
            )}
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button
              variant="secondary"
              onClick={() => setShowClaimModal(false)}
              disabled={isPending}
            >
              Batal
            </Button>
            <Button type="submit" loading={isPending}>
              Kirim Pengajuan Klaim
            </Button>
          </div>
        </form>
      </Modal>

      <Modal
        open={showUpdateModal}
        onClose={() => !isPending && setShowUpdateModal(false)}
        title="Perbarui Status Klaim Refund"
        description="Catat hasil tanggapan supplier atas pengajuan klaim refund yang sudah dikirim."
      >
        <form onSubmit={handleUpdateRefundStatus} className="space-y-4">
          <FeedbackBanner feedback={feedback} onDismiss={() => setFeedback(null)} />

          <Select
            label="Status Klaim Refund Terbaru"
            required
            value={nextStatus}
            onChange={(e) => setNextStatus(e.target.value)}
            options={nextStatusOptions}
          />

          <Input
            label="Nominal Refund Final (Rp) — Opsional"
            type="number"
            min="1"
            step="1"
            value={updateAmount}
            onChange={(e) => setUpdateAmount(e.target.value)}
            placeholder="Isi jika nominal diperbarui"
            error={feedback?.fieldErrors?.refundAmount || null}
          />

          <div>
            <label
              htmlFor="refund-update-notes"
              className="block text-xs sm:text-sm font-medium text-slate-700 mb-1.5"
            >
              Catatan Tanggapan Supplier{' '}
              {nextStatus === 'rejected' && (
                <span className="text-[#FF3D8B]" aria-hidden="true">
                  *
                </span>
              )}
            </label>
            <textarea
              id="refund-update-notes"
              rows={3}
              required={nextStatus === 'rejected'}
              value={updateNotes}
              onChange={(e) => setUpdateNotes(e.target.value)}
              placeholder={
                nextStatus === 'rejected'
                  ? 'Wajib diisi alasan penolakan dari supplier minimal 5 karakter...'
                  : 'Catatan persetujuan / bukti transfer refund...'
              }
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-[#3243DD] focus:outline-none focus:ring-2 focus:ring-[#3243DD]/20"
            />
            {feedback?.fieldErrors?.refundNotes && (
              <p className="mt-1 text-xs font-medium text-red-600">
                {feedback.fieldErrors.refundNotes}
              </p>
            )}
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button
              variant="secondary"
              onClick={() => setShowUpdateModal(false)}
              disabled={isPending}
            >
              Batal
            </Button>
            <Button type="submit" loading={isPending}>
              Simpan Status Refund
            </Button>
          </div>
        </form>
      </Modal>
    </>
  );
}
