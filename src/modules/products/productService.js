import { withTransaction } from '../../lib/db/pool.js';
import { PERMISSIONS, requirePermission } from '../../lib/auth/rbac.js';
import { ConflictError, NotFoundError, ValidationError } from '../../lib/constants/errors.js';
import { STOCK_STATUSES } from '../../lib/constants/statuses.js';
import {
  deleteProductImageFile,
  saveProductImageFile,
  validateProductImageFile,
} from '../../lib/storage/index.js';
import { cleanString } from '../../lib/validation/common.js';
import { findCategoryById } from '../categories/categoryRepo.js';
import { recordAuditEvent } from '../audit/auditService.js';
import { validateProductInput } from './productValidation.js';
import {
  listProducts,
  findProductById,
  findProductBySku,
  createProduct,
  updateProduct,
  getProductOperationalUsage,
  archiveProductById,
  deleteProductById,
} from './productRepo.js';

export function computeProductStockStatus(
  stock,
  minimumStock,
  lowStockThreshold = null
) {
  const numStock = Number(stock);
  if (numStock === 0) return STOCK_STATUSES.OUT_OF_STOCK;
  if (minimumStock === null || minimumStock === undefined) {
    return 'Min. Belum Diatur';
  }
  const numMin = Number(minimumStock);
  if (numStock <= numMin) return STOCK_STATUSES.SEVERE;
  if (lowStockThreshold !== null && lowStockThreshold !== undefined) {
    const numLow = Number(lowStockThreshold);
    if (numStock <= numLow) return STOCK_STATUSES.LOW;
  }
  return STOCK_STATUSES.NORMAL;
}

export async function getProductsCatalog(user, filters = {}) {
  requirePermission(user, PERMISSIONS.PRODUCTS_READ);
  const result = await listProducts(filters);
  return {
    ...result,
    items: result.items.map((item) => ({
      ...item,
      stock_status: computeProductStockStatus(
        item.stock,
        item.minimum_stock,
        item.low_stock_threshold
      ),
    })),
  };
}

export async function getProductDetail(user, productId) {
  requirePermission(user, PERMISSIONS.PRODUCTS_READ);
  const product = await findProductById(productId);
  if (!product) {
    throw new NotFoundError('Produk tidak ditemukan.');
  }
  return {
    ...product,
    stock_status: computeProductStockStatus(
      product.stock,
      product.minimum_stock,
      product.low_stock_threshold
    ),
  };
}

export async function createProductItem(
  user,
  rawInput,
  { imageFile = null, requirePrices = false, requireUnit = false } = {}
) {
  requirePermission(user, PERMISSIONS.PRODUCTS_MANAGE);
  const input = validateProductInput(rawInput, { requirePrices, requireUnit });

  if (imageFile) {
    validateProductImageFile({
      mimeType: imageFile.mimeType,
      sizeBytes: imageFile.buffer?.length || 0,
      originalName: imageFile.originalName,
    });
  }

  let savedImage = null;
  try {
    if (imageFile) {
      savedImage = await saveProductImageFile(imageFile);
    }

    const created = await withTransaction(async (client) => {
      const category = await findCategoryById(input.categoryId, client);
      if (!category) {
        throw new ValidationError('Kategori produk tidak ditemukan.', {
          categoryId: 'Pilih kategori yang valid.',
        });
      }

      const existingSku = await findProductBySku(input.sku, null, client);
      if (existingSku) {
        throw new ConflictError(`SKU "${input.sku}" sudah digunakan produk lain.`, {
          sku: 'Kode SKU harus unik.',
        });
      }

      const createdRow = await createProduct(
        {
          ...input,
          imagePath: savedImage ? savedImage.storageKey : null,
        },
        client
      );

      await recordAuditEvent(
        {
          actorId: user.id,
          actorRole: user.role,
          action: 'PRODUCT_CREATED',
          entityType: 'product',
          entityId: createdRow.id,
          newState: createdRow,
        },
        client
      );

      return createdRow;
    });

    return created;
  } catch (err) {
    if (savedImage?.storageKey) {
      await deleteProductImageFile(savedImage.storageKey).catch(() => {});
    }
    throw err;
  }
}

