import { ValidationError } from '../../lib/constants/errors.js';
import {
  cleanString,
  isNonEmptyString,
  isPositiveInt,
} from '../../lib/validation/common.js';

const ISSUE_TYPES = new Set([
  'shortage',
  'excess',
  'wrong_item',
  'damaged',
  'lost',
  'not_received',
  'other',
]);
const SOURCE_TYPES = new Set(['incoming', 'outgoing', 'purchase_order', 'stock_count']);

export function validateCreateDiscrepancyInput(rawInput) {
  const issueType = cleanString(rawInput?.issueType);
  const sourceType = cleanString(rawInput?.sourceType);
  const sourceId = rawInput?.sourceId ? Number(rawInput.sourceId) : null;
  const productId = Number(rawInput?.productId);
  const description = cleanString(rawInput?.description);

  const expectedRaw = cleanString(
    rawInput?.expectedQuantity !== undefined && rawInput?.expectedQuantity !== null
      ? String(rawInput.expectedQuantity)
      : ''
  );
  const actualRaw = cleanString(
    rawInput?.actualQuantity !== undefined && rawInput?.actualQuantity !== null
      ? String(rawInput.actualQuantity)
      : ''
  );

  const fieldErrors = {};

  if (!ISSUE_TYPES.has(issueType)) {
    fieldErrors.issueType = 'Jenis ketidaksesuaian tidak valid.';
  }
  if (!SOURCE_TYPES.has(sourceType)) {
    fieldErrors.sourceType = 'Sumber laporan tidak valid.';
  }
  if (sourceType !== 'stock_count' && !isPositiveInt(sourceId)) {
    fieldErrors.sourceId = 'Referensi transaksi atau Purchase Order wajib dipilih.';
  }
  if (!isPositiveInt(productId)) {
    fieldErrors.productId = 'Produk wajib dipilih.';
  }
  if (!isNonEmptyString(description, { min: 5, max: 1000 })) {
    fieldErrors.description = 'Deskripsi temuan wajib diisi minimal 5 karakter.';
  }

  let expectedQuantity = null;
  let actualQuantity = null;
  if (expectedRaw !== '') {
    const num = Number(expectedRaw);
    if (!Number.isInteger(num) || num < 0) {
      fieldErrors.expectedQuantity = 'Kuantitas diharapkan harus bilangan bulat >= 0.';
    } else {
      expectedQuantity = num;
    }
  }
  if (actualRaw !== '') {
    const num = Number(actualRaw);
    if (!Number.isInteger(num) || num < 0) {
      fieldErrors.actualQuantity = 'Kuantitas aktual harus bilangan bulat >= 0.';
    } else {
      actualQuantity = num;
    }
  }

  const difference =
    expectedQuantity !== null && actualQuantity !== null
      ? actualQuantity - expectedQuantity
      : null;

  if (Object.keys(fieldErrors).length > 0) {
    throw new ValidationError('Periksa kembali laporan discrepancy.', fieldErrors);
  }

  return {
    issueType,
    sourceType,
    sourceId: sourceType === 'stock_count' ? null : sourceId,
    productId,
    expectedQuantity,
    actualQuantity,
    difference,
    description,
  };
}

export function validateResolveDiscrepancyInput(rawInput) {
  const status = cleanString(rawInput?.status);
  const investigationNotes = cleanString(rawInput?.investigationNotes) || null;
  const resolutionType = cleanString(rawInput?.resolutionType) || null;
  const resolutionNotes = cleanString(rawInput?.resolutionNotes) || null;

  const fieldErrors = {};

  if (!['investigating', 'resolved', 'closed'].includes(status)) {
    fieldErrors.status = 'Status tindak lanjut discrepancy tidak valid.';
  }
  if (
    ['resolved', 'closed'].includes(status) &&
    !isNonEmptyString(resolutionNotes || '', { min: 5, max: 1000 })
  ) {
    fieldErrors.resolutionNotes =
      'Catatan penyelesaian wajib diisi (minimal 5 karakter) saat menutup atau menyelesaikan discrepancy.';
  }

  if (Object.keys(fieldErrors).length > 0) {
    throw new ValidationError('Periksa kembali data penyelesaian discrepancy.', fieldErrors);
  }

  return {
    status,
    investigationNotes,
    resolutionType,
    resolutionNotes,
  };
}

export function validateRefundClaimInput(rawInput) {
  const refundNotes = cleanString(rawInput?.refundNotes);
  const rawAmount = cleanString(
    rawInput?.refundAmount !== undefined && rawInput?.refundAmount !== null
      ? String(rawInput.refundAmount)
      : ''
  );

  const fieldErrors = {};
  if (!isNonEmptyString(refundNotes, { min: 5, max: 1000 })) {
    fieldErrors.refundNotes =
      'Alasan / rincian klaim refund wajib diisi minimal 5 karakter.';
  }

  let refundAmount = null;
  if (rawAmount !== '') {
    const num = Number(rawAmount);
    if (!Number.isFinite(num) || num <= 0) {
      fieldErrors.refundAmount =
        'Nominal estimasi refund harus lebih besar dari Rp 0 (atau kosongkan).';
    } else {
      refundAmount = Math.round(num * 100) / 100;
    }
  }

  if (Object.keys(fieldErrors).length > 0) {
    throw new ValidationError('Periksa kembali data pengajuan klaim refund.', fieldErrors);
  }

  return { refundAmount, refundNotes };
}

export function validateRefundStatusUpdateInput(rawInput) {
  const refundStatus = cleanString(rawInput?.refundStatus);
  const refundNotes = cleanString(rawInput?.refundNotes) || null;
  const rawAmount = cleanString(
    rawInput?.refundAmount !== undefined && rawInput?.refundAmount !== null
      ? String(rawInput.refundAmount)
      : ''
  );

  const fieldErrors = {};
  if (!['approved', 'rejected', 'completed'].includes(refundStatus)) {
    fieldErrors.refundStatus = 'Status tindak lanjut klaim refund tidak valid.';
  }
  if (
    refundStatus === 'rejected' &&
    !isNonEmptyString(refundNotes || '', { min: 5, max: 1000 })
  ) {
    fieldErrors.refundNotes =
      'Alasan penolakan klaim refund wajib diisi minimal 5 karakter.';
  } else if (refundNotes && refundNotes.length > 1000) {
    fieldErrors.refundNotes = 'Catatan klaim refund maksimal 1000 karakter.';
  }

  let refundAmount = null;
  if (rawAmount !== '') {
    const num = Number(rawAmount);
    if (!Number.isFinite(num) || num <= 0) {
      fieldErrors.refundAmount = 'Nominal refund harus lebih besar dari Rp 0.';
    } else {
      refundAmount = Math.round(num * 100) / 100;
    }
  }

  if (Object.keys(fieldErrors).length > 0) {
    throw new ValidationError('Periksa kembali pembaruan status klaim refund.', fieldErrors);
  }

  return { refundStatus, refundAmount, refundNotes };
}
