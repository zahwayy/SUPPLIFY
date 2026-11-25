import Link from 'next/link';
import { redirect } from 'next/navigation';
import {
  Users,
  UserCheck,
  Package,
  AlertTriangle,
  ClipboardList,
  Truck,
  CheckCircle2,
  Clock,
  Boxes,
  SlidersHorizontal,
  ArrowRight,
  ArrowDownToLine,
  ArrowUpFromLine,
  Activity,
  History,
  PackageCheck,
} from 'lucide-react';
import { getCurrentUser } from '../../../lib/auth/session.js';
import { hasPermission, PERMISSIONS } from '../../../lib/auth/rbac.js';
import { ROLES } from '../../../lib/constants/roles.js';
import {
  formatCurrencyIDR,
  formatDate,
  formatDateTime,
} from '../../../lib/utils/format.js';
import {
  getAuditActionMeta,
  getAuditEntityLabel,
  getMovementSourceHref,
  getStockStatusMeta,
  STOCK_STATUS_META,
} from '../../../lib/utils/labels.js';
import { computeProductStockStatus } from '../../../modules/products/productService.js';
import { getDashboardDataForUser } from '../../../modules/dashboard/dashboardService.js';
import RoleDashboardShell from '../../../components/dashboard/RoleDashboardShell.jsx';
import Badge from '../../../components/ui/Badge.jsx';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '../../../components/ui/Card.jsx';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '../../../components/ui/Table.jsx';
import StatusPill from '../../../components/shared/StatusPill.jsx';
import EmptyState from '../../../components/ui/EmptyState.jsx';

export const dynamic = 'force-dynamic';

function DataUnavailableNotice() {
  return (
    <div
      role="alert"
      className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900"
    >
      <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0 text-amber-600" aria-hidden="true" />
      <span>
        Sebagian data ringkasan sementara belum dapat dimuat. Silakan muat ulang halaman
        beberapa saat lagi.
      </span>
    </div>
  );
}

