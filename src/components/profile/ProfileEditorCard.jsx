'use client';

import { useActionState, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Building2, Lock, Pencil, User } from 'lucide-react';
import { updateOwnProfileAction } from '../../modules/users/userActions.js';
import { ROLES } from '../../lib/constants/roles.js';
import FeedbackBanner from '../shared/FeedbackBanner.jsx';
import StatusPill from '../shared/StatusPill.jsx';
import Button from '../ui/Button.jsx';
import Input from '../ui/Input.jsx';
import { useToast } from '../ui/ToastProvider.jsx';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '../ui/Card.jsx';

const emptyActionState = { ok: false, error: null, message: '', fieldErrors: null };

export default function ProfileEditorCard({ profile }) {
  const router = useRouter();
  const toast = useToast();
  const isSupplier = profile.role === ROLES.SUPPLIER && Boolean(profile.supplierId);

  const initialValues = {
    name: profile.name || '',
    phone:
      profile.phone ||
      (isSupplier ? profile.supplierPhone || '' : ''),
    contactName: profile.supplierContactName || '',
    address: profile.supplierAddress || '',
  };

  const [isEditing, setIsEditing] = useState(false);
  const [formValues, setFormValues] = useState(initialValues);
  const [clientErrors, setClientErrors] = useState({});
  const [feedback, setFeedback] = useState(null);

  const [actionState, formAction, isPending] = useActionState(
    async (prev, formData) => {
      const res = await updateOwnProfileAction(prev, formData);
      if (res.ok && res.data) {
        const updated = res.data;
        setFormValues({
          name: updated.name || '',
          phone:
            updated.phone ||
            (isSupplier ? updated.supplier_phone || '' : ''),
          contactName: updated.supplier_contact_name || '',
          address: updated.supplier_address || '',
        });
        setClientErrors({});
        setIsEditing(false);
        setFeedback({ type: 'success', text: res.message });
        toast.success(res.message, { title: 'Profil Diperbarui' });
        router.refresh();
      } else if (res?.error) {
        setFeedback({ type: 'error', text: res.error });
        toast.error(res.error);
      }
      return res;
    },
    emptyActionState
  );

  function validateField(fieldName, fieldVal) {
    const trimmed = String(fieldVal || '').trim();
    if (fieldName === 'name') {
      if (trimmed.length < 2 || trimmed.length > 100) {
        return 'Nama lengkap wajib diisi (2-100 karakter).';
      }
      return '';
    }
    if (fieldName === 'phone') {
      if (isSupplier && (!trimmed || !/^[0-9+\-\s()]{6,30}$/.test(trimmed))) {
        return 'Nomor telepon perusahaan wajib diisi dengan format valid (6-30 digit).';
      }
      if (!isSupplier && trimmed && !/^[0-9+\-\s()]{6,30}$/.test(trimmed)) {
        return 'Format nomor telepon tidak valid (6-30 karakter angka/tanda + -).';
      }
      return '';
    }
    if (isSupplier && fieldName === 'contactName') {
      if (trimmed.length < 2 || trimmed.length > 100) {
        return 'Nama penanggung jawab (PIC) wajib diisi (2-100 karakter).';
      }
      return '';
    }
    if (isSupplier && fieldName === 'address') {
      if (trimmed.length < 5 || trimmed.length > 500) {
        return 'Alamat perusahaan wajib diisi minimal 5 karakter.';
      }
      return '';
    }
    return '';
  }

  function handleFieldChange(fieldName, nextValue) {
    setFormValues((prev) => ({ ...prev, [fieldName]: nextValue }));
    if (clientErrors[fieldName]) {
      setClientErrors((prev) => {
        const next = { ...prev };
        delete next[fieldName];
        return next;
      });
    }
  }

  function handleFieldBlur(fieldName) {
    const err = validateField(fieldName, formValues[fieldName]);
    setClientErrors((prev) => {
      if (!err) {
        if (!prev[fieldName]) return prev;
        const next = { ...prev };
        delete next[fieldName];
        return next;
      }
      return { ...prev, [fieldName]: err };
    });
  }

  function startEditing() {
    setFormValues({
      name: profile.name || '',
      phone:
        profile.phone ||
        (isSupplier ? profile.supplierPhone || '' : ''),
      contactName: profile.supplierContactName || '',
      address: profile.supplierAddress || '',
    });
    setClientErrors({});
    setFeedback(null);
    setIsEditing(true);
  }

  function cancelEditing() {
    setFormValues(initialValues);
    setClientErrors({});
    setIsEditing(false);
  }

  function handleSubmitValidation(event) {
    const errors = {};
    const fieldsToCheck = isSupplier
      ? ['name', 'phone', 'contactName', 'address']
      : ['name', 'phone'];
    for (const key of fieldsToCheck) {
      const msg = validateField(key, formValues[key]);
      if (msg) errors[key] = msg;
    }

    if (Object.keys(errors).length > 0) {
      event.preventDefault();
      setClientErrors(errors);
      const firstKey = fieldsToCheck.find((k) => errors[k]);
      if (firstKey) {
        const targetId =
          firstKey === 'name'
            ? 'profile-name'
            : firstKey === 'phone'
              ? 'profile-phone'
              : firstKey === 'contactName'
                ? 'profile-contact-name'
                : 'profile-address';
        document.getElementById(targetId)?.focus();
      }
    }
  }

  const displayedPhone =
    profile.phone || (isSupplier ? profile.supplierPhone : '') || 'Belum diisi';

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-3">
        <CardTitle className="flex items-center gap-2">
          <User className="h-4 w-4 text-[#3243DD]" aria-hidden="true" />
          Identitas Akun
        </CardTitle>
        {!isEditing && (
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={startEditing}
          >
            <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
            Edit Profil
          </Button>
        )}
      </CardHeader>

      <CardContent className="space-y-4 text-sm">
        <FeedbackBanner
          feedback={feedback}
          onDismiss={() => setFeedback(null)}
        />

        {isEditing ? (
          <form
            action={formAction}
            onSubmit={handleSubmitValidation}
            aria-label="Form edit profil pengguna"
            className="space-y-4"
          >
            <Input
              id="profile-name"
              name="name"
              label="Nama Lengkap"
              required
              autoComplete="name"
              minLength={2}
              maxLength={100}
              value={formValues.name}
              onChange={(e) => handleFieldChange('name', e.target.value)}
              onBlur={() => handleFieldBlur('name')}
              error={clientErrors.name || actionState.fieldErrors?.name}
            />

            <Input
              id="profile-phone"
              name="phone"
              type="tel"
              inputMode="tel"
              label={isSupplier ? 'Nomor Telepon Perusahaan' : 'Nomor Telepon (Opsional)'}
              required={isSupplier}
              autoComplete="tel"
              maxLength={30}
              placeholder="Contoh: 081234567890"
              value={formValues.phone}
              onChange={(e) => handleFieldChange('phone', e.target.value)}
              onBlur={() => handleFieldBlur('phone')}
              error={clientErrors.phone || actionState.fieldErrors?.phone}
            />

            {isSupplier && (
              <>
                <Input
                  id="profile-contact-name"
                  name="contactName"
                  label="Nama Penanggung Jawab (PIC)"
                  required
                  autoComplete="name"
                  minLength={2}
                  maxLength={100}
                  value={formValues.contactName}
                  onChange={(e) => handleFieldChange('contactName', e.target.value)}
                  onBlur={() => handleFieldBlur('contactName')}
                  error={
                    clientErrors.contactName || actionState.fieldErrors?.contactName
                  }
                />

                <div>
                  <label
                    htmlFor="profile-address"
                    className="block text-xs sm:text-sm font-medium text-slate-700 mb-1.5"
                  >
                    Alamat Perusahaan{' '}
                    <span className="text-[#FF3D8B]" aria-hidden="true">
                      *
                    </span>
                  </label>
                  <textarea
                    id="profile-address"
                    name="address"
                    rows={3}
                    required
                    minLength={5}
                    maxLength={500}
                    autoComplete="street-address"
                    value={formValues.address}
                    onChange={(e) => handleFieldChange('address', e.target.value)}
                    onBlur={() => handleFieldBlur('address')}
                    aria-invalid={Boolean(
                      clientErrors.address || actionState.fieldErrors?.address
                    )}
                    className={`w-full rounded-lg border bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 ${
                      clientErrors.address || actionState.fieldErrors?.address
                        ? 'border-red-400 focus:border-red-500 focus:ring-red-200'
                        : 'border-slate-300 focus:border-[#3243DD] focus:ring-[#3243DD]/20'
                    }`}
                  />
                  {(clientErrors.address || actionState.fieldErrors?.address) && (
                    <p role="alert" className="mt-1 text-xs font-medium text-red-600">
                      {clientErrors.address || actionState.fieldErrors?.address}
                    </p>
                  )}
                </div>
              </>
            )}

            <div className="rounded-xl border border-slate-200/80 bg-[#F4F5F8] p-3.5 space-y-2.5 text-xs">
              <div className="flex items-center gap-1.5 font-semibold text-slate-700">
                <Lock className="h-3.5 w-3.5 text-slate-500" aria-hidden="true" />
                <span>Informasi Terkunci (Dikelola Admin)</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div>
                  <span className="block text-[11px] text-slate-500">Email Akun</span>
                  <span className="font-medium text-slate-800 break-all">
                    {profile.email}
                  </span>
                </div>
                <div>
                  <span className="block text-[11px] text-slate-500">
                    Peran &amp; Status
                  </span>
                  <span className="font-medium text-slate-800">
                    {profile.roleLabel} ({profile.status})
                  </span>
                </div>
                {isSupplier && (
                  <div className="sm:col-span-2">
                    <span className="block text-[11px] text-slate-500">
                      Perusahaan Supplier
                    </span>
                    <span className="font-medium text-slate-800">
                      {profile.supplierCompanyName || 'Belum tersedia'}
                    </span>
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-100">
              <Button
                type="button"
                variant="secondary"
                onClick={cancelEditing}
                disabled={isPending}
              >
                Batal
              </Button>
              <Button type="submit" variant="primary" loading={isPending}>
                Simpan Perubahan
              </Button>
            </div>
          </form>
        ) : (
          <div className="space-y-3.5">
            <div className="flex items-center justify-between gap-2 pb-2.5 border-b border-slate-100">
              <span className="text-xs text-slate-500">Status Akun</span>
              <StatusPill status={profile.status || 'active'} />
            </div>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 pb-2.5 border-b border-slate-100">
              <span className="text-xs text-slate-500">Nama Lengkap</span>
              <span className="font-semibold text-slate-900">{profile.name}</span>
            </div>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 pb-2.5 border-b border-slate-100">
              <span className="text-xs text-slate-500">Nomor Telepon</span>
              <span className="font-semibold text-slate-900 tabular-nums">
                {displayedPhone}
              </span>
            </div>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 pb-2.5 border-b border-slate-100">
              <span className="text-xs text-slate-500">Email</span>
              <span className="font-semibold text-slate-900 break-all">
                {profile.email}
              </span>
            </div>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
              <span className="text-xs text-slate-500">Peran Operasional</span>
              <span className="font-semibold text-slate-900">{profile.roleLabel}</span>
            </div>

            {isSupplier && (
              <div className="pt-3 border-t border-slate-100 space-y-2.5">
                <div>
                  <p className="flex items-center gap-1.5 text-xs text-slate-500">
                    <Building2
                      className="h-3.5 w-3.5 text-[#FF3D8B]"
                      aria-hidden="true"
                    />
                    Perusahaan Supplier
                  </p>
                  <p className="mt-0.5 font-semibold text-slate-900">
                    {profile.supplierCompanyName || 'Belum tersedia'}
                  </p>
                </div>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                  <span className="text-xs text-slate-500">Penanggung Jawab (PIC)</span>
                  <span className="font-semibold text-slate-900">
                    {profile.supplierContactName || 'Belum diisi'}
                  </span>
                </div>
                <div>
                  <span className="text-xs text-slate-500">Alamat Perusahaan</span>
                  <p className="mt-0.5 text-xs sm:text-sm text-slate-700 leading-relaxed">
                    {profile.supplierAddress || 'Belum diisi'}
                  </p>
                </div>
              </div>
            )}

            <p className="pt-2 text-[11px] text-slate-500 border-t border-slate-100">
              Perubahan email, peran, dan status akun dikelola secara terpusat oleh Admin sistem.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
