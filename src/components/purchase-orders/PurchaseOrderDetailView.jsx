'use client';

import { useActionState, useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  CheckCircle2,
  XCircle,
  Truck,
  PackageCheck,
  ArrowDownToLine,
  ExternalLink,
  Info,
  BellRing,
  AlertTriangle,
  MapPin,
} from 'lucide-react';
import {
  confirmPoAction,
  rejectPoAction,
  submitShipmentAction,
  confirmArrivalAction,
  notifyStaffForInspectionAction,
  cancelPoAction,
} from '../../modules/purchase-orders/poActions.js';
import { ROLES } from '../../lib/constants/roles.js';
import { formatCurrencyIDR, formatDate, formatDateTime } from '../../lib/utils/format.js';
import PageHeader from '../shared/PageHeader.jsx';
import StatusPill from '../shared/StatusPill.jsx';
import FeedbackBanner from '../shared/FeedbackBanner.jsx';
import WorkflowStepper from '../shared/WorkflowStepper.jsx';
import EvidencePanel from '../shared/EvidencePanel.jsx';
import Button from '../ui/Button.jsx';
import Input from '../ui/Input.jsx';
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

function buildPoSteps(status) {
  const isReceived = ['received', 'completed'].includes(status);
  return [
    { key: 'pending', label: 'Pesanan Dibuat', sublabel: 'Menunggu konfirmasi Supplier' },
    { key: 'confirmed', label: 'Dikonfirmasi', sublabel: 'Pesanan disiapkan Supplier' },
    { key: 'in_transit', label: 'Dalam Pengiriman', sublabel: 'Menuju gudang Supplify' },
    { key: 'inspecting', label: 'Pemeriksaan Fisik', sublabel: 'Pengecekan barang oleh Staff' },
    {
      key: 'received',
      label: 'Pesanan Diterima',
      sublabel: isReceived
        ? 'Pesanan diterima dan stok masuk'
        : 'Menunggu persetujuan penerimaan',
    },
  ];
}

function mapStepKey(status) {
  if (['processing', 'preparing', 'confirmed'].includes(status)) return 'confirmed';
  if (status === 'delivered') return 'in_transit';
  if (['received', 'completed'].includes(status)) return 'received';
  return status;
}

