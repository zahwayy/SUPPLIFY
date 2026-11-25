'use client';

import { useActionState, useEffect, useRef, useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Plus,
  Pencil,
  Trash2,
  Search,
  Package,
  Eye,
  X,
  Info,
  ImagePlus,
} from 'lucide-react';
import {
  createProductAction,
  updateProductAction,
  archiveProductAction,
  deleteProductAction,
} from '../../modules/products/productActions.js';
import {
  ALLOWED_PRODUCT_UNIT_VALUES,
  PRODUCT_UNIT_OPTIONS,
  normalizeProductUnit,
} from '../../lib/constants/units.js';
import { formatCurrencyIDR } from '../../lib/utils/format.js';
import { getProductImageSrc } from '../../lib/utils/productImage.js';
import {
  getStockStatusMeta,
  STOCK_STATUS_FILTER_OPTIONS,
} from '../../lib/utils/labels.js';
import PageHeader from '../shared/PageHeader.jsx';
import FeedbackBanner from '../shared/FeedbackBanner.jsx';
import ExportCsvButton from '../shared/ExportCsvButton.jsx';
import Button from '../ui/Button.jsx';
import Input from '../ui/Input.jsx';
import Select from '../ui/Select.jsx';
import Modal from '../ui/Modal.jsx';
import { useToast } from '../ui/ToastProvider.jsx';
import Badge from '../ui/Badge.jsx';
import Pagination from '../ui/Pagination.jsx';
import EmptyState from '../ui/EmptyState.jsx';
import { Card, CardContent } from '../ui/Card.jsx';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '../ui/Table.jsx';
import ArchiveProductDialog from './ArchiveProductDialog.jsx';
import DeleteProductDialog from './DeleteProductDialog.jsx';
import ProductRowActions from './ProductRowActions.jsx';

const emptyActionState = { ok: false, error: null, message: '', fieldErrors: null };
const MAX_CLIENT_IMAGE_BYTES = 2 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

function sanitizeNominalInput(raw) {
  const cleaned = String(raw || '').replace(/[^0-9.]/g, '');
  const parts = cleaned.split('.');
  if (parts.length <= 1) return cleaned;
  return `${parts[0]}.${parts.slice(1).join('')}`;
}

function sanitizeIntegerInput(raw) {
  return String(raw || '').replace(/[^0-9]/g, '');
}

function formatRupiahPreview(rawValue) {
  if (rawValue === '' || rawValue === null || rawValue === undefined) {
    return null;
  }
  const num = Number(rawValue);
  if (!Number.isFinite(num) || num < 0) return null;
  return formatCurrencyIDR(num);
}

function buildFormFromProduct(product = null) {
  return {
    sku: product?.sku || '',
    categoryId: product ? String(product.category_id) : '',
    name: product?.name || '',
    purchasePrice:
      product?.purchase_price !== null && product?.purchase_price !== undefined
        ? String(Number(product.purchase_price))
        : '',
    sellingPrice:
      product?.selling_price !== null && product?.selling_price !== undefined
        ? String(Number(product.selling_price))
        : '',
    minimumStock:
      product?.minimum_stock !== null && product?.minimum_stock !== undefined
        ? String(product.minimum_stock)
        : '',
    lowStockThreshold:
      product?.low_stock_threshold !== null && product?.low_stock_threshold !== undefined
        ? String(product.low_stock_threshold)
        : '',
    unit: product?.unit ? normalizeProductUnit(product.unit) : '',
    rackLocation: product?.rack_location || '',
    description: product?.description || '',
  };
}

