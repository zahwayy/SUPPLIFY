import { ValidationError } from '../../lib/constants/errors.js';
import { INCOMING_DISCREPANCY_ACTIONS } from '../../lib/constants/statuses.js';
import {
  cleanString,
  isNonEmptyString,
  isPositiveInt,
} from '../../lib/validation/common.js';

function isNonNegativeInt(val) {
  return Number.isInteger(val) && val >= 0;
}

const VALID_CONDITIONS = new Set([
  'good',
  'partial',
  'damaged',
  'wrong_item',
  'excess',
  'mixed',
]);

const VALID_DISCREPANCY_ACTIONS = new Set(
  Object.values(INCOMING_DISCREPANCY_ACTIONS).filter((v) => v !== 'accept_excess')
);

export function validateCreateIncomingInput(rawInput) {
  const purchaseOrderId = Number(rawInput?.purchaseOrderId);
  const receivingDate =
    cleanString(rawInput?.receivingDate) || new Date().toISOString().slice(0, 10);
  const notes = cleanString(rawInput?.notes) || null;
  const rawItems = Array.isArray(rawInput?.items) ? rawInput.items : [];

  const fieldErrors = {};

  if (!isPositiveInt(purchaseOrderId)) {
    fieldErrors.purchaseOrderId = 'Purchase Order yang siap diperiksa wajib dipilih.';
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(receivingDate)) {
    fieldErrors.receivingDate = 'Tanggal penerimaan tidak valid (YYYY-MM-DD).';
  }
  if (rawItems.length === 0) {
    fieldErrors.items = 'Minimal satu item barang diterima wajib diisi.';
  }

  const seen = new Set();
  const items = [];
  for (const item of rawItems) {
    const productId = Number(item?.productId);
    const quantity = Number(item?.quantity);
    const conditionStatus = cleanString(item?.conditionStatus || 'good');
    const itemNotes = cleanString(item?.notes) || null;

    if (!isPositiveInt(productId) || !isPositiveInt(quantity)) {
      fieldErrors.items =
        'Setiap item Incoming harus memiliki produk valid dan jumlah aktual diterima > 0.';
      break;
    }
    if (!VALID_CONDITIONS.has(conditionStatus)) {
      fieldErrors.items = 'Status kondisi barang tidak valid.';
      break;
    }
    if (seen.has(productId)) {
      fieldErrors.items = 'Produk tidak boleh duplikat dalam satu Incoming.';
      break;
    }

    const hasGood =
      item?.goodQuantity !== undefined &&
      item?.goodQuantity !== null &&
      item?.goodQuantity !== '';
    const hasDamaged =
      item?.damagedQuantity !== undefined &&
      item?.damagedQuantity !== null &&
      item?.damagedQuantity !== '';

    let goodQuantity;
    let damagedQuantity;

    if (hasGood && hasDamaged) {
      goodQuantity = Number(item.goodQuantity);
      damagedQuantity = Number(item.damagedQuantity);
    } else if (hasGood) {
      goodQuantity = Number(item.goodQuantity);
      damagedQuantity = quantity - goodQuantity;
    } else if (hasDamaged) {
      damagedQuantity = Number(item.damagedQuantity);
      goodQuantity = quantity - damagedQuantity;
    } else if (conditionStatus === 'damaged' || conditionStatus === 'wrong_item') {
      goodQuantity = 0;
      damagedQuantity = quantity;
    } else {
      goodQuantity = quantity;
      damagedQuantity = 0;
    }

    if (!isNonNegativeInt(goodQuantity) || !isNonNegativeInt(damagedQuantity)) {
      fieldErrors.items =
        'Jumlah barang baik dan jumlah rusak/bermasalah harus berupa angka bulat >= 0.';
      break;
    }
    if (goodQuantity + damagedQuantity !== quantity) {
      fieldErrors.items =
        'Jumlah barang baik + jumlah rusak/bermasalah harus sama dengan jumlah aktual diterima.';
      break;
    }

    seen.add(productId);
    items.push({
      productId,
      quantity,
      goodQuantity,
      damagedQuantity,
      conditionStatus,
      notes: itemNotes,
    });
  }

  if (Object.keys(fieldErrors).length > 0) {
    throw new ValidationError('Periksa kembali data laporan pemeriksaan Incoming.', fieldErrors);
  }

  return { purchaseOrderId, receivingDate, notes, items };
}

