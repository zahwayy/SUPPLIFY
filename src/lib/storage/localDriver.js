import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { ValidationError } from '../constants/errors.js';

export const ALLOWED_EVIDENCE_MIME_TYPES = Object.freeze({
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'application/pdf': '.pdf',
});

export const ALLOWED_PRODUCT_IMAGE_MIME_TYPES = Object.freeze({
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
});

export const PUBLIC_PRODUCT_IMAGE_URL_PREFIX = '/images/products/';

export const BUNDLED_PRODUCT_IMAGE_FILES = Object.freeze(
  new Set([
    '01_Sketchbook_A4.webp',
    '02_Watercolor_Set.webp',
    '03_Acrylic_Paint.webp',
    '04_Kuas_Lukis.webp',
    '05_Canvas_Panel.webp',
    '06_Sticky_Notes.webp',
    '07_Paper_Clip.webp',
    '08_Stapler.webp',
    '09_Folder_Dokumen.webp',
    '10_Binder_Clip.webp',
    '11_Pensil_HB_2.webp',
    '12_Pulpen_Gel_0.5mm.webp',
    '13_Penghapus_Putih.webp',
    '14_Penggaris_30cm.webp',
    '15_Drawing_Pen_0.1mm.webp',
  ])
);

export function getStorageRoot() {
  const configured = process.env.STORAGE_ROOT || './storage/uploads';
  return path.resolve(process.cwd(), configured);
}

export function getPublicProductImagesRoot() {
  const configured = process.env.PUBLIC_PRODUCT_IMAGES_ROOT;
  if (configured) {
    return path.resolve(process.cwd(), configured);
  }
  return path.resolve(process.cwd(), 'public', 'images', 'products');
}

export function isPublicProductImagePath(imagePath) {
  if (typeof imagePath !== 'string') return false;
  const trimmed = imagePath.trim();
  return (
    trimmed.startsWith(PUBLIC_PRODUCT_IMAGE_URL_PREFIX) ||
    trimmed.startsWith('images/products/')
  );
}

