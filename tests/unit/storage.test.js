import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {
  validateUploadFile,
  validateProductImageFile,
  generateSafeStorageKey,
  resolveSafeStoragePath,
  getStorageRoot,
  getPublicProductImagesRoot,
  resolvePublicProductImagePath,
  saveProductImageFile,
  readProductImageFile,
  deleteProductImageFile,
} from '../../src/lib/storage/index.js';
import { getProductImageSrc } from '../../src/lib/utils/productImage.js';
import { ValidationError } from '../../src/lib/constants/errors.js';

test('validateUploadFile accepts allowed evidence MIME types and rejects others', () => {
  assert.doesNotThrow(() =>
    validateUploadFile({
      mimeType: 'image/png',
      sizeBytes: 1024,
      originalName: 'inspection.png',
    })
  );

  assert.throws(
    () =>
      validateUploadFile({
        mimeType: 'application/x-msdownload',
        sizeBytes: 1024,
        originalName: 'malware.exe',
      }),
    ValidationError
  );

  assert.throws(
    () =>
      validateUploadFile({
        mimeType: 'image/jpeg',
        sizeBytes: 50 * 1024 * 1024,
        originalName: 'huge.jpg',
      }),
    ValidationError
  );
});

test('validateProductImageFile accepts JPG/PNG/WEBP <= 2 MB and rejects PDF or oversized files', () => {
  assert.doesNotThrow(() =>
    validateProductImageFile({
      mimeType: 'image/webp',
      sizeBytes: 512 * 1024,
      originalName: 'produk.webp',
    })
  );

  assert.throws(
    () =>
      validateProductImageFile({
        mimeType: 'application/pdf',
        sizeBytes: 1024,
        originalName: 'doc.pdf',
      }),
    ValidationError
  );

  assert.throws(
    () =>
      validateProductImageFile({
        mimeType: 'image/png',
        sizeBytes: 3 * 1024 * 1024,
        originalName: 'too-big.png',
      }),
    ValidationError
  );
});

test('resolveSafeStoragePath prevents directory traversal outside storage root', () => {
  const key = generateSafeStorageKey('incoming_inspection', 'image/jpeg');
  assert.match(key, /^incoming_inspection\/\d+-[a-f0-9-]+\.jpg$/);

  const resolved = resolveSafeStoragePath(key);
  assert.equal(resolved.startsWith(getStorageRoot() + path.sep), true);

  // Traversal segments are stripped/contained and never escape STORAGE_ROOT
  const traversalCheck = resolveSafeStoragePath('../../etc/passwd');
  assert.equal(traversalCheck.startsWith(getStorageRoot() + path.sep), true);
});

test('saveProductImageFile saves uploaded product images inside public/images/products and protects bundled assets', async () => {
  const tmpPublicRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'supplify-pub-img-'));
  const prevEnv = process.env.PUBLIC_PRODUCT_IMAGES_ROOT;
  process.env.PUBLIC_PRODUCT_IMAGES_ROOT = tmpPublicRoot;

  try {
    assert.equal(getPublicProductImagesRoot(), tmpPublicRoot);

    const traversal = resolvePublicProductImagePath('/images/products/../../secret.webp');
    assert.equal(traversal.startsWith(tmpPublicRoot + path.sep), true);

    const saved = await saveProductImageFile({
      buffer: Buffer.from('fake-webp-content'),
      mimeType: 'image/webp',
      originalName: 'Kuas Cat Baru.webp',
    });

    assert.match(saved.storageKey, /^\/images\/products\/kuas-cat-baru-\d+-[a-f0-9]+\.webp$/);
    assert.equal(saved.fullPath.startsWith(tmpPublicRoot + path.sep), true);

    const diskContent = await readProductImageFile(saved.storageKey);
    assert.equal(diskContent.toString('utf8'), 'fake-webp-content');

    // Custom uploaded image is deleted when replaced/removed
    await deleteProductImageFile(saved.storageKey);
    await assert.rejects(() => readProductImageFile(saved.storageKey), { code: 'ENOENT' });

    // Bundled zip assets stay intact even if deleteProductImageFile is called
    const bundledFile = path.join(tmpPublicRoot, '01_Sketchbook_A4.webp');
    await fs.writeFile(bundledFile, Buffer.from('bundled-asset'));
    await deleteProductImageFile('/images/products/01_Sketchbook_A4.webp');
    const stillExists = await fs.readFile(bundledFile);
    assert.equal(stillExists.toString('utf8'), 'bundled-asset');
  } finally {
    if (prevEnv === undefined) {
      delete process.env.PUBLIC_PRODUCT_IMAGES_ROOT;
    } else {
      process.env.PUBLIC_PRODUCT_IMAGES_ROOT = prevEnv;
    }
    await fs.rm(tmpPublicRoot, { recursive: true, force: true });
  }
});

test('getProductImageSrc resolves public paths directly and preserves legacy API fallback', () => {
  assert.equal(getProductImageSrc(null), null);
  assert.equal(getProductImageSrc({ id: 1, image_path: '' }), null);
  assert.equal(
    getProductImageSrc({
      id: 15,
      image_path: '/images/products/01_Sketchbook_A4.webp',
      updated_at: '2026-11-25T10:00:00Z',
    }),
    '/images/products/01_Sketchbook_A4.webp?v=2026-11-25T10%3A00%3A00Z'
  );
  assert.equal(
    getProductImageSrc({
      id: 99,
      image_path: 'products/legacy-file.webp',
      updated_at: '123',
    }),
    '/api/products/99/image?v=123'
  );
});
