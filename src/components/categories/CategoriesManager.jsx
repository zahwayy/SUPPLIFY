'use client';

import { useActionState, useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Plus, Pencil, Trash2, Search, Tags, X, ArrowUpRight } from 'lucide-react';
import {
  createCategoryAction,
  updateCategoryAction,
  deleteCategoryAction,
} from '../../modules/categories/categoryActions.js';
import PageHeader from '../shared/PageHeader.jsx';
import FeedbackBanner from '../shared/FeedbackBanner.jsx';
import ExportCsvButton from '../shared/ExportCsvButton.jsx';
import Button from '../ui/Button.jsx';
import { useToast } from '../ui/ToastProvider.jsx';
import Input from '../ui/Input.jsx';
import Modal from '../ui/Modal.jsx';
import Dialog from '../ui/Dialog.jsx';
import Badge from '../ui/Badge.jsx';
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

const emptyActionState = { ok: false, error: null, message: '', fieldErrors: null };

export default function CategoriesManager({
  categories,
  initialSearch = '',
  canExport = false,
}) {
  const router = useRouter();
  const toast = useToast();
  const [searchTerm, setSearchTerm] = useState(initialSearch);
  const [modalMode, setModalMode] = useState(null);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [formValues, setFormValues] = useState({ code: '', name: '', description: '' });
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [feedback, setFeedback] = useState(null);
  const [isDeleting, startDelete] = useTransition();

  const [createState, createAction, isCreating] = useActionState(
    async (prev, fd) => {
      const res = await createCategoryAction(prev, fd);
      if (res.ok) {
        setModalMode(null);
        setFormValues({ code: '', name: '', description: '' });
        setFeedback({ type: 'success', text: res.message });
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
      const res = await updateCategoryAction(prev, fd);
      if (res.ok) {
        setModalMode(null);
        setSelectedCategory(null);
        setFeedback({ type: 'success', text: res.message });
        router.refresh();
      } else if (res?.error) {
        toast.error(res.error);
      }
      return res;
    },
    emptyActionState
  );

  function openCreateModal() {
    setSelectedCategory(null);
    setFormValues({ code: '', name: '', description: '' });
    setModalMode('create');
  }

  function openEditModal(cat) {
    setSelectedCategory(cat);
    setFormValues({
      code: cat.code || '',
      name: cat.name || '',
      description: cat.description || '',
    });
    setModalMode('edit');
  }

  function handleSearchSubmit(e) {
    e.preventDefault();
    const params = new URLSearchParams();
    if (searchTerm.trim()) params.set('search', searchTerm.trim());
    router.push(`/categories${params.toString() ? `?${params.toString()}` : ''}`);
  }

  function resetSearch() {
    setSearchTerm('');
    router.push('/categories');
  }

  function handleDeleteClick(cat) {
    const productCnt = Number(cat.total_product_count || 0);
    const supplierCnt = Number(cat.supplier_count || 0);
    if (productCnt > 0 || supplierCnt > 0) {
      const parts = [];
      if (productCnt > 0) parts.push(`${productCnt} produk`);
      if (supplierCnt > 0) parts.push(`${supplierCnt} supplier`);
      setFeedback({
        type: 'warning',
        text: `Kategori "${cat.name}" tidak dapat dihapus karena masih digunakan oleh produk atau supplier (${parts.join(' dan ')}). Periksa data yang terhubung sebelum melakukan penghapusan.`,
      });
      return;
    }
    setDeleteTarget(cat);
  }

  function confirmDelete() {
    if (!deleteTarget) return;
    startDelete(async () => {
      const res = await deleteCategoryAction(deleteTarget.id);
      setDeleteTarget(null);
      if (res.ok) {
        setFeedback({ type: 'success', text: res.message });
        router.refresh();
      } else {
        setFeedback({ type: 'error', text: res.error });
      }
    });
  }

  const activeState = modalMode === 'edit' ? editState : createState;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Kategori Produk"
        description="Kelola pengelompokan produk dan bidang penyediaan supplier sebagai master data bersama. Kategori yang masih terhubung dengan produk atau supplier tidak dapat dihapus."
        actions={
          <>
            {canExport && (
              <ExportCsvButton
                resource="categories"
                filters={{ search: initialSearch }}
                onFeedback={setFeedback}
              />
            )}
            <Button variant="primary" onClick={openCreateModal}>
              <Plus className="h-4 w-4" aria-hidden="true" />
              Tambah Kategori
            </Button>
          </>
        }
      />

      <FeedbackBanner feedback={feedback} onDismiss={() => setFeedback(null)} />

      <Card variant="neutral">
        <CardContent className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <form onSubmit={handleSearchSubmit} className="flex flex-wrap gap-2 w-full sm:flex-1 max-w-lg">
            <div className="relative min-w-0 w-full sm:w-auto sm:flex-1 sm:min-w-[200px]">
              <Search
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400"
                aria-hidden="true"
              />
              <input
                type="search"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Cari kode atau nama kategori..."
                className="w-full rounded-lg border border-slate-300 bg-white py-2 pl-9 pr-3 text-sm focus:border-[#3243DD] focus:outline-none focus:ring-2 focus:ring-[#3243DD]/20"
              />
            </div>
            <Button type="submit" variant="secondary">
              Cari
            </Button>
            {initialSearch && (
              <Button type="button" variant="ghost" onClick={resetSearch}>
                <X className="h-3.5 w-3.5" aria-hidden="true" />
                Reset
              </Button>
            )}
          </form>
          <span className="text-xs font-medium text-slate-500 tabular-nums">
            Total: {categories.length} kategori
          </span>
        </CardContent>
      </Card>

      {categories.length > 0 ? (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="hidden sm:table-cell">Kode</TableHead>
              <TableHead>Nama Kategori</TableHead>
              <TableHead className="hidden lg:table-cell">Deskripsi</TableHead>
              <TableHead className="hidden md:table-cell">Produk Terkait</TableHead>
              <TableHead className="hidden lg:table-cell">Supplier Terkait</TableHead>
              <TableHead className="text-right">Aksi</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {categories.map((cat) => {
              const productCnt = Number(cat.total_product_count || 0);
              const supplierCnt = Number(cat.supplier_count || 0);
              const hasRelations = productCnt > 0 || supplierCnt > 0;
              return (
                <TableRow key={cat.id}>
                  <TableCell className="hidden sm:table-cell">
                    {cat.code ? (
                      <Badge tone="primary" className="font-mono">
                        {cat.code}
                      </Badge>
                    ) : (
                      <span className="text-xs text-slate-400">—</span>
                    )}
                  </TableCell>
                  <TableCell className="font-semibold text-slate-900">
                    <div className="flex flex-wrap items-center gap-1.5">
                      {cat.code && (
                        <Badge tone="primary" className="font-mono sm:hidden">
                          {cat.code}
                        </Badge>
                      )}
                      <span>{cat.name}</span>
                    </div>
                    <p className="mt-0.5 text-[11px] font-normal text-slate-500 md:hidden">
                      {cat.active_product_count ?? 0} produk • {supplierCnt} supplier
                    </p>
                  </TableCell>
                  <TableCell className="hidden lg:table-cell max-w-md text-xs sm:text-sm text-slate-600">
                    {cat.description || '—'}
                  </TableCell>
                  <TableCell className="hidden md:table-cell">
                    <Link
                      href={`/products?categoryId=${cat.id}`}
                      className="inline-flex items-center gap-1 group"
                      title={`Lihat produk dalam kategori ${cat.name}`}
                    >
                      <Badge
                        tone={Number(cat.active_product_count || 0) > 0 ? 'info' : 'neutral'}
                        className="group-hover:border-[#3243DD]/40 transition-colors"
                      >
                        <span className="tabular-nums">{cat.active_product_count ?? 0}</span>{' '}
                        produk
                        <ArrowUpRight className="h-3 w-3" aria-hidden="true" />
                      </Badge>
                    </Link>
                  </TableCell>
                  <TableCell className="hidden lg:table-cell">
                    <Badge tone={supplierCnt > 0 ? 'primary' : 'neutral'}>
                      <span className="tabular-nums">{supplierCnt}</span> supplier
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right whitespace-nowrap">
                    <div className="inline-flex items-center gap-1.5">
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => openEditModal(cat)}
                      >
                        <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                        Perbarui
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        title={
                          hasRelations
                            ? 'Kategori tidak dapat dihapus karena masih digunakan oleh produk atau supplier'
                            : 'Hapus kategori'
                        }
                        onClick={() => handleDeleteClick(cat)}
                        className={
                          hasRelations
                            ? 'text-slate-400 hover:bg-amber-50 hover:text-amber-700'
                            : 'text-red-600 hover:bg-red-50'
                        }
                      >
                        <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                        Hapus
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      ) : (
        <EmptyState
          icon={Tags}
          title={
            initialSearch
              ? 'Kategori Tidak Ditemukan'
              : 'Belum Ada Kategori Produk'
          }
          description={
            initialSearch
              ? 'Tidak ada kategori yang cocok dengan kata kunci pencarian Anda.'
              : 'Buat kategori produk terlebih dahulu sebelum menambahkan item ke katalog.'
          }
          action={
            initialSearch ? (
              <Button variant="secondary" onClick={resetSearch}>
                Reset Pencarian
              </Button>
            ) : (
              <Button variant="primary" onClick={openCreateModal}>
                <Plus className="h-4 w-4" aria-hidden="true" />
                Tambah Kategori
              </Button>
            )
          }
        />
      )}

      {/* Create / Edit Modal */}
      <Modal
        open={Boolean(modalMode)}
        onClose={() => {
          setModalMode(null);
          setSelectedCategory(null);
        }}
        title={modalMode === 'edit' ? 'Perbarui Kategori' : 'Tambah Kategori Baru'}
        description="Pastikan kode dan nama kategori bersifat unik agar mudah dikenali."
      >
        <form
          action={modalMode === 'edit' ? editAction : createAction}
          className="space-y-4"
        >
          {modalMode === 'edit' && (
            <input type="hidden" name="id" value={selectedCategory?.id || ''} />
          )}

          {activeState.error && (
            <div
              role="alert"
              className="rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-700"
            >
              {activeState.error}
            </div>
          )}

          <Input
            name="code"
            label="Kode Kategori (Opsional)"
            placeholder="Contoh: STA"
            helperText="Singkatan 2–6 huruf untuk memudahkan pengelompokan SKU."
            value={formValues.code}
            onChange={(e) =>
              setFormValues((prev) => ({ ...prev, code: e.target.value }))
            }
            error={activeState.fieldErrors?.code}
          />

          <Input
            name="name"
            label="Nama Kategori"
            required
            placeholder="Contoh: Stationery"
            value={formValues.name}
            onChange={(e) =>
              setFormValues((prev) => ({ ...prev, name: e.target.value }))
            }
            error={activeState.fieldErrors?.name}
          />

          <div>
            <label
              htmlFor="cat-description"
              className="block text-xs sm:text-sm font-medium text-slate-700 mb-1.5"
            >
              Deskripsi (Opsional)
            </label>
            <textarea
              id="cat-description"
              name="description"
              rows={3}
              value={formValues.description}
              onChange={(e) =>
                setFormValues((prev) => ({ ...prev, description: e.target.value }))
              }
              placeholder="Penjelasan singkat kelompok produk dalam kategori ini..."
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-[#3243DD] focus:outline-none focus:ring-2 focus:ring-[#3243DD]/20"
            />
            {activeState.fieldErrors?.description && (
              <p className="mt-1 text-xs font-medium text-red-600">
                {activeState.fieldErrors.description}
              </p>
            )}
          </div>

          <div className="flex justify-end gap-2.5 pt-2 border-t border-slate-100">
            <Button
              variant="secondary"
              onClick={() => setModalMode(null)}
              disabled={isCreating || isUpdating}
            >
              Batal
            </Button>
            <Button
              type="submit"
              variant="primary"
              loading={isCreating || isUpdating}
            >
              {modalMode === 'edit' ? 'Simpan Perubahan' : 'Simpan Kategori'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={confirmDelete}
        title="Hapus Kategori Produk?"
        message={`Apakah Anda yakin ingin menghapus kategori "${deleteTarget?.name || ''}"? Tindakan ini tidak dapat dibatalkan.`}
        confirmLabel="Ya, Hapus"
        cancelLabel="Batal"
        confirmVariant="danger"
        loading={isDeleting}
      />
    </div>
  );
}
