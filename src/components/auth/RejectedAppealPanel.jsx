'use client';

import { useActionState, useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  XCircle,
  ArrowLeft,
  Bell,
  ChevronDown,
  ChevronUp,
  Send,
  Pencil,
  Clock,
  Check,
  Building2,
} from 'lucide-react';
import {
  submitSupplierAppealAction,
  updateSupplierAppealAction,
} from '../../modules/suppliers/supplierActions.js';
import { markRejectedNoticeReadAction } from '../../modules/notifications/notificationActions.js';
import { formatDateTime } from '../../lib/utils/format.js';
import { getSupplierAppealStatusMeta } from '../../lib/utils/labels.js';
import StatusPill from '../shared/StatusPill.jsx';
import FeedbackBanner from '../shared/FeedbackBanner.jsx';
import Badge from '../ui/Badge.jsx';
import Button from '../ui/Button.jsx';
import Input from '../ui/Input.jsx';

const emptyActionState = { ok: false, error: null, message: '', fieldErrors: null };

export default function RejectedAppealPanel({ context }) {
  const router = useRouter();
  const {
    supplier,
    latestAppeal,
    notifications = [],
  } = context;

  const isUpdateMode = latestAppeal?.status === 'submitted';
  const isUnderReview = latestAppeal?.status === 'under_review';
  const isAppealExhausted = latestAppeal?.status === 'rejected';
  const canAppealOrEdit = !latestAppeal || isUpdateMode;

  const initialProposed =
    isUpdateMode && latestAppeal?.proposed_updates
      ? latestAppeal.proposed_updates
      : {};

  const [showForm, setShowForm] = useState(false);
  const [showPrevRegistration, setShowPrevRegistration] = useState(false);
  const [showCorrections, setShowCorrections] = useState(
    Boolean(
      initialProposed.companyName ||
        initialProposed.contactName ||
        initialProposed.phone ||
        initialProposed.address ||
        initialProposed.additionalNotes
    )
  );
  const [feedback, setFeedback] = useState(null);

  const [appealReason, setAppealReason] = useState(
    isUpdateMode ? latestAppeal.appeal_reason || '' : ''
  );
  const [companyName, setCompanyName] = useState(
    initialProposed.companyName || supplier.company_name || ''
  );
  const [contactName, setContactName] = useState(
    initialProposed.contactName || supplier.contact_name || ''
  );
  const [phone, setPhone] = useState(initialProposed.phone || supplier.phone || '');
  const [address, setAddress] = useState(
    initialProposed.address || supplier.address || ''
  );
  const [additionalNotes, setAdditionalNotes] = useState(
    initialProposed.additionalNotes || ''
  );

  const [isNotifPending, startNotifTransition] = useTransition();

  const [submitState, submitAction, isSubmitting] = useActionState(
    async (prev, fd) => {
      const actionFn = isUpdateMode
        ? updateSupplierAppealAction
        : submitSupplierAppealAction;
      const res = await actionFn(prev, fd);
      if (res.ok) {
        setShowForm(false);
        setFeedback({ type: 'success', text: res.message });
        router.refresh();
      } else if (res?.error) {
        setFeedback({ type: 'error', text: res.error });
      }
      return res;
    },
    emptyActionState
  );

  function openAppealForm() {
    if (isUpdateMode && latestAppeal) {
      setAppealReason(latestAppeal.appeal_reason || '');
      const pu = latestAppeal.proposed_updates || {};
      setCompanyName(pu.companyName || supplier.company_name || '');
      setContactName(pu.contactName || supplier.contact_name || '');
      setPhone(pu.phone || supplier.phone || '');
      setAddress(pu.address || supplier.address || '');
      setAdditionalNotes(pu.additionalNotes || '');
    } else {
      setAppealReason('');
      setCompanyName(supplier.company_name || '');
      setContactName(supplier.contact_name || '');
      setPhone(supplier.phone || '');
      setAddress(supplier.address || '');
      setAdditionalNotes('');
    }
    setFeedback(null);
    setShowForm(true);
  }

  function handleMarkRead(notifId) {
    startNotifTransition(async () => {
      await markRejectedNoticeReadAction(notifId);
      router.refresh();
    });
  }

  const appealMeta = latestAppeal ? getSupplierAppealStatusMeta(latestAppeal.status) : null;

  return (
    <div className="space-y-5 text-left">
      <div className="text-center space-y-2.5">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-red-50 border border-red-200 text-red-600">
          <XCircle className="h-7 w-7" aria-hidden="true" />
        </div>

        <div className="flex flex-wrap items-center justify-center gap-2">
          <StatusPill status="rejected" labelOverride="Pendaftaran Ditolak" />
          {appealMeta && <Badge tone={appealMeta.tone}>{appealMeta.label}</Badge>}
        </div>

        <div>
          <h2 className="text-xl font-bold text-slate-900">
            Akun Supplier Tidak Disetujui
          </h2>
          <p className="mt-1.5 text-sm text-slate-600 leading-relaxed">
            Pendaftaran akun <strong>{supplier.company_name}</strong> belum disetujui Admin.
            Anda dapat membaca alasan penolakan dan mengajukan banding peninjauan kembali.
          </p>
        </div>
      </div>

      <FeedbackBanner feedback={feedback} onDismiss={() => setFeedback(null)} />

      {/* Alasan Penolakan dari Admin */}
      <div className="rounded-2xl bg-red-50/70 border border-red-200 p-4 text-sm space-y-1.5">
        <p className="text-xs font-semibold uppercase tracking-wider text-red-700">
          Alasan Penolakan dari Admin
        </p>
        <p className="text-slate-800 leading-relaxed">
          {supplier.rejection_reason ||
            'Tidak ada catatan tambahan dari Admin.'}
        </p>
      </div>

      {/* Ringkasan Notifikasi Penolakan & Banding */}
      {notifications.length > 0 && (
        <div className="rounded-2xl border border-slate-200 bg-[#F4F5F8]/70 p-3.5 space-y-2.5">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-600">
            <Bell className="h-3.5 w-3.5 text-[#3243DD]" aria-hidden="true" />
            <span>Notifikasi Status</span>
          </div>
          <ul className="space-y-2">
            {notifications.slice(0, 4).map((n) => (
              <li
                key={n.id}
                className={`rounded-xl border p-2.5 text-xs ${
                  n.is_read
                    ? 'bg-white border-slate-200/80 text-slate-600'
                    : 'bg-[#EEF1FD]/60 border-[#3243DD]/25 text-slate-800'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="font-semibold text-slate-900">{n.title}</p>
                  <span className="text-[10px] text-slate-400 tabular-nums shrink-0">
                    {formatDateTime(n.created_at)}
                  </span>
                </div>
                <p className="mt-1 leading-relaxed">{n.message}</p>
                {!n.is_read && (
                  <button
                    type="button"
                    disabled={isNotifPending}
                    onClick={() => handleMarkRead(n.id)}
                    className="mt-1.5 inline-flex items-center gap-1 text-[11px] font-semibold text-[#3243DD] hover:underline cursor-pointer"
                  >
                    <Check className="h-3 w-3" aria-hidden="true" />
                    Tandai sudah dibaca
                  </button>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Tinjauan Data Registrasi Sebelumnya (Collapsible) */}
      <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
        <button
          type="button"
          onClick={() => setShowPrevRegistration((prev) => !prev)}
          aria-expanded={showPrevRegistration}
          className="w-full flex items-center justify-between gap-2 px-4 py-3 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
        >
          <span className="inline-flex items-center gap-2">
            <Building2 className="h-4 w-4 text-[#3243DD]" aria-hidden="true" />
            Lihat Data Registrasi Sebelumnya
          </span>
          {showPrevRegistration ? (
            <ChevronUp className="h-4 w-4 text-slate-500" aria-hidden="true" />
          ) : (
            <ChevronDown className="h-4 w-4 text-slate-500" aria-hidden="true" />
          )}
        </button>

        {showPrevRegistration && (
          <dl className="px-4 pb-3.5 pt-1 border-t border-slate-100 space-y-2 text-xs">
            <div className="flex justify-between gap-3">
              <dt className="text-slate-500">Nama Akun &amp; Email</dt>
              <dd className="font-medium text-slate-900 text-right">
                {supplier.account_name} ({supplier.email})
              </dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-slate-500">Perusahaan</dt>
              <dd className="font-semibold text-slate-900 text-right">
                {supplier.company_name}
              </dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-slate-500">Penanggung Jawab (PIC)</dt>
              <dd className="font-medium text-slate-900 text-right">
                {supplier.contact_name}
              </dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-slate-500">Nomor Telepon</dt>
              <dd className="font-medium text-slate-900 text-right">
                {supplier.phone}
              </dd>
            </div>
            <div>
              <dt className="text-slate-500">Alamat Perusahaan</dt>
              <dd className="mt-0.5 text-slate-800 leading-relaxed">
                {supplier.address}
              </dd>
            </div>
            <div>
              <dt className="text-slate-500">Kategori Barang</dt>
              <dd className="mt-1 flex flex-wrap gap-1">
                {Array.isArray(supplier.categories) && supplier.categories.length > 0 ? (
                  supplier.categories.map((cat) => (
                    <Badge key={cat.id} tone="info">
                      {cat.name}
                    </Badge>
                  ))
                ) : (
                  <span className="text-slate-400">Tidak ada kategori</span>
                )}
              </dd>
            </div>
          </dl>
        )}
      </div>

      {/* Status Banding Aktif atau Hasil Peninjauan Banding Terakhir */}
      {latestAppeal && !showForm && (
        <div
          className={`rounded-2xl border p-4 text-xs sm:text-sm space-y-2 ${
            latestAppeal.status === 'under_review'
              ? 'bg-[#EEF1FD]/65 border-[#3243DD]/25'
              : latestAppeal.status === 'submitted'
              ? 'bg-amber-50/75 border-amber-200'
              : 'bg-red-50/50 border-red-200'
          }`}
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="inline-flex items-center gap-1.5 font-semibold text-slate-900">
              <Clock className="h-4 w-4 text-[#3243DD]" aria-hidden="true" />
              Status Pengajuan Banding
            </span>
            <Badge tone={appealMeta.tone}>{appealMeta.label}</Badge>
          </div>

          <p className="text-xs text-slate-600 tabular-nums">
            Dikirim pada {formatDateTime(latestAppeal.created_at)}
          </p>

          <div className="rounded-xl bg-white border border-slate-200/80 p-3 text-xs text-slate-700 space-y-1">
            <p className="font-semibold text-slate-900">Penjelasan Banding Anda:</p>
            <p className="leading-relaxed whitespace-pre-line">{latestAppeal.appeal_reason}</p>
          </div>

          {latestAppeal.status === 'rejected' && latestAppeal.admin_decision_notes && (
            <div className="rounded-xl bg-white border border-red-200 p-3 text-xs text-red-900 space-y-1">
              <p className="font-semibold">Hasil Peninjauan Admin:</p>
              <p className="leading-relaxed">{latestAppeal.admin_decision_notes}</p>
              {latestAppeal.reviewed_at && (
                <p className="text-[11px] text-red-700 tabular-nums">
                  Diputuskan pada {formatDateTime(latestAppeal.reviewed_at)}
                </p>
              )}
            </div>
          )}

          {isUnderReview && (
            <p className="text-xs text-[#2635BC] font-medium">
              Pengajuan banding Anda sedang ditinjau oleh Admin. Anda tidak perlu mengirim ulang
              selama proses peninjauan berlangsung.
            </p>
          )}

          {isAppealExhausted && (
            <div className="rounded-xl border border-red-200 bg-white p-3.5 space-y-3 text-xs">
              <div className="space-y-1">
                <p className="font-semibold text-red-900">
                  Mohon Maaf, Kesempatan Banding Telah Habis
                </p>
                <p className="text-slate-700 leading-relaxed">
                  Mohon maaf, pengajuan banding untuk akun{' '}
                  <strong>{supplier.company_name}</strong> kembali tidak disetujui oleh Admin.
                  Sesuai ketentuan sistem, pengajuan banding hanya dapat dilakukan maksimal 1
                  kali untuk setiap akun. Silakan lakukan pendaftaran ulang menggunakan alamat
                  email baru beserta data perusahaan yang lengkap melalui halaman registrasi.
                </p>
              </div>
              <Link
                href="/register"
                className="inline-flex w-full items-center justify-center min-h-[40px] rounded-xl bg-[#3243DD] px-4 py-2 text-xs sm:text-sm font-semibold text-white hover:bg-[#2635BC] transition-colors"
              >
                Daftar Ulang Supplier
              </Link>
            </div>
          )}
        </div>
      )}

      {/* CTA Ajukan Banding / Perbarui Banding */}
      {!showForm && canAppealOrEdit && (
        <div className="pt-1 space-y-2">
          <Button
            type="button"
            variant="primary"
            size="lg"
            onClick={openAppealForm}
            className="w-full"
          >
            {isUpdateMode ? (
              <>
                <Pencil className="h-4 w-4" aria-hidden="true" />
                Perbarui Penjelasan Banding
              </>
            ) : (
              <>
                <Send className="h-4 w-4" aria-hidden="true" />
                Ajukan Banding
              </>
            )}
          </Button>
          {!isUpdateMode && (
            <p className="text-center text-[11px] text-slate-500">
              Pengajuan banding hanya dapat dilakukan maksimal 1 kali per akun pendaftar.
            </p>
          )}
        </div>
      )}

      {/* Form Pengajuan Banding */}
      {showForm && (
        <form
          action={submitAction}
          className="rounded-2xl border border-[#3243DD]/25 bg-[#F4F5F8]/60 p-4 space-y-3.5"
        >
          {isUpdateMode && (
            <input type="hidden" name="appealId" value={latestAppeal.id} />
          )}

          <div className="flex items-center justify-between gap-2">
            <h3 className="text-sm font-bold text-slate-900">
              {isUpdateMode ? 'Perbarui Pengajuan Banding' : 'Form Pengajuan Banding'}
            </h3>
          </div>

          {submitState.error && (
            <div
              role="alert"
              className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700"
            >
              {submitState.error}
            </div>
          )}

          <div>
            <label
              htmlFor="appeal-reason"
              className="block text-xs sm:text-sm font-medium text-slate-700 mb-1.5"
            >
              Penjelasan atau Klarifikasi Penolakan{' '}
              <span className="text-[#FF3D8B]" aria-hidden="true">
                *
              </span>
            </label>
            <textarea
              id="appeal-reason"
              name="appealReason"
              rows={4}
              required
              minLength={15}
              maxLength={1500}
              value={appealReason}
              onChange={(e) => setAppealReason(e.target.value)}
              placeholder="Jelaskan klarifikasi Anda atas alasan penolakan atau perincian perbaikan data perusahaan..."
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-[#3243DD] focus:outline-none focus:ring-2 focus:ring-[#3243DD]/20"
            />
            {submitState.fieldErrors?.appealReason ? (
              <p className="mt-1 text-xs font-medium text-red-600">
                {submitState.fieldErrors.appealReason}
              </p>
            ) : (
              <p className="mt-1 text-[11px] text-slate-500">
                Minimal 15 karakter. Data registrasi sebelumnya sudah tersimpan di sistem.
              </p>
            )}
          </div>

          <div>
            <button
              type="button"
              onClick={() => setShowCorrections((prev) => !prev)}
              aria-expanded={showCorrections}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#3243DD] hover:underline cursor-pointer"
            >
              {showCorrections ? (
                <ChevronUp className="h-3.5 w-3.5" aria-hidden="true" />
              ) : (
                <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" />
              )}
              Lampirkan Perbaikan Data Registrasi (Opsional)
            </button>

            {showCorrections && (
              <div className="mt-3 space-y-3 rounded-xl border border-slate-200 bg-white p-3">
                <p className="text-[11px] text-slate-500">
                  Biarkan nilai yang sudah sesuai; ubah hanya kolom yang ingin Anda perbaiki.
                </p>
                <Input
                  id="appeal-company-name"
                  name="companyName"
                  label="Nama Perusahaan"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  error={submitState.fieldErrors?.companyName}
                />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Input
                    id="appeal-contact-name"
                    name="contactName"
                    label="Penanggung Jawab (PIC)"
                    value={contactName}
                    onChange={(e) => setContactName(e.target.value)}
                    error={submitState.fieldErrors?.contactName}
                  />
                  <Input
                    id="appeal-phone"
                    name="phone"
                    type="tel"
                    label="Nomor Telepon"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    error={submitState.fieldErrors?.phone}
                  />
                </div>
                <div>
                  <label
                    htmlFor="appeal-address"
                    className="block text-xs font-medium text-slate-700 mb-1"
                  >
                    Alamat Perusahaan
                  </label>
                  <textarea
                    id="appeal-address"
                    name="address"
                    rows={2}
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs sm:text-sm focus:border-[#3243DD] focus:outline-none focus:ring-2 focus:ring-[#3243DD]/20"
                  />
                  {submitState.fieldErrors?.address && (
                    <p className="mt-1 text-xs font-medium text-red-600">
                      {submitState.fieldErrors.address}
                    </p>
                  )}
                </div>
                <div>
                  <label
                    htmlFor="appeal-additional-notes"
                    className="block text-xs font-medium text-slate-700 mb-1"
                  >
                    Informasi Pendukung Tambahan
                  </label>
                  <textarea
                    id="appeal-additional-notes"
                    name="additionalNotes"
                    rows={2}
                    value={additionalNotes}
                    onChange={(e) => setAdditionalNotes(e.target.value)}
                    placeholder="Contoh: Nomor NPWP/NIB atau jam kontak PIC aktif..."
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs sm:text-sm focus:border-[#3243DD] focus:outline-none focus:ring-2 focus:ring-[#3243DD]/20"
                  />
                </div>
              </div>
            )}
          </div>

          <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-200/80">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setShowForm(false)}
              disabled={isSubmitting}
            >
              Batal
            </Button>
            <Button type="submit" variant="primary" loading={isSubmitting}>
              {isUpdateMode ? 'Simpan Pembaruan' : 'Kirim Pengajuan Banding'}
            </Button>
          </div>
        </form>
      )}

      <div className="pt-2 flex flex-col sm:flex-row gap-3 justify-center border-t border-slate-100">
        <Link
          href="/login"
          className="inline-flex items-center justify-center min-h-[42px] rounded-xl border border-slate-300 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
        >
          Kembali ke Halaman Masuk
        </Link>
        <Link
          href="/"
          className="inline-flex items-center justify-center gap-1.5 min-h-[42px] rounded-xl border border-slate-300 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Beranda
        </Link>
      </div>
    </div>
  );
}