function validateProductClientForm(values, mode, imageError) {
  const fieldErrors = {};
  const sku = String(values.sku || '').trim().toUpperCase();
  const name = String(values.name || '').trim();
  const unit = normalizeProductUnit(values.unit);

  if (mode === 'create' && !/^[A-Z0-9_-]{2,50}$/.test(sku)) {
    fieldErrors.sku = 'Kode SKU wajib diisi (2–50 karakter huruf, angka, -, atau _).';
  }
  if (name.length < 2 || name.length > 150) {
    fieldErrors.name = 'Nama produk wajib diisi (2–150 karakter).';
  }
  if (!values.categoryId) {
    fieldErrors.categoryId = 'Kategori produk wajib dipilih.';
  }
  if (!unit || !ALLOWED_PRODUCT_UNIT_VALUES.has(unit)) {
    fieldErrors.unit = 'Satuan produk wajib dipilih dari daftar yang tersedia.';
  }

  if (values.purchasePrice === '') {
    fieldErrors.purchasePrice = 'Harga beli wajib diisi.';
  } else {
    const numBuy = Number(values.purchasePrice);
    if (!Number.isFinite(numBuy) || numBuy <= 0) {
      fieldErrors.purchasePrice = 'Harga beli harus lebih besar dari Rp 0.';
    }
  }

  if (values.sellingPrice === '') {
    fieldErrors.sellingPrice = 'Harga jual wajib diisi.';
  } else {
    const numSell = Number(values.sellingPrice);
    if (!Number.isFinite(numSell) || numSell < 0) {
      fieldErrors.sellingPrice = 'Harga jual tidak boleh bernilai negatif.';
    }
  }

  const minStock = values.minimumStock === '' ? null : Number(values.minimumStock);
  const lowThresh =
    values.lowStockThreshold === '' ? null : Number(values.lowStockThreshold);

  if (minStock !== null && (!Number.isInteger(minStock) || minStock < 0)) {
    fieldErrors.minimumStock = 'Stok minimum harus berupa bilangan bulat >= 0.';
  }
  if (lowThresh !== null && (!Number.isInteger(lowThresh) || lowThresh <= 0)) {
    fieldErrors.lowStockThreshold = 'Batas stok rendah harus lebih besar dari 0.';
  } else if (lowThresh !== null && minStock === null) {
    fieldErrors.minimumStock =
      'Stok minimum wajib diisi apabila Batas Stok Rendah diatur.';
  } else if (lowThresh !== null && minStock !== null && lowThresh <= minStock) {
    fieldErrors.lowStockThreshold =
      'Batas stok rendah harus lebih besar dari Stok Minimum.';
  }

  if (String(values.description || '').length > 1000) {
    fieldErrors.description = 'Deskripsi produk maksimal 1000 karakter.';
  }

  if (imageError) {
    fieldErrors.image = imageError;
  }

  return fieldErrors;
}