export function resolvePublicProductImagePath(imagePath) {
  if (!imagePath || typeof imagePath !== 'string') {
    throw new ValidationError('Path gambar produk tidak valid.');
  }
  const root = getPublicProductImagesRoot();
  const stripped = imagePath
    .trim()
    .replace(/^\/?images\/products\//i, '')
    .replace(/\\/g, '/');
  const normalized = path.posix.normalize(stripped).replace(/^(\.\.(\/|$))+/, '');
  const resolved = path.resolve(root, normalized);

  if (!resolved.startsWith(root + path.sep)) {
    throw new ValidationError('Akses path gambar produk tidak diizinkan.');
  }
  return resolved;
}

export function getMaxUploadBytes() {
  const mb = Number(process.env.MAX_UPLOAD_SIZE_MB || '5');
  const safeMb = Number.isFinite(mb) && mb > 0 ? mb : 5;
  return safeMb * 1024 * 1024;
}

export function getMaxProductImageBytes() {
  const mb = Number(process.env.MAX_PRODUCT_IMAGE_MB || '2');
  const safeMb = Number.isFinite(mb) && mb > 0 ? Math.min(mb, 5) : 2;
  return safeMb * 1024 * 1024;
}

export function validateUploadFile({ mimeType, sizeBytes, originalName }) {
  if (!originalName || typeof originalName !== 'string') {
    throw new ValidationError('Nama file tidak valid.');
  }
  if (!ALLOWED_EVIDENCE_MIME_TYPES[mimeType]) {
    throw new ValidationError(
      'Tipe file tidak didukung. Gunakan JPG, PNG, WEBP, atau PDF.'
    );
  }
  const maxBytes = getMaxUploadBytes();
  if (!Number.isFinite(sizeBytes) || sizeBytes <= 0) {
    throw new ValidationError('File kosong atau ukuran tidak valid.');
  }
  if (sizeBytes > maxBytes) {
    throw new ValidationError(
      `Ukuran file melebihi batas maksimal ${Math.round(maxBytes / (1024 * 1024))} MB.`
    );
  }
}

export function validateProductImageFile({ mimeType, sizeBytes, originalName }) {
  if (!originalName || typeof originalName !== 'string') {
    throw new ValidationError('Nama file gambar produk tidak valid.', {
      image: 'Pilih file gambar yang valid.',
    });
  }
  if (!ALLOWED_PRODUCT_IMAGE_MIME_TYPES[mimeType]) {
    throw new ValidationError(
      'Format gambar produk tidak didukung. Gunakan JPG, PNG, atau WEBP.',
      { image: 'Hanya mendukung file JPG, PNG, atau WEBP.' }
    );
  }
  const maxBytes = getMaxProductImageBytes();
  if (!Number.isFinite(sizeBytes) || sizeBytes <= 0) {
    throw new ValidationError('File gambar kosong atau tidak valid.', {
      image: 'Ukuran gambar harus lebih besar dari 0 byte.',
    });
  }
  if (sizeBytes > maxBytes) {
    const maxMb = Math.round((maxBytes / (1024 * 1024)) * 10) / 10;
    throw new ValidationError(
      `Ukuran gambar produk melebihi batas maksimal ${maxMb} MB.`,
      { image: `Ukuran maksimal gambar ${maxMb} MB.` }
    );
  }
}

export function generateSafeStorageKey(scopeFolder, mimeType) {
  const safeScope = String(scopeFolder || 'general').replace(/[^a-z0-9_-]/gi, '');
  const ext =
    ALLOWED_PRODUCT_IMAGE_MIME_TYPES[mimeType] ||
    ALLOWED_EVIDENCE_MIME_TYPES[mimeType] ||
    '';
  const uniqueName = `${Date.now()}-${crypto.randomUUID()}${ext}`;
  return path.posix.join(safeScope, uniqueName);
}

export function resolveSafeStoragePath(storageKey) {
  if (!storageKey || typeof storageKey !== 'string') {
    throw new ValidationError('Storage key tidak valid.');
  }
  const root = getStorageRoot();
  const normalizedKey = path.normalize(storageKey).replace(/^(\.\.(\/|\\|$))+/, '');
  const resolved = path.resolve(root, normalizedKey);

  // Prevent path traversal outside STORAGE_ROOT
  if (!resolved.startsWith(root + path.sep)) {
    throw new ValidationError('Akses path penyimpanan tidak diizinkan.');
  }
  return resolved;
}

export async function saveLocalFile({ buffer, scopeFolder, mimeType, originalName }) {
  validateUploadFile({
    mimeType,
    sizeBytes: buffer?.length || 0,
    originalName,
  });

  const storageKey = generateSafeStorageKey(scopeFolder, mimeType);
  const fullPath = resolveSafeStoragePath(storageKey);

  await fs.mkdir(path.dirname(fullPath), { recursive: true });
  await fs.writeFile(fullPath, buffer);

  return {
    storageKey,
    fullPath,
    sizeBytes: buffer.length,
    mimeType,
  };
}

export async function saveProductImageFile({ buffer, mimeType, originalName }) {
  validateProductImageFile({
    mimeType,
    sizeBytes: buffer?.length || 0,
    originalName,
  });

  const ext = ALLOWED_PRODUCT_IMAGE_MIME_TYPES[mimeType] || '.webp';
  const rawStem = path.basename(String(originalName || 'product'), path.extname(String(originalName || '')));
  const safeStem = rawStem
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40) || 'product';
  const uniqueName = `${safeStem}-${Date.now()}-${crypto.randomUUID().slice(0, 8)}${ext}`;
  const storageKey = `${PUBLIC_PRODUCT_IMAGE_URL_PREFIX}${uniqueName}`;
  const fullPath = resolvePublicProductImagePath(storageKey);

  await fs.mkdir(path.dirname(fullPath), { recursive: true });
  await fs.writeFile(fullPath, buffer);

  return {
    storageKey,
    publicUrl: storageKey,
    fullPath,
    sizeBytes: buffer.length,
    mimeType,
  };
}

export async function readProductImageFile(imagePath) {
  if (isPublicProductImagePath(imagePath)) {
    const fullPath = resolvePublicProductImagePath(imagePath);
    return fs.readFile(fullPath);
  }
  return readLocalFile(imagePath);
}

export async function deleteProductImageFile(imagePath) {
  if (!imagePath || typeof imagePath !== 'string') return;
  if (isPublicProductImagePath(imagePath)) {
    const fullPath = resolvePublicProductImagePath(imagePath);
    const filename = path.basename(fullPath);
    if (BUNDLED_PRODUCT_IMAGE_FILES.has(filename)) {
      return;
    }
    try {
      await fs.unlink(fullPath);
    } catch (err) {
      if (err.code !== 'ENOENT') throw err;
    }
    return;
  }
  await deleteLocalFile(imagePath);
}

export async function readLocalFile(storageKey) {
  const fullPath = resolveSafeStoragePath(storageKey);
  return fs.readFile(fullPath);
}

export async function deleteLocalFile(storageKey) {
  const fullPath = resolveSafeStoragePath(storageKey);
  try {
    await fs.unlink(fullPath);
  } catch (err) {
    if (err.code !== 'ENOENT') throw err;
  }
}
