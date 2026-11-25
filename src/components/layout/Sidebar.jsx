'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Package,
  Tags,
  Boxes,
  ArrowDownToLine,
  ArrowUpFromLine,
  ClipboardList,
  AlertTriangle,
  SlidersHorizontal,
  History,
  UserCheck,
  Users,
  Activity,
  Truck,
  X,
} from 'lucide-react';
import { getNavigationForRole } from '../../lib/constants/navigation.js';
import { ROLE_LABELS } from '../../lib/constants/roles.js';
import SupplifyLogo from '../icons/SupplifyLogo.jsx';

const ICON_MAP = {
  dashboard: LayoutDashboard,
  products: Package,
  categories: Tags,
  inventory: Boxes,
  incoming: ArrowDownToLine,
  outgoing: ArrowUpFromLine,
  orders: ClipboardList,
  discrepancies: AlertTriangle,
  adjustments: SlidersHorizontal,
  movements: History,
  supplierVerify: UserCheck,
  users: Users,
  activity: Activity,
  shipment: Truck,
};

const INVENTORY_HUB_PATHS = [
  '/inventory',
  '/stock-movements',
  '/discrepancies',
  '/stock-adjustments',
];

function isNavItemActive(itemHref, pathname) {
  if (itemHref === '/inventory') {
    return INVENTORY_HUB_PATHS.some(
      (base) => pathname === base || pathname.startsWith(`${base}/`)
    );
  }
  return (
    pathname === itemHref ||
    (itemHref !== '/dashboard' && pathname.startsWith(`${itemHref}/`))
  );
}

function groupNavItems(items) {
  const groups = [];
  const map = new Map();
  for (const item of items) {
    const groupName = item.group || 'Menu Utama';
    if (!map.has(groupName)) {
      const groupObj = { name: groupName, items: [] };
      map.set(groupName, groupObj);
      groups.push(groupObj);
    }
    map.get(groupName).items.push(item);
  }
  return groups;
}

export default function Sidebar({ role, isOpen, onClose }) {
  const pathname = usePathname();
  const navItems = getNavigationForRole(role);
  const groups = groupNavItems(navItems);

  return (
    <>
      {isOpen && (
        <div
          className="fixed inset-0 z-30 bg-slate-900/40 backdrop-blur-[1px] lg:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-40 w-64 bg-white border-r border-slate-200/80 flex flex-col transition-transform duration-200 lg:sticky lg:top-0 lg:h-screen shrink-0 lg:translate-x-0 ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Clean Brand Header */}
        <div className="h-16 px-5 flex items-center justify-between bg-white border-b border-slate-100 shrink-0">
          <Link
            href="/dashboard"
            onClick={onClose}
            className="focus:outline-none focus-visible:ring-2 focus-visible:ring-[#3243DD] rounded-lg"
          >
            <SupplifyLogo size={30} subtitle="Sistem Gudang" />
          </Link>
          <button
            type="button"
            onClick={onClose}
            className="lg:hidden rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-800 cursor-pointer"
            aria-label="Tutup menu navigasi"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Structured Royal Blue Operational Sidebar */}
        <div className="flex-1 flex flex-col bg-[#3243DD] text-white px-3 pt-4 pb-4 overflow-hidden">
          <nav
            className="flex-1 overflow-y-auto space-y-4 pr-0.5"
            aria-label="Navigasi utama"
          >
            {groups.map((group) => (
              <div key={group.name}>
                <p className="px-3 mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-white/55">
                  {group.name}
                </p>
                <div className="space-y-0.5">
                  {group.items.map((item) => {
                    const Icon = ICON_MAP[item.icon] || LayoutDashboard;
                    const isActive = isNavItemActive(item.href, pathname);

                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={onClose}
                        aria-current={isActive ? 'page' : undefined}
                        className={`flex items-center justify-between gap-2 rounded-lg px-3 py-2 text-[13px] font-medium transition-colors ${
                          isActive
                            ? 'bg-white text-[#3243DD] font-semibold shadow-sm'
                            : 'text-white/85 hover:bg-white/12 hover:text-white'
                        }`}
                      >
                        <span className="flex items-center gap-2.5 min-w-0">
                          <Icon
                            className={`h-4 w-4 shrink-0 ${
                              isActive ? 'text-[#3243DD]' : 'text-white/75'
                            }`}
                            aria-hidden="true"
                          />
                          <span className="truncate">{item.label}</span>
                        </span>

                        <span className="flex items-center gap-1.5 shrink-0">
                          {item.badgeText && (
                            <span
                              className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${
                                isActive
                                  ? 'bg-[#EEF1FD] text-[#3243DD]'
                                  : 'bg-white/15 text-white/90'
                              }`}
                            >
                              {item.badgeText}
                            </span>
                          )}
                          {isActive && (
                            <span
                              className="h-1.5 w-1.5 rounded-full bg-[#FF3D8B]"
                              aria-hidden="true"
                            />
                          )}
                        </span>
                      </Link>
                    );
                  })}
                </div>
              </div>
            ))}
          </nav>

          {/* Compact Role Context Footer */}
          <div className="mt-4 pt-3 border-t border-white/15 px-2">
            <p className="text-[10px] font-medium uppercase tracking-wider text-white/60">
              Peran Aktif
            </p>
            <div className="mt-1 flex items-center justify-between gap-2">
              <span className="text-xs font-semibold text-white truncate">
                {ROLE_LABELS[role] || role}
              </span>
              <span
                className="h-2 w-2 rounded-full bg-[#FF3D8B] shrink-0"
                aria-hidden="true"
              />
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}
