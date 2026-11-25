import { ValidationError } from '../../lib/constants/errors.js';
import {
  cleanString,
  isNonEmptyString,
  isPositiveInt,
} from '../../lib/validation/common.js';

export function validateCreatePoInput(rawInput) {
  const supplierId = Number(rawInput?.supplierId);
  const orderDate = cleanString(rawInput?.orderDate) || new Date().toISOString().slice(0, 10);
  const expectedArrival = cleanString(rawInput?.expectedArrival) || null;
  const notes = cleanString(rawInput?.notes) || null;
  const referencePoId = rawInput?.referencePoId ? Number(rawInput.referencePoId) : null;
  const sourceDiscrepancyId = rawInput?.sourceDiscrepancyId
    ? Number(rawInput.sourceDiscrepancyId)
    : null;
  const rawItems = Array.isArray(rawInput?.items) ? rawInput.items : [];

  const fieldErrors = {};

  if (!isPositiveInt(supplierId)) {
    fieldErrors.supplierId = 'Supplier terverifikasi wajib dipilih.';
  }
  if (referencePoId !== null && !isPositiveInt(referencePoId)) {
    fieldErrors.referencePoId = 'Referensi PO sebelumnya tidak valid.';
  }
  if (sourceDiscrepancyId !== null && !isPositiveInt(sourceDiscrepancyId)) {
    fieldErrors.sourceDiscrepancyId = 'Referensi discrepancy tidak valid.';
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(orderDate)) {
    fieldErrors.orderDate = 'Tanggal pemesanan tidak valid.';
  }
  if (expectedArrival && !/^\d{4}-\d{2}-\d{2}$/.test(expectedArrival)) {
    fieldErrors.expectedArrival = 'Estimasi kedatangan tidak valid.';
  }
  if (expectedArrival && expectedArrival < orderDate) {
    fieldErrors.expectedArrival = 'Estimasi kedatangan tidak boleh lebih awal dari tanggal pemesanan.';
  }

  if (rawItems.length === 0) {
    fieldErrors.items = 'Minimal satu item produk wajib ditambahkan ke PO.';
  }

  const seenProducts = new Set();
  const items = [];
  for (const item of rawItems) {
    const productId = Number(item?.productId);
    const quantity = Number(item?.quantity);
    if (!isPositiveInt(productId) || !isPositiveInt(quantity)) {
      fieldErrors.items = 'Setiap item PO harus memiliki produk valid dan kuantitas > 0.';
      break;
    }
    if (seenProducts.has(productId)) {
      fieldErrors.items = 'Produk yang sama tidak boleh dimasukkan dua kali dalam satu PO.';
      break;
    }
    seenProducts.add(productId);
    items.push({ productId, quantity });
  }

  if (Object.keys(fieldErrors).length > 0) {
    throw new ValidationError('Periksa kembali data Purchase Order.', fieldErrors);
  }

  return {
    supplierId,
    orderDate,
    expectedArrival,
    notes,
    referencePoId,
    sourceDiscrepancyId,
    items,
  };
}

export function validatePoRejectionInput(rawInput) {
  const reason = cleanString(rawInput?.rejectionReason);
  if (!isNonEmptyString(reason, { min: 5, max: 500 })) {
    throw new ValidationError('Alasan penolakan PO wajib diisi (minimal 5 karakter).', {
      rejectionReason: 'Alasan penolakan wajib diisi minimal 5 karakter.',
    });
  }
  return { rejectionReason: reason };
}

export function validateShipmentInput(rawInput) {
  const courierName = cleanString(rawInput?.courierName);
  const trackingNumber = cleanString(rawInput?.trackingNumber);
  const noTrackingReason = cleanString(rawInput?.noTrackingReason);
  const notes = cleanString(rawInput?.notes) || null;
  const shippedAtRaw = cleanString(rawInput?.shippedAt);

  const fieldErrors = {};

  if (!isNonEmptyString(courierName, { min: 2, max: 120 })) {
    fieldErrors.courierName = 'Nama kurir atau metode pengiriman wajib diisi.';
  }
  if (!trackingNumber && !isNonEmptyString(noTrackingReason, { min: 5, max: 300 })) {
    fieldErrors.noTrackingReason =
      'Isi nomor resi, atau berikan alasan apabila pengiriman tidak memiliki nomor resi.';
  }
  if (trackingNumber.length > 100) {
    fieldErrors.trackingNumber = 'Nomor resi maksimal 100 karakter.';
  }

  let shippedAt = new Date();
  if (shippedAtRaw) {
    const parsed = new Date(shippedAtRaw);
    if (Number.isNaN(parsed.getTime())) {
      fieldErrors.shippedAt = 'Tanggal pengiriman tidak valid.';
    } else {
      shippedAt = parsed;
    }
  }

  if (Object.keys(fieldErrors).length > 0) {
    throw new ValidationError('Periksa kembali informasi pengiriman.', fieldErrors);
  }

  return {
    courierName,
    trackingNumber: trackingNumber || null,
    noTrackingReason: trackingNumber ? null : noTrackingReason,
    notes,
    shippedAt,
  };
}

export function validateSupplierArrivalInput(rawInput) {
  const arrivalNotes = cleanString(rawInput?.arrivalNotes) || null;
  if (arrivalNotes && arrivalNotes.length > 500) {
    throw new ValidationError('Catatan kedatangan maksimal 500 karakter.', {
      arrivalNotes: 'Catatan kedatangan maksimal 500 karakter.',
    });
  }
  return { arrivalNotes };
}

export function validateInspectionRequestInput(rawInput) {
  const notes = cleanString(rawInput?.notes) || null;
  if (notes && notes.length > 500) {
    throw new ValidationError('Catatan instruksi pemeriksaan maksimal 500 karakter.', {
      notes: 'Catatan instruksi pemeriksaan maksimal 500 karakter.',
    });
  }
  return { notes };
}

export function validateCompletePoInput(rawInput, { hasRemaining = false } = {}) {
  const completionNotes = cleanString(rawInput?.completionNotes) || null;
  if (hasRemaining && !isNonEmptyString(completionNotes, { min: 5, max: 500 })) {
    throw new ValidationError(
      'Masih ada sisa kewajiban PO. Isi catatan penyelesaian resmi (minimal 5 karakter) sebelum menyelesaikan PO.',
      {
        completionNotes:
          'Catatan penyelesaian resmi wajib diisi minimal 5 karakter jika masih ada sisa kewajiban.',
      }
    );
  }
  if (completionNotes && completionNotes.length > 500) {
    throw new ValidationError('Catatan penyelesaian maksimal 500 karakter.', {
      completionNotes: 'Catatan penyelesaian maksimal 500 karakter.',
    });
  }
  return { completionNotes };
}
