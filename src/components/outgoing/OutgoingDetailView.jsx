'use client';

import { useActionState, useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  CheckCircle2,
  XCircle,
  Truck,
  AlertTriangle,
  Info,
  Pencil,
  Trash2,
  Plus,
} from 'lucide-react';
import {
  updateOutgoingAction,
  deleteOutgoingAction,
  approveOutgoingAction,
  rejectOutgoingAction,
  recordHandoverAction,
} from '../../modules/outgoing/outgoingActions.js';
import { formatCurrencyIDR, formatDate, formatDateTime } from '../../lib/utils/format.js';
import {
  getHandoverMethodLabel,
  getRecipientTypeLabel,
  getStockStatusMeta,
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
import SearchableProductSelect from '../shared/SearchableProductSelect.jsx';
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

function buildOutgoingSteps(status) {
  const isShipped = ['shipped', 'delivered'].includes(status);
  const isApproved = status === 'approved' || isShipped;
  return [
    { key: 'pending', label: 'Pengajuan', sublabel: 'Menunggu persetujuan Manager' },
    {
      key: 'approved',
      label: 'Persetujuan Manager',
      sublabel: isApproved ? 'Siap disiapkan & dikemas' : 'Menunggu peninjauan',
    },
    {
      key: 'shipped',
      label: 'Pengiriman',
      sublabel: isShipped
        ? 'Barang dikirim dan stok dikurangi'
        : 'Menunggu pencatatan pengiriman',
    },
  ];
}

export default function OutgoingDetailView({
  tx,
  items,
  evidence,
  availableProducts = [],
  canApprove,
  canHandover,
  isCreator,
}) {
  const router = useRouter();
  const toast = useToast();
  const [feedback, setFeedback] = useState(null);
  const [confirmDialog, setConfirmDialog] = useState(null);
  const [confirmError, setConfirmError] = useState(null);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [showHandoverModal, setShowHandoverModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editError, setEditError] = useState(null);
  const [editForm, setEditForm] = useState({
    shipmentDate: tx.shipment_date
      ? String(tx.shipment_date).slice(0, 10)
      : new Date().toISOString().slice(0, 10),
    recipientName: tx.planned_recipient_name || tx.recipient_name || '',
    notes: tx.notes || '',
    items: items.map((it) => ({
      productId: String(it.product_id),
      quantity: String(it.quantity),
    })),
  });
  const [rejectionReason, setRejectionReason] = useState('');
  const [handoverForm, setHandoverForm] = useState({
    recipientName: tx.planned_recipient_name || tx.recipient_name || '',
    recipientType: 'customer',
    handoverMethod: 'direct',
    recipientContact: '',
    courierName: '',
    trackingNumber: '',
    notes: '',
  });
  const [isMutating, startTransition] = useTransition();

  const [rejectState, rejectAction, isRejecting] = useActionState(
    async (prev, fd) => {
      const res = await rejectOutgoingAction(prev, fd);
      if (res.ok) {
        setShowRejectModal(false);
        setRejectionReason('');
        setFeedback({ type: 'success', text: res.message });
        router.refresh();
      } else if (res?.error) {
        toast.error(res.error);
      }
      return res;
    },
    emptyActionState
  );

  const [handoverState, handoverAction, isHandovering] = useActionState(
    async (prev, fd) => {
      const res = await recordHandoverAction(prev, fd);
      if (res.ok) {
        setShowHandoverModal(false);
        setFeedback({ type: 'success', text: res.message });
        const alerts = res.data?.lowStockAlerts || [];
        if (alerts.length > 0) {
          const names = alerts
            .slice(0, 3)
            .map(
              (a) =>
                `${a.name} (sisa ${a.stockAfter} ${a.unit || 'unit'} — ${getStockStatusMeta(a.stockStatusAfter).label})`
            )
            .join(', ');
          toast.warning(
            `Peringatan Stok Menipis/Kritis/Habis: ${names}. Pertimbangkan untuk segera membuat Purchase Order restock.`,
            { title: 'Perhatian Kondisi Stok' }
          );
        }
        router.refresh();
      } else if (res?.error) {
        toast.error(res.error);
      }
      return res;
    },
    emptyActionState
  );

  function openEditModal() {
    setEditError(null);
    setEditForm({
      shipmentDate: tx.shipment_date
        ? String(tx.shipment_date).slice(0, 10)
        : new Date().toISOString().slice(0, 10),
      recipientName: tx.planned_recipient_name || tx.recipient_name || '',
      notes: tx.notes || '',
      items: items.map((it) => ({
        productId: String(it.product_id),
        quantity: String(it.quantity),
      })),
    });
    setShowEditModal(true);
  }

  function handleEditSubmit(e) {
    e.preventDefault();
    setEditError(null);
    if (editForm.items.some((it) => !it.productId)) {
      setEditError('Pilih produk pada setiap baris barang terlebih dahulu.');
      return;
    }
    startTransition(async () => {
      const res = await updateOutgoingAction(tx.id, {
        shipmentDate: editForm.shipmentDate,
        recipientName: editForm.recipientName.trim(),
        notes: editForm.notes,
        items: editForm.items.map((it) => ({
          productId: Number(it.productId),
          quantity: Number(it.quantity),
        })),
      });
      if (res.ok) {
        setShowEditModal(false);
        setFeedback({ type: 'success', text: res.message });
        toast.success(res.message);
        router.refresh();
      } else {
        setEditError(res.error || 'Gagal memperbarui pengajuan Outgoing.');
        toast.error(res.error);
      }
    });
  }

  function runSingleAction(dialogConfig) {
    setConfirmError(null);
    startTransition(async () => {
      const res = await dialogConfig.action();
      if (res.ok) {
        setConfirmDialog(null);
        setConfirmError(null);
        setFeedback({ type: 'success', text: res.message });
        toast.success(res.message);
        if (dialogConfig.redirectTo) {
          router.push(dialogConfig.redirectTo);
        } else {
          router.refresh();
        }
      } else {
        const msg = res.error || 'Tindakan belum berhasil diproses.';
        setConfirmError(msg);
        setFeedback({ type: 'error', text: msg });
        toast.error(msg);
      }
    });
  }

  const totalUnits = items.reduce((sum, it) => sum + Number(it.quantity || 0), 0);
  const insufficientItems = ['pending', 'approved'].includes(tx.status)
    ? items.filter(
        (it) =>
          it.current_stock !== undefined &&
          Number(it.quantity) > Number(it.current_stock)
      )
    : [];
  const hasInsufficientStock = insufficientItems.length > 0;

  return (
    <div className="space-y-5">
      <PageHeader
        title={`Outgoing ${tx.transaction_code}`}
        description={`Diajukan oleh ${tx.created_by_name} pada ${formatDateTime(tx.transaction_date)}`}
        breadcrumbs={[
          { label: 'Dashboard', href: '/dashboard' },
          { label: 'Outgoing', href: '/outgoing' },
          { label: tx.transaction_code },
        ]}
        badge={<StatusPill status={tx.status} />}
        actions={
          <div className="flex flex-wrap gap-2">
            <Link
              href="/outgoing"
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs sm:text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
            >
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              Kembali
            </Link>

            {canApprove && tx.status === 'pending' && (
              <>
                <Button
                  variant="primary"
                  disabled={hasInsufficientStock}
                  title={
                    hasInsufficientStock
                      ? 'Stok salah satu produk tidak mencukupi untuk disetujui'
                      : 'Setujui pengajuan Outgoing untuk proses picking Staff'
                  }
                  onClick={() => {
                    setConfirmError(null);
                    setConfirmDialog({
                      title: 'Setujui Pengeluaran Barang',
                      message: `Setujui pengajuan ${tx.transaction_code} untuk persiapan barang keluar (${totalUnits} unit / ${items.length} SKU)? Stok gudang belum berkurang sampai pengiriman dicatat oleh Staff.`,
                      label: 'Setujui Pengeluaran',
                      variant: 'primary',
                      action: () => approveOutgoingAction(tx.id),
                    });
                  }}
                >
                  <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                  Setujui Pengeluaran
                </Button>
                <Button variant="danger" onClick={() => setShowRejectModal(true)}>
                  <XCircle className="h-4 w-4" aria-hidden="true" />
                  Tolak Pengajuan
                </Button>
              </>
            )}

            {isCreator && tx.status === 'pending' && (
              <>
                <Button variant="secondary" onClick={openEditModal}>
                  <Pencil className="h-4 w-4" aria-hidden="true" />
                  Ubah Pengajuan
                </Button>
                <Button
                  variant="danger"
                  onClick={() => {
                    setConfirmError(null);
                    setConfirmDialog({
                      title: 'Hapus Pengajuan Outgoing Pending',
                      message: `Hapus permanen pengajuan ${tx.transaction_code}? Tindakan ini hanya dapat dilakukan selama berstatus Pending dan belum memengaruhi stok gudang.`,
                      label: 'Hapus Pengajuan',
                      variant: 'danger',
                      redirectTo: '/outgoing',
                      action: () => deleteOutgoingAction(tx.id),
                    });
                  }}
                >
                  <Trash2 className="h-4 w-4" aria-hidden="true" />
                  Hapus Pengajuan
                </Button>
              </>
            )}

            {canHandover && tx.status === 'approved' && (
              <Button
                variant="primary"
                disabled={hasInsufficientStock}
                title={
                  hasInsufficientStock
                    ? 'Stok saat ini tidak mencukupi untuk pengiriman'
                    : 'Catat serah terima pengiriman dan kurangi stok gudang'
                }
                onClick={() => {
                  setHandoverForm((prev) => ({
                    ...prev,
                    recipientName:
                      prev.recipientName ||
                      tx.planned_recipient_name ||
                      tx.recipient_name ||
                      '',
                  }));
                  setShowHandoverModal(true);
                }}
              >
                <Truck className="h-4 w-4" aria-hidden="true" />
                Catat Pengiriman
              </Button>
            )}
          </div>
        }
      />

      <WorkflowStepper
        steps={buildOutgoingSteps(tx.status)}
        currentKey={tx.status === 'delivered' ? 'shipped' : tx.status}
        terminalStatus={
          tx.status === 'rejected' || tx.status === 'cancelled' ? tx.status : null
        }
        terminalLabel={
          tx.status === 'rejected'
            ? 'Pengajuan pengeluaran ditolak — stok tidak berkurang'
            : 'Pengajuan pengeluaran dibatalkan — stok tidak berkurang'
        }
      />

      <FeedbackBanner feedback={feedback} onDismiss={() => setFeedback(null)} />

      {/* Contextual Alert for Pending/Approved Stock Check */}
      {((canApprove && tx.status === 'pending') ||
        (canHandover && tx.status === 'approved')) && (
        <div
          className={`rounded-xl border px-4 py-3 text-xs sm:text-sm flex items-start gap-2.5 ${
            hasInsufficientStock
              ? 'border-red-200 bg-red-50 text-red-900'
              : 'border-[#3243DD]/20 bg-[#EEF1FD]/70 text-slate-900'
          }`}
        >
          {hasInsufficientStock ? (
            <AlertTriangle className="h-4 w-4 mt-0.5 text-red-600 shrink-0" />
          ) : (
            <Info className="h-4 w-4 mt-0.5 text-[#3243DD] shrink-0" />
          )}
          <div>
            <p className="font-semibold">
              {hasInsufficientStock
                ? 'Stok Gudang Tidak Mencukupi'
                : tx.status === 'pending'
                ? 'Stok Tersedia untuk Pengajuan Ini'
                : 'Barang Siap Dikirim'}
            </p>
            <p className="text-xs opacity-85 mt-0.5">
              {hasInsufficientStock
                ? 'Salah satu produk kekurangan stok. Lakukan penambahan atau penyesuaian kuantitas sebelum barang dapat dikirim.'
                : tx.status === 'pending'
                ? `Persetujuan mengizinkan penyiapan barang (${totalUnits} unit). Stok gudang akan dikurangi otomatis saat pengiriman dicatat.`
                : `Stok gudang akan dikurangi otomatis sebesar ${totalUnits} unit saat pengiriman dicatat.`}
            </p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2">
              <CardTitle>Daftar Barang Keluar ({items.length} SKU)</CardTitle>
              <span className="text-xs font-semibold text-slate-600 tabular-nums">
                Total: {totalUnits} unit
                {items.some((it) => it.unit_price !== null && it.unit_price !== undefined) && (
                  <span>
                    {' '}• Nilai:{' '}
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
                    <TableHead>Produk</TableHead>
                    <TableHead>Diminta</TableHead>
                    {['pending', 'approved'].includes(tx.status) && (
                      <>
                        <TableHead>Stok Saat Ini</TableHead>
                        <TableHead>Sisa Setelah Shipped</TableHead>
                      </>
                    )}
                    <TableHead>Harga Satuan</TableHead>
                    <TableHead>Subtotal</TableHead>
                    <TableHead>Satuan</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((it) => {
                    const hasStock = it.current_stock !== undefined;
                    const projected = hasStock
                      ? Number(it.current_stock) - Number(it.quantity)
                      : null;
                    const isShort = projected !== null && projected < 0;
                    const hasUnitPrice =
                      it.unit_price !== null && it.unit_price !== undefined;

                    return (
                      <TableRow key={it.id} className={isShort ? 'bg-red-50/50' : ''}>
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
                        </TableCell>
                        <TableCell className="font-bold text-slate-900 tabular-nums">
                          {it.quantity}
                        </TableCell>
                        {['pending', 'approved'].includes(tx.status) && (
                          <>
                            <TableCell className="tabular-nums text-slate-700">
                              {hasStock ? it.current_stock : '—'}
                            </TableCell>
                            <TableCell
                              className={`font-semibold tabular-nums ${
                                isShort ? 'text-red-700' : 'text-emerald-700'
                              }`}
                            >
                              {projected !== null ? (
                                isShort ? (
                                  <span>{projected} (Kurang)</span>
                                ) : (
                                  projected
                                )
                              ) : (
                                '—'
                              )}
                            </TableCell>
                          </>
                        )}
                        <TableCell className="text-xs text-slate-700 tabular-nums whitespace-nowrap">
                          {hasUnitPrice ? formatCurrencyIDR(it.unit_price) : '—'}
                        </TableCell>
                        <TableCell className="text-xs font-semibold text-slate-900 tabular-nums whitespace-nowrap">
                          {hasUnitPrice
                            ? formatCurrencyIDR(Number(it.quantity) * Number(it.unit_price))
                            : '—'}
                        </TableCell>
                        <TableCell className="text-xs text-slate-600">
                          {it.unit || '—'}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <EvidencePanel
            entityType="outgoing_handover"
            entityId={tx.id}
            files={evidence}
            title="Bukti Serah Terima & Pengiriman"
            helperNote="Unggah foto serah terima, tanda terima barang, atau resi ekspedisi setelah transaksi disetujui."
            canUpload={canHandover && ['approved', 'shipped'].includes(tx.status)}
            canDelete={false}
          />
        </div>

        <aside className="space-y-5">
          {/* Handover & Delivery Card */}
          <Card highlight={tx.status === 'approved' || tx.status === 'shipped'}>
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2">
                <Truck className="h-4 w-4 text-[#3243DD]" aria-hidden="true" />
                Informasi Serah Terima &amp; Pengiriman
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-xs">
              {(tx.shipment_date || tx.planned_recipient_name) && !tx.handover_id && (
                <div className="rounded-lg border border-slate-200 bg-[#F4F5F8] p-2.5 space-y-1">
                  {tx.shipment_date && (
                    <p className="text-slate-600">
                      Jadwal Pengiriman:{' '}
                      <strong className="text-slate-900">
                        {formatDate(tx.shipment_date)}
                      </strong>
                    </p>
                  )}
                  {(tx.planned_recipient_name || tx.recipient_name) && (
                    <p className="text-slate-600">
                      Customer / Penerima:{' '}
                      <strong className="text-slate-900">
                        {tx.planned_recipient_name || tx.recipient_name}
                      </strong>
                    </p>
                  )}
                </div>
              )}
              {tx.handover_id ? (
                <>
                  {tx.shipment_date && (
                    <div>
                      <p className="text-slate-500">Tanggal Pengiriman</p>
                      <p className="mt-0.5 font-semibold text-slate-900">
                        {formatDate(tx.shipment_date)}
                      </p>
                    </div>
                  )}
                  <div>
                    <p className="text-slate-500">Penerima</p>
                    <p className="mt-0.5 font-semibold text-slate-900">
                      {tx.recipient_name}{' '}
                      <span className="font-normal text-slate-500">
                        ({getRecipientTypeLabel(tx.recipient_type)})
                      </span>
                    </p>
                    {tx.recipient_contact && (
                      <p className="text-slate-600">{tx.recipient_contact}</p>
                    )}
                  </div>
                  <div>
                    <p className="text-slate-500">Metode Penyerahan</p>
                    <p className="mt-0.5 font-semibold text-slate-900">
                      {getHandoverMethodLabel(tx.handover_method)}
                    </p>
                  </div>
                  {tx.courier_name && (
                    <div>
                      <p className="text-slate-500">Kurir &amp; Nomor Resi</p>
                      <p className="mt-0.5 font-semibold text-slate-900">
                        {tx.courier_name}
                        {tx.tracking_number ? ` • ${tx.tracking_number}` : ''}
                      </p>
                    </div>
                  )}
                  <div className="pt-2 border-t border-slate-100">
                    <p className="text-slate-500">Diserahkan Oleh</p>
                    <p className="mt-0.5 font-semibold text-slate-900">
                      {tx.handed_over_by_name}
                    </p>
                    <p className="text-slate-500 tabular-nums">
                      {formatDateTime(tx.handed_over_at)}
                    </p>
                  </div>
                  {tx.delivered_at && (
                    <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-2.5 text-emerald-900">
                      <p className="font-semibold">Konfirmasi Diterima (Delivered)</p>
                      <p className="mt-0.5 tabular-nums">
                        {formatDateTime(tx.delivered_at)}
                      </p>
                    </div>
                  )}
                </>
              ) : (
                <p className="text-slate-600 leading-relaxed">
                  {tx.status === 'approved'
                    ? 'Transaksi telah disetujui untuk picking/packing (stok belum berubah). Tandai Shipped dan lengkapi detail pengiriman untuk mengurangi stok gudang.'
                    : 'Pengiriman (Shipped) dicatat oleh Warehouse Staff setelah pengajuan Outgoing disetujui oleh Warehouse Manager.'}
                </p>
              )}
            </CardContent>
          </Card>

          {/* Processing Timeline Card */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Riwayat Pemrosesan</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-xs">
              <div>
                <p className="text-slate-500">Diajukan</p>
                <p className="mt-0.5 font-semibold text-slate-900">
                  {tx.created_by_name}
                </p>
                <p className="text-slate-500 tabular-nums">
                  {formatDateTime(tx.transaction_date)}
                </p>
              </div>
              {tx.processed_by_name && (
                <div className="pt-2 border-t border-slate-100">
                  <p className="text-slate-500">Diproses Manager</p>
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
                  <p className="text-slate-500">Tujuan / Catatan</p>
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
        </aside>
      </div>

      {/* Handover / Shipped Modal */}
      <Modal
        open={showHandoverModal}
        onClose={() => setShowHandoverModal(false)}
        title={`Catat Pengiriman — ${tx.transaction_code}`}
        description={`Stok gudang akan dikurangi otomatis sebanyak ${totalUnits} unit saat pengiriman ini dicatat.`}
      >
        <form action={handoverAction} className="space-y-3.5">
          <input type="hidden" name="txId" value={tx.id} />
          {handoverState.error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-700">
              {handoverState.error}
            </div>
          )}
          <Input
            name="recipientName"
            label="Nama Penerima / PIC"
            required
            value={handoverForm.recipientName}
            onChange={(e) =>
              setHandoverForm((prev) => ({ ...prev, recipientName: e.target.value }))
            }
            placeholder="Contoh: Budi Santoso (Tim Desain)"
            error={handoverState.fieldErrors?.recipientName}
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Select
              name="recipientType"
              label="Tipe Penerima"
              required
              value={handoverForm.recipientType}
              onChange={(e) =>
                setHandoverForm((prev) => ({ ...prev, recipientType: e.target.value }))
              }
              options={[
                { value: 'internal', label: 'Internal' },
                { value: 'customer', label: 'Pelanggan (Customer)' },
                { value: 'branch', label: 'Cabang (Branch)' },
                { value: 'external', label: 'Pihak Eksternal' },
                { value: 'courier', label: 'Kurir' },
              ]}
            />
            <Select
              name="handoverMethod"
              label="Metode Penyerahan"
              required
              value={handoverForm.handoverMethod}
              onChange={(e) =>
                setHandoverForm((prev) => ({ ...prev, handoverMethod: e.target.value }))
              }
              options={[
                { value: 'direct', label: 'Serah Terima Langsung' },
                { value: 'courier', label: 'Melalui Kurir / Ekspedisi' },
              ]}
            />
          </div>
          <Input
            name="recipientContact"
            label="Kontak Penerima (Opsional)"
            value={handoverForm.recipientContact}
            onChange={(e) =>
              setHandoverForm((prev) => ({
                ...prev,
                recipientContact: e.target.value,
              }))
            }
            placeholder="No. HP atau ekstensi"
          />
          {handoverForm.handoverMethod === 'courier' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 rounded-xl border border-slate-200 bg-[#F4F5F8] p-3">
              <Input
                name="courierName"
                label="Nama Kurir / Ekspedisi"
                required
                value={handoverForm.courierName}
                onChange={(e) =>
                  setHandoverForm((prev) => ({
                    ...prev,
                    courierName: e.target.value,
                  }))
                }
                placeholder="Contoh: JNE / Armada Internal"
                error={handoverState.fieldErrors?.courierName}
              />
              <Input
                name="trackingNumber"
                label="Nomor Resi (Opsional)"
                value={handoverForm.trackingNumber}
                onChange={(e) =>
                  setHandoverForm((prev) => ({
                    ...prev,
                    trackingNumber: e.target.value,
                  }))
                }
                placeholder="Nomor resi pengiriman"
              />
            </div>
          )}
          <div>
            <label
              htmlFor="handover-notes"
              className="block text-xs sm:text-sm font-medium text-slate-700 mb-1"
            >
              Catatan Serah Terima (Opsional)
            </label>
            <textarea
              id="handover-notes"
              name="notes"
              rows={2}
              value={handoverForm.notes}
              onChange={(e) =>
                setHandoverForm((prev) => ({ ...prev, notes: e.target.value }))
              }
              placeholder="Contoh: Barang diserahkan lengkap dalam 2 kardus tersegel."
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-[#3243DD] focus:outline-none focus:ring-2 focus:ring-[#3243DD]/20"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <Button
              variant="secondary"
              onClick={() => setShowHandoverModal(false)}
              disabled={isHandovering}
            >
              Batal
            </Button>
            <Button type="submit" variant="primary" loading={isHandovering}>
              Konfirmasi Pengiriman &amp; Kurangi Stok
            </Button>
          </div>
        </form>
      </Modal>

      {/* Edit Pending Modal (Staff Creator only) */}
      {isCreator && tx.status === 'pending' && (
        <Modal
          open={showEditModal}
          onClose={() => !isMutating && setShowEditModal(false)}
          title={`Ubah Pengajuan Outgoing ${tx.transaction_code}`}
          description="Sesuaikan tanggal pengiriman, Customer/Penerima, catatan, atau daftar item selama pengajuan masih berstatus Pending."
          maxWidthClass="max-w-2xl"
        >
          <form onSubmit={handleEditSubmit} className="space-y-4">
            {editError && (
              <div
                role="alert"
                className="rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-700"
              >
                {editError}
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Input
                label="Tanggal Pengiriman"
                type="date"
                required
                value={editForm.shipmentDate}
                onChange={(e) =>
                  setEditForm((prev) => ({ ...prev, shipmentDate: e.target.value }))
                }
              />
              <Input
                label="Nama Customer / Penerima"
                required
                minLength={2}
                value={editForm.recipientName}
                onChange={(e) =>
                  setEditForm((prev) => ({ ...prev, recipientName: e.target.value }))
                }
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs sm:text-sm font-semibold text-slate-800">
                  Daftar Barang Keluar <span className="text-[#FF3D8B]">*</span>
                </label>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() =>
                    setEditForm((prev) => ({
                      ...prev,
                      items: [...prev.items, { productId: '', quantity: '1' }],
                    }))
                  }
                >
                  <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                  Tambah Item
                </Button>
              </div>
              <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                {editForm.items.map((row, idx) => (
                  <div
                    key={idx}
                    className="grid grid-cols-1 sm:grid-cols-[1fr_100px_auto] gap-2 items-center rounded-xl border border-slate-200 bg-[#F4F5F8] p-2.5"
                  >
                    <SearchableProductSelect
                      value={row.productId}
                      onChange={(val) => {
                        setEditForm((prev) => ({
                          ...prev,
                          items: prev.items.map((it, i) =>
                            i === idx ? { ...it, productId: val } : it
                          ),
                        }));
                      }}
                      required
                      ariaLabel={`Produk baris ${idx + 1}`}
                      placeholder="Cari nama atau SKU produk..."
                      products={availableProducts}
                      isOptionDisabled={(p) => Number(p.stock) <= 0}
                      getOptionMeta={(p) =>
                        `${p.sku} • Stok: ${p.stock} ${p.unit || 'unit'}`
                      }
                      getOptionBadge={(p) =>
                        Number(p.stock) <= 0
                          ? { text: 'HABIS', toneClass: 'bg-slate-200 text-slate-700' }
                          : null
                      }
                    />
                    <input
                      type="number"
                      min="1"
                      step="1"
                      required
                      value={row.quantity}
                      onChange={(e) => {
                        const val = e.target.value;
                        setEditForm((prev) => ({
                          ...prev,
                          items: prev.items.map((it, i) =>
                            i === idx ? { ...it, quantity: val } : it
                          ),
                        }));
                      }}
                      className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm tabular-nums focus:border-[#3243DD] focus:outline-none"
                    />
                    {editForm.items.length > 1 && (
                      <button
                        type="button"
                        onClick={() =>
                          setEditForm((prev) => ({
                            ...prev,
                            items: prev.items.filter((_, i) => i !== idx),
                          }))
                        }
                        className="rounded-lg p-2 text-red-600 hover:bg-red-100 cursor-pointer"
                        aria-label="Hapus baris item"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div>
              <label
                htmlFor="edit-out-notes"
                className="block text-xs sm:text-sm font-medium text-slate-700 mb-1"
              >
                Tujuan / Catatan Pengeluaran
              </label>
              <textarea
                id="edit-out-notes"
                rows={2}
                value={editForm.notes}
                onChange={(e) =>
                  setEditForm((prev) => ({ ...prev, notes: e.target.value }))
                }
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-[#3243DD] focus:outline-none focus:ring-2 focus:ring-[#3243DD]/20"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <Button
                variant="secondary"
                onClick={() => setShowEditModal(false)}
                disabled={isMutating}
              >
                Batal
              </Button>
              <Button type="submit" variant="primary" loading={isMutating}>
                Simpan Perubahan
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* Reject Modal */}
      <Modal
        open={showRejectModal}
        onClose={() => setShowRejectModal(false)}
        title={`Tolak Outgoing ${tx.transaction_code}`}
        description="Penolakan tidak mengurangi stok gudang. Berikan alasan agar Staff dapat menindaklanjuti."
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
              htmlFor="out-reject-reason"
              className="block text-xs sm:text-sm font-medium text-slate-700 mb-1.5"
            >
              Alasan Penolakan <span className="text-[#FF3D8B]">*</span>
            </label>
            <textarea
              id="out-reject-reason"
              name="rejectionReason"
              rows={3}
              required
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              placeholder="Contoh: Permintaan melebihi alokasi unit atau perlu verifikasi ulang."
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
              Tolak Pengajuan
            </Button>
          </div>
        </form>
      </Modal>

      <Dialog
        open={Boolean(confirmDialog)}
        onClose={() => {
          if (!isMutating) {
            setConfirmDialog(null);
            setConfirmError(null);
          }
        }}
        onConfirm={() => runSingleAction(confirmDialog)}
        title={confirmDialog?.title || ''}
        message={confirmDialog?.message || ''}
        confirmLabel={confirmDialog?.label || 'Konfirmasi'}
        confirmVariant={confirmDialog?.variant || 'primary'}
        loading={isMutating}
      >
        {confirmError && (
          <div
            role="alert"
            className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-700"
          >
            {confirmError}
          </div>
        )}
      </Dialog>
    </div>
  );
}