export default async function DashboardPage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect('/login?expired=1');
  }
  if (!hasPermission(user, PERMISSIONS.DASHBOARD_ACCESS)) {
    redirect('/unauthorized');
  }

  const data = await getDashboardDataForUser(user);
  const m = data.metrics || {};
  const unavailableBanner = !data.dbConnected ? <DataUnavailableNotice /> : null;

  /* =========================================================================
   * 1. ADMIN DASHBOARD
   * ========================================================================= */
  if (user.role === ROLES.ADMIN) {
    const pendingSup = m.pendingSuppliers ?? 0;
    const pendingAppeals = m.pendingAppeals ?? 0;
    const criticalStock =
      (m.outOfStock ?? 0) + (m.severeStock ?? 0) + (m.lowStock ?? 0);
    return (
      <RoleDashboardShell
        user={user}
        title={`Halo, ${user.name}`}
        headerActions={
          <Link
            href="/supplier-verification?status=pending"
            className="inline-flex items-center gap-1.5 rounded-lg bg-[#3243DD] px-3.5 py-2 text-xs sm:text-sm font-semibold text-white hover:bg-[#2635BC] transition-colors"
          >
            <UserCheck className="h-4 w-4" aria-hidden="true" />
            Verifikasi Supplier
          </Link>
        }
        kpiStrip={[
          {
            label: 'Menunggu Verifikasi',
            value: data.dbConnected ? pendingSup : '—',
            helper:
              pendingSup > 0
                ? 'Supplier baru menunggu peninjauan'
                : 'Semua pengajuan telah ditinjau',
            icon: Clock,
            tone: pendingSup > 0 ? 'accent' : 'primary',
            surface: pendingSup > 0 ? 'soft-pink' : 'soft-blue',
            href: '/supplier-verification?status=pending',
          },
          {
            label: 'Nilai Inventaris',
            value: data.dbConnected ? formatCurrencyIDR(m.estimatedValue) : '—',
            helper: `${m.totalStockUnits ?? 0} unit dari ${m.totalProducts ?? 0} SKU`,
            // icon: Boxes,
            tone: 'success',
            surface: 'soft-blue',
            href: '/inventory',
          },
          {
            label: 'Akun Aktif',
            value: data.dbConnected ? m.totalUsers ?? 0 : '—',
            helper: `${m.activeSuppliers ?? 0} supplier aktif • ${m.inactiveUsers ?? 0} nonaktif`,
            icon: Users,
            href: '/users',
          },
          {
            label: 'Perlu Perhatian Stok',
            value: data.dbConnected ? criticalStock : '—',
            helper: `${m.outOfStock ?? 0} ${STOCK_STATUS_META['Out of Stock'].label.toLowerCase()} • ${m.severeStock ?? 0} ${STOCK_STATUS_META.Severe.label.toLowerCase()} • ${m.lowStock ?? 0} ${STOCK_STATUS_META.Low.label.toLowerCase()}`,
            icon: AlertTriangle,
            tone: criticalStock > 0 ? 'danger' : 'primary',
            surface: criticalStock > 0 ? 'soft-pink' : 'default',
            href: (m.severeStock ?? 0) > 0 ? '/inventory?stockStatus=severe' : '/inventory?stockStatus=out_of_stock',
          },
        ]}
        mainContent={
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-3">
              <div>
                <CardTitle>Pengajuan &amp; Status Supplier</CardTitle>
              </div>
              <Link
                href="/supplier-verification"
                className="inline-flex items-center gap-1 text-xs font-semibold text-[#3243DD] hover:underline shrink-0"
              >
                Kelola Semua
                <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
              </Link>
            </CardHeader>
            <CardContent className="p-0 sm:p-5">
              {data.recentRows.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Perusahaan</TableHead>
                      <TableHead>Penanggung Jawab &amp; Email</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Tanggal Daftar</TableHead>
                      <TableHead className="text-right">Tindakan</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.recentRows.map((row) => (
                      <TableRow key={row.id}>
                        <TableCell className="font-semibold text-slate-900">
                          {row.company_name}
                        </TableCell>
                        <TableCell className="text-xs">
                          <p className="font-medium text-slate-800">{row.contact_name || row.name}</p>
                          <p className="text-slate-500">{row.email}</p>
                        </TableCell>
                        <TableCell>
                          <StatusPill status={row.status} />
                        </TableCell>
                        <TableCell className="text-xs text-slate-600 tabular-nums">
                          {formatDate(row.created_at)}
                        </TableCell>
                        <TableCell className="text-right">
                          <Link
                            href={`/supplier-verification?status=${row.status}`}
                            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-[#3243DD] hover:bg-[#EEF1FD] transition-colors"
                          >
                            {row.status === 'pending' ? 'Tinjau' : 'Lihat Detail'}
                          </Link>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="p-5 sm:p-0">
                  <EmptyState
                    icon={UserCheck}
                    title="Belum Ada Pengajuan Supplier"
                    description="Pendaftaran perusahaan supplier baru akan tampil di sini untuk Anda tinjau sebelum mereka mengakses portal."
                  />
                </div>
              )}
            </CardContent>
          </Card>
        }
        sideContent={
          <>
            <Card variant={pendingSup > 0 || pendingAppeals > 0 ? 'soft-pink' : 'soft-blue'}>
              <CardHeader>
                <CardTitle className="flex items-center justify-between text-sm">
                  <span>Prioritas Administrasi</span>
                  {(pendingSup > 0 || pendingAppeals > 0) && (
                    <Badge tone="accent">
                      {pendingSup + pendingAppeals} Perlu Tinjauan
                    </Badge>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2.5 text-xs text-slate-600">
                <p className="text-slate-600 leading-relaxed">
                  {pendingSup === 0 && pendingAppeals === 0
                    ? 'Tidak ada pendaftaran supplier atau pengajuan banding yang menunggu keputusan Admin.'
                    : `${pendingSup} verifikasi supplier baru dan ${pendingAppeals} pengajuan banding menunggu peninjauan.`}
                </p>
                {(pendingSup > 0 || pendingAppeals > 0 || (m.inactiveUsers ?? 0) > 0) && (
                  <div className="flex flex-col gap-1.5 pt-1">
                    {pendingSup > 0 && (
                      <Link
                        href="/supplier-verification?status=pending"
                        className="inline-flex items-center gap-1 font-semibold text-[#3243DD] hover:underline"
                      >
                        Buka Daftar Verifikasi ({pendingSup})
                      </Link>
                    )}
                    {pendingAppeals > 0 && (
                      <Link
                        href="/supplier-verification?status=appeals"
                        className="inline-flex items-center gap-1 font-semibold text-[#FF3D8B] hover:underline"
                      >
                        Tinjau Pengajuan Banding ({pendingAppeals})
                      </Link>
                    )}
                    {(m.inactiveUsers ?? 0) > 0 && (
                      <Link
                        href="/users?status=inactive"
                        className="inline-flex items-center gap-1 font-medium text-slate-700 hover:text-[#3243DD] hover:underline"
                      >
                        Lihat Akun Nonaktif ({m.inactiveUsers ?? 0})
                      </Link>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between gap-2">
                <CardTitle className="flex items-center gap-2 text-sm">
                  <Activity className="h-4 w-4 text-[#3243DD]" aria-hidden="true" />
                  Aktivitas Terbaru
                </CardTitle>
                <Link
                  href="/activity-log"
                  className="text-xs font-semibold text-[#3243DD] hover:underline"
                >
                  Semua
                </Link>
              </CardHeader>
              <CardContent className="p-3.5">
                {data.secondaryRows.length > 0 ? (
                  <ul className="divide-y divide-slate-100">
                    {data.secondaryRows.map((log) => {
                      const act = getAuditActionMeta(log.action);
                      return (
                        <li key={log.id} className="py-2.5 first:pt-0 last:pb-0">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-xs font-semibold text-slate-900 truncate">
                              {act.label}
                            </span>
                            <span className="text-[11px] text-slate-400 shrink-0 tabular-nums">
                              {formatDate(log.created_at)}
                            </span>
                          </div>
                          <p className="mt-0.5 text-[11px] text-slate-500 truncate">
                            {log.actor_name || 'Sistem'} • {getAuditEntityLabel(log.entity_type)}
                          </p>
                        </li>
                      );
                    })}
                  </ul>
                ) : (
                  <p className="text-xs text-slate-500 py-3 text-center">
                    Belum ada catatan aktivitas terbaru.
                  </p>
                )}
              </CardContent>
            </Card>
          </>
        }
      />
    );
  }

  /* =========================================================================
   * 2. WAREHOUSE MANAGER DASHBOARD
   * ========================================================================= */
  if (user.role === ROLES.MANAGER) {
    const pendingApprovals = m.pendingApprovals ?? 0;
    const criticalStock =
      (m.outOfStock ?? 0) + (m.severeStock ?? 0) + (m.lowStock ?? 0);
    const exceptionCount = (m.openDiscrepancies ?? 0) + (m.pendingAdjustments ?? 0);

    return (
      <RoleDashboardShell
        user={user}
        title={`Halo, ${user.name}`}
        headerActions={
          <Link
            href="/restock-orders"
            className="inline-flex items-center gap-1.5 rounded-lg bg-[#3243DD] px-3.5 py-2 text-xs sm:text-sm font-semibold text-white hover:bg-[#2635BC] transition-colors"
          >
            <ClipboardList className="h-4 w-4" aria-hidden="true" />
            Buat PO Restock
          </Link>
        }
        kpiStrip={[
          {
            label: 'Menunggu Persetujuan',
            value: data.dbConnected ? pendingApprovals : '—',
            helper: `${m.pendingIncoming ?? 0} Barang Masuk • ${m.pendingOutgoing ?? 0} Barang Keluar`,
            icon: Clock,
            tone: pendingApprovals > 0 ? 'accent' : 'primary',
            surface: pendingApprovals > 0 ? 'soft-pink' : 'soft-blue',
            href:
              (m.pendingIncoming ?? 0) > 0
                ? '/incoming?status=pending'
                : '/outgoing?status=pending',
          },
          {
            label: 'Perlu Perhatian Stok',
            value: data.dbConnected ? criticalStock : '—',
            helper: `${m.outOfStock ?? 0} ${STOCK_STATUS_META['Out of Stock'].label.toLowerCase()} • ${m.severeStock ?? 0} ${STOCK_STATUS_META.Severe.label.toLowerCase()} • ${m.lowStock ?? 0} ${STOCK_STATUS_META.Low.label.toLowerCase()}`,
            icon: AlertTriangle,
            tone: criticalStock > 0 ? 'danger' : 'success',
            surface: criticalStock > 0 ? 'soft-pink' : 'default',
            href:
              (m.severeStock ?? 0) > 0
                ? '/inventory?stockStatus=severe'
                : (m.outOfStock ?? 0) > 0
                ? '/inventory?stockStatus=out_of_stock'
                : '/inventory?stockStatus=low',
          },
          {
            label: 'Purchase Order Aktif',
            value: data.dbConnected ? m.activePurchaseOrders ?? 0 : '—',
            helper: `${m.inTransitPos ?? 0} dalam pengiriman • ${m.inspectingPos ?? 0} pemeriksaan fisik`,
            icon: Truck,
            tone: 'primary',
            surface: 'soft-blue',
            href: '/restock-orders',
          },
          {
            label: 'Kendala & Penyesuaian',
            value: data.dbConnected ? exceptionCount : '—',
            helper: `${m.openDiscrepancies ?? 0} selisih stok • ${m.pendingAdjustments ?? 0} penyesuaian`,
            icon: SlidersHorizontal,
            tone: exceptionCount > 0 ? 'warning' : 'primary',
            href:
              (m.openDiscrepancies ?? 0) > 0
                ? '/inventory?tab=discrepancies'
                : '/inventory?tab=adjustments',
          },
        ]}
        mainContent={
          <>
            {/* Antrean Persetujuan & Transaksi Gudang */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between gap-3">
                <div>
                  <CardTitle>Antrean Persetujuan &amp; Transaksi Gudang</CardTitle>
                  <p className="mt-0.5 text-xs text-slate-500">
                    Transaksi berstatus Menunggu ditampilkan paling atas untuk segera ditinjau.
                  </p>
                </div>
                <div className="flex items-center gap-3 text-xs font-semibold shrink-0">
                  <Link href="/incoming" className="text-[#3243DD] hover:underline">
                    Barang Masuk
                  </Link>
                  <span className="text-slate-300">|</span>
                  <Link href="/outgoing" className="text-[#3243DD] hover:underline">
                    Barang Keluar
                  </Link>
                </div>
              </CardHeader>
              <CardContent className="p-0 sm:p-5">
                {data.recentRows.length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Kode</TableHead>
                        <TableHead>Jenis</TableHead>
                        <TableHead>Total Item</TableHead>
                        <TableHead>Diajukan Oleh</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Aksi</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.recentRows.map((row) => {
                        const detailHref = `/${
                          row.type === 'incoming' ? 'incoming' : 'outgoing'
                        }/${row.id}`;
                        return (
                          <TableRow key={row.id}>
                            <TableCell className="font-mono text-xs font-semibold text-[#3243DD]">
                              <Link href={detailHref} className="hover:underline">
                                {row.transaction_code}
                              </Link>
                            </TableCell>
                            <TableCell className="text-xs font-medium">
                              <span className="inline-flex items-center gap-1.5">
                                {row.type === 'incoming' ? (
                                  <ArrowDownToLine className="h-3.5 w-3.5 text-emerald-600" />
                                ) : (
                                  <ArrowUpFromLine className="h-3.5 w-3.5 text-amber-600" />
                                )}
                                {row.type === 'incoming' ? 'Barang Masuk' : 'Barang Keluar'}
                              </span>
                            </TableCell>
                            <TableCell className="text-xs tabular-nums">
                              {row.item_count} SKU ({row.total_quantity} unit)
                            </TableCell>
                            <TableCell className="text-xs">
                              <p className="text-slate-800">{row.created_by_name}</p>
                              <p className="text-[11px] text-slate-400">
                                {formatDateTime(row.transaction_date)}
                              </p>
                            </TableCell>
                            <TableCell>
                              <StatusPill status={row.status} />
                            </TableCell>
                            <TableCell className="text-right">
                              <Link
                                href={detailHref}
                                className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-semibold transition-colors ${
                                  row.status === 'pending'
                                    ? 'bg-[#3243DD] text-white hover:bg-[#2635BC]'
                                    : 'border border-slate-200 bg-white text-slate-700 hover:border-[#3243DD] hover:text-[#3243DD]'
                                }`}
                              >
                                {row.status === 'pending' ? 'Tinjau' : 'Lihat Detail'}
                              </Link>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                ) : (
                  <div className="p-5 sm:p-0">
                    <EmptyState
                      icon={CheckCircle2}
                      title="Belum Ada Transaksi Gudang"
                      description="Pengajuan Barang Masuk dan Barang Keluar dari Warehouse Staff akan tampil di sini untuk Anda tinjau."
                    />
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Recent Stock Movements */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between gap-2">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <History className="h-4 w-4 text-[#3243DD]" aria-hidden="true" />
                    Pergerakan Stok Terbaru
                  </CardTitle>
                  <p className="mt-0.5 text-xs text-slate-500">
                    Perubahan stok aktual dari transaksi atau penyesuaian yang disetujui.
                  </p>
                </div>
                <Link
                  href="/inventory?tab=movements"
                  className="inline-flex items-center gap-1 text-xs font-semibold text-[#3243DD] hover:underline shrink-0"
                >
                  Lihat Riwayat
                  <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                </Link>
              </CardHeader>
              <CardContent className="p-4">
                {data.secondaryRows.length > 0 ? (
                  <ul className="divide-y divide-slate-100">
                    {data.secondaryRows.map((mv) => {
                      const srcHref = getMovementSourceHref(mv);
                      const refCode = mv.transaction_code || mv.adjustment_code || '—';
                      return (
                        <li
                          key={mv.id}
                          className="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0 text-xs"
                        >
                          <div className="min-w-0">
                            <p className="font-semibold text-slate-900 truncate">
                              <Link
                                href={`/products/${mv.product_id}`}
                                className="hover:text-[#3243DD]"
                              >
                                {mv.product_name}
                              </Link>
                            </p>
                            <p className="text-[11px] text-slate-500">
                              <span className="font-mono">{mv.sku}</span> •{' '}
                              {srcHref ? (
                                <Link
                                  href={srcHref}
                                  className="font-mono text-[#3243DD] hover:underline"
                                >
                                  {refCode}
                                </Link>
                              ) : (
                                <span className="font-mono">{refCode}</span>
                              )}{' '}
                              • {mv.stock_before} <strong>{mv.stock_after}</strong>
                            </p>
                          </div>
                          <Badge
                            tone={mv.quantity_delta > 0 ? 'success' : 'warning'}
                            className="tabular-nums shrink-0"
                          >
                            {mv.quantity_delta > 0
                              ? `+${mv.quantity_delta}`
                              : mv.quantity_delta}{' '}
                            {mv.unit || ''}
                          </Badge>
                        </li>
                      );
                    })}
                  </ul>
                ) : (
                  <p className="text-xs text-slate-500 text-center py-4">
                    Belum ada pergerakan stok tercatat.
                  </p>
                )}
              </CardContent>
            </Card>
          </>
        }
        sideContent={
          <>
            {/* Low & Out of Stock Watchlist */}
            <Card variant={criticalStock > 0 ? 'soft-pink' : 'default'}>
              <CardHeader className="flex flex-row items-center justify-between gap-2">
                <CardTitle className="flex items-center gap-2 text-sm">
                  <AlertTriangle
                    className={`h-4 w-4 ${
                      criticalStock > 0 ? 'text-[#FF3D8B]' : 'text-emerald-600'
                    }`}
                    aria-hidden="true"
                  />
                  Perlu Perhatian Stok
                </CardTitle>
                <Link
                  href="/inventory?stockStatus=low"
                  className="text-xs font-semibold text-[#3243DD] hover:underline"
                >
                  Inventaris
                </Link>
              </CardHeader>
              <CardContent className="p-4 space-y-3">
                {data.actionRows.length > 0 ? (
                  <>
                    <ul className="divide-y divide-slate-100">
                      {data.actionRows.map((prod) => {
                        const statusVal = computeProductStockStatus(
                          prod.stock,
                          prod.minimum_stock,
                          prod.low_stock_threshold
                        );
                        const meta = getStockStatusMeta(statusVal);
                        return (
                          <li
                            key={prod.id}
                            className="flex items-center justify-between gap-2 py-2 first:pt-0 last:pb-0 text-xs"
                          >
                            <div className="min-w-0">
                              <Link
                                href={`/products/${prod.id}`}
                                className="font-semibold text-slate-900 hover:text-[#3243DD] truncate block"
                              >
                                {prod.name}
                              </Link>
                              <p className="text-[11px] text-slate-500">
                                <span className="font-mono">{prod.sku}</span> • Min:{' '}
                                {prod.minimum_stock ?? '—'}
                                {prod.low_stock_threshold !== null && prod.low_stock_threshold !== undefined
                                  ? ` / Rendah: ${prod.low_stock_threshold}`
                                  : ''}
                              </p>
                            </div>
                            <div className="text-right shrink-0">
                              <Badge tone={meta.tone} className="tabular-nums">
                                {prod.stock} {prod.unit || ''} ({meta.label})
                              </Badge>
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                    <Link
                      href="/inventory?stockStatus=severe"
                      className="inline-flex items-center gap-1 text-xs font-semibold text-[#3243DD] hover:underline"
                    >
                      Lihat Semua di Inventaris
                    </Link>
                  </>
                ) : (
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Seluruh produk aktif berada pada kondisi stok aman di atas batas minimum.
                  </p>
                )}
              </CardContent>
            </Card>

            {/* Inventory Value & Operational Checklist */}
            <Card variant="soft-blue">
              <CardHeader>
                <CardTitle className="text-sm">Ringkasan Persediaan &amp; Tindakan</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-xs">
                <div className="rounded-lg bg-white border border-[#3243DD]/15 p-3 flex items-center justify-between">
                  <div>
                    <p className="text-slate-500">Total Unit Tersimpan</p>
                    <p className="mt-0.5 text-lg font-bold text-slate-900 tabular-nums">
                      {data.dbConnected ? m.totalStockUnits ?? 0 : '—'}{' '}
                      <span className="text-xs font-normal text-slate-500">
                        ({m.totalProducts ?? 0} SKU)
                      </span>
                    </p>
                  </div>
                </div>
                <div className="rounded-lg bg-white border border-[#3243DD]/15 p-3">
                  <p className="text-slate-500">Estimasi Nilai Persediaan</p>
                  <p className="mt-0.5 text-base font-bold text-slate-900 tabular-nums">
                    {data.dbConnected ? formatCurrencyIDR(m.estimatedValue) : '—'}
                  </p>
                </div>

                {((m.deliveredAwaitingReceived ?? 0) > 0 ||
                  (m.openDiscrepancies ?? 0) > 0 ||
                  (m.pendingAdjustments ?? 0) > 0) && (
                  <div className="pt-1 space-y-1.5">
                    {(m.deliveredAwaitingReceived ?? 0) > 0 && (
                      <Link
                        href="/restock-orders?status=in_transit"
                        className="flex items-center justify-between rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 font-semibold text-amber-900 hover:bg-amber-100/70 transition-colors"
                      >
                        <span>Instruksikan Pemeriksaan ({m.deliveredAwaitingReceived} PO)</span>
                        <ArrowRight className="h-3.5 w-3.5" />
                      </Link>
                    )}
                    {(m.openDiscrepancies ?? 0) > 0 && (
                      <Link
                        href="/inventory?tab=discrepancies&status=open"
                        className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-3 py-2 font-medium text-slate-700 hover:border-[#3243DD] hover:text-[#3243DD] transition-colors"
                      >
                        <span>Tinjau {m.openDiscrepancies} Selisih Stok</span>
                        <ArrowRight className="h-3.5 w-3.5" />
                      </Link>
                    )}
                    {(m.pendingAdjustments ?? 0) > 0 && (
                      <Link
                        href="/inventory?tab=adjustments&status=pending"
                        className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-3 py-2 font-medium text-slate-700 hover:border-[#3243DD] hover:text-[#3243DD] transition-colors"
                      >
                        <span>Tinjau {m.pendingAdjustments} Penyesuaian Stok</span>
                        <ArrowRight className="h-3.5 w-3.5" />
                      </Link>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </>
        }
      />
    );
  }

  /* =========================================================================
   * 3. WAREHOUSE STAFF DASHBOARD
   * ========================================================================= */
  if (user.role === ROLES.STAFF) {
    const readyIncoming = m.readyForIncoming ?? 0;
    const readyHandover = m.readyForHandover ?? 0;

    return (
      <RoleDashboardShell
        user={user}
        title={`Halo, ${user.name}`}
        headerActions={
        <>
            <Link
              href="/incoming"
              className="inline-flex items-center gap-1.5 rounded-lg bg-[#3243DD] px-3.5 py-2 text-xs sm:text-sm font-semibold text-white hover:bg-[#2635BC] transition-colors"
            >
              <ArrowDownToLine className="h-4 w-4" aria-hidden="true" />
              Catat Pemeriksaan Masuk
            </Link>
            <Link
              href="/outgoing"
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs sm:text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
            >
              <ArrowUpFromLine className="h-4 w-4" aria-hidden="true" />
              Ajukan Barang Keluar
            </Link>
          </>
        }
        kpiStrip={[
          {
            label: 'PO Siap Diperiksa',
            value: data.dbConnected ? readyIncoming : '—',
            helper: `${m.receivablePurchaseOrders ?? 0} total PO dalam proses penerimaan`,
            icon: ArrowDownToLine,
            tone: readyIncoming > 0 ? 'accent' : 'primary',
            surface: readyIncoming > 0 ? 'soft-pink' : 'soft-blue',
            href: '/incoming',
          },
          {
            label: 'Siap Dikirim',
            value: data.dbConnected ? readyHandover : '—',
            helper: 'Pengeluaran disetujui Manager',
            icon: PackageCheck,
            tone: readyHandover > 0 ? 'success' : 'primary',
            surface: 'soft-blue',
            href: '/outgoing?status=approved',
          },
          {
            label: 'Menunggu Persetujuan',
            value: data.dbConnected ? m.myPendingTransactions ?? 0 : '—',
            helper: 'Pengajuan Anda ke Manager',
            icon: Clock,
            tone: 'warning',
            href: '/incoming?status=pending',
          },
          {
            label: 'Laporan Selisih Stok',
            value: data.dbConnected ? m.myDiscrepancies ?? 0 : '—',
            helper: 'Dilaporkan oleh Anda',
            icon: AlertTriangle,
            href: '/inventory?tab=discrepancies',
          },
        ]}
        mainContent={
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-3">
              <div>
                <CardTitle>Riwayat Pengajuan Transaksi Anda</CardTitle>
                <p className="mt-0.5 text-xs text-slate-500">
                  Pantau status persetujuan pengajuan Barang Masuk dan Barang Keluar yang Anda buat.
                </p>
              </div>
              <div className="flex items-center gap-3 text-xs font-semibold shrink-0">
                <Link href="/incoming" className="text-[#3243DD] hover:underline">
                  Barang Masuk
                </Link>
                <span className="text-slate-300">|</span>
                <Link href="/outgoing" className="text-[#3243DD] hover:underline">
                  Barang Keluar
                </Link>
              </div>
            </CardHeader>
            <CardContent className="p-0 sm:p-5">
              {data.recentRows.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Kode Transaksi</TableHead>
                      <TableHead>Jenis</TableHead>
                      <TableHead>Item</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Tanggal</TableHead>
                      <TableHead className="text-right">Aksi</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.recentRows.map((row) => {
                      const detailHref = `/${
                        row.type === 'incoming' ? 'incoming' : 'outgoing'
                      }/${row.id}`;
                      return (
                        <TableRow key={row.id}>
                          <TableCell className="font-mono text-xs font-semibold text-[#3243DD]">
                            <Link href={detailHref} className="hover:underline">
                              {row.transaction_code}
                            </Link>
                          </TableCell>
                          <TableCell className="text-xs font-medium">
                            {row.type === 'incoming' ? 'Barang Masuk' : 'Barang Keluar'}
                          </TableCell>
                          <TableCell className="text-xs tabular-nums">
                            {row.item_count} SKU ({row.total_quantity} unit)
                          </TableCell>
                          <TableCell>
                            <StatusPill status={row.status} />
                          </TableCell>
                          <TableCell className="text-xs text-slate-600 tabular-nums">
                            {formatDate(row.transaction_date)}
                          </TableCell>
                          <TableCell className="text-right">
                            <Link
                              href={detailHref}
                              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 hover:border-[#3243DD] hover:text-[#3243DD]"
                            >
                              {row.type === 'outgoing' && row.status === 'approved'
                                ? 'Catat Pengiriman'
                                : 'Lihat Detail'}
                            </Link>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              ) : (
                <div className="p-5 sm:p-0">
                  <EmptyState
                    icon={ClipboardList}
                    title="Belum Ada Transaksi Tercatat"
                    description="Mulai dengan membuat laporan pemeriksaan barang masuk dari PO yang siap diperiksa atau mengajukan pengeluaran barang."
                  />
                </div>
              )}
            </CardContent>
          </Card>
        }
        sideContent={
          <>
            {/* Actionable POs ready for Incoming */}
            <Card variant={data.actionRows.length > 0 ? 'soft-pink' : 'soft-blue'}>
              <CardHeader className="flex flex-row items-center justify-between gap-2">
                <CardTitle className="text-sm">PO Siap Diperiksa</CardTitle>
                <Badge tone={data.actionRows.length > 0 ? 'accent' : 'neutral'}>
                  {data.actionRows.length}
                </Badge>
              </CardHeader>
              <CardContent className="p-4">
                {data.actionRows.length > 0 ? (
                  <ul className="space-y-2.5">
                    {data.actionRows.map((po) => (
                      <li
                        key={po.id}
                        className="rounded-lg border border-slate-200 bg-white p-3 flex items-center justify-between gap-2"
                      >
                        <div className="min-w-0">
                          <p className="font-mono text-xs font-semibold text-[#3243DD]">
                            {po.po_code}
                          </p>
                          <p className="text-xs font-medium text-slate-800 truncate">
                            {po.supplier_name}
                          </p>
                          <p className="text-[11px] text-slate-500">
                            {po.item_count} SKU ({po.total_quantity} unit)
                          </p>
                        </div>
                        <Link
                          href={`/incoming?poId=${po.id}`}
                          className="shrink-0 rounded-lg bg-[#3243DD] px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-[#2635BC] transition-colors"
                        >
                          Periksa Barang
                        </Link>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-xs text-slate-500 leading-relaxed">
                    Saat ini belum ada PO yang diarahkan Manager untuk pemeriksaan fisik.
                  </p>
                )}
              </CardContent>
            </Card>

            {/* Outgoing ready for shipping */}
            <Card variant="soft-blue">
              <CardHeader className="flex flex-row items-center justify-between gap-2">
                <CardTitle className="text-sm">Siap Dikirim</CardTitle>
                <Badge tone={data.secondaryRows.length > 0 ? 'success' : 'neutral'}>
                  {data.secondaryRows.length}
                </Badge>
              </CardHeader>
              <CardContent className="p-4">
                {data.secondaryRows.length > 0 ? (
                  <ul className="space-y-2.5">
                    {data.secondaryRows.map((tx) => (
                      <li
                        key={tx.id}
                        className="rounded-lg border border-slate-200 bg-white p-3 flex items-center justify-between gap-2"
                      >
                        <div className="min-w-0">
                          <p className="font-mono text-xs font-semibold text-[#3243DD]">
                            {tx.transaction_code}
                          </p>
                          <p className="text-[11px] text-slate-600 truncate">
                            {tx.item_count} SKU ({tx.total_quantity} unit)
                          </p>
                        </div>
                        <Link
                          href={`/outgoing/${tx.id}`}
                          className="shrink-0 rounded-lg border border-[#3243DD] px-2.5 py-1 text-xs font-semibold text-[#3243DD] hover:bg-[#EEF1FD] transition-colors"
                        >
                          Catat Pengiriman
                        </Link>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-xs text-slate-500 leading-relaxed">
                    Tidak ada pengeluaran berstatus Disetujui yang menunggu pengiriman.
                  </p>
                )}
              </CardContent>
            </Card>
          </>
        }
      />
    );
  }

  /* =========================================================================
   * 4. SUPPLIER PORTAL DASHBOARD (strictly scoped to own POs & Shipments)
   * ========================================================================= */
  const pendingConf = m.pendingConfirmation ?? 0;
  const awaitingShip = m.awaitingShipment ?? 0;

  return (
    <RoleDashboardShell
      user={user}
      title={`Halo, ${user.name}`}
      headerActions={
        <Link href="/shipment"
          className="inline-flex items-center gap-1.5 rounded-lg bg-[#3243DD] px-3.5 py-2 text-xs sm:text-sm font-semibold text-white hover:bg-[#2635BC] transition-colors"
        >
          <Truck className="h-4 w-4" aria-hidden="true" />
          Kelola Pengiriman
        </Link>
      }
      kpiStrip={[
        {
          label: 'Menunggu Konfirmasi',
          value: data.dbConnected ? pendingConf : '—',
          helper: 'Perlu konfirmasi atau penolakan',
          icon: Clock,
          tone: pendingConf > 0 ? 'accent' : 'primary',
          surface: pendingConf > 0 ? 'soft-pink' : 'soft-blue',
          href: '/purchase-orders?status=pending',
        },
        {
          label: 'Perlu Data Pengiriman',
          value: data.dbConnected ? awaitingShip : '—',
          helper: 'Dikonfirmasi / Disiapkan',
          icon: ClipboardList,
          tone: awaitingShip > 0 ? 'warning' : 'primary',
          surface: 'soft-blue',
          href: '/shipment',
        },
        {
          label: 'Dalam Pengiriman',
          value: data.dbConnected ? m.inTransit ?? 0 : '—',
          helper: 'Menuju gudang Supplify',
          icon: Truck,
          href: '/shipment',
        },
        {
          label: 'Pesanan Selesai',
          value: data.dbConnected ? m.completedOrders ?? 0 : '—',
          helper: 'Terkirim / Diterima gudang',
          icon: CheckCircle2,
          tone: 'success',
          href: '/shipment-history',
        },
      ]}
      mainContent={
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-3">
            <div>
              <CardTitle>Purchase Order Terbaru untuk Perusahaan Anda</CardTitle>
              <p className="mt-0.5 text-xs text-slate-500">
                Pesanan yang memerlukan konfirmasi atau pengiriman diprioritaskan di bagian atas.
              </p>
            </div>
            <Link
              href="/purchase-orders"
              className="inline-flex items-center gap-1 text-xs font-semibold text-[#3243DD] hover:underline shrink-0"
            >
              Semua PO
              <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
            </Link>
          </CardHeader>
          <CardContent className="p-0 sm:p-5">
            {data.recentRows.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Kode PO</TableHead>
                    <TableHead>Item / Qty</TableHead>
                    <TableHead>Estimasi Tiba</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Langkah Berikutnya</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.recentRows.map((row) => {
                    const nextCta =
                      row.status === 'pending'
                        ? 'Konfirmasi PO'
                        : ['processing', 'confirmed', 'preparing'].includes(row.status)
                        ? 'Kirim Barang'
                        : 'Lihat Detail';
                    const isPrimaryAction = [
                      'pending',
                      'processing',
                      'confirmed',
                      'preparing',
                    ].includes(row.status);
                    return (
                      <TableRow key={row.id}>
                        <TableCell className="font-mono text-xs font-semibold text-[#3243DD]">
                          <Link
                            href={`/purchase-orders/${row.id}`}
                            className="hover:underline"
                          >
                            {row.po_code}
                          </Link>
                          <p className="font-sans text-[11px] font-normal text-slate-400">
                            Dipesan {formatDate(row.order_date)}
                          </p>
                        </TableCell>
                        <TableCell className="text-xs tabular-nums">
                          {row.item_count} SKU ({row.total_quantity} unit)
                        </TableCell>
                        <TableCell className="text-xs tabular-nums">
                          {formatDate(row.expected_arrival)}
                        </TableCell>
                        <TableCell>
                          <StatusPill status={row.status} />
                        </TableCell>
                        <TableCell className="text-right">
                          <Link
                            href={`/purchase-orders/${row.id}`}
                            className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-semibold transition-colors ${
                              isPrimaryAction
                                ? 'bg-[#3243DD] text-white hover:bg-[#2635BC]'
                                : 'border border-slate-200 bg-white text-slate-700 hover:border-[#3243DD] hover:text-[#3243DD]'
                            }`}
                          >
                            {nextCta}
                          </Link>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            ) : (
              <div className="p-5 sm:p-0">
                <EmptyState
                  icon={ClipboardList}
                  title="Belum Ada Purchase Order"
                  description="Purchase Order yang diterbitkan untuk perusahaan Anda akan tampil di sini beserta panduan konfirmasi dan pengiriman."
                />
              </div>
            )}
          </CardContent>
        </Card>
      }
      sideContent={
        <Card variant="soft-blue">
          <CardHeader>
            <CardTitle className="text-sm">Alur Pemenuhan Pesanan</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-xs text-slate-600">
            <ol className="space-y-2.5">
              <li className="flex items-start gap-2.5">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#EEF1FD] text-[11px] font-bold text-[#3243DD]">
                  1
                </span>
                <span>
                  <strong className="text-slate-800">Konfirmasi PO</strong> berstatus
                  Menunggu ({pendingConf} pesanan).
                </span>
              </li>
              <li className="flex items-start gap-2.5">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#EEF1FD] text-[11px] font-bold text-[#3243DD]">
                  2
                </span>
                <span>
                  <strong className="text-slate-800">Kirim Data Pengiriman</strong>{' '}
                  berupa kurir, nomor resi, dan lampiran bukti ({awaitingShip} siap kirim).
                </span>
              </li>
              <li className="flex items-start gap-2.5">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#EEF1FD] text-[11px] font-bold text-[#3243DD]">
                  3
                </span>
                <span>
                  <strong className="text-slate-800">Pantau Penerimaan</strong> pada
                  halaman Riwayat Pengiriman hingga gudang menerima barang.
                </span>
              </li>
            </ol>
            {pendingConf > 0 && (
              <div className="pt-1">
                <Link
                  href="/purchase-orders?status=pending"
                  className="inline-flex items-center gap-1 text-xs font-semibold text-[#3243DD] hover:underline"
                >
                  Tinjau PO Menunggu Konfirmasi
                </Link>
              </div>
            )}
          </CardContent>
        </Card>
      }
    />
  );
}
