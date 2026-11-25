import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { ArrowLeft, Package, History, ClipboardList, SlidersHorizontal, Archive } from 'lucide-react';
import { getCurrentUser } from '../../../../lib/auth/session.js';
import { hasPermission, PERMISSIONS } from '../../../../lib/auth/rbac.js';
import { ForbiddenError, NotFoundError } from '../../../../lib/constants/errors.js';
import { getProductDetail } from '../../../../modules/products/productService.js';
import { getStockMovementLedger } from '../../../../modules/inventory/inventoryService.js';
import { formatCurrencyIDR, formatDateTime } from '../../../../lib/utils/format.js';
import { getProductImageSrc } from '../../../../lib/utils/productImage.js';
import {
  getMovementSourceHref,
  getMovementTypeMeta,
  getStockStatusMeta,
} from '../../../../lib/utils/labels.js';
import PageHeader from '../../../../components/shared/PageHeader.jsx';
import ProductDetailArchiveButton from '../../../../components/products/ProductDetailArchiveButton.jsx';
import Badge from '../../../../components/ui/Badge.jsx';
import EmptyState from '../../../../components/ui/EmptyState.jsx';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '../../../../components/ui/Card.jsx';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '../../../../components/ui/Table.jsx';

export const dynamic = 'force-dynamic';