export default function ProductsManager({
  catalog,
  categories,
  canManage = false,
  canArchive = false,
  canDelete = false,
  canExport = false,
  initialFilters,
}) {
  const router = useRouter();
  const toast = useToast();
  const fileInputRef = useRef(null);

  const [search, setSearch] = useState(initialFilters.search || '');
  const [categoryId, setCategoryId] = useState(
    initialFilters.categoryId ? String(initialFilters.categoryId) : ''
  );
  const [stockStatus, setStockStatus] = useState(initialFilters.stockStatus || '');
  const [sortBy, setSortBy] = useState(initialFilters.sortBy || 'sku');

  const [modalMode, setModalMode] = useState(null);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [formValues, setFormValues] = useState(buildFormFromProduct());
  const [clientErrors, setClientErrors] = useState({});
  const [selectedImagePreview, setSelectedImagePreview] = useState(null);
  const [selectedImageName, setSelectedImageName] = useState('');
  const [selectedImageError, setSelectedImageError] = useState(null);
  const [removeExistingImage, setRemoveExistingImage] = useState(false);

  const [archiveTarget, setArchiveTarget] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteError, setDeleteError] = useState(null);
  const [feedback, setFeedback] = useState(null);
  const [isMutating, startTransition] = useTransition();

  useEffect(() => {
    return () => {
      if (selectedImagePreview && selectedImagePreview.startsWith('blob:')) {
        URL.revokeObjectURL(selectedImagePreview);
      }
    };
  }, [selectedImagePreview]);

  function clearImageSelection() {
    if (selectedImagePreview && selectedImagePreview.startsWith('blob:')) {
      URL.revokeObjectURL(selectedImagePreview);
    }
    setSelectedImagePreview(null);
    setSelectedImageName('');
    setSelectedImageError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }

  const [createState, createAction, isCreating] = useActionState(
    async (prev, fd) => {
      const res = await createProductAction(prev, fd);
      if (res.ok) {
        setModalMode(null);
        setFormValues(buildFormFromProduct());
        clearImageSelection();
        setClientErrors({});
        setFeedback({ type: 'success', text: res.message });
        toast.success(res.message, { title: 'Produk Ditambahkan' });
        router.refresh();
      } else if (res?.error) {
        toast.error(res.error);
      }
      return res;
    },
    emptyActionState
  );

  const [editState, editAction, isUpdating] = useActionState(
    async (prev, fd) => {
      const res = await updateProductAction(prev, fd);
      if (res.ok) {
        setModalMode(null);
        setSelectedProduct(null);
        clearImageSelection();
        setRemoveExistingImage(false);
        setClientErrors({});
        setFeedback({ type: 'success', text: res.message });
        toast.success(res.message, { title: 'Produk Diperbarui' });
        router.refresh();
      } else if (res?.error) {
        toast.error(res.error);
      }
      return res;
    },
    emptyActionState
  );

  const hasActiveFilters = Boolean(
    initialFilters.search ||
      initialFilters.categoryId ||
      initialFilters.stockStatus ||
      (initialFilters.sortBy && initialFilters.sortBy !== 'sku')
  );

  function pushFilters(overrides = {}) {
    const next = {
      search,
      categoryId,
      stockStatus,
      sortBy,
      page: 1,
      ...overrides,
    };
    const params = new URLSearchParams();
    if (next.search?.trim()) params.set('search', next.search.trim());
    if (next.categoryId) params.set('categoryId', String(next.categoryId));
    if (next.stockStatus) params.set('stockStatus', next.stockStatus);
    if (next.sortBy && next.sortBy !== 'sku') params.set('sortBy', next.sortBy);
    if (next.page && next.page > 1) params.set('page', String(next.page));

    router.push(`/products${params.toString() ? `?${params.toString()}` : ''}`);
  }

  function resetFilters() {
    setSearch('');
    setCategoryId('');
    setStockStatus('');
    setSortBy('sku');
    router.push('/products');
  }

  function openCreateModal() {
    setSelectedProduct(null);
    setFormValues(buildFormFromProduct());
    setClientErrors({});
    clearImageSelection();
    setRemoveExistingImage(false);
    setModalMode('create');
  }

  function openEditModal(product) {
    setSelectedProduct(product);
    setFormValues(buildFormFromProduct(product));
    setClientErrors({});
    clearImageSelection();
    setRemoveExistingImage(false);
    setModalMode('edit');
  }

  function handleImageChange(e) {
    const file = e.target.files?.[0];
    if (!file) {
      clearImageSelection();
      return;
    }

    if (!ALLOWED_IMAGE_TYPES.has(file.type)) {
      clearImageSelection();
      setSelectedImageError('Format gambar tidak didukung. Pilih file JPG, PNG, atau WEBP.');
      return;
    }

    if (file.size <= 0 || file.size > MAX_CLIENT_IMAGE_BYTES) {
      clearImageSelection();
      setSelectedImageError('Ukuran gambar melebihi batas maksimal 2 MB.');
      return;
    }

    if (selectedImagePreview && selectedImagePreview.startsWith('blob:')) {
      URL.revokeObjectURL(selectedImagePreview);
    }
    const objUrl = URL.createObjectURL(file);
    setSelectedImagePreview(objUrl);
    setSelectedImageName(file.name);
    setSelectedImageError(null);
    setRemoveExistingImage(false);
  }

  function handleFormSubmit(e) {
    const errors = validateProductClientForm(formValues, modalMode, selectedImageError);
    if (Object.keys(errors).length > 0) {
      e.preventDefault();
      setClientErrors(errors);
      return;
    }
    setClientErrors({});
  }

  function handleArchiveConfirm() {
    const target = archiveTarget;
    if (!target) return;
    startTransition(async () => {
      const res = await archiveProductAction(target.id);
      setArchiveTarget(null);
      if (res?.ok) {
        setFeedback(null);
        toast.success(
          res.message || `Produk "${target.name}" (${target.sku}) berhasil diarsipkan.`,
          { title: 'Produk Diarsipkan' }
        );
        router.refresh();
      } else {
        const errMsg = res?.error || 'Gagal mengarsipkan produk. Silakan coba lagi.';
        toast.error(errMsg, { title: 'Gagal Mengarsipkan' });
      }
    });
  }

  function handleDeleteConfirm() {
    const target = deleteTarget;
    if (!target) return;
    setDeleteError(null);
    startTransition(async () => {
      const res = await deleteProductAction(target.id);
      if (res.ok) {
        setDeleteTarget(null);
        setDeleteError(null);
        setFeedback({ type: 'success', text: res.message });
        toast.success(
          res.message || `Produk "${target.name}" (${target.sku}) berhasil dihapus.`,
          { title: 'Produk Dihapus' }
        );
        router.refresh();
      } else {
        const errMsg = res.error || 'Produk tidak dapat dihapus.';
        setDeleteError(errMsg);
        setFeedback(null);
        toast.error(errMsg, { title: 'Penghapusan Dibatalkan' });
      }
    });
  }

  const activeState = modalMode === 'edit' ? editState : createState;
  const mergedErrors = {
    ...(activeState.fieldErrors || {}),
    ...clientErrors,
  };

  const categoryOptions = categories.map((c) => ({
    value: String(c.id),
    label: c.code ? `${c.name} (${c.code})` : c.name,
  }));

  const buyPreview = formatRupiahPreview(formValues.purchasePrice);
  const sellPreview = formatRupiahPreview(formValues.sellingPrice);
  const existingImageUrl =
    modalMode === 'edit' && !removeExistingImage
      ? getProductImageSrc(selectedProduct)
      : null;
  const activePreviewUrl = selectedImagePreview || existingImageUrl;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Katalog Produk"
        description={
          canManage
            ? 'Kelola data master produk gudang, harga beli, harga jual, satuan, gambar produk, dan batas stok minimum.'
            : 'Lihat informasi master katalog produk gudang, stok tersedia, dan batas stok minimum (akses baca saja).'
        }
        actions={
          <>
            {canExport && (
              <ExportCsvButton
                resource="products"
                filters={{
                  search: initialFilters.search,
                  categoryId: initialFilters.categoryId,
                  stockStatus: initialFilters.stockStatus,
                  sortBy: initialFilters.sortBy,
                }}
                onFeedback={setFeedback}
              />
            )}
            {canManage && (
              <Button variant="primary" onClick={openCreateModal}>
                <Plus className="h-4 w-4" aria-hidden="true" />
                Tambah Produk
              </Button>
            )}
          </>
        }
      />

      <FeedbackBanner feedback={feedback} onDismiss={() => setFeedback(null)} />

      {/* Pencarian & Penyaringan */}
      <Card variant="neutral">
        <CardContent className="p-4">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              pushFilters();
            }}
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3 items-end"
          >
            <div className="sm:col-span-2 lg:col-span-4">
              <label
                htmlFor="prod-search"
                className="block text-xs font-medium text-slate-600 mb-1"
              >
                Cari SKU / Nama Produk
              </label>
              <div className="relative">
                <Search
                  className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400"
                  aria-hidden="true"
                />
                <input
                  id="prod-search"
                  type="search"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Contoh: STA-001 atau Pensil..."
                  className="w-full rounded-lg border border-slate-300 bg-white py-2 pl-9 pr-3 text-sm focus:border-[#3243DD] focus:outline-none focus:ring-2 focus:ring-[#3243DD]/20"
                />
              </div>
            </div>

            <div className="lg:col-span-3">
              <Select
                label="Kategori"
                value={categoryId}
                onChange={(e) => {
                  setCategoryId(e.target.value);
                  pushFilters({ categoryId: e.target.value });
                }}
                placeholder="Semua Kategori"
                options={categoryOptions}
              />
            </div>

            <div className="lg:col-span-2">
              <Select
                label="Status Stok"
                value={stockStatus}
                onChange={(e) => {
                  setStockStatus(e.target.value);
                  pushFilters({ stockStatus: e.target.value });
                }}
                placeholder="Semua Status"
                options={STOCK_STATUS_FILTER_OPTIONS}
              />
            </div>

            <div className="lg:col-span-3 flex gap-2 items-end">
              <div className="flex-1">
                <Select
                  label="Urutkan"
                  value={sortBy}
                  onChange={(e) => {
                    setSortBy(e.target.value);
                    pushFilters({ sortBy: e.target.value });
                  }}
                  options={[
                    { value: 'sku', label: 'SKU (A–Z)' },
                    { value: 'name', label: 'Nama (A–Z)' },
                    { value: 'stock', label: 'Stok Terkecil' },
                    { value: 'category', label: 'Kategori' },
                  ]}
                />
              </div>
              <Button type="submit" variant="secondary">
                Cari
              </Button>
            </div>
          </form>

          <div className="mt-3 pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-600">
            <div className="flex flex-wrap items-center gap-4">
              {hasActiveFilters && (
                <button
                  type="button"
                  onClick={resetFilters}
                  className="inline-flex items-center gap-1 font-semibold text-[#3243DD] hover:underline cursor-pointer"
                >
                  <X className="h-3.5 w-3.5" aria-hidden="true" />
                  Reset Pencarian
                </button>
              )}
            </div>
            <span className="tabular-nums font-medium text-slate-500">
              Menampilkan {catalog.items.length} dari {catalog.totalCount} produk
            </span>
          </div>
        </CardContent>
      </Card>

      {catalog.items.length > 0 ? (
        <div className="space-y-4">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Produk</TableHead>
                <TableHead className="hidden md:table-cell">Kategori</TableHead>
                <TableHead>Stok</TableHead>
                <TableHead className="hidden lg:table-cell">Min / Rendah</TableHead>
                <TableHead className="hidden lg:table-cell">Harga Beli</TableHead>
                <TableHead className="hidden md:table-cell">Harga Jual</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {catalog.items.map((product) => {
                const statusMeta = getStockStatusMeta(product.stock_status);
                const imageSrc = getProductImageSrc(product);
                return (
                  <TableRow key={product.id}>
                    <TableCell>
                      <div className="flex items-center gap-2.5 sm:gap-3 min-w-[145px] sm:min-w-[200px]">
                        <div className="h-11 w-11 rounded-lg border border-slate-200 bg-[#F4F5F8] flex items-center justify-center overflow-hidden shrink-0">
                          {imageSrc ? (
                            <img
                              src={imageSrc}
                              alt={product.name}
                              onError={(e) => {
                                if (!e.currentTarget.dataset.fallbackApplied) {
                                  e.currentTarget.dataset.fallbackApplied = '1';
                                  e.currentTarget.src = `/api/products/${product.id}/image`;
                                }
                              }}
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <Package
                              className="h-5 w-5 text-slate-400"
                              aria-hidden="true"
                            />
                          )}
                        </div>
                        <div className="min-w-0">
                          <Link
                            href={`/products/${product.id}`}
                            className="font-semibold text-slate-900 hover:text-[#3243DD] block truncate"
                          >
                            {product.name}
                          </Link>
                          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs">
                            <Link
                              href={`/products/${product.id}`}
                              className="font-mono font-semibold text-[#3243DD] hover:underline"
                            >
                              {product.sku}
                            </Link>
                            {product.rack_location && (
                              <span className="text-[11px] text-slate-500">
                                • Rak: {product.rack_location}
                              </span>
                            )}
                          </div>
                          <p className="mt-0.5 text-[11px] text-slate-500 truncate md:hidden">
                            {product.category_name} • {formatCurrencyIDR(product.selling_price)}
                          </p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-xs text-slate-600">
                      {product.category_name}
                    </TableCell>
                    <TableCell className="font-semibold text-slate-900 tabular-nums whitespace-nowrap">
                      {product.stock}{' '}
                      <span className="text-xs font-normal text-slate-500">
                        {product.unit || ''}
                      </span>
                    </TableCell>
                    <TableCell className="hidden lg:table-cell text-xs text-slate-600 tabular-nums">
                      {product.minimum_stock !== null ? product.minimum_stock : '—'}
                      {product.low_stock_threshold !== null &&
                      product.low_stock_threshold !== undefined
                        ? ` / ${product.low_stock_threshold}`
                        : ''}
                    </TableCell>
                    <TableCell className="hidden lg:table-cell text-xs text-slate-700 tabular-nums whitespace-nowrap">
                      {formatCurrencyIDR(product.purchase_price)}
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-xs text-slate-700 tabular-nums whitespace-nowrap">
                      {formatCurrencyIDR(product.selling_price)}
                    </TableCell>
                    <TableCell>
                      <Badge tone={statusMeta.tone}>{statusMeta.label}</Badge>
                    </TableCell>
                    <TableCell className="text-right whitespace-nowrap">
                      <div className="inline-flex items-center gap-1.5">
                        <Link
                          href={`/products/${product.id}`}
                          className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100 transition-colors"
                        >
                          <Eye className="h-3.5 w-3.5" aria-hidden="true" />
                          Detail
                        </Link>
                        {canManage && (
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => openEditModal(product)}
                          >
                            <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                            Perbarui
                          </Button>
                        )}
                        {(canArchive || canDelete) && (
                          <ProductRowActions
                            product={product}
                            disabled={isMutating}
                            canArchive={canArchive}
                            canDelete={canDelete}
                            onArchive={setArchiveTarget}
                            onDelete={(prod) => {
                              setDeleteError(null);
                              setDeleteTarget(prod);
                            }}
                          />
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>

          <Pagination
            page={catalog.page}
            totalPages={catalog.totalPages}
            onPageChange={(nextPage) => pushFilters({ page: nextPage })}
          />
        </div>
      ) : (
        <EmptyState
          icon={Package}
          title={
            hasActiveFilters
              ? 'Tidak Ada Produk yang Cocok'
              : 'Belum Ada Produk di Katalog'
          }
          description={
            hasActiveFilters
              ? 'Coba ubah kata kunci pencarian atau reset filter untuk melihat seluruh produk.'
              : canManage
              ? 'Tambahkan produk pertama Anda untuk mulai mencatat persediaan gudang.'
              : 'Belum ada data produk yang terdaftar di katalog gudang.'
          }
          action={
            <>
              {hasActiveFilters && (
                <Button variant="secondary" onClick={resetFilters}>
                  Reset Pencarian
                </Button>
              )}
              {canManage && (
                <Button variant="primary" onClick={openCreateModal}>
                  <Plus className="h-4 w-4" aria-hidden="true" />
                  Tambah Produk
                </Button>
              )}
            </>
          }
        />
      )}

      {/* Modal Tambah / Perbarui Produk (Admin & Manager) */}
      {canManage && (
        <Modal
          open={Boolean(modalMode)}
          onClose={() => {
            setModalMode(null);
            setSelectedProduct(null);
            clearImageSelection();
            setRemoveExistingImage(false);
          }}
          title={modalMode === 'edit' ? 'Perbarui Data Produk' : 'Tambah Produk Baru'}
          description="Lengkapi informasi produk, kategori, harga beli & harga jual, satuan, serta gambar produk di bawah ini."
          maxWidthClass="max-w-2xl"
        >
          <form
            action={modalMode === 'edit' ? editAction : createAction}
            onSubmit={handleFormSubmit}
            className="space-y-5"
          >
            {modalMode === 'edit' && (
              <input type="hidden" name="id" value={selectedProduct?.id || ''} />
            )}
            <input
              type="hidden"
              name="removeImage"
              value={removeExistingImage ? '1' : '0'}
            />

            {activeState.error && (
              <div
                role="alert"
                className="rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-700"
              >
                {activeState.error}
              </div>
            )}

            {/* Bagian 1: Identitas Produk */}
            <div className="space-y-3.5">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Identitas Produk
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <Input
                    name="sku"
                    label="Kode SKU"
                    required
                    disabled={modalMode === 'edit'}
                    readOnly={modalMode === 'edit'}
                    placeholder="Contoh: STA-006"
                    value={formValues.sku}
                    onChange={(e) => {
                      setClientErrors((p) => ({ ...p, sku: null }));
                      setFormValues((prev) => ({
                        ...prev,
                        sku: e.target.value.toUpperCase(),
                      }));
                    }}
                    error={mergedErrors.sku}
                  />
                  {modalMode === 'edit' && (
                    <>
                      <input type="hidden" name="sku" value={formValues.sku} />
                      <p className="mt-1 text-[11px] text-slate-500">
                        Kode SKU bersifat permanen setelah produk dibuat.
                      </p>
                    </>
                  )}
                </div>
                <Select
                  name="categoryId"
                  label="Kategori"
                  required
                  value={formValues.categoryId}
                  onChange={(e) => {
                    setClientErrors((p) => ({ ...p, categoryId: null }));
                    setFormValues((prev) => ({ ...prev, categoryId: e.target.value }));
                  }}
                  placeholder="Pilih kategori produk"
                  options={categoryOptions}
                  error={mergedErrors.categoryId}
                />
              </div>

              <Input
                name="name"
                label="Nama Produk"
                required
                placeholder="Contoh: Spidol Papan Tulis Hitam"
                value={formValues.name}
                onChange={(e) => {
                  setClientErrors((p) => ({ ...p, name: null }));
                  setFormValues((prev) => ({ ...prev, name: e.target.value }));
                }}
                error={mergedErrors.name}
              />
            </div>

            {/* Bagian 2: Harga & Pengaturan Gudang */}
            <div className="space-y-3.5 pt-3 border-t border-slate-100">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Harga &amp; Pengaturan Gudang
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label
                    htmlFor="prod-purchase-price"
                    className="block text-xs sm:text-sm font-medium text-slate-700 mb-1.5"
                  >
                    Harga Beli (Rp) <span className="text-[#FF3D8B]">*</span>
                  </label>
                  <div className="relative">
                    <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-slate-500">
                      Rp
                    </span>
                    <input
                      id="prod-purchase-price"
                      name="purchasePrice"
                      type="text"
                      inputMode="numeric"
                      required
                      placeholder="Contoh: 15000"
                      value={formValues.purchasePrice}
                      onChange={(e) => {
                        setClientErrors((p) => ({ ...p, purchasePrice: null }));
                        setFormValues((prev) => ({
                          ...prev,
                          purchasePrice: sanitizeNominalInput(e.target.value),
                        }));
                      }}
                      className={`w-full rounded-lg border bg-white py-2 pl-9 pr-3 text-sm tabular-nums text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 ${
                        mergedErrors.purchasePrice
                          ? 'border-red-400 focus:border-red-500 focus:ring-red-200'
                          : 'border-slate-300 focus:border-[#3243DD] focus:ring-[#3243DD]/20'
                      }`}
                    />
                  </div>
                  {mergedErrors.purchasePrice ? (
                    <p className="mt-1 text-xs font-medium text-red-600">
                      {mergedErrors.purchasePrice}
                    </p>
                  ) : buyPreview ? (
                    <p className="mt-1 text-[11px] font-medium text-[#3243DD] tabular-nums">
                      Tampilan Rupiah: {buyPreview}
                    </p>
                  ) : (
                    <p className="mt-1 text-[11px] text-slate-500">
                      Masukkan nominal angka tanpa titik pemisah ribuan.
                    </p>
                  )}
                </div>

                <div>
                  <label
                    htmlFor="prod-selling-price"
                    className="block text-xs sm:text-sm font-medium text-slate-700 mb-1.5"
                  >
                    Harga Jual (Rp) <span className="text-[#FF3D8B]">*</span>
                  </label>
                  <div className="relative">
                    <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-slate-500">
                      Rp
                    </span>
                    <input
                      id="prod-selling-price"
                      name="sellingPrice"
                      type="text"
                      inputMode="numeric"
                      required
                      placeholder="Contoh: 20000"
                      value={formValues.sellingPrice}
                      onChange={(e) => {
                        setClientErrors((p) => ({ ...p, sellingPrice: null }));
                        setFormValues((prev) => ({
                          ...prev,
                          sellingPrice: sanitizeNominalInput(e.target.value),
                        }));
                      }}
                      className={`w-full rounded-lg border bg-white py-2 pl-9 pr-3 text-sm tabular-nums text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 ${
                        mergedErrors.sellingPrice
                          ? 'border-red-400 focus:border-red-500 focus:ring-red-200'
                          : 'border-slate-300 focus:border-[#3243DD] focus:ring-[#3243DD]/20'
                      }`}
                    />
                  </div>
                  {mergedErrors.sellingPrice ? (
                    <p className="mt-1 text-xs font-medium text-red-600">
                      {mergedErrors.sellingPrice}
                    </p>
                  ) : sellPreview ? (
                    <p className="mt-1 text-[11px] font-medium text-[#3243DD] tabular-nums">
                      Tampilan Rupiah: {sellPreview}
                    </p>
                  ) : (
                    <p className="mt-1 text-[11px] text-slate-500">
                      Masukkan nominal angka yang valid (minimal Rp 0).
                    </p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
                <Select
                  name="unit"
                  label="Satuan"
                  required
                  value={formValues.unit}
                  onChange={(e) => {
                    setClientErrors((p) => ({ ...p, unit: null }));
                    setFormValues((prev) => ({ ...prev, unit: e.target.value }));
                  }}
                  placeholder="Pilih satuan"
                  options={PRODUCT_UNIT_OPTIONS}
                  error={mergedErrors.unit}
                />
                <Input
                  name="rackLocation"
                  label="Lokasi Rak"
                  placeholder="Contoh: A-01"
                  value={formValues.rackLocation}
                  onChange={(e) =>
                    setFormValues((prev) => ({ ...prev, rackLocation: e.target.value }))
                  }
                  error={mergedErrors.rackLocation}
                />
                <Input
                  name="minimumStock"
                  type="text"
                  inputMode="numeric"
                  label="Stok Minimum (Kritis)"
                  placeholder="Opsional"
                  value={formValues.minimumStock}
                  onChange={(e) => {
                    setClientErrors((p) => ({ ...p, minimumStock: null }));
                    setFormValues((prev) => ({
                      ...prev,
                      minimumStock: sanitizeIntegerInput(e.target.value),
                    }));
                  }}
                  error={mergedErrors.minimumStock}
                />
                <Input
                  name="lowStockThreshold"
                  type="text"
                  inputMode="numeric"
                  label="Batas Stok Rendah"
                  placeholder="> Stok Minimum"
                  value={formValues.lowStockThreshold}
                  onChange={(e) => {
                    setClientErrors((p) => ({ ...p, lowStockThreshold: null }));
                    setFormValues((prev) => ({
                      ...prev,
                      lowStockThreshold: sanitizeIntegerInput(e.target.value),
                    }));
                  }}
                  error={mergedErrors.lowStockThreshold}
                />
              </div>

              {/* Stok (Read-only agar selaras dengan Stock Movement Ledger) */}
              <div className="rounded-lg border border-slate-200 bg-[#F4F5F8] px-3.5 py-2.5 flex items-center justify-between gap-3">
                <div className="flex items-start gap-2 text-xs text-slate-700">
                  <Info
                    className="h-4 w-4 mt-0.5 text-[#3243DD] shrink-0"
                    aria-hidden="true"
                  />
                  <div>
                    <span className="font-semibold text-slate-900">
                      Stok Gudang Saat Ini:{' '}
                      <span className="tabular-nums text-[#3243DD]">
                        {modalMode === 'edit' ? selectedProduct?.stock ?? 0 : 0}{' '}
                        {formValues.unit || selectedProduct?.unit || 'unit'}
                      </span>
                    </span>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      Saldo stok dikelola otomatis melalui Barang Masuk, Barang Keluar,
                      dan Penyesuaian Stok yang disetujui agar buku besar pergerakan stok
                      tetap konsisten.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Bagian 3: Gambar Produk & Deskripsi */}
            <div className="space-y-3.5 pt-3 border-t border-slate-100">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Gambar &amp; Deskripsi Produk
              </p>

              <div className="flex flex-col sm:flex-row items-start gap-4">
                <div className="h-24 w-24 rounded-xl border border-slate-200 bg-[#F4F5F8] flex items-center justify-center overflow-hidden shrink-0">
                  {activePreviewUrl ? (
                    <img
                      src={activePreviewUrl}
                      alt={formValues.name || 'Preview gambar produk'}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex flex-col items-center text-slate-400">
                      <Package className="h-7 w-7" aria-hidden="true" />
                      <span className="mt-1 text-[10px] font-medium">Tanpa Gambar</span>
                    </div>
                  )}
                </div>

                <div className="flex-1 w-full space-y-2">
                  <label
                    htmlFor="prod-image"
                    className="block text-xs sm:text-sm font-medium text-slate-700"
                  >
                    Gambar Produk (Opsional)
                  </label>
                  <div className="flex flex-wrap items-center gap-2">
                    <label className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer transition-colors">
                      <ImagePlus className="h-4 w-4 text-[#3243DD]" aria-hidden="true" />
                      <span>
                        {activePreviewUrl ? 'Ganti Gambar' : 'Unggah Gambar'}
                      </span>
                      <input
                        ref={fileInputRef}
                        id="prod-image"
                        name="image"
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        onChange={handleImageChange}
                        className="sr-only"
                      />
                    </label>
                    {selectedImageName && (
                      <button
                        type="button"
                        onClick={clearImageSelection}
                        className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100 cursor-pointer"
                      >
                        <X className="h-3.5 w-3.5" aria-hidden="true" />
                        Batalkan File Baru
                      </button>
                    )}
                    {modalMode === 'edit' &&
                      selectedProduct?.image_path &&
                      !selectedImagePreview &&
                      !removeExistingImage && (
                        <button
                          type="button"
                          onClick={() => setRemoveExistingImage(true)}
                          className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 cursor-pointer"
                        >
                          <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                          Hapus Gambar
                        </button>
                      )}
                  </div>
                  <p className="text-[11px] text-slate-500">
                    {selectedImageName
                      ? `File dipilih: ${selectedImageName}`
                      : removeExistingImage
                      ? 'Gambar saat ini akan dihapus saat perubahan disimpan.'
                      : 'Format didukung: JPG, PNG, atau WEBP dengan ukuran maksimal 2 MB.'}
                  </p>
                  {mergedErrors.image && (
                    <p className="text-xs font-medium text-red-600">
                      {mergedErrors.image}
                    </p>
                  )}
                </div>
              </div>

              <div>
                <label
                  htmlFor="prod-desc"
                  className="block text-xs sm:text-sm font-medium text-slate-700 mb-1.5"
                >
                  Deskripsi (Opsional)
                </label>
                <textarea
                  id="prod-desc"
                  name="description"
                  rows={2}
                  value={formValues.description}
                  onChange={(e) =>
                    setFormValues((prev) => ({ ...prev, description: e.target.value }))
                  }
                  placeholder="Spesifikasi singkat atau catatan penyimpanan produk..."
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-[#3243DD] focus:outline-none focus:ring-2 focus:ring-[#3243DD]/20"
                />
                {mergedErrors.description && (
                  <p className="mt-1 text-xs font-medium text-red-600">
                    {mergedErrors.description}
                  </p>
                )}
              </div>
            </div>

            <div className="flex justify-end gap-2.5 pt-3 border-t border-slate-100">
              <Button
                variant="secondary"
                onClick={() => {
                  setModalMode(null);
                  setSelectedProduct(null);
                  clearImageSelection();
                  setRemoveExistingImage(false);
                }}
                disabled={isCreating || isUpdating}
              >
                Batal
              </Button>
              <Button
                type="submit"
                variant="primary"
                loading={isCreating || isUpdating}
              >
                {modalMode === 'edit' ? 'Perbarui Produk' : 'Simpan Produk'}
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* Dialog Konfirmasi Arsipkan Produk & Hapus Produk Permanen */}
      {canArchive && (
        <ArchiveProductDialog
          product={archiveTarget}
          open={Boolean(archiveTarget)}
          loading={isMutating}
          onClose={() => {
            if (!isMutating) setArchiveTarget(null);
          }}
          onConfirm={handleArchiveConfirm}
        />
      )}

      {canDelete && (
        <DeleteProductDialog
          product={deleteTarget}
          open={Boolean(deleteTarget)}
          loading={isMutating}
          error={deleteError}
          onClose={() => {
            if (!isMutating) {
              setDeleteTarget(null);
              setDeleteError(null);
            }
          }}
          onConfirm={handleDeleteConfirm}
          onSwitchToArchive={
            canArchive
              ? (prod) => {
                  setDeleteTarget(null);
                  setDeleteError(null);
                  setArchiveTarget(prod);
                }
              : null
          }
        />
      )}
    </div>
  );
}
