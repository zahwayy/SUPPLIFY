import { ValidationError } from '../../lib/constants/errors.js';
import {
  cleanString,
  isNonEmptyString,
  isPositiveInt,
} from '../../lib/validation/common.js';

const ADJUSTMENT_TYPES = new Set([
  'loss',
  'damage',
  'found',
  'correction',
  'return',
  'other',
]);

export function validateCreateAdjustmentInput(rawInput) {
  const productId = Number(rawInput?.productId);
  const discrepancyId = rawInput?.discrepancyId ? Number(rawInput.discrepancyId) : null;
  const adjustmentType = cleanString(rawInput?.adjustmentType);
  const direction = cleanString(rawInput?.direction || '');
  const rawDelta = Number(rawInput?.quantityDelta);
  const reason = cleanString(rawInput?.reason);

  const fieldErrors = {};

  if (!isPositiveInt(productId)) {
    fieldErrors.productId = 'Produk wajib dipilih.';
  }
  if (discrepancyId !== null && !isPositiveInt(discrepancyId)) {
    fieldErrors.discrepancyId = 'Referensi discrepancy tidak valid.';
  }
  if (!ADJUSTMENT_TYPES.has(adjustmentType)) {
    fieldErrors.adjustmentType = 'Jenis penyesuaian stok tidak valid.';
  }

  let quantityDelta = rawDelta;
  if (direction === 'decrease' && rawDelta > 0) {
    quantityDelta = -rawDelta;
  } else if (direction === 'increase' && rawDelta < 0) {
    quantityDelta = Math.abs(rawDelta);
  }

  if (!Number.isInteger(quantityDelta) || quantityDelta === 0) {
    fieldErrors.quantityDelta = 'Jumlah penyesuaian harus berupa bilangan bulat selain nol.';
  }

  if (!isNonEmptyString(reason, { min: 5, max: 1000 })) {
    fieldErrors.reason = 'Alasan penyesuaian stok wajib diisi (minimal 5 karakter).';
  }

  if (Object.keys(fieldErrors).length > 0) {
    throw new ValidationError('Periksa kembali pengajuan Stock Adjustment.', fieldErrors);
  }

  return {
    productId,
    discrepancyId,
    adjustmentType,
    quantityDelta,
    reason,
  };
}

export function validateAdjustmentRejectionInput(rawInput) {
  const rejectionReason = cleanString(rawInput?.rejectionReason);
  if (!isNonEmptyString(rejectionReason, { min: 5, max: 500 })) {
    throw new ValidationError('Alasan penolakan wajib diisi minimal 5 karakter.', {
      rejectionReason: 'Alasan penolakan wajib diisi (5–500 karakter).',
    });
  }
  return { rejectionReason };
}
