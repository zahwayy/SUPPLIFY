'use client';

import { useActionState, useState, useTransition } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  ExternalLink,
  Info,
  Truck,
} from 'lucide-react';
import {
  approveIncomingAction,
  rejectIncomingAction,
  cancelIncomingAction,
} from '../../modules/incoming/incomingActions.js';
import { formatCurrencyIDR, formatDate, formatDateTime } from '../../lib/utils/format.js';
import {
  getConditionMeta,
  getIncomingDiscrepancyActionLabel,
  INCOMING_DISCREPANCY_ACTION_LABELS,
} from '../../lib/utils/labels.js';
import PageHeader from '../shared/PageHeader.jsx';
import StatusPill from '../shared/StatusPill.jsx';
import FeedbackBanner from '../shared/FeedbackBanner.jsx';
import WorkflowStepper from '../shared/WorkflowStepper.jsx';
import EvidencePanel from '../shared/EvidencePanel.jsx';
import Button from '../ui/Button.jsx';
import Badge from '../ui/Badge.jsx';
import Modal from '../ui/Modal.jsx';
import Dialog from '../ui/Dialog.jsx';
import { useToast } from '../ui/ToastProvider.jsx';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/Card.jsx';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '../ui/Table.jsx';

const emptyActionState = { ok: false, error: null, message: '', fieldErrors: null };

function buildIncomingSteps(status) {
  const isApproved = status === 'approved';
  return [
    {
      key: 'inspection',
      label: 'Pemeriksaan Fisik Staff',
      sublabel: 'Hasil pemeriksaan tercatat',
    },
    {
      key: 'pending',
      label: 'Pemeriksaan & Persetujuan Manager',
      sublabel: isApproved
        ? 'Keputusan telah ditetapkan'
        : 'Tinjau jumlah barang yang akan diterima',
    },
    {
      key: 'approved',
      label: 'Penerimaan Disetujui',
      sublabel: isApproved
        ? 'Pesanan diterima dan stok masuk'
        : 'Menunggu persetujuan Manager',
    },
  ];
}

