'use client';

import Link from 'next/link';
import {
  Boxes,
  History,
  AlertTriangle,
  SlidersHorizontal,
} from 'lucide-react';
import PageHeader from '../shared/PageHeader.jsx';
import InventoryView from './InventoryView.jsx';
import StockMovementsView from './StockMovementsView.jsx';
import DiscrepanciesManager from '../discrepancies/DiscrepanciesManager.jsx';
import AdjustmentsManager from '../adjustments/AdjustmentsManager.jsx';

const TAB_DEFINITIONS = [
  {
    key: 'summary',
    label: 'Ringkasan',
    href: '/inventory?tab=summary',
    icon: Boxes,
  },
  {
    key: 'movements',
    label: 'Pergerakan Stok',
    href: '/inventory?tab=movements',
    icon: History,
  },
  {
    key: 'discrepancies',
    label: 'Selisih Stok',
    href: '/inventory?tab=discrepancies',
    icon: AlertTriangle,
  },
  {
    key: 'adjustments',
    label: 'Penyesuaian Stok',
    href: '/inventory?tab=adjustments',
    icon: SlidersHorizontal,
  },
];

export default function InventoryHub({
  activeTab = 'summary',
  allowedTabs = ['summary'],
  summaryProps = null,
  movementsProps = null,
  discrepanciesProps = null,
  adjustmentsProps = null,
}) {
  const visibleTabs = TAB_DEFINITIONS.filter((tab) =>
    allowedTabs.includes(tab.key)
  );

  return (
    <div className="space-y-5">
      <PageHeader
        title="Inventaris & Pergerakan Stok"
        description="Pantau ketersediaan stok gudang, riwayat pergerakan stok, laporan selisih stok, dan pengajuan penyesuaian stok dalam satu pusat kendali."
      />

      {visibleTabs.length > 1 && (
        <nav
          aria-label="Tab modul inventaris"
          className="flex flex-wrap gap-1.5 border-b border-slate-200 pb-3"
        >
          {visibleTabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.key;
            return (
              <Link
                key={tab.key}
                href={tab.href}
                aria-current={isActive ? 'page' : undefined}
                className={`inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-xs sm:text-sm font-semibold border transition-colors ${
                  isActive
                    ? 'bg-[#3243DD] text-white border-[#3243DD] shadow-sm'
                    : 'bg-white text-slate-700 border-slate-200 hover:border-[#3243DD]/40 hover:text-slate-900'
                }`}
              >
                <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                <span>{tab.label}</span>
              </Link>
            );
          })}
        </nav>
      )}

      {activeTab === 'summary' && summaryProps && (
        <InventoryView {...summaryProps} embedded basePath="/inventory" />
      )}
      {activeTab === 'movements' && movementsProps && (
        <StockMovementsView {...movementsProps} embedded basePath="/inventory" />
      )}
      {activeTab === 'discrepancies' && discrepanciesProps && (
        <DiscrepanciesManager {...discrepanciesProps} embedded basePath="/inventory" />
      )}
      {activeTab === 'adjustments' && adjustmentsProps && (
        <AdjustmentsManager {...adjustmentsProps} embedded basePath="/inventory" />
      )}
    </div>
  );
}