export default async function ProductDetailPage({ params }) {
  const user = await getCurrentUser();
  if (!user) redirect('/login?expired=1');
  if (!hasPermission(user, PERMISSIONS.PRODUCTS_READ)) redirect('/unauthorized');

  const resolvedParams = await params;
  const productId = Number(resolvedParams?.id);
  if (!Number.isInteger(productId) || productId <= 0) {
    notFound();
  }

  let product;
  try {
    product = await getProductDetail(user, productId);
  } catch (err) {
    if (err instanceof ForbiddenError) {
      redirect('/unauthorized');
    }
    if (err instanceof NotFoundError) {
      notFound();
    }
    throw err;
  }

  const movements = await getStockMovementLedger(user, {
    productId,
    page: 1,
    pageSize: 15,
  });

  const canArchive = hasPermission(user, PERMISSIONS.PRODUCTS_ARCHIVE);
  const canCreatePo = hasPermission(user, PERMISSIONS.PO_CREATE);
  const canAdjust = hasPermission(user, PERMISSIONS.ADJUSTMENT_READ);
  const isArchived = Boolean(product.deleted_at);
  const statusMeta = getStockStatusMeta(product.stock_status);

  return (
    <div className="space-y-6">
      <PageHeader
        title={product.name}
        description={`Informasi master produk, kondisi persediaan terkini, dan riwayat pergerakan stok untuk SKU ${product.sku}.`}
        breadcrumbs={[
          { label: 'Beranda', href: '/dashboard' },
          { label: 'Produk', href: '/products' },
          { label: product.sku },
        ]}
        badge={
          isArchived ? (
            <div className="flex flex-wrap items-center gap-1.5">
              <Badge tone="warning">Diarsipkan</Badge>
              <Badge tone={statusMeta.tone}>{statusMeta.label}</Badge>
            </div>
          ) : (
            <Badge tone={statusMeta.tone}>{statusMeta.label}</Badge>
          )
        }
        actions={
          <div className="flex flex-wrap gap-2">
            <Link
              href="/products"
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs sm:text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
            >
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              Kembali
            </Link>
            {canCreatePo && !isArchived && (
              <Link
                href={`/restock-orders?productId=${product.id}`}
                className="inline-flex items-center gap-1.5 rounded-lg bg-[#3243DD] px-3.5 py-2 text-xs sm:text-sm font-semibold text-white hover:bg-[#2635BC] transition-colors"
              >
                <ClipboardList className="h-4 w-4" aria-hidden="true" />
                Buat PO Restock
              </Link>
            )}
            {canAdjust && !isArchived && (
              <Link
                href="/inventory?tab=adjustments"
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs sm:text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
              >
                <SlidersHorizontal className="h-4 w-4" aria-hidden="true" />
                Penyesuaian Stok
              </Link>
            )}
            {canArchive && !isArchived && (
              <ProductDetailArchiveButton
                product={{
                  id: product.id,
                  sku: product.sku,
                  name: product.name,
                  category_name: product.category_name,
                  stock: product.stock,
                  unit: product.unit,
                }}
              />
            )}
          </div>
        }
      />

      {isArchived && (
        <div
          role="status"
          className="rounded-xl border border-amber-200 bg-amber-50/90 px-4 py-3 flex items-start gap-3 text-sm text-amber-950"
        >
          <Archive className="h-4 w-4 text-amber-700 mt-0.5 shrink-0" aria-hidden="true" />
          <p className="leading-relaxed">
            Produk ini berstatus diarsipkan dan tidak lagi ditampilkan pada daftar produk
            aktif. Histori transaksi dan pergerakan stok yang sudah tercatat tetap tersimpan.
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="h-4 w-4 text-[#3243DD]" aria-hidden="true" />
              Informasi Produk
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <div className="w-full h-44 rounded-xl border border-slate-200 bg-[#F4F5F8] flex items-center justify-center overflow-hidden">
              {getProductImageSrc(product) ? (
                <img
                  src={getProductImageSrc(product)}
                  alt={product.name}
                  className="h-full w-full object-contain"
                />
              ) : (
                <div className="flex flex-col items-center text-slate-400">
                  <Package className="h-10 w-10" aria-hidden="true" />
                  <span className="mt-1.5 text-xs font-medium">
                    Belum ada gambar produk
                  </span>
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl bg-[#F4F5F8] border border-slate-200/70 p-3.5">
                <p className="text-xs text-slate-500">Stok Tersedia</p>
                <p className="mt-1 text-2xl font-bold text-slate-900 tabular-nums">
                  {product.stock}{' '}
                  <span className="text-xs font-normal text-slate-500">
                    {product.unit || ''}
                  </span>
                </p>
              </div>
              <div className="rounded-xl bg-[#F4F5F8] border border-slate-200/70 p-3.5">
                <p className="text-xs text-slate-500">Min / Batas Rendah</p>
                <p className="mt-1 text-xl font-bold text-slate-900 tabular-nums">
                  {product.minimum_stock !== null ? product.minimum_stock : '—'}
                  {product.low_stock_threshold !== null &&
                  product.low_stock_threshold !== undefined
                    ? ` / ${product.low_stock_threshold}`
                    : ''}{' '}
                  {product.minimum_stock !== null && (
                    <span className="text-xs font-normal text-slate-500">
                      {product.unit || ''}
                    </span>
                  )}
                </p>
              </div>
            </div>

            <dl className="space-y-3 text-sm pt-1">
              <div className="flex justify-between gap-2 pb-2 border-b border-slate-100">
                <dt className="text-xs text-slate-500">Kode SKU</dt>
                <dd className="font-mono text-xs font-semibold text-[#3243DD]">
                  {product.sku}
                </dd>
              </div>
              <div className="flex justify-between gap-2 pb-2 border-b border-slate-100">
                <dt className="text-xs text-slate-500">Kategori</dt>
                <dd className="font-semibold text-slate-900 text-right">
                  <Link
                    href={`/products?categoryId=${product.category_id}`}
                    className="hover:text-[#3243DD] hover:underline"
                  >
                    {product.category_name}
                  </Link>
                </dd>
              </div>
              <div className="flex justify-between gap-2 pb-2 border-b border-slate-100">
                <dt className="text-xs text-slate-500">Harga Beli</dt>
                <dd className="font-semibold text-slate-900 tabular-nums">
                  {formatCurrencyIDR(product.purchase_price)}
                </dd>
              </div>
              <div className="flex justify-between gap-2 pb-2 border-b border-slate-100">
                <dt className="text-xs text-slate-500">Harga Jual</dt>
                <dd className="font-semibold text-slate-900 tabular-nums">
                  {formatCurrencyIDR(product.selling_price)}
                </dd>
              </div>
              <div className="flex justify-between gap-2 pb-2 border-b border-slate-100">
                <dt className="text-xs text-slate-500">Lokasi Rak</dt>
                <dd className="font-semibold text-slate-900">
                  {product.rack_location || 'Belum ditentukan'}
                </dd>
              </div>
              <div className="flex justify-between gap-2 pb-2 border-b border-slate-100">
                <dt className="text-xs text-slate-500">Satuan</dt>
                <dd className="font-semibold text-slate-900">
                  {product.unit || 'Belum ditentukan'}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500">Deskripsi</dt>
                <dd className="mt-1 text-xs text-slate-700 leading-relaxed">
                  {product.description || 'Belum ada keterangan tambahan.'}
                </dd>
              </div>
            </dl>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between gap-2">
            <div>
              <CardTitle className="flex items-center gap-2">
                <History className="h-4 w-4 text-[#3243DD]" aria-hidden="true" />
                Riwayat Pergerakan Stok
              </CardTitle>
              <p className="mt-0.5 text-xs text-slate-500">
                Menampilkan 15 perubahan stok terbaru dari transaksi dan penyesuaian yang disetujui.
              </p>
            </div>
          </CardHeader>
          <CardContent className="p-0 sm:p-5">
            {movements.items.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Waktu</TableHead>
                    <TableHead>Jenis</TableHead>
                    <TableHead>Referensi</TableHead>
                    <TableHead>Perubahan</TableHead>
                    <TableHead>Stok</TableHead>
                    <TableHead>Diproses Oleh</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {movements.items.map((m) => {
                    const mvMeta = getMovementTypeMeta(m.movement_type);
                    const sourceHref = getMovementSourceHref(m);
                    const refCode = m.transaction_code || m.adjustment_code || '—';

                    return (
                      <TableRow key={m.id}>
                        <TableCell className="text-xs text-slate-600 tabular-nums whitespace-nowrap">
                          {formatDateTime(m.created_at)}
                        </TableCell>
                        <TableCell>
                          <Badge tone={mvMeta.tone}>{mvMeta.label}</Badge>
                        </TableCell>
                        <TableCell className="font-mono text-xs">
                          {sourceHref ? (
                            <Link
                              href={sourceHref}
                              className="font-semibold text-[#3243DD] hover:underline"
                            >
                              {refCode}
                            </Link>
                          ) : (
                            refCode
                          )}
                        </TableCell>
                        <TableCell
                          className={`font-bold tabular-nums ${
                            m.quantity_delta > 0 ? 'text-emerald-700' : 'text-red-700'
                          }`}
                        >
                          {m.quantity_delta > 0
                            ? `+${m.quantity_delta}`
                            : m.quantity_delta}{' '}
                          <span className="text-xs font-normal text-slate-500">
                            {m.unit || product.unit || ''}
                          </span>
                        </TableCell>
                        <TableCell className="text-xs tabular-nums whitespace-nowrap">
                          {m.stock_before} <strong>{m.stock_after}</strong>
                        </TableCell>
                        <TableCell className="text-xs text-slate-700">
                          {m.actor_name}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            ) : (
              <div className="p-5 sm:p-0">
                <EmptyState
                  icon={History}
                  title="Belum Ada Pergerakan Stok"
                  description="Setiap penambahan dari Barang Masuk atau pengurangan dari Barang Keluar yang disetujui Manager akan tercatat di sini."
                />
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
