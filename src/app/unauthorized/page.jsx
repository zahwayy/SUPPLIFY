import Link from 'next/link';

export default function UnauthorizedPage() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-[#F4F5F8] p-6">
      <div className="max-w-md w-full bg-white rounded-2xl border border-slate-200 shadow-sm p-8 text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-[#FF3D8B]/10 text-[#FF3D8B] font-bold text-xl">
          403
        </div>
        <h1 className="text-xl font-semibold text-slate-900">
          Akses Ditolak
        </h1>
        <p className="mt-2 text-sm text-slate-600">
          Peran akun Anda tidak memiliki izin untuk mengakses halaman atau fitur ini.
        </p>
        <div className="mt-6 flex justify-center gap-3">
          <Link
            href="/dashboard"
            className="inline-flex items-center justify-center min-h-[40px] rounded-lg bg-[#3243DD] px-4 py-2 text-sm font-semibold text-white hover:bg-[#2736BA] transition-colors"
          >
            Kembali ke Beranda
          </Link>
        </div>
      </div>
    </main>
  );
}
