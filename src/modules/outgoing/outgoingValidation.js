import { ValidationError } from '../../lib/constants/errors.js';
import {
  cleanString,
  isNonEmptyString,
  isPositiveInt,
} from '../../lib/validation/common.js';

const VALID_RECIPIENT_TYPES = new Set([
  'internal',
  'customer',
  'branch',
  'external',
  'courier',
]);
const VALID_METHODS = new Set(['direct', 'courier']);

function isValidIsoCalendarDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

export function validateCreateOutgoingInput(rawInput) {
  const rawShipmentDate = cleanString(rawInput?.shipmentDate);
  const shipmentDate = rawShipmentDate || new Date().toISOString().slice(0, 10);
  const recipientName = cleanString(rawInput?.recipientName);
  const notes = cleanString(rawInput?.notes) || null;
  const rawItems = Array.isArray(rawInput?.items) ? rawInput.items : [];

  const fieldErrors = {};
  if (!isValidIsoCalendarDate(shipmentDate)) {
    fieldErrors.shipmentDate = 'Tanggal pengiriman wajib berupa tanggal valid (YYYY-MM-DD).';
  }
  if (!isNonEmptyString(recipientName, { min: 2, max: 150 })) {
    fieldErrors.recipientName = 'Nama Customer / Penerima wajib diisi (2–150 karakter).';
  }
  if (rawItems.length === 0) {
    fieldErrors.items = 'Minimal satu item barang keluar wajib ditambahkan.';
  }

  const seen = new Set();
  const items = [];
  for (const item of rawItems) {
    const productId = Number(item?.productId);
    const quantity = Number(item?.quantity);
    const itemNotes = cleanString(item?.notes) || null;

    if (!isPositiveInt(productId) || !isPositiveInt(quantity)) {
      fieldErrors.items = 'Setiap item Outgoing harus memiliki produk valid dan kuantitas > 0.';
      break;
    }
    if (seen.has(productId)) {
      fieldErrors.items = 'Produk yang sama tidak boleh dicatat dua kali dalam satu Outgoing.';
      break;
    }
    seen.add(productId);
    items.push({ productId, quantity, notes: itemNotes });
  }

  if (Object.keys(fieldErrors).length > 0) {
    throw new ValidationError('Periksa kembali data transaksi Outgoing.', fieldErrors);
  }

  return { shipmentDate, recipientName, notes, items };
}

export function validateHandoverInput(rawInput, { fallbackRecipientName = '' } = {}) {
  const recipientName =
    cleanString(rawInput?.recipientName) || cleanString(fallbackRecipientName);
  const recipientType = cleanString(rawInput?.recipientType) || 'customer';
  const recipientContact = cleanString(rawInput?.recipientContact) || null;
  const handoverMethod = cleanString(rawInput?.handoverMethod) || 'direct';
  const courierName = cleanString(rawInput?.courierName) || null;
  const trackingNumber = cleanString(rawInput?.trackingNumber) || null;
  const notes = cleanString(rawInput?.notes) || null;

  const fieldErrors = {};

  if (!isNonEmptyString(recipientName, { min: 2, max: 150 })) {
    fieldErrors.recipientName = 'Nama Customer / penerima wajib diisi (2–150 karakter).';
  }
  if (!VALID_RECIPIENT_TYPES.has(recipientType)) {
    fieldErrors.recipientType = 'Tipe penerima tidak valid.';
  }
  if (!VALID_METHODS.has(handoverMethod)) {
    fieldErrors.handoverMethod = 'Metode serah terima harus direct atau courier.';
  }
  if (handoverMethod === 'courier' && !isNonEmptyString(courierName || '', { min: 2, max: 120 })) {
    fieldErrors.courierName = 'Nama kurir wajib diisi untuk pengiriman via kurir.';
  }

  if (Object.keys(fieldErrors).length > 0) {
    throw new ValidationError('Periksa kembali data pengiriman (Shipped).', fieldErrors);
  }

  return {
    recipientName,
    recipientType,
    recipientContact,
    handoverMethod,
    courierName,
    trackingNumber,
    notes,
  };
}
