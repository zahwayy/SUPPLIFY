import { ValidationError } from '../../lib/constants/errors.js';
import { cleanString, isNonEmptyString } from '../../lib/validation/common.js';

export function validateCategoryInput(rawInput) {
  const code = cleanString(rawInput?.code).toUpperCase();
  const name = cleanString(rawInput?.name);
  const description = cleanString(rawInput?.description);

  const fieldErrors = {};

  if (code && (!/^[A-Z0-9_-]{2,20}$/.test(code))) {
    fieldErrors.code = 'Kode kategori hanya boleh berisi huruf, angka, tanda hubung, atau garis bawah (2–20 karakter).';
  }
  if (!isNonEmptyString(name, { min: 2, max: 100 })) {
    fieldErrors.name = 'Nama kategori wajib diisi (2–100 karakter).';
  }
  if (description.length > 500) {
    fieldErrors.description = 'Deskripsi kategori maksimal 500 karakter.';
  }

  if (Object.keys(fieldErrors).length > 0) {
    throw new ValidationError('Periksa kembali data kategori.', fieldErrors);
  }

  return {
    code: code || null,
    name,
    description: description || null,
  };
}
