import { ValidationError } from '../../lib/constants/errors.js';
import {
  cleanString,
  isNonEmptyString,
  isValidEmail,
} from '../../lib/validation/common.js';

export function validateLoginInput(rawInput) {
  const email = cleanString(rawInput?.email).toLowerCase();
  const password = typeof rawInput?.password === 'string' ? rawInput.password : '';
  const fieldErrors = {};

  if (!isValidEmail(email)) {
    fieldErrors.email = 'Format email tidak valid.';
  }
  if (password.length === 0) {
    fieldErrors.password = 'Password wajib diisi.';
  }

  if (Object.keys(fieldErrors).length > 0) {
    throw new ValidationError('Periksa kembali email dan password Anda.', fieldErrors);
  }

  return { email, password };
}

export function validateSupplierRegistrationInput(rawInput) {
  const name = cleanString(rawInput?.name);
  const email = cleanString(rawInput?.email).toLowerCase();
  const password = typeof rawInput?.password === 'string' ? rawInput.password : '';
  const confirmPassword =
    typeof rawInput?.confirmPassword === 'string' ? rawInput.confirmPassword : '';
  const companyName = cleanString(rawInput?.companyName);
  const contactName = cleanString(rawInput?.contactName);
  const phone = cleanString(rawInput?.phone);
  const address = cleanString(rawInput?.address);

  const rawCategoryIds = Array.isArray(rawInput?.categoryIds)
    ? rawInput.categoryIds
    : rawInput?.categoryIds !== undefined && rawInput?.categoryIds !== null
    ? [rawInput.categoryIds]
    : [];
  const categoryIds = [
    ...new Set(
      rawCategoryIds
        .map((v) => Number(cleanString(String(v))))
        .filter((n) => Number.isInteger(n) && n > 0)
    ),
  ];

  const fieldErrors = {};

  if (!isNonEmptyString(name, { min: 2, max: 100 })) {
    fieldErrors.name = 'Nama akun harus diisi (2–100 karakter).';
  }
  if (!isValidEmail(email)) {
    fieldErrors.email = 'Format email tidak valid.';
  }
  if (password.length < 8 || password.length > 100) {
    fieldErrors.password = 'Kata sandi minimal 8 karakter.';
  }
  if (password !== confirmPassword) {
    fieldErrors.confirmPassword = 'Konfirmasi kata sandi tidak cocok.';
  }
  if (!isNonEmptyString(companyName, { min: 2, max: 150 })) {
    fieldErrors.companyName = 'Nama perusahaan wajib diisi (2–150 karakter).';
  }
  if (!isNonEmptyString(contactName, { min: 2, max: 100 })) {
    fieldErrors.contactName = 'Nama penanggung jawab wajib diisi (2–100 karakter).';
  }
  if (!isNonEmptyString(phone, { min: 6, max: 30 })) {
    fieldErrors.phone = 'Nomor telepon wajib diisi (6–30 karakter).';
  }
  if (!isNonEmptyString(address, { min: 5, max: 500 })) {
    fieldErrors.address = 'Alamat perusahaan wajib diisi minimal 5 karakter.';
  }
  if (categoryIds.length === 0) {
    fieldErrors.categoryIds = 'Pilih minimal satu kategori barang yang disediakan.';
  }

  if (Object.keys(fieldErrors).length > 0) {
    throw new ValidationError('Mohon lengkapi data pendaftaran dengan benar.', fieldErrors);
  }

  return {
    name,
    email,
    password,
    companyName,
    contactName,
    phone,
    address,
    categoryIds,
  };
}
