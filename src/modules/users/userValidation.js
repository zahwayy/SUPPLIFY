import { INTERNAL_ROLES, ROLES } from '../../lib/constants/roles.js';
import { ValidationError } from '../../lib/constants/errors.js';
import {
  cleanString,
  isNonEmptyString,
  isValidEmail,
} from '../../lib/validation/common.js';

export function validateCreateInternalUserInput(rawInput) {
  const name = cleanString(rawInput?.name);
  const email = cleanString(rawInput?.email).toLowerCase();
  const password = typeof rawInput?.password === 'string' ? rawInput.password : '';
  const role = cleanString(rawInput?.role).toLowerCase();

  const fieldErrors = {};

  if (!isNonEmptyString(name, { min: 2, max: 100 })) {
    fieldErrors.name = 'Nama pengguna wajib diisi (2-100 karakter).';
  }
  if (!isValidEmail(email)) {
    fieldErrors.email = 'Format email tidak valid.';
  }
  if (password.length < 8 || password.length > 100) {
    fieldErrors.password = 'Password minimal 8 karakter.';
  }
  if (!INTERNAL_ROLES.includes(role)) {
    fieldErrors.role = 'Role akun internal hanya boleh admin, manager, atau staff.';
  }

  if (Object.keys(fieldErrors).length > 0) {
    throw new ValidationError('Periksa kembali data akun pengguna.', fieldErrors);
  }

  return { name, email, password, role };
}

export function validateUpdateOwnProfileInput(rawInput, { role = '' } = {}) {
  const name = cleanString(rawInput?.name);
  const phone = cleanString(rawInput?.phone);
  const contactName = cleanString(rawInput?.contactName);
  const address = cleanString(rawInput?.address);
  const isSupplier = role === ROLES.SUPPLIER;

  const fieldErrors = {};

  if (!isNonEmptyString(name, { min: 2, max: 100 })) {
    fieldErrors.name = 'Nama lengkap wajib diisi (2-100 karakter).';
  }

  if (isSupplier) {
    if (!phone || !/^[0-9+\-\s()]{6,30}$/.test(phone)) {
      fieldErrors.phone = 'Nomor telepon perusahaan wajib diisi dengan format valid (6-30 digit).';
    }
    if (!isNonEmptyString(contactName, { min: 2, max: 100 })) {
      fieldErrors.contactName = 'Nama penanggung jawab (PIC) wajib diisi (2-100 karakter).';
    }
    if (!isNonEmptyString(address, { min: 5, max: 500 })) {
      fieldErrors.address = 'Alamat perusahaan wajib diisi minimal 5 karakter.';
    }
  } else if (phone && !/^[0-9+\-\s()]{6,30}$/.test(phone)) {
    fieldErrors.phone = 'Format nomor telepon tidak valid (6-30 karakter angka/tanda + -).';
  }

  if (Object.keys(fieldErrors).length > 0) {
    throw new ValidationError('Periksa kembali informasi profil Anda.', fieldErrors);
  }

  return {
    name,
    phone: phone || null,
    contactName: isSupplier ? contactName : null,
    address: isSupplier ? address : null,
  };
}
