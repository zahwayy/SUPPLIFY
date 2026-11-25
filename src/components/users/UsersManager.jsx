'use client';

import { useActionState, useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { UserPlus, Search, Users, Power, X, ArrowUpRight } from 'lucide-react';
import {
  createInternalUserAction,
  toggleUserStatusAction,
} from '../../modules/users/userActions.js';
import { formatDateTime } from '../../lib/utils/format.js';
import PageHeader from '../shared/PageHeader.jsx';
import StatusPill from '../shared/StatusPill.jsx';
import FeedbackBanner from '../shared/FeedbackBanner.jsx';
import RoleBadge from '../ui/RoleBadge.jsx';
import Button from '../ui/Button.jsx';
import Input from '../ui/Input.jsx';
import Select from '../ui/Select.jsx';
import Modal from '../ui/Modal.jsx';
import Dialog from '../ui/Dialog.jsx';
import { useToast } from '../ui/ToastProvider.jsx';
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

const INITIAL_USER_FORM = {
  name: '',
  email: '',
  role: 'staff',
  password: '',
};

export default function UsersManager({ users, currentUserId, initialFilters }) {
  const router = useRouter();
  const toast = useToast();
  const [search, setSearch] = useState(initialFilters.search || '');
  const [role, setRole] = useState(initialFilters.role || '');
  const [status, setStatus] = useState(initialFilters.status || '');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [formValues, setFormValues] = useState(INITIAL_USER_FORM);
  const [toggleTarget, setToggleTarget] = useState(null);
  const [feedback, setFeedback] = useState(null);
  const [isToggling, startToggle] = useTransition();

  const [createState, createAction, isCreating] = useActionState(
    async (prev, fd) => {
      const res = await createInternalUserAction(prev, fd);
      if (res.ok) {
        setShowCreateModal(false);
        setFormValues(INITIAL_USER_FORM);
        setFeedback({ type: 'success', text: res.message });
      } else if (res?.error) {
        toast.error(res.error);
      }
      return res;
    },
    emptyActionState
  );

  const hasActiveFilters = Boolean(
    initialFilters.search || initialFilters.role || initialFilters.status
  );

  function pushFilters(overrides = {}) {
    const next = { search, role, status, ...overrides };
    const params = new URLSearchParams();
    if (next.search?.trim()) params.set('search', next.search.trim());
    if (next.role) params.set('role', next.role);
    if (next.status) params.set('status', next.status);
    router.push(`/users${params.toString() ? `?${params.toString()}` : ''}`);
  }

  function resetFilters() {
    setSearch('');
    setRole('');
    setStatus('');
    router.push('/users');
  }

  function handleConfirmToggle() {
    if (!toggleTarget) return;
    const nextStatus = toggleTarget.status === 'active' ? 'inactive' : 'active';
    startToggle(async () => {
      const res = await toggleUserStatusAction(toggleTarget.id, nextStatus);
      setToggleTarget(null);
      if (res.ok) {
        setFeedback({ type: 'success', text: res.message });
      } else {
        setFeedback({ type: 'error', text: res.error });
      }
    });
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Manajemen Pengguna"
        description="Kelola akun internal gudang serta status aktif/nonaktif akun tanpa menghapus histori transaksi."
        actions={
          <Button variant="primary" onClick={() => setShowCreateModal(true)}>
            <UserPlus className="h-4 w-4" aria-hidden="true" />
            Buat Akun Internal
          </Button>
        }
      />

      <FeedbackBanner feedback={feedback} onDismiss={() => setFeedback(null)} />

      <Card variant="neutral">
        <CardContent className="p-4">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              pushFilters();
            }}
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3 items-end"
          >
            <div className="sm:col-span-2 lg:col-span-6">
              <label
                htmlFor="user-search"
                className="block text-xs font-medium text-slate-600 mb-1"
              >
                Cari Nama / Email
              </label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search
                    className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400"
                    aria-hidden="true"
                  />
                  <input
                    id="user-search"
                    type="search"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Cari nama atau email..."
                    className="w-full rounded-lg border border-slate-300 bg-white py-2 pl-9 pr-3 text-sm focus:border-[#3243DD] focus:outline-none focus:ring-2 focus:ring-[#3243DD]/20"
                  />
                </div>
                <Button type="submit" variant="secondary">
                  Cari
                </Button>
                {hasActiveFilters && (
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={resetFilters}
                    aria-label="Reset pencarian"
                    title="Reset pencarian"
                  >
                    <X className="h-4 w-4" aria-hidden="true" />
                  </Button>
                )}
              </div>
            </div>

            <div className="lg:col-span-3">
              <Select
                label="Peran"
                value={role}
                onChange={(e) => {
                  setRole(e.target.value);
                  pushFilters({ role: e.target.value });
                }}
                placeholder="Semua Peran"
                options={[
                  { value: 'admin', label: 'Admin' },
                  { value: 'manager', label: 'Warehouse Manager' },
                  { value: 'staff', label: 'Warehouse Staff' },
                  { value: 'supplier', label: 'Supplier' },
                ]}
              />
            </div>

            <div className="lg:col-span-3">
              <Select
                label="Status"
                value={status}
                onChange={(e) => {
                  setStatus(e.target.value);
                  pushFilters({ status: e.target.value });
                }}
                placeholder="Semua Status"
                options={[
                  { value: 'active', label: 'Aktif' },
                  { value: 'inactive', label: 'Nonaktif' },
                  { value: 'pending', label: 'Menunggu' },
                  { value: 'rejected', label: 'Ditolak' },
                ]}
              />
            </div>
          </form>
        </CardContent>
      </Card>

      {users.length > 0 ? (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nama &amp; Organisasi</TableHead>
              <TableHead className="hidden md:table-cell">Email</TableHead>
              <TableHead className="hidden md:table-cell">Peran</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="hidden lg:table-cell">Terdaftar</TableHead>
              <TableHead className="text-right">Aksi</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map((u) => {
              const isSelf = Number(u.id) === Number(currentUserId);
              const isPendingOrRejectedSupplier =
                u.role === 'supplier' &&
                (u.status === 'pending' || u.status === 'rejected');

              return (
                <TableRow
                  key={u.id}
                  className={u.status === 'inactive' ? 'bg-slate-50/70' : ''}
                >
                  <TableCell>
                    <p className="font-semibold text-slate-900">
                      {u.name}{' '}
                      {isSelf && (
                        <span className="text-xs font-medium text-[#3243DD]">
                          (Anda)
                        </span>
                      )}
                    </p>
                    {u.supplier_company_name && (
                      <p className="text-xs text-slate-500">
                        {u.supplier_company_name}
                      </p>
                    )}
                    <div className="mt-1 flex flex-wrap items-center gap-1.5 md:hidden">
                      <RoleBadge role={u.role} />
                      <span className="text-[11px] text-slate-500 break-all">{u.email}</span>
                    </div>
                  </TableCell>
                  <TableCell className="hidden md:table-cell text-xs text-slate-700">{u.email}</TableCell>
                  <TableCell className="hidden md:table-cell">
                    <RoleBadge role={u.role} />
                  </TableCell>
                  <TableCell>
                    <StatusPill status={u.status} />
                  </TableCell>
                  <TableCell className="hidden lg:table-cell text-xs text-slate-600 tabular-nums whitespace-nowrap">
                    {formatDateTime(u.created_at)}
                  </TableCell>
                  <TableCell className="text-right whitespace-nowrap">
                    {isPendingOrRejectedSupplier ? (
                      <Link
                        href={`/supplier-verification?status=${u.status}`}
                        className="inline-flex items-center gap-1 text-xs font-semibold text-[#3243DD] hover:underline"
                      >
                        Kelola di Verifikasi
                        <ArrowUpRight className="h-3 w-3" aria-hidden="true" />
                      </Link>
                    ) : !isSelf ? (
                      <Button
                        variant={u.status === 'active' ? 'ghost' : 'secondary'}
                        size="sm"
                        className={
                          u.status === 'active' ? 'text-red-600 hover:bg-red-50' : ''
                        }
                        onClick={() => setToggleTarget(u)}
                      >
                        <Power className="h-3.5 w-3.5" aria-hidden="true" />
                        {u.status === 'active' ? 'Nonaktifkan' : 'Aktifkan'}
                      </Button>
                    ) : (
                      <span className="text-xs text-slate-400">Akun aktif Anda</span>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      ) : (
        <EmptyState
          icon={Users}
          title={
            hasActiveFilters
              ? 'Tidak Ada Akun yang Cocok'
              : 'Belum Ada Data Pengguna'
          }
          description="Sesuaikan pilihan atau kata kunci pencarian untuk menampilkan akun pengguna lainnya."
          action={
            hasActiveFilters && (
              <Button variant="secondary" onClick={resetFilters}>
                Reset Pencarian
              </Button>
            )
          }
        />
      )}

      {/* Create Internal Account Modal */}
      <Modal
        open={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        title="Buat Akun Internal Baru"
        description="Untuk akun mitra Supplier, pendaftaran dilakukan melalui halaman Registrasi Supplier dan diverifikasi Admin."
      >
        <form action={createAction} className="space-y-4">
          {createState.error && (
            <div
              role="alert"
              className="rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-700"
            >
              {createState.error}
            </div>
          )}

          <Input
            name="name"
            label="Nama Lengkap"
            required
            placeholder="Contoh: Rina Wijaya"
            value={formValues.name}
            onChange={(e) =>
              setFormValues((prev) => ({ ...prev, name: e.target.value }))
            }
            error={createState.fieldErrors?.name}
          />
          <Input
            name="email"
            type="email"
            label="Email Login"
            required
            placeholder="nama@perusahaan.com"
            value={formValues.email}
            onChange={(e) =>
              setFormValues((prev) => ({ ...prev, email: e.target.value }))
            }
            error={createState.fieldErrors?.email}
          />
          <Select
            name="role"
            label="Peran Pengguna"
            required
            value={formValues.role}
            onChange={(e) =>
              setFormValues((prev) => ({ ...prev, role: e.target.value }))
            }
            options={[
              { value: 'admin', label: 'Admin' },
              { value: 'manager', label: 'Warehouse Manager' },
              { value: 'staff', label: 'Warehouse Staff' },
            ]}
            error={createState.fieldErrors?.role}
          />
          <Input
            name="password"
            type="password"
            label="Password Awal"
            required
            minLength={8}
            helperText="Minimal 8 karakter."
            placeholder="Masukkan password awal"
            value={formValues.password}
            onChange={(e) =>
              setFormValues((prev) => ({ ...prev, password: e.target.value }))
            }
            error={createState.fieldErrors?.password}
          />

          <div className="flex justify-end gap-2.5 pt-2 border-t border-slate-100">
            <Button
              variant="secondary"
              onClick={() => setShowCreateModal(false)}
              disabled={isCreating}
            >
              Batal
            </Button>
            <Button type="submit" variant="primary" loading={isCreating}>
              Simpan Akun
            </Button>
          </div>
        </form>
      </Modal>

      {/* Activate / Deactivate Dialog */}
      <Dialog
        open={Boolean(toggleTarget)}
        onClose={() => setToggleTarget(null)}
        onConfirm={handleConfirmToggle}
        title={
          toggleTarget?.status === 'active'
            ? 'Nonaktifkan Akun Pengguna'
            : 'Aktifkan Kembali Akun'
        }
        message={
          toggleTarget?.status === 'active'
            ? `Menonaktifkan "${toggleTarget?.name}" akan langsung mencabut sesi login aktifnya dan mencegah login ulang, tanpa menghapus riwayat transaksi sebelumnya. Lanjutkan?`
            : `Akun "${toggleTarget?.name}" akan diaktifkan kembali sehingga dapat masuk dan bekerja sesuai perannya.`
        }
        confirmLabel={
          toggleTarget?.status === 'active' ? 'Nonaktifkan Akun' : 'Aktifkan Akun'
        }
        confirmVariant={toggleTarget?.status === 'active' ? 'danger' : 'primary'}
        loading={isToggling}
      />
    </div>
  );
}