export default function IncomingDetailView({
  tx,
  items,
  evidence,
  arrivalEvidence = [],
  canApprove,
  canUploadEvidence,
  isCreator,
}) {
  const toast = useToast();
  const [feedback, setFeedback] = useState(null);
  const [showApproveDialog, setShowApproveDialog] = useState(false);
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [showDiscrepancySummaryModal, setShowDiscrepancySummaryModal] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');
  const [supplierFollowupNotes, setSupplierFollowupNotes] = useState(
    tx.supplier_followup_notes || ''
  );
  const [isMutating, startTransition] = useTransition();

  // Manager per-product Accepted Quantity review decisions
  const [reviewMap, setReviewMap] = useState(() => {
    const initial = {};
    for (const it of items) {
      const receivedQty = Number(it.quantity);
      const orderedQty =
        it.ordered_quantity !== null && it.ordered_quantity !== undefined
          ? Number(it.ordered_quantity)
          : receivedQty;
      const goodQty =
        it.good_quantity !== null && it.good_quantity !== undefined
          ? Number(it.good_quantity)
          : ['damaged', 'wrong_item'].includes(it.condition_status)
          ? 0
          : receivedQty;
      const maxAccepted = Math.min(receivedQty, orderedQty);
      const initialAccepted = Math.min(goodQty, maxAccepted);
      const damagedQty = Number(it.damaged_quantity || 0);

      let defaultAction = it.discrepancy_action || 'none';
      if (defaultAction === 'none' || defaultAction === 'accept_excess') {
        if (damagedQty > 0) defaultAction = 'reject_damaged';
        else if (initialAccepted < orderedQty) defaultAction = 'refund_claim';
        else defaultAction = 'none';
      }

      initial[it.product_id] = {
        approvedQuantity: String(
          it.approved_quantity !== null && it.approved_quantity !== undefined
            ? it.approved_quantity
            : initialAccepted
        ),
        discrepancyAction: defaultAction,
        managerNotes: it.manager_notes || '',
      };
    }
    return initial;
  });

  const [rejectState, rejectAction, isRejecting] = useActionState(
    async (prev, fd) => {
      const res = await rejectIncomingAction(prev, fd);
      if (res.ok) {
        setShowRejectModal(false);
        setRejectionReason('');
        setFeedback({ type: 'success', text: res.message });
      } else if (res?.error) {
        toast.error(res.error);
      }
      return res;
    },
    emptyActionState
  );

  const isReviewMode = canApprove && tx.status === 'pending';

  const totalActualUnits = items.reduce((sum, it) => sum + Number(it.quantity || 0), 0);
  const totalGoodUnits = items.reduce(
    (sum, it) =>
      sum +
      Number(
        it.good_quantity !== null && it.good_quantity !== undefined
          ? it.good_quantity
          : it.quantity
      ),
    0
  );
  const totalDamagedUnits = items.reduce(
    (sum, it) => sum + Number(it.damaged_quantity || 0),
    0
  );

  const totalPlannedApproved = isReviewMode
    ? items.reduce((sum, it) => {
        const val = Number(reviewMap[it.product_id]?.approvedQuantity);
        return sum + (Number.isInteger(val) && val >= 0 ? val : 0);
      }, 0)
    : items.reduce((sum, it) => sum + Number(it.approved_quantity || 0), 0);

  const hasInvalidReviewQty =
    isReviewMode &&
    items.some((it) => {
      const raw = reviewMap[it.product_id]?.approvedQuantity;
      if (raw === '' || raw === null || raw === undefined) return true;
      const val = Number(raw);
      const orderedCap =
        it.ordered_quantity !== null && it.ordered_quantity !== undefined
          ? Number(it.ordered_quantity)
          : Number(it.quantity);
      const maxCap = Math.min(Number(it.quantity), orderedCap);
      return !Number.isInteger(val) || val < 0 || val > maxCap;
    });

  const totalPlannedDiscrepancy = items.reduce((sum, it) => {
    const orderedCap =
      it.ordered_quantity !== null && it.ordered_quantity !== undefined
        ? Number(it.ordered_quantity)
        : Number(it.quantity);
    const val = isReviewMode
      ? Number(reviewMap[it.product_id]?.approvedQuantity || 0)
      : Number(it.approved_quantity || 0);
    return sum + Math.max(0, orderedCap - (Number.isFinite(val) ? val : 0));
  }, 0);

  const issueItems = items
    .map((it) => {
      const orderedCap =
        it.ordered_quantity !== null && it.ordered_quantity !== undefined
          ? Number(it.ordered_quantity)
          : Number(it.quantity);
      const goodQty =
        it.good_quantity !== null && it.good_quantity !== undefined
          ? Number(it.good_quantity)
          : Number(it.quantity);
      const damagedQty = Number(it.damaged_quantity || 0);
      const plannedAccepted = isReviewMode
        ? Number(reviewMap[it.product_id]?.approvedQuantity || 0)
        : Number(it.approved_quantity || 0);
      const itemDiscrepancy = Math.max(
        0,
        orderedCap - (Number.isFinite(plannedAccepted) ? plannedAccepted : 0)
      );
      const hasItemIssue =
        damagedQty > 0 ||
        itemDiscrepancy > 0 ||
        (it.condition_status && it.condition_status !== 'good');

      if (!hasItemIssue) return null;
      return {
        item: it,
        orderedCap,
        goodQty,
        damagedQty,
        plannedAccepted: Number.isFinite(plannedAccepted) ? plannedAccepted : 0,
        itemDiscrepancy,
        condMeta: getConditionMeta(it.condition_status || 'good'),
      };
    })
    .filter(Boolean);

  const hasIssueItems =
    totalDamagedUnits > 0 ||
    totalPlannedDiscrepancy > 0 ||
    issueItems.length > 0;

  function handleApprove() {
    startTransition(async () => {
      const payload = {
        items: items.map((it) => {
          const r = reviewMap[it.product_id] || {};
          return {
            productId: Number(it.product_id),
            approvedQuantity: Number(r.approvedQuantity),
            discrepancyAction: r.discrepancyAction || 'none',
            managerNotes: r.managerNotes || null,
          };
        }),
        supplierFollowupNotes: supplierFollowupNotes.trim() || null,
      };
      const res = await approveIncomingAction(tx.id, payload);
      if (res.ok) {
        setShowApproveDialog(false);
        setFeedback({ type: 'success', text: res.message });
      } else {
        setFeedback({ type: 'error', text: res.error });
      }
    });
  }

  function handleCancel() {
    startTransition(async () => {
      const res = await cancelIncomingAction(tx.id);
      if (res.ok) {
        setShowCancelDialog(false);
        setFeedback({ type: 'success', text: res.message });
      } else {
        setFeedback({ type: 'error', text: res.error });
      }
    });
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title={`Incoming ${tx.transaction_code}`}
        description={`Referensi ${tx.po_code} • ${tx.supplier_name} • Diperiksa oleh ${tx.created_by_name}`}
        breadcrumbs={[
          { label: 'Dashboard', href: '/dashboard' },
          { label: 'Incoming', href: '/incoming' },
          { label: tx.transaction_code },
        ]}
        badge={<StatusPill status={tx.status} />}
        actions={
          <div className="flex flex-wrap gap-2">
            <Link
              href="/incoming"
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs sm:text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
            >
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              Kembali
            </Link>

            {isReviewMode && (
              <>
                <Button
                  variant="primary"
                  disabled={hasInvalidReviewQty || totalPlannedApproved <= 0}
                  onClick={() => setShowApproveDialog(true)}
                >
                  <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                  Setujui Penerimaan ({totalPlannedApproved} unit)
                </Button>
                <Button variant="danger" onClick={() => setShowRejectModal(true)}>
                  <XCircle className="h-4 w-4" aria-hidden="true" />
                  Tolak Penerimaan
                </Button>
              </>
            )}

            {isCreator && tx.status === 'pending' && (
              <Button variant="secondary" onClick={() => setShowCancelDialog(true)}>
                Batalkan Pengajuan
              </Button>
            )}
          </div>
        }
      />

      <WorkflowStepper
        steps={buildIncomingSteps(tx.status)}
        currentKey={tx.status === 'approved' ? 'approved' : 'pending'}
        terminalStatus={
          tx.status === 'rejected' || tx.status === 'cancelled' ? tx.status : null
        }
        terminalLabel={
          tx.status === 'rejected'
            ? 'Penerimaan ditolak — pesanan dikembalikan dan stok tidak berubah'
            : 'Laporan penerimaan dibatalkan — stok tidak berubah'
        }
      />

      <FeedbackBanner feedback={feedback} onDismiss={() => setFeedback(null)} />

      {/* Manager Review Context Banner */}
      {isReviewMode && (
        <div
          className={`rounded-xl border px-4 py-3.5 text-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
            hasIssueItems
              ? 'border-amber-200 bg-amber-50 text-amber-950'
              : 'border-[#3243DD]/20 bg-[#EEF1FD]/70 text-slate-900'
          }`}
        >
          <div className="flex items-start gap-2.5">
            {hasIssueItems ? (
              <AlertTriangle className="h-4 w-4 mt-0.5 text-amber-600 shrink-0" />
            ) : (
              <Info className="h-4 w-4 mt-0.5 text-[#3243DD] shrink-0" />
            )}
            <div className="text-xs sm:text-sm leading-relaxed">
              <p className="font-semibold">
                {hasIssueItems
                  ? 'Perlu Tinjauan pada Hasil Pemeriksaan'
                  : 'Hasil Pemeriksaan Sesuai Pesanan'}
              </p>
              <p className="text-xs opacity-90 mt-0.5">
                {hasIssueItems
                  ? 'Staff menemukan selisih jumlah atau barang yang tidak memenuhi kondisi penerimaan. Tinjau hasil inspeksi sebelum menyetujui penerimaan.'
                  : 'Seluruh barang diterima dalam kondisi baik. Pastikan jumlah yang diterima sudah sesuai sebelum menyetujui penerimaan.'}
              </p>
              <p className="text-xs opacity-85 mt-1 tabular-nums">
                {hasIssueItems ? (
                  <>
                    Diperiksa: <strong>{totalActualUnits} unit</strong> • Layak diterima:{' '}
                    <strong>{totalGoodUnits}</strong> • Bermasalah:{' '}
                    <strong>{totalDamagedUnits}</strong> • Rencana diterima:{' '}
                    <strong className="text-[#3243DD]">{totalPlannedApproved} unit</strong>
                    {totalPlannedDiscrepancy > 0 && (
                      <>
                        {' '}• Selisih:{' '}
                        <strong className="text-red-700">{totalPlannedDiscrepancy} unit</strong>
                      </>
                    )}
                  </>
                ) : (
                  <>
                    Diperiksa: <strong>{totalActualUnits} unit</strong> • Layak diterima:{' '}
                    <strong>{totalGoodUnits}</strong> • Akan masuk stok:{' '}
                    <strong className="text-[#3243DD]">{totalPlannedApproved} unit</strong>
                  </>
                )}
              </p>
            </div>
          </div>
          {hasIssueItems && (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="shrink-0 border-amber-300 bg-white text-amber-900 hover:bg-amber-100/60"
              onClick={() => setShowDiscrepancySummaryModal(true)}
            >
              Tinjau Ketidaksesuaian
            </Button>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader className="flex flex-wrap items-center justify-between gap-2">
              <CardTitle>Hasil Pemeriksaan &amp; Persetujuan Produk ({items.length} SKU)</CardTitle>
              <span className="text-xs font-semibold text-slate-600 tabular-nums">
                Fisik: {totalActualUnits} • Baik: {totalGoodUnits} • Bermasalah:{' '}
                {totalDamagedUnits}
                {tx.status === 'approved' ? ` • Disetujui: ${totalPlannedApproved}` : ''}
              </span>
            </CardHeader>
            <CardContent className="p-0 sm:p-5 space-y-4">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Produk &amp; PO Qty</TableHead>
                    <TableHead>Pemeriksaan Staff</TableHead>
                    <TableHead>Kondisi</TableHead>
                    <TableHead>
                      {isReviewMode ? 'Jumlah Diterima (Accepted Qty)' : 'Accepted Qty'}
                    </TableHead>
                    <TableHead>Selisih</TableHead>
                    <TableHead>Catatan &amp; Tindak Lanjut</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((it) => {
                    const condMeta = getConditionMeta(it.condition_status || 'good');
                    const goodQty =
                      it.good_quantity !== null && it.good_quantity !== undefined
                        ? Number(it.good_quantity)
                        : Number(it.quantity);
                    const damagedQty = Number(it.damaged_quantity || 0);
                    const orderedCap =
                      it.ordered_quantity !== null && it.ordered_quantity !== undefined
                        ? Number(it.ordered_quantity)
                        : Number(it.quantity);
                    const maxCap = Math.min(Number(it.quantity), orderedCap);
                    const review = reviewMap[it.product_id] || {
                      approvedQuantity: String(Math.min(goodQty, maxCap)),
                      discrepancyAction: 'none',
                      managerNotes: '',
                    };
                    const plannedNum = Number(review.approvedQuantity);
                    const isInvalid =
                      isReviewMode &&
                      (review.approvedQuantity === '' ||
                        !Number.isInteger(plannedNum) ||
                        plannedNum < 0 ||
                        plannedNum > maxCap);
                    const itemDiscrepancy = Math.max(
                      0,
                      orderedCap -
                        (isReviewMode
                          ? Number.isFinite(plannedNum)
                            ? plannedNum
                            : 0
                          : Number(it.approved_quantity || 0))
                    );
                    const showDiscrepancyControls =
                      isReviewMode &&
                      (damagedQty > 0 ||
                        plannedNum < orderedCap ||
                        it.condition_status !== 'good');

                    return (
                      <TableRow key={it.id}>
                        <TableCell>
                          <Link
                            href={`/products/${it.product_id}`}
                            className="font-semibold text-slate-900 hover:text-[#3243DD]"
                          >
                            {it.product_name}
                          </Link>
                          <p className="font-mono text-xs text-[#3243DD]">
                            {it.sku}
                            {it.rack_location ? (
                              <span className="ml-2 font-sans text-[11px] font-medium text-slate-500">
                                • Rak: {it.rack_location}
                              </span>
                            ) : null}
                          </p>
                          <p className="mt-1 text-[11px] text-slate-500 tabular-nums">
                            PO Qty: <strong>{it.ordered_quantity ?? '—'}</strong>
                            {it.unit_price !== null && it.unit_price !== undefined && (
                              <span> • {formatCurrencyIDR(it.unit_price)}/{it.unit || 'unit'}</span>
                            )}
                          </p>
                        </TableCell>

                        <TableCell className="text-xs tabular-nums whitespace-nowrap">
                          <p className="font-bold text-slate-900">
                            Fisik: {it.quantity} {it.unit || ''}
                          </p>
                          <p className="text-emerald-700">Baik: {goodQty}</p>
                          {damagedQty > 0 && (
                            <p className="font-semibold text-red-700">
                              Rusak/Masalah: {damagedQty}
                            </p>
                          )}
                        </TableCell>

                        <TableCell>
                          <Badge tone={condMeta.tone}>{condMeta.label}</Badge>
                          {it.notes && (
                            <p className="mt-1 text-[11px] text-slate-600 max-w-[160px]">
                              {it.notes}
                            </p>
                          )}
                        </TableCell>

                        <TableCell className="tabular-nums">
                          {isReviewMode ? (
                            <div className="w-28">
                              <input
                                type="number"
                                min="0"
                                max={maxCap}
                                step="1"
                                aria-label={`Accepted Quantity untuk ${it.sku}`}
                                value={review.approvedQuantity}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setReviewMap((prev) => ({
                                    ...prev,
                                    [it.product_id]: {
                                      ...prev[it.product_id],
                                      approvedQuantity: val,
                                    },
                                  }));
                                }}
                                className={`w-full rounded-lg border px-2.5 py-1.5 text-sm font-bold tabular-nums focus:outline-none ${
                                  isInvalid
                                    ? 'border-red-400 bg-red-50 text-red-700'
                                    : 'border-[#3243DD]/50 bg-white text-[#3243DD] focus:border-[#3243DD]'
                                }`}
                              />
                              <p className="mt-0.5 text-[10px] text-slate-500">
                                Maks: {maxCap} {it.unit || ''}
                              </p>
                            </div>
                          ) : tx.status === 'approved' ? (
                            <span className="font-bold text-emerald-700">
                              +{it.approved_quantity ?? it.quantity} {it.unit || ''}
                            </span>
                          ) : (
                            <span className="text-xs text-slate-400">
                              Usulan baik: {goodQty}
                            </span>
                          )}
                        </TableCell>

                        <TableCell className="text-xs tabular-nums whitespace-nowrap">
                          {tx.status === 'rejected' || tx.status === 'cancelled' ? (
                            <span className="text-slate-400">—</span>
                          ) : itemDiscrepancy > 0 ? (
                            <Badge tone="danger">
                              {itemDiscrepancy} {it.unit || 'unit'}
                            </Badge>
                          ) : (
                            <span className="text-emerald-700 font-medium">0</span>
                          )}
                        </TableCell>

                        <TableCell className="text-xs text-slate-600">
                          {isReviewMode ? (
                            showDiscrepancyControls ? (
                              <div className="space-y-1.5 min-w-[180px]">
                                <select
                                  aria-label={`Tindak lanjut untuk ${it.sku}`}
                                  value={review.discrepancyAction}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    setReviewMap((prev) => ({
                                      ...prev,
                                      [it.product_id]: {
                                        ...prev[it.product_id],
                                        discrepancyAction: val,
                                      },
                                    }));
                                  }}
                                  className="w-full rounded-lg border border-slate-300 bg-white px-2 py-1 text-xs focus:border-[#3243DD] focus:outline-none"
                                >
                                  {Object.entries(INCOMING_DISCREPANCY_ACTION_LABELS)
                                    .filter(([val]) => val !== 'accept_excess')
                                    .map(([val, lbl]) => (
                                      <option key={val} value={val}>
                                        {lbl}
                                      </option>
                                    ))}
                                </select>
                                <input
                                  type="text"
                                  value={review.managerNotes}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    setReviewMap((prev) => ({
                                      ...prev,
                                      [it.product_id]: {
                                        ...prev[it.product_id],
                                        managerNotes: val,
                                      },
                                    }));
                                  }}
                                  placeholder="Catatan review (opsional)..."
                                  className="w-full rounded-lg border border-slate-300 bg-white px-2 py-1 text-xs focus:border-[#3243DD] focus:outline-none"
                                />
                              </div>
                            ) : (
                              <span className="text-emerald-700 font-medium">Sesuai pesanan</span>
                            )
                          ) : (
                            <div className="space-y-1">
                              {it.discrepancy_action && it.discrepancy_action !== 'none' && (
                                <p className="font-semibold text-amber-800">
                                  {getIncomingDiscrepancyActionLabel(it.discrepancy_action)}
                                </p>
                              )}
                              {it.manager_notes && (
                                <p className="text-slate-700">{it.manager_notes}</p>
                              )}
                              {!it.manager_notes &&
                                (!it.discrepancy_action ||
                                  it.discrepancy_action === 'none') && <span>—</span>}
                            </div>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>

              {/* Manager Follow-up Message to Supplier (optional, visible on Supplier PO page) */}
              {isReviewMode && (
                <div className="px-4 sm:px-0 pt-2 border-t border-slate-100">
                  <label
                    htmlFor="supplier-followup-notes"
                    className="block text-xs font-semibold text-slate-700 mb-1"
                  >
                    Catatan untuk Supplier (Opsional)
                  </label>
                  <textarea
                    id="supplier-followup-notes"
                    rows={2}
                    value={supplierFollowupNotes}
                    onChange={(e) => setSupplierFollowupNotes(e.target.value)}
                    placeholder="Contoh: 10 unit rusak tidak diterima. Mohon proses klaim atau koordinasi pengiriman terpisah."
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs sm:text-sm focus:border-[#3243DD] focus:outline-none focus:ring-2 focus:ring-[#3243DD]/20"
                  />
                </div>
              )}
            </CardContent>
          </Card>

          {/* Staff Inspection Photos */}
          <EvidencePanel
            entityType="incoming_inspection"
            entityId={tx.id}
            files={evidence}
            title="Bukti Pemeriksaan Fisik (Staff)"
            helperNote="Unggah foto kondisi kemasan, barang baik, atau barang rusak/bermasalah saat status masih Pending."
            canUpload={canUploadEvidence && tx.status === 'pending'}
            canDelete={canUploadEvidence && tx.status === 'pending'}
          />

          {/* Supplier Arrival Proof Photos (Read-only context for Manager & Staff) */}
          {arrivalEvidence.length > 0 && (
            <EvidencePanel
              entityType="supplier_arrival"
              entityId={tx.purchase_order_id}
              files={arrivalEvidence}
              title="Foto Bukti Kedatangan dari Supplier (Referensi Awal)"
              helperNote="Foto yang dikirimkan Supplier saat mengonfirmasi kedatangan barang pada PO terkait."
              canUpload={false}
              canDelete={false}
            />
          )}
        </div>

        <aside className="space-y-5">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Detail PO &amp; Pemrosesan</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3.5 text-xs">
              <div>
                <p className="text-slate-500">Referensi Purchase Order</p>
                <div className="mt-0.5 flex items-center justify-between gap-2">
                  <Link
                    href={`/purchase-orders/${tx.purchase_order_id}`}
                    className="inline-flex items-center gap-1 font-mono font-semibold text-[#3243DD] hover:underline"
                  >
                    {tx.po_code}
                    <ExternalLink className="h-3 w-3" aria-hidden="true" />
                  </Link>
                  <StatusPill status={tx.po_status} />
                </div>
                {tx.po_order_date && (
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Tanggal PO: {formatDate(tx.po_order_date)}
                  </p>
                )}
              </div>
              <div>
                <p className="text-slate-500">Supplier</p>
                <p className="mt-0.5 font-semibold text-slate-900">{tx.supplier_name}</p>
              </div>
              {tx.courier_name && (
                <div>
                  <p className="text-slate-500 flex items-center gap-1">
                    <Truck className="h-3.5 w-3.5" aria-hidden="true" />
                    Pengiriman
                  </p>
                  <p className="mt-0.5 font-medium text-slate-800">
                    {tx.courier_name}
                    {tx.tracking_number ? ` • ${tx.tracking_number}` : ''}
                  </p>
                </div>
              )}
              <div>
                <p className="text-slate-500">Diperiksa Oleh (Staff)</p>
                <p className="mt-0.5 font-semibold text-slate-900">
                  {tx.created_by_name}
                </p>
                <p className="text-slate-500 tabular-nums">
                  {formatDateTime(tx.transaction_date)}
                </p>
              </div>
              {tx.processed_by_name && (
                <div className="pt-2 border-t border-slate-100">
                  <p className="text-slate-500">
                    {tx.status === 'approved' ? 'Disetujui Oleh (Manager)' : 'Diproses Oleh'}
                  </p>
                  <p className="mt-0.5 font-semibold text-slate-900">
                    {tx.processed_by_name}
                  </p>
                  <p className="text-slate-500 tabular-nums">
                    {formatDateTime(tx.processed_at)}
                  </p>
                </div>
              )}
              {tx.notes && (
                <div className="pt-2 border-t border-slate-100">
                  <p className="text-slate-500">Catatan Pemeriksaan Staff</p>
                  <p className="mt-0.5 text-slate-700 leading-relaxed">{tx.notes}</p>
                </div>
              )}
              {tx.rejection_reason && (
                <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-red-800">
                  <p className="font-semibold">Alasan Penolakan:</p>
                  <p className="mt-1 leading-relaxed">{tx.rejection_reason}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {tx.status === 'approved' && (
            <Card>
              <CardContent className="p-4 text-xs space-y-2">
                <p className="font-semibold text-emerald-800">
                  Pesanan Diterima &amp; Stok Masuk
                </p>
                <p className="text-slate-600 leading-relaxed">
                  Sebanyak <strong>{totalPlannedApproved} unit</strong> telah ditambahkan ke
                  persediaan gudang dan dicatat pada pergerakan stok.
                </p>
                <div className="flex flex-col gap-1.5 pt-1">
                  {(totalPlannedDiscrepancy > 0 || totalDamagedUnits > 0) && (
                    <Link
                      href={`/discrepancies?search=${encodeURIComponent(tx.transaction_code)}`}
                      className="inline-flex items-center gap-1 font-semibold text-amber-800 hover:underline"
                    >
                      Lihat Detail Ketidaksesuaian
                    </Link>
                  )}
                  <Link
                    href={`/stock-movements?search=${encodeURIComponent(tx.transaction_code)}`}
                    className="inline-flex items-center gap-1 font-semibold text-[#3243DD] hover:underline"
                  >
                    Lihat Pergerakan Stok
                  </Link>
                </div>
              </CardContent>
            </Card>
          )}
          {canApprove && tx.status === 'rejected' && (
            <Card>
              <CardContent className="p-4 text-xs space-y-2">
                <p className="font-semibold text-red-800">
                  Penerimaan Ditolak
                </p>
                <p className="text-slate-600 leading-relaxed">
                  Pesanan dikembalikan tanpa menambah stok gudang. Jika barang masih
                  dibutuhkan, buat PO baru secara terpisah.
                </p>
                <Link
                  href={`/restock-orders?referencePoId=${tx.purchase_order_id}&supplierId=${tx.supplier_id || ''}`}
                  className="inline-flex items-center gap-1 font-semibold text-[#3243DD] hover:underline"
                >
                  Buat PO Baru
                </Link>
              </CardContent>
            </Card>
          )}
        </aside>
      </div>

      {/* Read-only Staff Inspection & Discrepancy Review Modal (Manager Review) */}
      <Modal
        open={showDiscrepancySummaryModal}
        onClose={() => setShowDiscrepancySummaryModal(false)}
        title="Ringkasan Ketidaksesuaian Hasil Pemeriksaan"
        description="Data hasil pemeriksaan fisik oleh Staff untuk pertimbangan sebelum keputusan persetujuan."
        maxWidthClass="max-w-3xl"
      >
        <div className="space-y-4">
          {issueItems.length > 0 ? (
            <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
              {issueItems.map(
                ({
                  item: it,
                  orderedCap,
                  goodQty,
                  damagedQty,
                  plannedAccepted,
                  itemDiscrepancy,
                  condMeta,
                }) => (
                  <div
                    key={it.id}
                    className="rounded-xl border border-slate-200 bg-[#F4F5F8]/70 p-3.5 space-y-2.5 text-xs"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <p className="font-semibold text-sm text-slate-900">
                          {it.product_name}
                        </p>
                        <p className="font-mono text-xs text-[#3243DD]">{it.sku}</p>
                      </div>
                      <Badge tone={condMeta.tone}>{condMeta.label}</Badge>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-6 gap-2 rounded-lg bg-white border border-slate-200/80 p-2.5 tabular-nums">
                      <div>
                        <span className="block text-[11px] text-slate-500">Pesanan PO</span>
                        <strong className="text-slate-900">
                          {orderedCap} {it.unit || ''}
                        </strong>
                      </div>
                      <div>
                        <span className="block text-[11px] text-slate-500">Fisik Datang</span>
                        <strong className="text-slate-900">
                          {it.quantity} {it.unit || ''}
                        </strong>
                      </div>
                      <div>
                        <span className="block text-[11px] text-slate-500">Layak Diterima</span>
                        <strong className="text-emerald-700">
                          {goodQty} {it.unit || ''}
                        </strong>
                      </div>
                      <div>
                        <span className="block text-[11px] text-slate-500">Bermasalah</span>
                        <strong className={damagedQty > 0 ? 'text-red-700' : 'text-slate-600'}>
                          {damagedQty} {it.unit || ''}
                        </strong>
                      </div>
                      <div>
                        <span className="block text-[11px] text-slate-500">Rencana Accepted</span>
                        <strong className="text-[#3243DD]">
                          {plannedAccepted} {it.unit || ''}
                        </strong>
                      </div>
                      <div>
                        <span className="block text-[11px] text-slate-500">Selisih</span>
                        <strong className={itemDiscrepancy > 0 ? 'text-red-700' : 'text-slate-600'}>
                          {itemDiscrepancy} {it.unit || ''}
                        </strong>
                      </div>
                    </div>

                    {it.notes && (
                      <p className="text-slate-700 leading-relaxed">
                        <span className="font-semibold text-slate-800">Catatan Staff:</span>{' '}
                        {it.notes}
                      </p>
                    )}
                  </div>
                )
              )}
            </div>
          ) : (
            <p className="text-sm text-slate-600">
              Tidak ditemukan selisih atau barang bermasalah pada item yang diperiksa.
            </p>
          )}

          {(tx.notes || evidence.length > 0) && (
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-1.5 text-xs text-slate-700">
              {tx.notes && (
                <p>
                  <span className="font-semibold text-slate-900">Catatan Umum Pemeriksaan:</span>{' '}
                  {tx.notes}
                </p>
              )}
              <p>
                <span className="font-semibold text-slate-900">Bukti Foto Pemeriksaan:</span>{' '}
                {evidence.length > 0
                  ? `${evidence.length} file terlampir pada bagian Bukti Pemeriksaan Fisik di halaman ini.`
                  : 'Belum ada foto bukti pemeriksaan yang dilampirkan Staff.'}
              </p>
            </div>
          )}

          <div className="flex justify-end pt-2 border-t border-slate-100">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setShowDiscrepancySummaryModal(false)}
            >
              Tutup
            </Button>
          </div>
        </div>
      </Modal>

      <Dialog
        open={showApproveDialog}
        onClose={() => setShowApproveDialog(false)}
        onConfirm={handleApprove}
        title="Konfirmasi Persetujuan Penerimaan"
        message={
          totalPlannedDiscrepancy > 0
            ? `Setujui penerimaan ${tx.transaction_code} untuk PO ${tx.po_code}? Sebanyak ${totalPlannedApproved} unit akan ditambahkan ke stok gudang, sedangkan ${totalPlannedDiscrepancy} unit selisih tidak masuk stok dan tercatat pada daftar ketidaksesuaian.`
            : `Setujui penerimaan ${tx.transaction_code} untuk PO ${tx.po_code}? Sebanyak ${totalPlannedApproved} unit akan ditambahkan ke stok gudang dan status pesanan diperbarui menjadi Diterima.`
        }
        confirmLabel="Setujui & Tambah Stok"
        confirmVariant="primary"
        loading={isMutating}
      />

      <Dialog
        open={showCancelDialog}
        onClose={() => setShowCancelDialog(false)}
        onConfirm={handleCancel}
        title="Batalkan Laporan Pemeriksaan"
        message={`Membatalkan ${tx.transaction_code} tidak mengubah stok gudang. Setelah dibatalkan, pemeriksaan fisik untuk PO ${tx.po_code} dapat diajukan kembali.`}
        confirmLabel="Batalkan Pengajuan"
        confirmVariant="danger"
        loading={isMutating}
      />

      <Modal
        open={showRejectModal}
        onClose={() => setShowRejectModal(false)}
        title={`Tolak Penerimaan ${tx.transaction_code}`}
        description="Penolakan akan mengembalikan status PO dan tidak menambah stok gudang. Sertakan alasan agar Staff dapat menindaklanjuti."
      >
        <form action={rejectAction} className="space-y-4">
          <input type="hidden" name="txId" value={tx.id} />
          {rejectState.error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-700">
              {rejectState.error}
            </div>
          )}
          <div>
            <label
              htmlFor="inc-reject-reason"
              className="block text-xs sm:text-sm font-medium text-slate-700 mb-1.5"
            >
              Alasan Penolakan <span className="text-[#FF3D8B]">*</span>
            </label>
            <textarea
              id="inc-reject-reason"
              name="rejectionReason"
              rows={3}
              required
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              placeholder="Contoh: Seluruh barang diterima dalam kondisi rusak sehingga ditolak untuk masuk stok."
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-[#3243DD] focus:outline-none focus:ring-2 focus:ring-[#3243DD]/20"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <Button
              variant="secondary"
              onClick={() => setShowRejectModal(false)}
              disabled={isRejecting}
            >
              Batal
            </Button>
            <Button type="submit" variant="danger" loading={isRejecting}>
              Tolak Penerimaan
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