export async function updateProductItem(
  user,
  productId,
  rawInput,
  { imageFile = null, removeImage = false, requirePrices = false, requireUnit = false } = {}
) {
  requirePermission(user, PERMISSIONS.PRODUCTS_MANAGE);

  if (imageFile) {
    validateProductImageFile({
      mimeType: imageFile.mimeType,
      sizeBytes: imageFile.buffer?.length || 0,
      originalName: imageFile.originalName,
    });
  }

  let savedImage = null;
  let oldImageToDelete = null;

  try {
    if (imageFile) {
      savedImage = await saveProductImageFile(imageFile);
    }

    const updated = await withTransaction(async (client) => {
      const existing = await findProductById(productId, client);
      if (!existing) {
        throw new NotFoundError('Produk tidak ditemukan.');
      }

      const submittedSku = cleanString(rawInput?.sku).toUpperCase();
      if (submittedSku && submittedSku !== String(existing.sku).toUpperCase()) {
        throw new ValidationError('SKU tidak dapat diubah setelah produk dibuat.', {
          sku: 'SKU bersifat permanen dan tidak dapat diubah setelah produk dibuat.',
        });
      }

      const input = validateProductInput(
        { ...rawInput, sku: existing.sku },
        { isEdit: true, requirePrices, requireUnit }
      );

      const category = await findCategoryById(input.categoryId, client);
      if (!category) {
        throw new ValidationError('Kategori produk tidak ditemukan.', {
          categoryId: 'Pilih kategori yang valid.',
        });
      }

      let nextImagePath = existing.image_path || null;
      if (savedImage) {
        nextImagePath = savedImage.storageKey;
        if (existing.image_path && existing.image_path !== savedImage.storageKey) {
          oldImageToDelete = existing.image_path;
        }
      } else if (removeImage && existing.image_path) {
        nextImagePath = null;
        oldImageToDelete = existing.image_path;
      }

      const updatedRow = await updateProduct(
        productId,
        {
          ...input,
          imagePath: nextImagePath,
        },
        client
      );

      await recordAuditEvent(
        {
          actorId: user.id,
          actorRole: user.role,
          action: 'PRODUCT_UPDATED',
          entityType: 'product',
          entityId: updatedRow.id,
          previousState: {
            sku: existing.sku,
            name: existing.name,
            category_id: existing.category_id,
            purchase_price: existing.purchase_price,
            selling_price: existing.selling_price,
            minimum_stock: existing.minimum_stock,
            low_stock_threshold: existing.low_stock_threshold,
            unit: existing.unit,
            rack_location: existing.rack_location,
            image_path: existing.image_path,
          },
          newState: updatedRow,
        },
        client
      );

      return updatedRow;
    });

    if (oldImageToDelete) {
      await deleteProductImageFile(oldImageToDelete).catch(() => {});
    }

    return updated;
  } catch (err) {
    if (savedImage?.storageKey) {
      await deleteProductImageFile(savedImage.storageKey).catch(() => {});
    }
    throw err;
  }
}

export async function archiveProductItem(user, productId) {
  requirePermission(user, PERMISSIONS.PRODUCTS_ARCHIVE);

  return withTransaction(async (client) => {
    const existing = await findProductById(productId, client);
    if (!existing) {
      throw new NotFoundError('Produk tidak ditemukan.');
    }

    if (existing.deleted_at) {
      throw new ConflictError(
        `Produk "${existing.name}" (${existing.sku}) sudah berstatus diarsipkan.`
      );
    }

    const archived = await archiveProductById(productId, client);
    if (!archived) {
      throw new ConflictError(
        'Produk tidak dapat diarsipkan atau sudah berstatus diarsipkan.'
      );
    }

    await recordAuditEvent(
      {
        actorId: user.id,
        actorRole: user.role,
        action: 'PRODUCT_ARCHIVED',
        entityType: 'product',
        entityId: archived.id,
        previousState: {
          sku: existing.sku,
          name: existing.name,
          deleted_at: null,
        },
        newState: {
          sku: archived.sku,
          name: archived.name,
          deleted_at: archived.deleted_at,
        },
      },
      client
    );

    return {
      id: archived.id,
      sku: archived.sku,
      name: archived.name,
      deleted_at: archived.deleted_at,
    };
  });
}

export async function deleteProductItem(user, productId) {
  requirePermission(user, PERMISSIONS.PRODUCTS_DELETE);

  const result = await withTransaction(async (client) => {
    const existing = await findProductById(productId, client);
    if (!existing) {
      throw new NotFoundError('Produk tidak ditemukan.');
    }

    const usage = await getProductOperationalUsage(productId, client);
    const totalRefs =
      Number(usage.po_item_count || 0) +
      Number(usage.tx_item_count || 0) +
      Number(usage.discrepancy_count || 0) +
      Number(usage.adjustment_count || 0) +
      Number(usage.movement_count || 0);

    if (totalRefs > 0 || Number(existing.stock || 0) > 0) {
      const reasons = [];
      if (Number(usage.po_item_count || 0) > 0) reasons.push(`${usage.po_item_count} item PO`);
      if (Number(usage.tx_item_count || 0) > 0) reasons.push(`${usage.tx_item_count} transaksi gudang`);
      if (Number(usage.discrepancy_count || 0) > 0) reasons.push(`${usage.discrepancy_count} laporan selisih stok`);
      if (Number(usage.adjustment_count || 0) > 0) reasons.push(`${usage.adjustment_count} penyesuaian stok`);
      if (Number(usage.movement_count || 0) > 0) reasons.push(`${usage.movement_count} histori pergerakan stok`);
      if (reasons.length === 0 && Number(existing.stock || 0) > 0) {
        reasons.push(`stok aktif (${existing.stock} ${existing.unit || 'unit'})`);
      }

      throw new ConflictError(
        `Produk "${existing.name}" (${existing.sku}) tidak dapat dihapus secara permanen karena masih memiliki keterkaitan data operasional (${reasons.join(', ')}) demi menjaga integritas histori dan audit sistem.`
      );
    }

    try {
      await deleteProductById(productId, client);
    } catch (err) {
      if (err?.code === '23503') {
        throw new ConflictError(
          `Produk "${existing.name}" (${existing.sku}) tidak dapat dihapus karena masih digunakan dalam histori operasional sistem.`
        );
      }
      throw err;
    }

    await recordAuditEvent(
      {
        actorId: user.id,
        actorRole: user.role,
        action: 'PRODUCT_DELETED',
        entityType: 'product',
        entityId: existing.id,
        previousState: {
          sku: existing.sku,
          name: existing.name,
          category_id: existing.category_id,
          purchase_price: existing.purchase_price,
          selling_price: existing.selling_price,
        },
      },
      client
    );

    return {
      id: existing.id,
      sku: existing.sku,
      name: existing.name,
      imagePath: existing.image_path || null,
    };
  });

  if (result.imagePath) {
    await deleteProductImageFile(result.imagePath).catch(() => {});
  }

  return { id: result.id, sku: result.sku, name: result.name };
}
