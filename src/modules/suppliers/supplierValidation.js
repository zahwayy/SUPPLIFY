import { ValidationError } from '../../lib/constants/errors.js';
import { SUPPLIER_APPEAL_STATUSES } from '../../lib/constants/statuses.js';
import { cleanString, isNonEmptyString } from '../../lib/validation/common.js';

export function validateSupplierRejectionInput(rawInput) {
  const reason = cleanString(rawInput?.rejectionReason);
  if (!isNonEmptyString(reason, { min: 5, max: 500 })) {
    throw new ValidationError(
      'Alasan penolakan supplier wajib diisi (minimal 5 karakter).',
      { rejectionReason: 'Alasan penolakan wajib diisi minimal 5 karakter.' }
    );
  }
  return { rejectionReason: reason };
}

export function validateSupplierAppealInput(rawInput) {
  const appealReason = cleanString(rawInput?.appealReason);
  const companyName = cleanString(rawInput?.companyName);
  const contactName = cleanString(rawInput?.contactName);
  const phone = cleanString(rawInput?.phone);
  const address = cleanString(rawInput?.address);
  const additionalNotes = cleanString(rawInput?.additionalNotes);

  const fieldErrors = {};

  if (!isNonEmptyString(appealReason, { min: 15, max: 1500 })) {
    fieldErrors.appealReason =
      'Penjelasan atau klarifikasi banding wajib diisi (15-1500 karakter).';
  }

  if (companyName && !isNonEmptyString(companyName, { min: 2, max: 150 })) {
    fieldErrors.companyName = 'Nama perusahaan harus 2-150 karakter.';
  }
  if (contactName && !isNonEmptyString(contactName, { min: 2, max: 100 })) {
    fieldErrors.contactName = 'Nama penanggung jawab harus 2-100 karakter.';
  }
  if (phone && !/^[0-9+\-\s()]{6,30}$/.test(phone)) {
    fieldErrors.phone = 'Format nomor telepon tidak valid (6-30 digit).';
  }
  if (address && !isNonEmptyString(address, { min: 5, max: 500 })) {
    fieldErrors.address = 'Alamat perusahaan minimal 5 karakter.';
  }
  if (additionalNotes && additionalNotes.length > 1000) {
    fieldErrors.additionalNotes = 'Catatan tambahan maksimal 1000 karakter.';
  }

  if (Object.keys(fieldErrors).length > 0) {
    throw new ValidationError('Periksa kembali pengajuan banding Anda.', fieldErrors);
  }

  const proposedUpdates = {};
  if (companyName) proposedUpdates.companyName = companyName;
  if (contactName) proposedUpdates.contactName = contactName;
  if (phone) proposedUpdates.phone = phone;
  if (address) proposedUpdates.address = address;
  if (additionalNotes) proposedUpdates.additionalNotes = additionalNotes;

  return { appealReason, proposedUpdates };
}

const ALLOWED_APPEAL_DECISIONS = new Set([
  SUPPLIER_APPEAL_STATUSES.UNDER_REVIEW,
  SUPPLIER_APPEAL_STATUSES.APPROVED,
  SUPPLIER_APPEAL_STATUSES.REJECTED,
]);

export function validateAppealReviewInput(rawInput) {
  const decision = cleanString(rawInput?.decision).toLowerCase();
  const adminDecisionNotes = cleanString(rawInput?.adminDecisionNotes);
  const fieldErrors = {};

  if (!ALLOWED_APPEAL_DECISIONS.has(decision)) {
    fieldErrors.decision = 'Keputusan peninjauan banding tidak valid.';
  }

  if (decision === SUPPLIER_APPEAL_STATUSES.REJECTED) {
    if (!isNonEmptyString(adminDecisionNotes, { min: 5, max: 1000 })) {
      fieldErrors.adminDecisionNotes =
        'Catatan alasan penolakan banding wajib diisi minimal 5 karakter.';
    }
  } else if (adminDecisionNotes && adminDecisionNotes.length > 1000) {
    fieldErrors.adminDecisionNotes = 'Catatan peninjauan maksimal 1000 karakter.';
  }

  if (Object.keys(fieldErrors).length > 0) {
    throw new ValidationError('Periksa kembali keputusan peninjauan banding.', fieldErrors);
  }

  return {
    decision,
    adminDecisionNotes: adminDecisionNotes || null,
  };
}
