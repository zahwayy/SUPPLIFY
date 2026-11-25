'use client';

import { useActionState, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  CheckCircle2,
  XCircle,
  Search,
  Building2,
  Eye,
  X,
  FileText,
  Clock,
} from 'lucide-react';
import {
  approveSupplierAction,
  rejectSupplierAction,
  markAppealUnderReviewAction,
  approveSupplierAppealAction,
  rejectSupplierAppealAction,
} from '../../modules/suppliers/supplierActions.js';
import { getSupplierAppealStatusMeta } from '../../lib/utils/labels.js';
import { formatDateTime } from '../../lib/utils/format.js';
import PageHeader from '../shared/PageHeader.jsx';
import StatusPill from '../shared/StatusPill.jsx';
import FeedbackBanner from '../shared/FeedbackBanner.jsx';
import ExportCsvButton from '../shared/ExportCsvButton.jsx';
import Badge from '../ui/Badge.jsx';
import Button from '../ui/Button.jsx';
import Modal from '../ui/Modal.jsx';
import Dialog from '../ui/Dialog.jsx';
import { useToast } from '../ui/ToastProvider.jsx';
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

export default function SupplierVerificationManager({
  suppliers,
  initialFilters,
  canExport = false,
}) {
  const router = useRouter();
  const toast = useToast();
  const [search, setSearch] = useState(initialFilters.search || '');
  const [status, setStatus] = useState(initialFilters.status || '');
  const [detailTarget, setDetailTarget] = useState(null);
  const [approveTarget, setApproveTarget] = useState(null);
  const [rejectTarget, setRejectTarget] = useState(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [approveAppealTarget, setApproveAppealTarget] = useState(null);
  const [approveAppealNotes, setApproveAppealNotes] = useState('');
  const [rejectAppealTarget, setRejectAppealTarget] = useState(null);
  const [rejectAppealNotes, setRejectAppealNotes] = useState('');
  const [feedback, setFeedback] = useState(null);
  const [isApproving, startApprove] = useTransition();
  const [isMarkingAppealReview, startMarkAppealReview] = useTransition();

  const [rejectState, rejectAction, isRejecting] = useActionState(
    async (prev, fd) => {
      const res = await rejectSupplierAction(prev, fd);
      if (res.ok) {
        setRejectTarget(null);
        setDetailTarget(null);
        setRejectionReason('');
        setFeedback({ type: 'success', text: res.message });
      } else if (res?.error) {
        toast.error(res.error);
      }
      return res;
    },
    emptyActionState
  );

  const [approveAppealState, approveAppealFormAction, isApprovingAppeal] = useActionState(
    async (prev, fd) => {
      const res = await approveSupplierAppealAction(prev, fd);
      if (res.ok) {
        setApproveAppealTarget(null);
        setDetailTarget(null);
        setApproveAppealNotes('');
        setFeedback({ type: 'success', text: res.message });
        toast.success(res.message);
        router.refresh();
      } else if (res?.error) {
        toast.error(res.error);
      }
      return res;
    },
    emptyActionState
  );

  const [rejectAppealState, rejectAppealFormAction, isRejectingAppeal] = useActionState(
    async (prev, fd) => {
      const res = await rejectSupplierAppealAction(prev, fd);
      if (res.ok) {
        setRejectAppealTarget(null);
        setDetailTarget(null);
        setRejectAppealNotes('');
        setFeedback({ type: 'success', text: res.message });
        toast.success(res.message);
        router.refresh();
      } else if (res?.error) {
        toast.error(res.error);
      }
      return res;
    },
    emptyActionState
  );

  const hasActiveFilters = Boolean(initialFilters.search || initialFilters.status);

  function pushFilters(overrides = {}) {
    const next = { search, status, ...overrides };
    const params = new URLSearchParams();
    if (next.search?.trim()) params.set('search', next.search.trim());
    if (next.status) params.set('status', next.status);
    router.push(
      `/supplier-verification${params.toString() ? `?${params.toString()}` : ''}`
    );
  }

  function resetFilters() {
    setSearch('');
    setStatus('');
    router.push('/supplier-verification');
  }

  function handleApproveConfirm() {
    if (!approveTarget) return;
    startApprove(async () => {
      const res = await approveSupplierAction(approveTarget.id);
      setApproveTarget(null);
      setDetailTarget(null);
      if (res.ok) {
        setFeedback({ type: 'success', text: res.message });
      } else {
        setFeedback({ type: 'error', text: res.error });
      }
    });
  }

  function handleMarkAppealUnderReview(appealId) {
    startMarkAppealReview(async () => {
      const res = await markAppealUnderReviewAction(appealId);
      if (res.ok) {
        setDetailTarget((prev) =>
          prev?.latest_appeal?.id === appealId
            ? {
                ...prev,
                latest_appeal: {
                  ...prev.latest_appeal,
                  status: 'under_review',
                },
              }
            : prev
        );
        setFeedback({ type: 'success', text: res.message });
        toast.success(res.message);
        router.refresh();
      } else {
        setFeedback({ type: 'error', text: res.error });
        toast.error(res.error);
      }
    });
  }

  const tabs = [
    { value: '', label: 'Semua' },
    { value: 'pending', label: 'Menunggu Verifikasi' },
    { value: 'appeals', label: 'Pengajuan Banding' },
    { value: 'active', label: 'Aktif' },
    { value: 'rejected', label: 'Ditolak' },
  ];

  return (
    <div className="space-y-5">
      <PageHeader
        title="Verifikasi Supplier"
        description="Tinjau informasi perusahaan dan kategori barang mitra supplier sebelum mengaktifkan akses mereka ke portal Purchase Order."
        actions={
          canExport ? (
            <ExportCsvButton
              resource="suppliers"
              filters={{
                search: initialFilters.search,
                status: initialFilters.status,
              }}
              onFeedback={setFeedback}
            />
          ) : null
        }
      />

      <FeedbackBanner feedback={feedback} onDismiss={() => setFeedback(null)} />

      <Card variant="neutral">
        <CardContent className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex flex-wrap gap-1.5">
            {tabs.map((tab) => (
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
                placeholder="Cari perusahaan, PIC, atau email..."
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

      {suppliers.length > 0 ? (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Perusahaan</TableHead>
              <TableHead>Penanggung Jawab</TableHead>
              <TableHead>Kategori Barang</TableHead>
              <TableHead>Email &amp; Telepon</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Terdaftar</TableHead>
              <TableHead className="text-right">Aksi</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {suppliers.map((sup) => (
              <TableRow key={sup.id}>
                <TableCell className="font-semibold text-slate-900">
                  {sup.company_name}
                </TableCell>
                <TableCell className="text-xs sm:text-sm text-slate-700">
                  {sup.contact_name}
                </TableCell>
                <TableCell className="max-w-[220px]">
                  {Array.isArray(sup.categories) && sup.categories.length > 0 ? (
                    <div className="flex flex-wrap gap-1">
                      {sup.categories.map((cat) => (
                        <Badge key={cat.id} tone="info">
                          {cat.name}
                        </Badge>
                      ))}
                    </div>
                  ) : (
                    <span className="text-xs text-slate-400">Belum dipilih</span>
                  )}
                </TableCell>
                <TableCell className="text-xs">
                  <p className="font-medium text-slate-900">{sup.email}</p>
                  <p className="text-slate-500">{sup.phone}</p>
                </TableCell>
                <TableCell>
                  <div className="flex flex-col items-start gap-1">
                    <StatusPill status={sup.status} />
                    {sup.latest_appeal && (
                      <Badge
                        tone={getSupplierAppealStatusMeta(sup.latest_appeal.status).tone}
                      >
                        {getSupplierAppealStatusMeta(sup.latest_appeal.status).label}
                      </Badge>
                    )}
                  </div>
                </TableCell>
                <TableCell className="text-xs text-slate-600 tabular-nums whitespace-nowrap">
                  {formatDateTime(sup.created_at)}
                </TableCell>
                <TableCell className="text-right whitespace-nowrap">
                  <div className="inline-flex items-center gap-1.5">
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={() => setDetailTarget(sup)}
                    >
                      <Eye className="h-3.5 w-3.5" aria-hidden="true" />
                      Lihat Detail
                    </Button>
                    {sup.status === 'rejected' &&
                      ['submitted', 'under_review'].includes(sup.latest_appeal?.status) && (
                        <Button
                          type="button"
                          variant="primary"
                          size="sm"
                          onClick={() => setDetailTarget(sup)}
                        >
                          <FileText className="h-3.5 w-3.5" aria-hidden="true" />
                          Tinjau Banding
                        </Button>
                      )}
                    {sup.status === 'pending' && (
                      <>
                        <Button
                          variant="primary"
                          size="sm"
                          onClick={() => setApproveTarget(sup)}
                        >
                          <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                          Setujui
                        </Button>
                        <Button
                          variant="danger"
                          size="sm"
                          onClick={() => {
                            setRejectionReason('');
                            setRejectTarget(sup);
                          }}
                        >
                          <XCircle className="h-3.5 w-3.5" aria-hidden="true" />
                          Tolak
                        </Button>
                      </>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      ) : (
        <EmptyState
          icon={Building2}
          title={
            hasActiveFilters
              ? 'Tidak Ada Supplier yang Cocok'
              : 'Belum Ada Pengajuan Supplier'
          }
          description={
            hasActiveFilters
              ? 'Ubah status atau kata kunci pencarian untuk melihat daftar mitra supplier lainnya.'
              : 'Supplier yang mendaftar melalui halaman registrasi akan tampil di sini untuk ditinjau Admin.'
          }
          action={
            hasActiveFilters && (
              <Button variant="secondary" onClick={resetFilters}>
                Reset Pencarian
              </Button>
            )
          }
        />
      )}

      {/* Detail Modal (with direct Approve/Reject actions for Pending & Appeal Review for Rejected) */}
      <Modal
        open={Boolean(detailTarget)}
        onClose={() => setDetailTarget(null)}
        title={detailTarget?.company_name || 'Profil Supplier'}
        description="Informasi pendaftaran, status verifikasi, dan riwayat pengajuan banding perusahaan supplier."
        footer={
          detailTarget?.status === 'pending' ? (
            <>
              <Button
                type="button"
                variant="danger"
                onClick={() => {
                  setRejectionReason('');
                  setRejectTarget(detailTarget);
                }}
              >
                <XCircle className="h-4 w-4" aria-hidden="true" />
                Tolak Pendaftaran
              </Button>
              <Button
                type="button"
                variant="primary"
                onClick={() => setApproveTarget(detailTarget)}
              >
                <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                Setujui &amp; Aktifkan
              </Button>
            </>
          ) : detailTarget?.status === 'rejected' &&
            ['submitted', 'under_review'].includes(detailTarget.latest_appeal?.status) ? (
            <>
              {detailTarget.latest_appeal.status === 'submitted' && (
                <Button
                  type="button"
                  variant="secondary"
                  loading={isMarkingAppealReview}
                  onClick={() =>
                    handleMarkAppealUnderReview(detailTarget.latest_appeal.id)
                  }
                >
                  <Clock className="h-4 w-4" aria-hidden="true" />
                  Tandai Ditinjau
                </Button>
              )}
              <Button
                type="button"
                variant="danger"
                onClick={() => {
                  setRejectAppealNotes('');
                  setRejectAppealTarget(detailTarget);
                }}
              >
                <XCircle className="h-4 w-4" aria-hidden="true" />
                Tolak Banding
              </Button>
              <Button
                type="button"
                variant="primary"
                onClick={() => {
                  setApproveAppealNotes('');
                  setApproveAppealTarget(detailTarget);
                }}
              >
                <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                Setujui Banding &amp; Aktifkan
              </Button>
            </>
          ) : null
        }
      >
        {detailTarget && (
          <div className="space-y-3.5 text-sm">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <span className="text-xs text-slate-500">Status Verifikasi</span>
              <StatusPill status={detailTarget.status} />
            </div>
            <div>
              <p className="text-xs text-slate-500">Nama Akun &amp; Penanggung Jawab</p>
              <p className="mt-0.5 font-semibold text-slate-900">
                {detailTarget.account_name} (PIC: {detailTarget.contact_name})
              </p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Email &amp; Telepon</p>
              <p className="mt-0.5 font-semibold text-slate-900">
                {detailTarget.email} • {detailTarget.phone}
              </p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Alamat Perusahaan</p>
              <p className="mt-0.5 text-slate-700 leading-relaxed">
                {detailTarget.address}
              </p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Kategori Barang yang Disediakan</p>
              {Array.isArray(detailTarget.categories) &&
              detailTarget.categories.length > 0 ? (
                <div className="mt-1 flex flex-wrap gap-1.5">
                  {detailTarget.categories.map((cat) => (
                    <Badge key={cat.id} tone="info">
                      {cat.code ? `${cat.name} (${cat.code})` : cat.name}
                    </Badge>
                  ))}
                </div>
              ) : (
                <p className="mt-0.5 text-xs text-slate-400">Belum dipilih</p>
              )}
            </div>
            <div>
              <p className="text-xs text-slate-500">Tanggal Pendaftaran</p>
              <p className="mt-0.5 text-slate-700 tabular-nums">
                {formatDateTime(detailTarget.created_at)}
              </p>
            </div>
            {detailTarget.verified_at && (
              <div className="pt-2.5 border-t border-slate-100 text-xs text-slate-600 tabular-nums">
                Diproses oleh <strong>{detailTarget.verified_by_name || 'Admin'}</strong>{' '}
                pada {formatDateTime(detailTarget.verified_at)}
              </div>
            )}
            {detailTarget.rejection_reason && (
              <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-800">
                <p className="font-semibold">Alasan Penolakan:</p>
                <p className="mt-1 leading-relaxed">{detailTarget.rejection_reason}</p>
              </div>
            )}
            {detailTarget.latest_appeal && (
              <div className="rounded-xl border border-slate-200 bg-[#F4F5F8] p-3.5 space-y-2.5 text-xs">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-2">
                  <span className="font-semibold text-slate-900">
                    Pengajuan Banding Terbaru
                  </span>
                  <Badge
                    tone={
                      getSupplierAppealStatusMeta(detailTarget.latest_appeal.status).tone
                    }
                  >
                    {
                      getSupplierAppealStatusMeta(detailTarget.latest_appeal.status)
                        .label
                    }
                  </Badge>
                </div>
                <div>
                  <p className="text-slate-500 font-medium">Penjelasan Supplier:</p>
                  <p className="mt-0.5 text-slate-800 leading-relaxed whitespace-pre-line">
                    {detailTarget.latest_appeal.appeal_reason}
                  </p>
                </div>
                {detailTarget.latest_appeal.proposed_updates &&
                  Object.keys(detailTarget.latest_appeal.proposed_updates).length > 0 && (
                    <div className="rounded-lg border border-slate-200 bg-white p-2.5 space-y-1">
                      <p className="font-semibold text-slate-700">
                        Pembaruan Data yang Diajukan:
                      </p>
                      {detailTarget.latest_appeal.proposed_updates.companyName && (
                        <p className="text-slate-600">
                          Perusahaan:{' '}
                          <span className="font-medium text-slate-900">
                            {detailTarget.latest_appeal.proposed_updates.companyName}
                          </span>
                        </p>
                      )}
                      {detailTarget.latest_appeal.proposed_updates.contactName && (
                        <p className="text-slate-600">
                          PIC:{' '}
                          <span className="font-medium text-slate-900">
                            {detailTarget.latest_appeal.proposed_updates.contactName}
                          </span>
                        </p>
                      )}
                      {detailTarget.latest_appeal.proposed_updates.phone && (
                        <p className="text-slate-600">
                          Telepon:{' '}
                          <span className="font-medium text-slate-900">
                            {detailTarget.latest_appeal.proposed_updates.phone}
                          </span>
                        </p>
                      )}
                      {detailTarget.latest_appeal.proposed_updates.address && (
                        <p className="text-slate-600">
                          Alamat:{' '}
                          <span className="font-medium text-slate-900">
                            {detailTarget.latest_appeal.proposed_updates.address}
                          </span>
                        </p>
                      )}
                      {detailTarget.latest_appeal.proposed_updates.additionalNotes && (
                        <p className="text-slate-600">
                          Catatan Tambahan:{' '}
                          <span className="text-slate-800">
                            {detailTarget.latest_appeal.proposed_updates.additionalNotes}
                          </span>
                        </p>
                      )}
                    </div>
                  )}
                {detailTarget.latest_appeal.admin_decision_notes && (
                  <div className="rounded-lg border border-slate-200 bg-white p-2.5">
                    <p className="font-semibold text-slate-700">
                      Catatan Keputusan Admin:
                    </p>
                    <p className="mt-0.5 text-slate-700 leading-relaxed">
                      {detailTarget.latest_appeal.admin_decision_notes}
                    </p>
                  </div>
                )}
                <p className="text-[11px] text-slate-500 tabular-nums">
                  Diajukan {formatDateTime(detailTarget.latest_appeal.created_at)}
                  {detailTarget.latest_appeal.reviewed_at
                    ? ` • Ditinjau oleh ${detailTarget.latest_appeal.reviewed_by_name || 'Admin'} pada ${formatDateTime(detailTarget.latest_appeal.reviewed_at)}`
                    : ''}
                </p>
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* Approve Confirmation Dialog */}
      <Dialog
        open={Boolean(approveTarget)}
        onClose={() => setApproveTarget(null)}
        onConfirm={handleApproveConfirm}
        title="Setujui Pendaftaran Supplier"
        message={`Menyetujui "${approveTarget?.company_name || ''}" akan mengaktifkan akun sehingga supplier dapat login dan menerima Purchase Order dari Warehouse Manager. Lanjutkan verifikasi?`}
        confirmLabel="Aktifkan Supplier"
        confirmVariant="primary"
        loading={isApproving}
      />

      {/* Reject Reason Modal */}
      <Modal
        open={Boolean(rejectTarget)}
        onClose={() => setRejectTarget(null)}
        title="Tolak Pendaftaran Supplier"
        description={`Berikan alasan penolakan yang jelas untuk "${rejectTarget?.company_name || ''}". Alasan ini akan ditampilkan kepada pendaftar.`}
      >
        <form action={rejectAction} className="space-y-4">
          <input type="hidden" name="supplierId" value={rejectTarget?.id || ''} />

          {rejectState.error && (
            <div
              role="alert"
              className="rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-700"
            >
              {rejectState.error}
            </div>
          )}

          <div>
            <label
              htmlFor="sup-reject-reason"
              className="block text-xs sm:text-sm font-medium text-slate-700 mb-1.5"
            >
              Alasan Penolakan <span className="text-[#FF3D8B]">*</span>
            </label>
            <textarea
              id="sup-reject-reason"
              name="rejectionReason"
              rows={3}
              required
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              placeholder="Contoh: Data perusahaan atau nomor kontak tidak dapat diverifikasi."
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-[#3243DD] focus:outline-none focus:ring-2 focus:ring-[#3243DD]/20"
            />
            {rejectState.fieldErrors?.rejectionReason && (
              <p className="mt-1 text-xs font-medium text-red-600">
                {rejectState.fieldErrors.rejectionReason}
              </p>
            )}
          </div>

          <div className="flex justify-end gap-2.5 pt-2 border-t border-slate-100">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setRejectTarget(null)}
              disabled={isRejecting}
            >
              Batal
            </Button>
            <Button type="submit" variant="danger" loading={isRejecting}>
              Tolak Supplier
            </Button>
          </div>
        </form>
      </Modal>

      {/* Approve Appeal Modal */}
      <Modal
        open={Boolean(approveAppealTarget)}
        onClose={() => {
          if (!isApprovingAppeal) setApproveAppealTarget(null);
        }}
        title="Setujui Banding & Aktifkan Supplier"
        description={`Menyetujui banding "${approveAppealTarget?.company_name || ''}" akan memperbarui data supplier yang diajukan dan mengaktifkan akun agar dapat masuk ke sistem.`}
      >
        <form action={approveAppealFormAction} className="space-y-4">
          <input
            type="hidden"
            name="appealId"
            value={approveAppealTarget?.latest_appeal?.id || ''}
          />

          {approveAppealState.error && (
            <div
              role="alert"
              className="rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-700"
            >
              {approveAppealState.error}
            </div>
          )}

          <div>
            <label
              htmlFor="appeal-approve-notes"
              className="block text-xs sm:text-sm font-medium text-slate-700 mb-1.5"
            >
              Catatan Keputusan (Opsional)
            </label>
            <textarea
              id="appeal-approve-notes"
              name="adminDecisionNotes"
              rows={3}
              value={approveAppealNotes}
              onChange={(e) => setApproveAppealNotes(e.target.value)}
              placeholder="Contoh: Klarifikasi dokumen dan nomor PIC telah diverifikasi."
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-[#3243DD] focus:outline-none focus:ring-2 focus:ring-[#3243DD]/20"
            />
          </div>

          <div className="flex justify-end gap-2.5 pt-2 border-t border-slate-100">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setApproveAppealTarget(null)}
              disabled={isApprovingAppeal}
            >
              Batal
            </Button>
            <Button type="submit" variant="primary" loading={isApprovingAppeal}>
              Setujui Banding &amp; Aktifkan
            </Button>
          </div>
        </form>
      </Modal>

      {/* Reject Appeal Modal */}
      <Modal
        open={Boolean(rejectAppealTarget)}
        onClose={() => {
          if (!isRejectingAppeal) setRejectAppealTarget(null);
        }}
        title="Tolak Pengajuan Banding"
        description={`Berikan catatan keputusan untuk penolakan banding "${rejectAppealTarget?.company_name || ''}". Penolakan banding bersifat final (maksimal 1 kali banding) dan supplier akan diarahkan untuk mendaftar ulang.`}
      >
        <form action={rejectAppealFormAction} className="space-y-4">
          <input
            type="hidden"
            name="appealId"
            value={rejectAppealTarget?.latest_appeal?.id || ''}
          />

          {rejectAppealState.error && (
            <div
              role="alert"
              className="rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-700"
            >
              {rejectAppealState.error}
            </div>
          )}

          <div>
            <label
              htmlFor="appeal-reject-notes"
              className="block text-xs sm:text-sm font-medium text-slate-700 mb-1.5"
            >
              Catatan Keputusan Admin <span className="text-[#FF3D8B]">*</span>
            </label>
            <textarea
              id="appeal-reject-notes"
              name="adminDecisionNotes"
              rows={3}
              required
              value={rejectAppealNotes}
              onChange={(e) => setRejectAppealNotes(e.target.value)}
              placeholder="Jelaskan kekurangan informasi atau alasan banding belum dapat disetujui."
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-[#3243DD] focus:outline-none focus:ring-2 focus:ring-[#3243DD]/20"
            />
            {rejectAppealState.fieldErrors?.adminDecisionNotes && (
              <p className="mt-1 text-xs font-medium text-red-600">
                {rejectAppealState.fieldErrors.adminDecisionNotes}
              </p>
            )}
          </div>

          <div className="flex justify-end gap-2.5 pt-2 border-t border-slate-100">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setRejectAppealTarget(null)}
              disabled={isRejectingAppeal}
            >
              Batal
            </Button>
            <Button type="submit" variant="danger" loading={isRejectingAppeal}>
              Tolak Banding
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
