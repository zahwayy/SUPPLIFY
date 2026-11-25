import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import SupplifyLogo from '../../components/icons/SupplifyLogo.jsx';

export default function AuthLayout({ children }) {
  return (
    <div className="min-h-screen flex flex-col supplify-ambient-bg py-5 sm:py-6">
      <header className="supplify-container flex items-center justify-between mb-5">
        <Link
          href="/"
          className="rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-[#3243DD]"
        >
          <SupplifyLogo size={32} subtitle="Sistem Gudang" />
        </Link>
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 min-h-[36px] rounded-xl bg-white border border-slate-200 px-3.5 py-1.5 text-xs sm:text-sm font-medium text-slate-700 hover:text-[#3243DD] hover:border-[#3243DD]/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3243DD] transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
          Beranda
        </Link>
      </header>

      <main className="supplify-container flex-1 flex items-center justify-center py-3">
        <div className="w-full max-w-lg rounded-3xl bg-white border border-slate-200/90 shadow-sm overflow-hidden">
          <div className="flex h-1.5 w-full" aria-hidden="true">
            <div className="w-3/4 bg-[#3243DD]" />
            <div className="w-1/4 bg-[#FF3D8B]" />
          </div>
          <div className="p-5 sm:p-7">{children}</div>
        </div>
      </main>

      <footer className="supplify-container mt-5 text-center text-xs text-slate-500">
        Supplify — Operasional Gudang Internal &amp; Portal Supplier Terverifikasi
      </footer>
    </div>
  );
}