export default function PurchaseOrderDetailView({
  po,
  items,
  evidence,
  arrivalEvidence = [],
  incomings = [],
  user,
}) {
  const router = useRouter();
  const toast = useToast();
  const [feedback, setFeedback] = useState(null);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [showShipmentModal, setShowShipmentModal] = useState(false);
  const [showArrivalModal, setShowArrivalModal] = useState(false);
  const [showNotifyStaffModal, setShowNotifyStaffModal] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState(null);

  const [rejectionReason, setRejectionReason] = useState('');
  const [arrivalNotes, setArrivalNotes] = useState(po.arrival_notes || '');
  const [arrivalPhoto, setArrivalPhoto] = useState(null);
  const [arrivalPhotoError, setArrivalPhotoError] = useState(null);
  const [inspectionNotes, setInspectionNotes] = useState(po.inspection_request_notes || '');

  const [shipForm, setShipForm] = useState({
    courierName: po.courier_name || '',
    trackingNumber: po.tracking_number || '',
    noTrackingReason: po.no_tracking_reason || '',
    shippedAt: po.shipped_at
      ? new Date(po.shipped_at).toISOString().slice(0, 16)
      : new Date().toISOString().slice(0, 16),
    notes: po.shipment_notes || '',
  });
  const [isMutating, startTransition] = useTransition();

  const [rejectState, rejectAction, isRejecting] = useActionState(
    async (prev, fd) => {
      const res = await rejectPoAction(prev, fd);
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

  const [shipState, shipAction, isShipping] = useActionState(
    async (prev, fd) => {
      const res = await submitShipmentAction(prev, fd);
      if (res.ok) {
        setShowShipmentModal(false);
        setFeedback({ type: 'success', text: res.message });
      } else if (res?.error) {
        toast.error(res.error);
      }
      return res;
    },
    emptyActionState
  );

  const [arrivalState, arrivalAction, isConfirmingArrival] = useActionState(
    async (prev, fd) => {
      setArrivalPhotoError(null);
      const res = await confirmArrivalAction(prev, fd);
      if (!res.ok) {
        if (res?.error) toast.error(res.error);
        return res;
      }

      let uploadWarning = '';
      if (arrivalPhoto) {
        try {
          const uploadFd = new FormData();
          uploadFd.append('entityType', 'supplier_arrival');
          uploadFd.append('entityId', String(po.id));
          uploadFd.append(
            'description',
            arrivalNotes.trim() || 'Foto bukti kedatangan barang dari Supplier'
          );
          uploadFd.append('file', arrivalPhoto);
          const upRes = await fetch('/api/evidence', { method: 'POST', body: uploadFd });
          const upData = await upRes.json();
          if (!upRes.ok || !upData.ok) {
            uploadWarning = ` (Foto bukti belum terunggah: ${upData.error || 'coba unggah melalui panel Bukti Kedatangan'})`;
          }
        } catch {
          uploadWarning =
            ' (Koneksi terputus saat mengunggah foto; Anda dapat mengunggahnya di panel Bukti Kedatangan.)';
        }
      }

      setShowArrivalModal(false);
      setArrivalPhoto(null);
      setFeedback({
        type: uploadWarning ? 'warning' : 'success',
        text: `${res.message}${uploadWarning}`,
      });
      router.refresh();
      return res;
    },
    emptyActionState
  );

  const [notifyState, notifyAction, isNotifying] = useActionState(
    async (prev, fd) => {
      const res = await notifyStaffForInspectionAction(prev, fd);
      if (res.ok) {
        setShowNotifyStaffModal(false);
        setFeedback({ type: 'success', text: res.message });
      } else if (res?.error) {
        toast.error(res.error);
      }
      return res;
    },
    emptyActionState
  );

  // Removed unused completeAction destructure cleanly below if needed — replace action buttons
  const unusedPlaceholder = null;
  void unusedPlaceholder;

  const isSupplier = user.role === ROLES.SUPPLIER;
  const isManager = user.role === ROLES.MANAGER;
  const isStaff = user.role === ROLES.STAFF;
  const listHref = isManager ? '/restock-orders' : '/purchase-orders';
  const listLabel = isManager ? 'Restock Orders' : 'Purchase Orders';

  function runSingleAction(fn) {
    startTransition(async () => {
      const res = await fn();
      if (res.ok) {
        setConfirmDialog(null);
        setFeedback({ type: 'success', text: res.message });
      } else {
        setFeedback({ type: 'error', text: res.error });
      }
    });
  }

  const totalOrderedUnits = items.reduce((sum, it) => sum + Number(it.quantity || 0), 0);
  const totalApprovedUnits = items.reduce(
    (sum, it) => sum + Number(it.approved_quantity || 0),
    0
  );
  const totalRemainingUnits = items.reduce(
    (sum, it) => sum + Number(it.remaining_quantity || 0),
    0
  );
  const hasRemaining = totalRemainingUnits > 0;
  const isConfirmedStatus = ['confirmed', 'processing', 'preparing'].includes(po.status);
  const isInTransit = po.status === 'in_transit';
  const isInspecting = po.status === 'inspecting';
  const isReturned = po.status === 'returned';
  const hasActiveIncoming = Boolean(po.active_incoming_id || po.pending_incoming_id);
  const isEligibleForIncoming = (isInspecting || isReturned) && !hasActiveIncoming;

  // Role-specific next-step guidance
  let nextStepNote = null;
  if (isSupplier) {
    if (po.status === 'pending') {
      nextStepNote =
        'Pesanan baru menunggu konfirmasi Anda. Konfirmasi kesanggupan memenuhi pesanan atau tolak beserta alasannya.';
    } else if (isConfirmedStatus) {
      nextStepNote =
        'Pesanan telah dikonfirmasi. Setelah barang dikirim, perbarui detail pengiriman agar status berubah menjadi Dalam Pengiriman.';
    } else if (isInTransit && !po.arrival_confirmed_at) {
      nextStepNote =
        'Barang sedang dalam pengiriman. Ketika barang tiba di gudang Supplify, unggah foto bukti dan kirim konfirmasi kedatangan untuk Warehouse Manager.';
    } else if (isInTransit && po.arrival_confirmed_at) {
      nextStepNote =
        'Konfirmasi kedatangan Anda telah dikirim ke Manager. Menunggu pemeriksaan fisik oleh tim gudang.';
    } else if (isInspecting) {
      nextStepNote =
        'Barang sedang dalam tahap pemeriksaan fisik oleh Warehouse Staff.';
    }
  } else if (isManager) {
    if (isInTransit) {
      nextStepNote = po.arrival_confirmed_at
        ? 'Supplier telah mengonfirmasi kedatangan barang. Tinjau foto bukti lalu arahkan Warehouse Staff untuk melakukan pemeriksaan fisik.'
        : 'Barang sedang dalam pengiriman. Setelah tiba di gudang, arahkan Warehouse Staff untuk memulai pemeriksaan fisik.';
    } else if (isInspecting && !hasActiveIncoming) {
      nextStepNote =
        'Menunggu Warehouse Staff mencatat hasil pemeriksaan fisik barang masuk.';
    } else if (po.pending_incoming_id) {
      nextStepNote = `Laporan pemeriksaan fisik ${po.pending_incoming_code} telah dikirim Staff dan menunggu keputusan persetujuan Anda.`;
    } else if (po.status === 'received' && hasRemaining) {
      nextStepNote =
        'Pesanan telah diterima. Selisih kuantitas tercatat pada daftar ketidaksesuaian untuk pengajuan klaim refund atau pembuatan PO baru terpisah.';
    } else if (isReturned) {
      nextStepNote =
        'Pesanan dikembalikan karena penerimaan ditolak (stok tidak bertambah). Anda dapat mengajukan klaim refund atau membuat PO baru terpisah.';
    }
  } else if (isStaff) {
    if (isEligibleForIncoming) {
      nextStepNote =
        'Pesanan siap diperiksa secara fisik. Periksa jumlah dan kondisi barang, lalu catat hasil pemeriksaan masuk.';
    } else if (po.pending_incoming_id) {
      nextStepNote = `Laporan pemeriksaan ${po.pending_incoming_code} sedang menunggu tinjauan Manager. Stok akan bertambah setelah disetujui.`;
    } else if (isInTransit) {
      nextStepNote =
        'Pengiriman sedang menuju gudang. Tunggu arahan Manager setelah barang tiba untuk memulai pemeriksaan fisik.';
    }
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title={`Purchase Order ${po.po_code}`}
        description={
          isSupplier
            ? `Pesanan pengadaan dari gudang Supplify • Tanggal pesan ${formatDate(po.order_date)}`
            : `Supplier: ${po.supplier_name} • Dibuat oleh ${po.created_by_name}`
        }
        breadcrumbs={[
          { label: 'Dashboard', href: '/dashboard' },
          { label: listLabel, href: listHref },
          { label: po.po_code },
        ]}
        badge={<StatusPill status={po.status} />}
        actions={
          <div className="flex flex-wrap gap-2">
            <Link
              href={listHref}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs sm:text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
            >
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              Kembali
            </Link>

            {/* Tahap 2: Supplier Confirm / Reject */}
            {isSupplier && po.status === 'pending' && (
              <>
                <Button
                  variant="primary"
                  onClick={() =>
                    setConfirmDialog({
                      title: 'Konfirmasi Purchase Order',
                      message: `Konfirmasi kesediaan memenuhi ${po.po_code} (${items.length} SKU, ${totalOrderedUnits} unit)? Status PO akan berubah menjadi Confirmed dan belum mengubah stok.`,
                      label: 'Konfirmasi Pesanan',
                      variant: 'primary',
                      action: () => confirmPoAction(po.id),
                    })
                  }
                >
                  <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                  Konfirmasi Pesanan
                </Button>
                <Button variant="danger" onClick={() => setShowRejectModal(true)}>
                  <XCircle className="h-4 w-4" aria-hidden="true" />
                  Tolak PO
                </Button>
              </>
            )}

            {/* Tahap 3: Supplier Confirm Shipment -> In Transit */}
            {isSupplier && (isConfirmedStatus || isInTransit) && (
              <Button
                variant={isConfirmedStatus ? 'primary' : 'secondary'}
                onClick={() => setShowShipmentModal(true)}
              >
                <Truck className="h-4 w-4" aria-hidden="true" />
                {po.shipment_id ? 'Perbarui Pengiriman' : 'Konfirmasi Pengiriman'}
              </Button>
            )}

            {/* Tahap 4: Supplier Confirm Arrival with Proof Photo */}
            {isSupplier && (isInTransit || isInspecting) && (
              <Button variant="secondary" onClick={() => setShowArrivalModal(true)}>
                <MapPin className="h-4 w-4" aria-hidden="true" />
                {po.arrival_confirmed_at
                  ? 'Perbarui Bukti Kedatangan'
                  : 'Konfirmasi Kedatangan Barang'}
              </Button>
            )}

            {/* Tahap 4->5: Manager Instructs Staff for Physical Inspection -> Inspecting */}
            {isManager &&
              ['in_transit', 'delivered', 'returned'].includes(po.status) &&
              !hasActiveIncoming && (
                <Button
                  variant="primary"
                  onClick={() => setShowNotifyStaffModal(true)}
                >
                  <BellRing className="h-4 w-4" aria-hidden="true" />
                  {po.status === 'returned'
                    ? 'Instruksikan Pemeriksaan Ulang'
                    : 'Instruksikan Pemeriksaan Staff'}
                </Button>
              )}

            {/* Manager Manual New Separate PO Follow-Up */}
            {isManager && ['received', 'returned', 'completed'].includes(po.status) && (
              <Link
                href={`/restock-orders?referencePoId=${po.id}&supplierId=${po.supplier_id}`}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs sm:text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
              >
                <PackageCheck className="h-4 w-4" aria-hidden="true" />
                Buat PO Baru
              </Link>
            )}

            {/* Manager Cancel PO */}
            {isManager &&
              ['pending', 'confirmed', 'processing'].includes(po.status) &&
              incomings.length === 0 && (
                <Button
                  variant="danger"
                  onClick={() =>
                    setConfirmDialog({
                      title: 'Batalkan Purchase Order',
                      message: `Batalkan ${po.po_code}? PO yang dibatalkan tidak dapat diproses lagi.`,
                      label: 'Batalkan PO',
                      variant: 'danger',
                      action: () => cancelPoAction(po.id),
                    })
                  }
                >
                  Batalkan PO
                </Button>
              )}

            {/* Tahap 6: Staff Create Incoming Report */}
            {isStaff && isEligibleForIncoming && (
              <Link
                href={`/incoming?poId=${po.id}`}
                className="inline-flex items-center gap-1.5 rounded-lg bg-[#3243DD] px-4 py-2 text-xs sm:text-sm font-semibold text-white hover:bg-[#2635BC] transition-colors"
              >
                <ArrowDownToLine className="h-4 w-4" aria-hidden="true" />
                Catat Pemeriksaan Masuk
              </Link>
            )}

            {/* Manager Shortcut to Pending Incoming Review */}
            {isManager && po.pending_incoming_id && (
              <Link
                href={`/incoming/${po.pending_incoming_id}`}
                className="inline-flex items-center gap-1.5 rounded-lg bg-[#3243DD] px-4 py-2 text-xs sm:text-sm font-semibold text-white hover:bg-[#2635BC] transition-colors"
              >
                <ExternalLink className="h-4 w-4" aria-hidden="true" />
                Tinjau Penerimaan ({po.pending_incoming_code})
              </Link>
            )}
          </div>
        }
      />

      <WorkflowStepper
        steps={buildPoSteps(po.status)}
        currentKey={mapStepKey(po.status)}
        terminalStatus={
          ['rejected', 'returned', 'cancelled'].includes(po.status)
            ? po.status === 'returned'
              ? 'rejected'
              : po.status
            : null
        }
        terminalLabel={
          po.status === 'rejected'
            ? 'Purchase Order ditolak oleh Supplier'
            : po.status === 'returned'
            ? 'Pesanan dikembalikan — penerimaan ditolak dan stok tidak bertambah'
            : 'Purchase Order dibatalkan'
        }
      />

      <FeedbackBanner feedback={feedback} onDismiss={() => setFeedback(null)} />

      {nextStepNote && (
        <div className="flex items-start gap-2.5 rounded-xl border border-[#3243DD]/20 bg-[#EEF1FD]/70 px-4 py-3 text-xs sm:text-sm text-slate-800">
          <Info className="h-4 w-4 mt-0.5 text-[#3243DD] shrink-0" aria-hidden="true" />
          <span className="leading-relaxed">{nextStepNote}</span>
        </div>
      )}

      {/* Manager Follow-up Request Notice (visible to Supplier & internal roles) */}
      {po.supplier_followup_notes && (
        <div className="flex items-start gap-2.5 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-xs sm:text-sm text-amber-950">
          <AlertTriangle className="h-4 w-4 mt-0.5 text-amber-600 shrink-0" aria-hidden="true" />
          <div>
            <p className="font-semibold">
              Permintaan Tindak Lanjut dari Warehouse Manager
            </p>
            <p className="mt-0.5 leading-relaxed">{po.supplier_followup_notes}</p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        <div className="lg:col-span-2 space-y-6">
          {/* Ordered Products & Partial Fulfillment Progress */}
          <Card>
            <CardHeader className="flex flex-wrap items-center justify-between gap-2">
              <CardTitle>Daftar Produk Pesanan ({items.length} SKU)</CardTitle>
              <span className="text-xs font-semibold text-slate-600 tabular-nums">
                Dipesan: {totalOrderedUnits} • Disetujui: {totalApprovedUnits} • Sisa:{' '}
                <strong className={hasRemaining ? 'text-amber-700' : 'text-emerald-700'}>
                  {totalRemainingUnits}
                </strong>{' '}
                unit
                {items.some((it) => it.unit_price !== null && it.unit_price !== undefined) && (
                  <span>
                    {' '}• Total PO:{' '}
                    <strong className="text-slate-900">
                      {formatCurrencyIDR(
                        items.reduce(
                          (sum, it) =>
                            sum +
                            (it.unit_price !== null && it.unit_price !== undefined
                              ? Number(it.quantity) * Number(it.unit_price)
                              : 0),
                          0
                        )
                      )}
                    </strong>
                  </span>
                )}
              </span>
            </CardHeader>
            <CardContent className="p-0 sm:p-5">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>SKU</TableHead>
                    <TableHead>Nama Produk</TableHead>
                    <TableHead>Dipesan</TableHead>
                    <TableHead>Disetujui (Masuk Stok)</TableHead>
                    <TableHead>Sisa Kewajiban</TableHead>
                    <TableHead>Harga Satuan</TableHead>
                    <TableHead>Subtotal</TableHead>
                    <TableHead>Satuan</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((item) => {
                    const hasUnitPrice =
                      item.unit_price !== null && item.unit_price !== undefined;
                    return (
                    <TableRow key={item.id}>
                      <TableCell className="font-mono text-xs font-semibold text-[#3243DD]">
                        {isSupplier ? (
                          item.sku
                        ) : (
                          <Link
                            href={`/products/${item.product_id}`}
                            className="hover:underline"
                          >
                            {item.sku}
                          </Link>
                        )}
                      </TableCell>
                      <TableCell className="font-semibold text-slate-900">
                        <p>{item.product_name}</p>
                        {!isSupplier && item.rack_location && (
                          <p className="text-[11px] font-normal text-slate-500">
                            Rak: {item.rack_location}
                          </p>
                        )}
                      </TableCell>
                      <TableCell className="font-bold tabular-nums">
                        {item.quantity}
                      </TableCell>
                      <TableCell className="tabular-nums font-semibold text-emerald-700">
                        {item.approved_quantity ?? 0}
                      </TableCell>
                      <TableCell
                        className={`tabular-nums font-semibold ${
                          Number(item.remaining_quantity) > 0
                            ? 'text-amber-700'
                            : 'text-slate-400'
                        }`}
                      >
                        {item.remaining_quantity ?? 0}
                      </TableCell>
                      <TableCell className="text-xs text-slate-700 tabular-nums whitespace-nowrap">
                        {hasUnitPrice ? formatCurrencyIDR(item.unit_price) : '—'}
                      </TableCell>
                      <TableCell className="text-xs font-semibold text-slate-900 tabular-nums whitespace-nowrap">
                        {hasUnitPrice
                          ? formatCurrencyIDR(Number(item.quantity) * Number(item.unit_price))
                          : '—'}
                      </TableCell>
                      <TableCell className="text-xs text-slate-600">
                        {item.unit || '—'}
                      </TableCell>
                    </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Internal-only Incoming History List (supports Partial Delivery!) */}
          {!isSupplier && (
            <Card>
              <CardHeader className="flex flex-wrap items-center justify-between gap-2">
                <CardTitle className="flex items-center gap-2">
                  <ArrowDownToLine className="h-4 w-4 text-[#3243DD]" aria-hidden="true" />
                  Riwayat Pemeriksaan Barang Masuk ({incomings.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0 sm:p-5">
                {incomings.length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Kode Incoming</TableHead>
                        <TableHead>Diterima Fisik</TableHead>
                        <TableHead>Bermasalah</TableHead>
                        <TableHead>Disetujui Stok</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Aksi</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {incomings.map((inc) => (
                        <TableRow key={inc.id}>
                          <TableCell className="font-mono text-xs font-semibold text-[#3243DD] whitespace-nowrap">
                            <Link href={`/incoming/${inc.id}`} className="hover:underline">
                              {inc.transaction_code}
                            </Link>
                            <p className="font-sans text-[11px] font-normal text-slate-500">
                              {inc.created_by_name} • {formatDateTime(inc.transaction_date)}
                            </p>
                          </TableCell>
                          <TableCell className="text-xs tabular-nums font-medium">
                            {inc.total_received_quantity} unit
                          </TableCell>
                          <TableCell className="text-xs tabular-nums">
                            {Number(inc.total_damaged_quantity) > 0 ? (
                              <span className="font-semibold text-red-700">
                                {inc.total_damaged_quantity} unit
                              </span>
                            ) : (
                              <span className="text-slate-400">0</span>
                            )}
                          </TableCell>
                          <TableCell className="text-xs tabular-nums font-semibold text-emerald-700">
                            {inc.status === 'approved'
                              ? `${inc.total_approved_quantity} unit`
                              : '—'}
                          </TableCell>
                          <TableCell>
                            <StatusPill status={inc.status} />
                          </TableCell>
                          <TableCell className="text-right whitespace-nowrap">
                            <Link
                              href={`/incoming/${inc.id}`}
                              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 hover:border-[#3243DD] hover:text-[#3243DD]"
                            >
                              {isManager && inc.status === 'pending' ? 'Tinjau' : 'Lihat Detail'}
                            </Link>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <p className="p-4 sm:p-0 text-xs text-slate-500">
                    Belum ada laporan Incoming untuk PO ini. Laporan Incoming dibuat oleh
                    Warehouse Staff setelah pemeriksaan fisik barang.
                  </p>
                )}
              </CardContent>
            </Card>
          )}

          {/* Arrival Proof Photos (Tahap 4) */}
          <EvidencePanel
            entityType="supplier_arrival"
            entityId={po.id}
            files={arrivalEvidence}
            title="Bukti Kedatangan Barang (Supplier)"
            helperNote={
              isSupplier
                ? 'Unggah foto bukti bahwa barang telah tiba di lokasi gudang. Foto ini hanya informasi awal bagi Manager, bukan bukti final penerimaan stok.'
                : 'Foto bukti kedatangan dari Supplier sebagai informasi awal sebelum pemeriksaan fisik oleh Warehouse Staff.'
            }
            canUpload={isSupplier && (isInTransit || isInspecting)}
            canDelete={isSupplier && !['received', 'returned', 'completed', 'cancelled'].includes(po.status)}
          />

          {/* Shipment Proof Photos (Tahap 3) */}
          <EvidencePanel
            entityType="supplier_shipment"
            entityId={po.id}
            files={evidence}
            title="Bukti Pengiriman Supplier"
            helperNote={
              isSupplier
                ? 'Unggah foto resi, surat jalan, atau paket saat pengiriman barang.'
                : 'Lampiran resi dan bukti pengiriman yang diunggah oleh Supplier.'
            }
            canUpload={isSupplier && (isConfirmedStatus || isInTransit)}
            canDelete={isSupplier && !['received', 'returned', 'completed', 'cancelled'].includes(po.status)}
          />
        </div>

        <aside className="space-y-5">
          {/* Arrival & Inspection Coordination Card */}
          <Card highlight={Boolean(po.arrival_confirmed_at && !po.inspection_requested_at && isManager)}>
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2">
                <MapPin className="h-4 w-4 text-[#3243DD]" aria-hidden="true" />
                Koordinasi Kedatangan &amp; Pemeriksaan
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-xs">
              <div>
                <p className="text-slate-500">Konfirmasi Kedatangan Supplier</p>
                {po.arrival_confirmed_at ? (
                  <>
                    <p className="mt-0.5 font-semibold text-emerald-700 tabular-nums">
                      Dikonfirmasi • {formatDateTime(po.arrival_confirmed_at)}
                    </p>
                    {po.arrival_notes && (
                      <p className="mt-1 rounded-lg bg-slate-50 border border-slate-200 p-2 text-slate-700 leading-relaxed">
                        {po.arrival_notes}
                      </p>
                    )}
                    <p className="mt-1 text-[11px] text-slate-500">
                      Foto bukti kedatangan: <strong>{arrivalEvidence.length} file</strong>
                    </p>
                  </>
                ) : (
                  <p className="mt-0.5 text-slate-500">
                    Belum ada konfirmasi kedatangan dari Supplier.
                  </p>
                )}
              </div>

              {!isSupplier && (
                <div className="pt-2.5 border-t border-slate-100">
                  <p className="text-slate-500">Instruksi Pemeriksaan ke Staff (Manager)</p>
                  {po.inspection_requested_at ? (
                    <>
                      <p className="mt-0.5 font-semibold text-[#3243DD] tabular-nums">
                        Diinformasikan • {formatDateTime(po.inspection_requested_at)}
                      </p>
                      {po.inspection_requested_by_name && (
                        <p className="text-[11px] text-slate-500">
                          Oleh: {po.inspection_requested_by_name}
                        </p>
                      )}
                      {po.inspection_request_notes && (
                        <p className="mt-1 rounded-lg bg-[#EEF1FD]/60 border border-[#3243DD]/15 p-2 text-slate-700 leading-relaxed">
                          {po.inspection_request_notes}
                        </p>
                      )}
                    </>
                  ) : (
                    <p className="mt-0.5 text-slate-500">
                      Belum diinformasikan kepada Warehouse Staff.
                    </p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Shipment Details Card */}
          <Card highlight={Boolean(po.shipment_id)}>
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2">
                <Truck className="h-4 w-4 text-[#3243DD]" aria-hidden="true" />
                Informasi Pengiriman (Shipment)
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-xs">
              {po.shipment_id ? (
                <>
                  <div>
                    <p className="text-slate-500">Kurir / Jasa Pengiriman</p>
                    <p className="mt-0.5 font-semibold text-slate-900">
                      {po.courier_name}
                    </p>
                  </div>
                  <div>
                    <p className="text-slate-500">Nomor Resi</p>
                    <p className="mt-0.5 font-mono font-semibold text-slate-900">
                      {po.tracking_number || 'Tanpa nomor resi'}
                    </p>
                    {po.no_tracking_reason && (
                      <p className="text-slate-600 mt-0.5">
                        Keterangan: {po.no_tracking_reason}
                      </p>
                    )}
                  </div>
                  <div>
                    <p className="text-slate-500">Waktu Kirim</p>
                    <p className="mt-0.5 font-semibold text-slate-900 tabular-nums">
                      {formatDateTime(po.shipped_at)}
                    </p>
                  </div>
                  {po.shipment_notes && (
                    <div className="pt-2 border-t border-slate-100">
                      <p className="text-slate-500">Catatan Pengiriman</p>
                      <p className="mt-0.5 text-slate-700 leading-relaxed">
                        {po.shipment_notes}
                      </p>
                    </div>
                  )}
                </>
              ) : (
                <p className="text-slate-600 leading-relaxed">
                  Belum ada informasi pengiriman yang dikonfirmasi oleh Supplier.
                </p>
              )}
            </CardContent>
          </Card>

          {/* PO Metadata Card */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Detail Pesanan</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-xs">
              {!isSupplier && (
                <div>
                  <p className="text-slate-500">Supplier</p>
                  <p className="mt-0.5 font-semibold text-slate-900">
                    {po.supplier_name}
                  </p>
                  {po.supplier_contact && (
                    <p className="text-slate-500">
                      PIC: {po.supplier_contact}{' '}
                      {po.supplier_phone ? `• ${po.supplier_phone}` : ''}
                    </p>
                  )}
                </div>
              )}
              <div>
                <p className="text-slate-500">Tanggal Pemesanan</p>
                <p className="mt-0.5 font-semibold text-slate-900 tabular-nums">
                  {formatDate(po.order_date)}
                </p>
              </div>
              <div>
                <p className="text-slate-500">Estimasi Kedatangan</p>
                <p className="mt-0.5 font-semibold text-slate-900 tabular-nums">
                  {formatDate(po.expected_arrival)}
                </p>
              </div>
              {po.confirmed_at && (
                <div>
                  <p className="text-slate-500">Dikonfirmasi Supplier</p>
                  <p className="mt-0.5 font-semibold text-slate-900 tabular-nums">
                    {formatDateTime(po.confirmed_at)}
                  </p>
                </div>
              )}
              {po.completed_at && (
                <div>
                  <p className="text-slate-500">Selesai (Completed)</p>
                  <p className="mt-0.5 font-semibold text-emerald-700 tabular-nums">
                    {formatDateTime(po.completed_at)}
                  </p>
                  {po.completed_by_name && (
                    <p className="text-slate-500">Oleh: {po.completed_by_name}</p>
                  )}
                  {po.completion_notes && (
                    <p className="mt-1 text-slate-700 leading-relaxed">
                      Catatan: {po.completion_notes}
                    </p>
                  )}
                </div>
              )}
              {po.reference_po_id && po.reference_po_code && (
                <div className="pt-2 border-t border-slate-100">
                  <p className="text-slate-500">Referensi PO Sebelumnya</p>
                  <Link
                    href={`/purchase-orders/${po.reference_po_id}`}
                    className="mt-0.5 inline-flex items-center gap-1 font-mono font-semibold text-[#3243DD] hover:underline"
                  >
                    {po.reference_po_code}
                    <ExternalLink className="h-3 w-3" aria-hidden="true" />
                  </Link>
                </div>
              )}
              {po.source_discrepancy_id && po.source_discrepancy_code && !isSupplier && (
                <div>
                  <p className="text-slate-500">Tindak Lanjut Discrepancy</p>
                  <Link
                    href={`/discrepancies/${po.source_discrepancy_id}`}
                    className="mt-0.5 inline-flex items-center gap-1 font-mono font-semibold text-[#3243DD] hover:underline"
                  >
                    {po.source_discrepancy_code}
                    <ExternalLink className="h-3 w-3" aria-hidden="true" />
                  </Link>
                </div>
              )}
              {po.notes && (
                <div className="pt-2 border-t border-slate-100">
                  <p className="text-slate-500">Catatan PO</p>
                  <p className="mt-0.5 text-slate-700 leading-relaxed">{po.notes}</p>
                </div>
              )}
              {po.rejection_reason && (
                <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-red-800">
                  <p className="font-semibold">Alasan Penolakan:</p>
                  <p className="mt-1 leading-relaxed">{po.rejection_reason}</p>
                </div>
              )}
            </CardContent>
          </Card>
        </aside>
      </div>

      {/* Reject Modal (Supplier) */}
      <Modal
        open={showRejectModal}
        onClose={() => setShowRejectModal(false)}
        title={`Tolak Purchase Order ${po.po_code}`}
        description="Berikan alasan penolakan yang jelas agar Warehouse Manager dapat menindaklanjuti."
      >
        <form action={rejectAction} className="space-y-4">
          <input type="hidden" name="poId" value={po.id} />
          {rejectState.error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-700">
              {rejectState.error}
            </div>
          )}
          <div>
            <label
              htmlFor="po-reject-reason"
              className="block text-xs sm:text-sm font-medium text-slate-700 mb-1.5"
            >
              Alasan Penolakan <span className="text-[#FF3D8B]">*</span>
            </label>
            <textarea
              id="po-reject-reason"
              name="rejectionReason"
              rows={3}
              required
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              placeholder="Contoh: Stok dari pabrikan sedang kosong hingga minggu depan."
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
              Tolak PO
            </Button>
          </div>
        </form>
      </Modal>

      {/* Submit Shipment Modal (Supplier -> In Transit) */}
      <Modal
        open={showShipmentModal}
        onClose={() => setShowShipmentModal(false)}
        title={`Konfirmasi Pengiriman ${po.po_code}`}
        description="Konfirmasi pengiriman barang hanya ketika barang benar-benar dikirim. Status PO akan berubah menjadi In Transit dan belum menambah stok."
      >
        <form action={shipAction} className="space-y-3.5">
          <input type="hidden" name="poId" value={po.id} />
          {shipState.error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-700">
              {shipState.error}
            </div>
          )}
          <Input
            name="courierName"
            label="Nama Kurir / Metode Pengiriman"
            required
            value={shipForm.courierName}
            onChange={(e) =>
              setShipForm((prev) => ({ ...prev, courierName: e.target.value }))
            }
            placeholder="Contoh: JNE Cargo / Armada Internal"
            error={shipState.fieldErrors?.courierName}
          />
          <Input
            name="trackingNumber"
            label="Nomor Resi"
            helperText="Kosongkan jika dikirim melalui armada internal atau tanpa resi."
            value={shipForm.trackingNumber}
            onChange={(e) =>
              setShipForm((prev) => ({ ...prev, trackingNumber: e.target.value }))
            }
            placeholder="Nomor resi pengiriman"
            error={shipState.fieldErrors?.trackingNumber}
          />
          <Input
            name="noTrackingReason"
            label="Alasan jika Resi Tidak Tersedia"
            required={!shipForm.trackingNumber.trim()}
            value={shipForm.noTrackingReason}
            onChange={(e) =>
              setShipForm((prev) => ({ ...prev, noTrackingReason: e.target.value }))
            }
            placeholder="Contoh: Dikirim langsung oleh kurir internal perusahaan"
            error={shipState.fieldErrors?.noTrackingReason}
          />
          <Input
            name="shippedAt"
            type="datetime-local"
            label="Waktu Pengiriman"
            value={shipForm.shippedAt}
            onChange={(e) =>
              setShipForm((prev) => ({ ...prev, shippedAt: e.target.value }))
            }
          />
          <div>
            <label
              htmlFor="ship-notes"
              className="block text-xs sm:text-sm font-medium text-slate-700 mb-1"
            >
              Catatan Pengiriman (Opsional)
            </label>
            <textarea
              id="ship-notes"
              name="notes"
              rows={2}
              value={shipForm.notes}
              onChange={(e) =>
                setShipForm((prev) => ({ ...prev, notes: e.target.value }))
              }
              placeholder="Jumlah koli, pengiriman tahap 1/2, nama driver, atau estimasi tiba..."
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-[#3243DD] focus:outline-none focus:ring-2 focus:ring-[#3243DD]/20"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <Button
              variant="secondary"
              onClick={() => setShowShipmentModal(false)}
              disabled={isShipping}
            >
              Batal
            </Button>
            <Button type="submit" variant="primary" loading={isShipping}>
              Konfirmasi Pengiriman
            </Button>
          </div>
        </form>
      </Modal>

      {/* Tahap 4: Confirm Arrival Modal (Supplier) */}
      <Modal
        open={showArrivalModal}
        onClose={() => setShowArrivalModal(false)}
        title={`Konfirmasi Kedatangan Barang — ${po.po_code}`}
        description="Informasikan kepada Warehouse Manager bahwa barang telah tiba di lokasi gudang. Konfirmasi ini merupakan informasi awal dan belum mengubah stok gudang."
      >
        <form action={arrivalAction} className="space-y-4">
          <input type="hidden" name="poId" value={po.id} />
          {(arrivalState.error || arrivalPhotoError) && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-700">
              {arrivalState.error || arrivalPhotoError}
            </div>
          )}
          <div>
            <label
              htmlFor="arrival-notes"
              className="block text-xs sm:text-sm font-medium text-slate-700 mb-1"
            >
              Informasi Kedatangan (Opsional)
            </label>
            <textarea
              id="arrival-notes"
              name="arrivalNotes"
              rows={3}
              value={arrivalNotes}
              onChange={(e) => setArrivalNotes(e.target.value)}
              placeholder="Contoh: Barang pengiriman tahap 1 (80 unit) sudah tiba di loading dock pukul 10.30 WIB."
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-[#3243DD] focus:outline-none focus:ring-2 focus:ring-[#3243DD]/20"
            />
          </div>
          <div>
            <label className="block text-xs sm:text-sm font-medium text-slate-700 mb-1">
              Foto Bukti Kedatangan (Opsional — JPG, PNG, WEBP, PDF • Maks 5 MB)
            </label>
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp,application/pdf"
              onChange={(e) => {
                const file = e.target.files?.[0] || null;
                setArrivalPhotoError(null);
                if (file && file.size > 5 * 1024 * 1024) {
                  setArrivalPhotoError('Ukuran foto maksimal 5 MB.');
                  setArrivalPhoto(null);
                  e.target.value = '';
                  return;
                }
                setArrivalPhoto(file);
              }}
              className="block w-full text-xs text-slate-700 file:mr-3 file:rounded-lg file:border-0 file:bg-[#3243DD] file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-white hover:file:bg-[#2635BC] file:cursor-pointer"
            />
            {arrivalPhoto && (
              <p className="mt-1 text-[11px] text-slate-600">
                Terpilih: <strong>{arrivalPhoto.name}</strong>
              </p>
            )}
          </div>
          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <Button
              variant="secondary"
              onClick={() => setShowArrivalModal(false)}
              disabled={isConfirmingArrival}
            >
              Batal
            </Button>
            <Button type="submit" variant="primary" loading={isConfirmingArrival}>
              Kirim Konfirmasi Kedatangan
            </Button>
          </div>
        </form>
      </Modal>

      {/* Tahap 5: Manager Inform Staff Modal */}
      <Modal
        open={showNotifyStaffModal}
        onClose={() => setShowNotifyStaffModal(false)}
        title={`Informasikan Staff untuk Pemeriksaan — ${po.po_code}`}
        description="Warehouse Staff akan dapat melihat PO ini beserta informasi pengiriman dan foto kedatangan untuk melakukan pemeriksaan fisik dan membuat laporan Incoming."
      >
        <form action={notifyAction} className="space-y-4">
          <input type="hidden" name="poId" value={po.id} />
          {notifyState.error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-700">
              {notifyState.error}
            </div>
          )}
          <div>
            <label
              htmlFor="inspection-notes"
              className="block text-xs sm:text-sm font-medium text-slate-700 mb-1"
            >
              Catatan / Arahan Pemeriksaan untuk Staff (Opsional)
            </label>
            <textarea
              id="inspection-notes"
              name="notes"
              rows={3}
              value={inspectionNotes}
              onChange={(e) => setInspectionNotes(e.target.value)}
              placeholder="Contoh: Mohon periksa kondisi fisik seluruh dus dan hitung jumlah barang baik serta barang rusak."
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-[#3243DD] focus:outline-none focus:ring-2 focus:ring-[#3243DD]/20"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <Button
              variant="secondary"
              onClick={() => setShowNotifyStaffModal(false)}
              disabled={isNotifying}
            >
              Batal
            </Button>
            <Button type="submit" variant="primary" loading={isNotifying}>
              Informasikan Staff
            </Button>
          </div>
        </form>
      </Modal>

      {/* Generic Confirm Dialog */}
      <Dialog
        open={Boolean(confirmDialog)}
        onClose={() => setConfirmDialog(null)}
        onConfirm={() => runSingleAction(confirmDialog.action)}
        title={confirmDialog?.title || ''}
        message={confirmDialog?.message || ''}
        confirmLabel={confirmDialog?.label || 'Konfirmasi'}
        confirmVariant={confirmDialog?.variant || 'primary'}
        loading={isMutating}
      />
    </div>
  );
}
