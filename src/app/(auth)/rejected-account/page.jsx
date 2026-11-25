import Link from 'next/link';
import { redirect } from 'next/navigation';
import { XCircle, ArrowLeft } from 'lucide-react';
import { getCurrentUser } from '../../../lib/auth/session.js';
import { readStatusNoticeCookie } from '../../../lib/auth/statusNotice.js';
import { verifyAccountStatusFromNotice } from '../../../modules/auth/authService.js';
import { getRejectedSupplierAppealContext } from '../../../modules/suppliers/supplierService.js';
import StatusPill from '../../../components/shared/StatusPill.jsx';
import RejectedAppealPanel from '../../../components/auth/RejectedAppealPanel.jsx';

export const dynamic = 'force-dynamic';

export default async function RejectedAccountPage() {
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

  if (accountInfo.verified && accountInfo.accountStatus === 'active') {
    redirect('/login');
  }
  if (accountInfo.verified && accountInfo.accountStatus === 'pending') {
    redirect('/pending-verification');
  }

  if (accountInfo.verified && accountInfo.accountStatus === 'rejected') {
    const appealContext = await getRejectedSupplierAppealContext(noticeUserIdOrFallback(accountInfo));
    if (appealContext?.eligible) {
      return <RejectedAppealPanel context={appealContext} />;
    }
  }

  return (
    <div className="space-y-5 text-center">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-red-50 border border-red-200 text-red-600">
        <XCircle className="h-7 w-7" aria-hidden="true" />
      </div>

      <div>
        <StatusPill status="rejected" labelOverride="Pendaftaran Ditolak" />
        <h2 className="mt-3 text-xl font-bold text-slate-900">
          Akun Supplier Tidak Disetujui
        </h2>
        <p className="mt-2 text-sm text-slate-600 leading-relaxed">
          Pendaftaran akun supplier ini ditolak oleh Admin. Masuk melalui halaman Masuk
          menggunakan email dan kata sandi pendaftaran Anda untuk melihat alasan penolakan
          atau mengajukan banding peninjauan kembali.
        </p>
      </div>

      <div className="pt-2 flex flex-col sm:flex-row gap-3 justify-center">
        <Link
          href="/login"
          className="inline-flex items-center justify-center min-h-[42px] rounded-xl bg-[#3243DD] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#2635BC] transition-colors"
        >
          Masuk untuk Tinjau Penolakan
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

function noticeUserIdOrFallback(info) {
  return info?.userId || null;
}
