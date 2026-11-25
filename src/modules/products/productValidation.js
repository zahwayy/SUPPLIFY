import { ValidationError } from '../../lib/constants/errors.js';
import {
  ALLOWED_PRODUCT_UNIT_VALUES,
  normalizeProductUnit,
} from '../../lib/constants/units.js';
import {
  cleanString,
  isNonEmptyString,
  isPositiveInt,
} from '../../lib/validation/common.js';

export function hasValidPurchasePrice(value) {
  if (value === null || value === undefined || String(value).trim() === '') {
    return false;
  }
  const num = Number(value);
  return Number.isFinite(num) && num > 0;
}

export function assertValidProductPrice(product) {
  if (!hasValidPurchasePrice(product?.purchase_price)) {
    const name = product?.name || 'Produk';
    const sku = product?.sku ? ` (${product.sku})` : '';
    throw new ValidationError(
      `Produk "${name}"${sku} belum memiliki harga beli yang valid (> Rp 0). Atur harga pada master produk terlebih dahulu sebelum digunakan dalam transaksi.`
    );
  }
  return Number(product.purchase_price);
}

function parseNumericValue(raw) {
  const str = cleanString(raw === null || raw === undefined ? '' : String(raw));
  if (str === '') return { empty: true, value: null };
  if (!/^-?\d+(\.\d+)?$/.test(str)) {
    return { empty: false, invalid: true, value: null };
  }
  const num = Number(str);
  if (!Number.isFinite(num)) {
    return { empty: false, invalid: true, value: null };
  }
  return { empty: false, invalid: false, value: Math.round(num * 100) / 100 };
}

function parsePriceField(
  raw,
  { fieldLabel, fieldKey, fieldErrors, required = false, allowZero = false }
) {
  const parsed = parseNumericValue(raw);
  if (parsed.empty) {
    if (required) {
      fieldErrors[fieldKey] = `${fieldLabel} wajib diisi dengan nominal angka yang valid.`;
    }
    return null;
  }
  if (parsed.invalid) {
    fieldErrors[fieldKey] = `${fieldLabel} harus berupa angka yang valid.`;
    return null;
  }
  if (parsed.value < 0) {
    fieldErrors[fieldKey] = `${fieldLabel} tidak boleh bernilai negatif.`;
    return null;
  }
  if (!allowZero && parsed.value === 0) {
    fieldErrors[fieldKey] = `${fieldLabel} harus lebih besar dari Rp 0.`;
    return null;
  }
  return parsed.value;
}

function parseOptionalNonNegativeInt(raw, fieldLabel, fieldKey, fieldErrors) {
  const str = cleanString(raw === null || raw === undefined ? '' : String(raw));
  if (str === '') return null;
  if (!/^-?\d+$/.test(str)) {
    fieldErrors[fieldKey] = `${fieldLabel} harus berupa bilangan bulat >= 0.`;
    return null;
  }
  const num = Number(str);
  if (!Number.isInteger(num) || num < 0) {
    fieldErrors[fieldKey] = `${fieldLabel} harus berupa bilangan bulat >= 0.`;
    return null;
  }
  return num;
}

export function validateProductInput(
  rawInput,
  { isEdit = false, requirePrices = false, requireUnit = false } = {}
) {
  const sku = cleanString(rawInput?.sku).toUpperCase();
  const name = cleanString(rawInput?.name);
  const categoryId = Number(rawInput?.categoryId);
  const description = cleanString(rawInput?.description);
  const normalizedUnit = normalizeProductUnit(rawInput?.unit);
  const rackLocation = cleanString(rawInput?.rackLocation);

  const fieldErrors = {};

  if (!isEdit && !/^[A-Z0-9_-]{2,50}$/.test(sku)) {
    fieldErrors.sku = 'Kode SKU wajib diisi (2–50 karakter huruf, angka, tanda hubung, atau garis bawah).';
  } else if (isEdit && sku && !/^[A-Z0-9_-]{2,50}$/.test(sku)) {
    fieldErrors.sku = 'Format kode SKU tidak valid.';
  }
  if (!isNonEmptyString(name, { min: 2, max: 150 })) {
    fieldErrors.name = 'Nama produk wajib diisi (2–150 karakter).';
  }
  if (!isPositiveInt(categoryId)) {
    fieldErrors.categoryId = 'Kategori produk wajib dipilih.';
  }
  if (description.length > 1000) {
    fieldErrors.description = 'Deskripsi produk maksimal 1000 karakter.';
  }

  if (requireUnit && !normalizedUnit) {
    fieldErrors.unit = 'Satuan produk wajib dipilih.';
  } else if (normalizedUnit && !ALLOWED_PRODUCT_UNIT_VALUES.has(normalizedUnit)) {
    fieldErrors.unit = 'Pilih satuan produk yang valid dari daftar yang tersedia.';
  }

  if (rackLocation.length > 50) {
    fieldErrors.rackLocation = 'Lokasi rak maksimal 50 karakter.';
  }

  const purchasePrice = parsePriceField(rawInput?.purchasePrice, {
    fieldLabel: 'Harga beli',
    fieldKey: 'purchasePrice',
    fieldErrors,
    required: requirePrices,
    allowZero: false,
  });

  const sellingPrice = parsePriceField(rawInput?.sellingPrice, {
    fieldLabel: 'Harga jual',
    fieldKey: 'sellingPrice',
    fieldErrors,
    required: requirePrices,
    allowZero: true,
  });

  const minimumStock = parseOptionalNonNegativeInt(
    rawInput?.minimumStock,
    'Stok minimum',
    'minimumStock',
    fieldErrors
  );
  const lowStockThreshold = parseOptionalNonNegativeInt(
    rawInput?.lowStockThreshold,
    'Batas stok rendah',
    'lowStockThreshold',
    fieldErrors
  );

  if (lowStockThreshold !== null && lowStockThreshold <= 0) {
    fieldErrors.lowStockThreshold = 'Batas stok rendah harus lebih besar dari 0.';
  } else if (lowStockThreshold !== null && minimumStock === null) {
    fieldErrors.minimumStock =
      'Stok minimum wajib diisi apabila Batas Stok Rendah diatur.';
  } else if (
    lowStockThreshold !== null &&
    minimumStock !== null &&
    lowStockThreshold <= minimumStock
  ) {
    fieldErrors.lowStockThreshold =
      'Batas stok rendah harus lebih besar dari Stok Minimum.';
  }

  if (Object.keys(fieldErrors).length > 0) {
    throw new ValidationError('Periksa kembali data produk yang diisi.', fieldErrors);
  }

  // Note: `stock` is intentionally never accepted here so warehouse stock stays
  // synchronized with transactions & stock_movements ledger.
  return {
    sku,
    name,
    categoryId,
    description: description || null,
    purchasePrice,
    sellingPrice,
    minimumStock,
    lowStockThreshold,
    unit: normalizedUnit || null,
    rackLocation: rackLocation || null,
  };
}
