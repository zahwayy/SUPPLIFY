'use client';

import { useActionState, useState } from 'react';
import Link from 'next/link';
import { AlertCircle, Check } from 'lucide-react';
import { registerSupplierAction } from '../../modules/auth/authActions.js';
import Input from '../ui/Input.jsx';
import Button from '../ui/Button.jsx';

const initialState = { ok: false, data: null, message: '', error: null, fieldErrors: null };

export default function RegisterForm({ categories = [] }) {
  const [state, formAction, isPending] = useActionState(
    registerSupplierAction,
    initialState
  );

  const [values, setValues] = useState({
    name: '',
    email: '',
    companyName: '',
    contactName: '',
    phone: '',
    address: '',
  });
  const [selectedCategories, setSelectedCategories] = useState([]);
  const [clientCategoryError, setClientCategoryError] = useState(null);

  function updateField(field) {
    return (e) => setValues((prev) => ({ ...prev, [field]: e.target.value }));
  }

  function toggleCategory(catId) {
    const strId = String(catId);
    setClientCategoryError(null);
    setSelectedCategories((prev) =>
      prev.includes(strId) ? prev.filter((id) => id !== strId) : [...prev, strId]
    );
  }

  function handleSubmit(e) {
    if (selectedCategories.length === 0) {
      e.preventDefault();
      setClientCategoryError('Pilih minimal satu kategori barang yang disediakan.');
      return;
    }
    setClientCategoryError(null);
  }

  const categoryError = clientCategoryError || state.fieldErrors?.categoryIds;

  return (
    <form action={formAction} onSubmit={handleSubmit} className="space-y-4">
      {state.error && (
        <div
          role="alert"
          className="flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 px-3.5 py-3 text-sm text-red-800"
        >
          <AlertCircle className="h-4 w-4 mt-0.5 shrink-0 text-red-600" aria-hidden="true" />
          <span>{state.error}</span>
        </div>
      )}

      <div className="space-y-3">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
          Informasi Akun
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Input
            id="name"
            name="name"
            type="text"
            label="Nama Akun"
            required
            value={values.name}
            onChange={updateField('name')}
            placeholder="Nama lengkap"
            error={state.fieldErrors?.name}
          />

          <Input
            id="email"
            name="email"
            type="email"
            label="Email Masuk"
            required
            value={values.email}
            onChange={updateField('email')}
            placeholder="supplier@perusahaan.com"
            error={state.fieldErrors?.email}
          />
        </div>
      </div>

      <div className="space-y-3 pt-2 border-t border-slate-100">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
          Profil Perusahaan Supplier
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Input
            id="companyName"
            name="companyName"
            type="text"
            label="Nama Perusahaan"
            required
            value={values.companyName}
            onChange={updateField('companyName')}
            placeholder="PT / CV Supplier"
            error={state.fieldErrors?.companyName}
          />

          <Input
            id="contactName"
            name="contactName"
            type="text"
            label="Penanggung Jawab (PIC)"
            required
            value={values.contactName}
            onChange={updateField('contactName')}
            placeholder="Nama PIC"
            error={state.fieldErrors?.contactName}
          />
        </div>

        <Input
          id="phone"
          name="phone"
          type="tel"
          label="Nomor Telepon"
          required
          value={values.phone}
          onChange={updateField('phone')}
          placeholder="0812xxxxxxxx"
          error={state.fieldErrors?.phone}
        />

        <div>
          <label
            htmlFor="address"
            className="block text-xs sm:text-sm font-medium text-slate-700 mb-1.5"
          >
            Alamat Perusahaan <span className="text-[#FF3D8B]">*</span>
          </label>
          <textarea
            id="address"
            name="address"
            rows={2}
            required
            value={values.address}
            onChange={updateField('address')}
            placeholder="Alamat lengkap perusahaan"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-[#3243DD] focus:outline-none focus:ring-2 focus:ring-[#3243DD]/20"
          />
          {state.fieldErrors?.address && (
            <p className="mt-1 text-xs font-medium text-red-600">
              {state.fieldErrors.address}
            </p>
          )}
        </div>

        {/* Kategori Barang dari Database */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <span className="block text-xs sm:text-sm font-medium text-slate-700">
              Kategori Barang yang Disediakan{' '}
              <span className="text-[#FF3D8B]">*</span>
            </span>
            <span className="text-[11px] font-medium text-slate-500 tabular-nums">
              {selectedCategories.length} dipilih
            </span>
          </div>

          {categories.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {categories.map((cat) => {
                const strId = String(cat.id);
                const checked = selectedCategories.includes(strId);
                return (
                  <label
                    key={cat.id}
                    className={`flex items-center justify-between gap-2 rounded-lg border px-3 py-2 text-xs sm:text-sm cursor-pointer transition-colors ${
                      checked
                        ? 'border-[#3243DD] bg-[#EEF1FD]/70 text-[#1F2C9E] font-semibold'
                        : 'border-slate-300 bg-white text-slate-700 hover:border-slate-400'
                    }`}
                  >
                    <input
                      type="checkbox"
                      name="categoryIds"
                      value={strId}
                      checked={checked}
                      onChange={() => toggleCategory(cat.id)}
                      className="sr-only"
                    />
                    <span className="truncate">
                      {cat.name}
                      {cat.code ? (
                        <span className="ml-1.5 font-mono text-[11px] text-slate-500">
                          ({cat.code})
                        </span>
                      ) : null}
                    </span>
                    <span
                      className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
                        checked
                          ? 'border-[#3243DD] bg-[#3243DD] text-white'
                          : 'border-slate-300 bg-white'
                      }`}
                    >
                      {checked && <Check className="h-3 w-3" aria-hidden="true" />}
                    </span>
                  </label>
                );
              })}
            </div>
          ) : (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs text-amber-800">
              Daftar kategori barang belum tersedia di sistem. Silakan hubungi Admin
              gudang sebelum melanjutkan pendaftaran.
            </div>
          )}

          {categoryError && (
            <p className="mt-1 text-xs font-medium text-red-600">{categoryError}</p>
          )}
          <p className="mt-1 text-[11px] text-slate-500">
            Anda dapat memilih lebih dari satu kategori barang sesuai bidang usaha.
          </p>
        </div>
      </div>

      <div className="space-y-3 pt-2 border-t border-slate-100">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
          Keamanan Akun
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Input
            id="password"
            name="password"
            type="password"
            label="Kata Sandi"
            required
            minLength={8}
            placeholder="Minimal 8 karakter"
            error={state.fieldErrors?.password}
          />

          <Input
            id="confirmPassword"
            name="confirmPassword"
            type="password"
            label="Konfirmasi Kata Sandi"
            required
            minLength={8}
            placeholder="Ulangi kata sandi"
            error={state.fieldErrors?.confirmPassword}
          />
        </div>
      </div>

      <Button
        type="submit"
        variant="primary"
        size="lg"
        loading={isPending}
        disabled={categories.length === 0}
        className="w-full"
      >
        {isPending ? 'Mengirim Pendaftaran...' : 'Daftar sebagai Supplier'}
      </Button>

      <div className="pt-1 text-center text-sm text-slate-600">
        Sudah memiliki akun aktif?{' '}
        <Link
          href="/login"
          className="font-semibold text-[#3243DD] hover:text-[#FF3D8B] transition-colors"
        >
          Masuk di sini
        </Link>
      </div>
    </form>
  );
}
