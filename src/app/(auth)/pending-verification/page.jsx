import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Clock, CheckCircle2, ArrowLeft } from 'lucide-react';
import { getCurrentUser } from '../../../lib/auth/session.js';
import { readStatusNoticeCookie } from '../../../lib/auth/statusNotice.js';
import { verifyAccountStatusFromNotice } from '../../../modules/auth/authService.js';
import StatusPill from '../../../components/shared/StatusPill.jsx';

export const dynamic = 'force-dynamic';

export default async function PendingVerificationPage() {
  const activeUser = await getCurrentUser();
  if (activeUser) {
    redirect('/dashboard');
  }

  let accountInfo = { verified: false };
  try {
    const notice = await readStatusNoticeCookie();
    if (notice) {
      accountInfo = await verifyAccountStatusFromNotice(notice);
    }
  } catch {
    accountInfo = { verified: false };
  }

  // If the account was just approved by Admin in DB, send them to login
  if (accountInfo.verified && accountInfo.accountStatus === 'active') {
    redirect('/login');
  }
  if (accountInfo.verified && accountInfo.accountStatus === 'rejected') {
    redirect('/rejected-account');
  }

  return (
    <div className="space-y-5 text-center">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-50 border border-amber-200 text-amber-700">
        <Clock className="h-7 w-7" aria-hidden="true" />
      </div>

      <div>
        <StatusPill status="pending" labelOverride="Menunggu Verifikasi Admin" />
        <h2 className="mt-3 text-xl font-bold text-slate-900">
          Akun Supplier Sedang Diverifikasi
        </h2>
        <p className="mt-2 text-sm text-slate-600 leading-relaxed">
          Pendaftaran akun supplier Anda telah diterima, namun Anda belum dapat
          mengakses Beranda sebelum Admin memverifikasi dan mengaktifkan akun.
        </p>
      </div>

      {accountInfo.verified && accountInfo.companyName && (
        <div className="rounded-2xl bg-[#EEF1FD]/70 border border-[#3243DD]/20 p-4 text-left text-sm">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            Informasi Pendaftaran
          </p>
          <p className="mt-1 font-semibold text-slate-900">
            {accountInfo.companyName}
          </p>
          <p className="mt-1 flex items-center gap-1.5 text-xs text-slate-600">
            <CheckCircle2 className="h-3.5 w-3.5 text-[#3243DD]" aria-hidden="true" />
            Data pendaftaran tersimpan dan menunggu peninjauan Admin.
          </p>
        </div>
      )}

      <div className="pt-2 flex flex-col sm:flex-row gap-3 justify-center">
        <Link
          href="/login"
          className="inline-flex items-center justify-center min-h-[42px] rounded-xl bg-[#3243DD] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#2635BC] transition-colors"
        >
          Kembali ke Halaman Masuk
        </Link>
        <Link
          href="/"
          className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-300 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Beranda
        </Link>
      </div>
    </div>
  );
}
