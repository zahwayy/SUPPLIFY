'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Menu, User, LogOut, Calendar } from 'lucide-react';
import RoleBadge from '../ui/RoleBadge.jsx';
import NotificationBell from './NotificationBell.jsx';
import { logoutAction } from '../../modules/auth/authActions.js';
import { getNavigationForRole } from '../../lib/constants/navigation.js';

function getCurrentSectionLabel(pathname, role) {
  if (pathname === '/profile') return 'Profil Pengguna';
  const nav = getNavigationForRole(role);
  const exact = nav.find((item) => item.href === pathname);
  if (exact) return exact.label;
  const prefix = nav.find(
    (item) => item.href !== '/dashboard' && pathname.startsWith(`${item.href}/`)
  );
  if (prefix) return prefix.label;
  if (pathname.startsWith('/purchase-orders')) return 'Pesanan Pembelian (PO)';
  if (pathname.startsWith('/restock-orders')) return 'Pesanan Restock';
  if (pathname.startsWith('/incoming')) return 'Barang Masuk';
  if (pathname.startsWith('/outgoing')) return 'Barang Keluar';
  if (pathname.startsWith('/products')) return 'Produk';
  if (
    pathname.startsWith('/inventory') ||
    pathname.startsWith('/stock-movements') ||
    pathname.startsWith('/discrepancies') ||
    pathname.startsWith('/stock-adjustments')
  ) {
    return 'Pergerakan Stok';
  }
  return 'Supplify WMS';
}

export default function Header({
  user,
  notifications = [],
  unreadNotificationCount = 0,
  onOpenMenu,
}) {
  const pathname = usePathname();
  const sectionLabel = getCurrentSectionLabel(pathname, user.role);

  const todayLabel = new Intl.DateTimeFormat('id-ID', {
    weekday: 'long',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date());

  return (
    <header className="sticky top-0 z-20 h-16 bg-white/95 backdrop-blur border-b border-slate-200/90 flex items-center">
      <div className="supplify-dashboard-container flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <button
            type="button"
            onClick={onOpenMenu}
            className="lg:hidden inline-flex items-center justify-center rounded-lg border border-slate-200 p-2 text-slate-700 hover:bg-slate-50 cursor-pointer"
            aria-label="Buka menu navigasi"
          >
            <Menu className="h-5 w-5" />
          </button>

          <div className="flex items-center gap-3 min-w-0">
            <span className="text-sm font-semibold text-slate-800 truncate">
              {sectionLabel}
            </span>
            <span
              className="hidden md:inline-block h-4 w-px bg-slate-200"
              aria-hidden="true"
            />
            <div className="hidden md:flex items-center gap-1.5 text-xs text-slate-500">
              <Calendar className="h-3.5 w-3.5 text-[#3243DD]" aria-hidden="true" />
              <span>{todayLabel}</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          <NotificationBell
            notifications={notifications}
            unreadCount={unreadNotificationCount}
          />

          <Link
            href="/profile"
            className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-[#EEF1FD]/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3243DD] transition-colors"
            title="Lihat Profil Pengguna"
          >
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#EEF1FD] text-[#3243DD] border border-[#3243DD]/15">
              <User className="h-4 w-4" aria-hidden="true" />
            </span>
            <span className="hidden sm:block text-left">
              <span className="block text-xs font-semibold text-slate-900 leading-tight max-w-[160px] truncate">
                {user.name}
              </span>
              <span className="block text-[11px] text-slate-500 max-w-[160px] truncate">
                {user.supplierCompanyName || user.email}
              </span>
            </span>
          </Link>

          <div className="hidden md:block">
            <RoleBadge role={user.role} />
          </div>

          <form action={logoutAction}>
            <button
              type="submit"
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 sm:px-3 py-1.5 text-xs font-semibold text-slate-700 hover:border-[#FF3D8B] hover:bg-[#FFF0F6] hover:text-[#D6246C] transition-colors cursor-pointer"
              title="Keluar dari akun"
            >
              <LogOut className="h-3.5 w-3.5" aria-hidden="true" />
              <span className="hidden sm:inline">Keluar</span>
            </button>
          </form>
        </div>
      </div>
    </header>
  );
}
