import { PERMISSIONS, requirePermission } from '../../lib/auth/rbac.js';
import { ConflictError, NotFoundError, ValidationError } from '../../lib/constants/errors.js';
import { listProducts } from '../products/productRepo.js';
import { computeProductStockStatus } from '../products/productService.js';
import {
  getInventorySummary,
  listStockMovements,
  lockProductsForUpdate,
  updateProductStock,
  insertStockMovement,
} from './inventoryRepo.js';

export async function getInventoryOverview(user, filters = {}) {
  requirePermission(user, PERMISSIONS.INVENTORY_READ);

  const [summary, catalog] = await Promise.all([
    getInventorySummary(),
    listProducts(filters),
  ]);

  return {
    summary,
    ...catalog,
    items: catalog.items.map((item) => ({
      ...item,
      stock_status: computeProductStockStatus(
        item.stock,
        item.minimum_stock,
        item.low_stock_threshold
      ),
    })),
  };
}

export async function getStockMovementLedger(user, filters = {}) {
  requirePermission(user, PERMISSIONS.INVENTORY_READ);
  return listStockMovements(filters);
}

/**
 * Single authoritative atomic stock mutation engine.
 * Must always be called inside an active PostgreSQL transaction (withTransaction).
 */
export async function applyStockChanges(
  {
    items,
    sourceType,
    transactionId = null,
    stockAdjustmentId = null,
    actorId,
    notes = null,
  },
  client
) {
  if (!client) {
    throw new Error('applyStockChanges requires an active PostgreSQL transaction client.');
  }
  if (!Array.isArray(items) || items.length === 0) {
    throw new ValidationError('Daftar perubahan stok produk tidak boleh kosong.');
  }

  // Merge deltas per productId to guarantee deterministic single-row update
  const deltaByProduct = new Map();
  for (const item of items) {
    const productId = Number(item.productId);
    const delta = Number(item.quantityDelta);
    if (!Number.isInteger(productId) || productId <= 0) {
      throw new ValidationError('ID produk tidak valid.');
    }
    if (!Number.isInteger(delta) || delta === 0) {
      throw new ValidationError('Perubahan kuantitas stok harus berupa bilangan bulat bukan nol.');
    }
    deltaByProduct.set(productId, (deltaByProduct.get(productId) || 0) + delta);
  }

  const productIds = [...deltaByProduct.keys()];
  const lockedProducts = await lockProductsForUpdate(productIds, client);
  const productMap = new Map(lockedProducts.map((p) => [Number(p.id), p]));

  const results = [];

  for (const productId of productIds.sort((a, b) => a - b)) {
    const product = productMap.get(productId);
    if (!product) {
      throw new NotFoundError(`Produk dengan ID ${productId} tidak ditemukan.`);
    }

    const quantityDelta = deltaByProduct.get(productId);
    if (quantityDelta === 0) continue;

    const stockBefore = Number(product.stock);
    const stockAfter = stockBefore + quantityDelta;

    if (stockAfter < 0) {
      throw new ConflictError(
        `Stok "${product.name}" (${product.sku}) tidak mencukupi. Tersedia: ${stockBefore}, dibutuhkan: ${Math.abs(quantityDelta)}.`
      );
    }

    let movementType;
    if (sourceType === 'incoming') {
      if (quantityDelta <= 0) {
        throw new ValidationError('Incoming harus menambah stok (> 0).');
      }
      movementType = 'in';
    } else if (sourceType === 'outgoing') {
      if (quantityDelta >= 0) {
        throw new ValidationError('Outgoing harus mengurangi stok (< 0).');
      }
      movementType = 'out';
    } else if (sourceType === 'adjustment') {
      movementType = quantityDelta > 0 ? 'adjustment_in' : 'adjustment_out';
    } else {
      throw new ValidationError('Sumber pergerakan stok tidak valid.');
    }

    await updateProductStock(productId, stockAfter, client);
    await insertStockMovement(
      {
        productId,
        sourceType,
        transactionId,
        stockAdjustmentId,
        movementType,
        quantityDelta,
        stockBefore,
        stockAfter,
        createdBy: actorId,
        notes,
      },
      client
    );

    results.push({
      productId,
      sku: product.sku,
      name: product.name,
      unit: product.unit || null,
      minimumStock: product.minimum_stock,
      lowStockThreshold: product.low_stock_threshold,
      stockBefore,
      quantityDelta,
      stockAfter,
      stockStatusAfter: computeProductStockStatus(
        stockAfter,
        product.minimum_stock,
        product.low_stock_threshold
      ),
    });
  }

  return results;
}