export function validateApproveIncomingInput(rawInput, existingItems) {
  const supplierFollowupNotes = cleanString(rawInput?.supplierFollowupNotes) || null;
  if (supplierFollowupNotes && supplierFollowupNotes.length > 500) {
    throw new ValidationError('Catatan tindak lanjut untuk Supplier maksimal 500 karakter.', {
      supplierFollowupNotes: 'Catatan tindak lanjut maksimal 500 karakter.',
    });
  }

  const rawItemDecisions = Array.isArray(rawInput?.items) ? rawInput.items : null;
  if (!rawItemDecisions || rawItemDecisions.length === 0) {
    throw new ValidationError(
      'Accepted Quantity untuk setiap produk wajib diisi dan dikonfirmasi secara manual oleh Warehouse Manager.'
    );
  }

  const decisionMap = new Map();
  for (const d of rawItemDecisions) {
    const pid = Number(d?.productId);
    if (isPositiveInt(pid)) {
      decisionMap.set(pid, d);
    }
  }

  const decisions = [];
  let totalApproved = 0;

  for (const item of existingItems) {
    const productId = Number(item.product_id);
    const receivedQty = Number(item.quantity);
    const orderedQty =
      item.ordered_quantity !== null && item.ordered_quantity !== undefined
        ? Number(item.ordered_quantity)
        : receivedQty;
    const damagedQty = Number(item.damaged_quantity || 0);

    const supplied = decisionMap.get(productId);
    const rawAccepted =
      supplied?.approvedQuantity !== undefined &&
      supplied?.approvedQuantity !== null &&
      supplied?.approvedQuantity !== ''
        ? supplied.approvedQuantity
        : supplied?.acceptedQuantity;

    if (
      !supplied ||
      rawAccepted === undefined ||
      rawAccepted === null ||
      String(rawAccepted).trim() === ''
    ) {
      throw new ValidationError(
        `Accepted Quantity untuk ${item.sku || `produk #${productId}`} wajib ditentukan secara manual oleh Manager.`
      );
    }

    const approvedQuantity = Number(rawAccepted);
    if (!isNonNegativeInt(approvedQuantity) || approvedQuantity > receivedQty) {
      throw new ValidationError(
        `Accepted Quantity untuk ${item.sku || `produk #${productId}`} harus antara 0 dan ${receivedQty} (kuantitas hasil pemeriksaan fisik).`
      );
    }

    if (approvedQuantity > orderedQty) {
      throw new ValidationError(
        `Accepted Quantity untuk ${item.sku || `produk #${productId}`} (${approvedQuantity}) tidak boleh melebihi kuantitas PO (${orderedQty}).`
      );
    }

    const discrepancyAction = cleanString(supplied?.discrepancyAction || 'none') || 'none';
    if (!VALID_DISCREPANCY_ACTIONS.has(discrepancyAction)) {
      throw new ValidationError('Tindakan ketidaksesuaian yang dipilih tidak valid.');
    }

    const managerNotes = cleanString(supplied?.managerNotes) || null;
    if (managerNotes && managerNotes.length > 500) {
      throw new ValidationError('Catatan Manager per item maksimal 500 karakter.');
    }

    const discrepancyQuantity = Math.max(0, orderedQty - approvedQuantity);

    totalApproved += approvedQuantity;
    decisions.push({
      productId,
      orderedQty,
      receivedQty,
      damagedQty,
      approvedQuantity,
      discrepancyQuantity,
      discrepancyAction,
      managerNotes,
    });
  }

  if (totalApproved <= 0) {
    throw new ValidationError(
      'Total Accepted Quantity yang masuk stok harus lebih dari 0. Gunakan tombol Tolak Incoming apabila seluruh barang ditolak (PO akan menjadi Returned).'
    );
  }

  return { decisions, supplierFollowupNotes };
}

export function validateTransactionRejectionInput(rawInput) {
  const reason = cleanString(rawInput?.rejectionReason);
  if (!isNonEmptyString(reason, { min: 5, max: 500 })) {
    throw new ValidationError('Alasan penolakan wajib diisi (minimal 5 karakter).', {
      rejectionReason: 'Alasan penolakan wajib diisi minimal 5 karakter.',
    });
  }
  return { rejectionReason: reason };
}
