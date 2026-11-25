import { query } from '../../lib/db/pool.js';

export async function getInventorySummary(client = null) {
  const executor = client || { query };
  const { rows } = await executor.query(`
    SELECT
      COUNT(*)::int AS total_products,
      COALESCE(SUM(stock), 0)::int AS total_stock_units,
      COUNT(*) FILTER (WHERE stock = 0)::int AS out_of_stock_count,
      COUNT(*) FILTER (WHERE stock > 0 AND minimum_stock IS NOT NULL AND stock <= minimum_stock)::int AS severe_stock_count,
      COUNT(*) FILTER (
        WHERE stock > 0
          AND minimum_stock IS NOT NULL
          AND low_stock_threshold IS NOT NULL
          AND stock > minimum_stock
          AND stock <= low_stock_threshold
      )::int AS low_stock_count,
      COUNT(*) FILTER (
        WHERE stock > 0
          AND minimum_stock IS NOT NULL
          AND (
            (low_stock_threshold IS NOT NULL AND stock > low_stock_threshold)
            OR (low_stock_threshold IS NULL AND stock > minimum_stock)
          )
      )::int AS normal_stock_count,
      COUNT(*) FILTER (WHERE stock > 0 AND minimum_stock IS NULL)::int AS unconfigured_min_count,
      COALESCE(SUM(stock * COALESCE(purchase_price, 0)), 0)::numeric(14, 2) AS estimated_inventory_value
    FROM products
    WHERE deleted_at IS NULL
  `);
  return rows[0];
}

export async function listStockMovements(
  { search = '', movementType = '', productId = null, page = 1, pageSize = 20 } = {},
  client = null
) {
  const executor = client || { query };
  const conditions = [];
  const params = [];

  if (productId) {
    params.push(Number(productId));
    conditions.push(`sm.product_id = $${params.length}`);
  }
  if (
    movementType &&
    ['in', 'out', 'adjustment_in', 'adjustment_out'].includes(movementType)
  ) {
    params.push(movementType);
    conditions.push(`sm.movement_type = $${params.length}`);
  }
  if (search) {
    params.push(`%${search}%`);
    conditions.push(
      `(p.sku ILIKE $${params.length} OR p.name ILIKE $${params.length} OR COALESCE(t.transaction_code, '') ILIKE $${params.length} OR COALESCE(sa.adjustment_code, '') ILIKE $${params.length})`
    );
  }

  const whereSql = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const safePage = Math.max(1, Number(page) || 1);
  const safePageSize = Math.min(50, Math.max(1, Number(pageSize) || 20));
  const offset = (safePage - 1) * safePageSize;

  const countRes = await executor.query(
    `SELECT COUNT(*)::int AS total
     FROM stock_movements sm
     INNER JOIN products p ON p.id = sm.product_id
     LEFT JOIN transactions t ON t.id = sm.transaction_id
     LEFT JOIN stock_adjustments sa ON sa.id = sm.stock_adjustment_id
     ${whereSql}`,
    params
  );
  const totalCount = countRes.rows[0]?.total ?? 0;

  const listParams = [...params, safePageSize, offset];
  const { rows } = await executor.query(
    `SELECT
       sm.id,
       sm.product_id,
       p.sku,
       p.name AS product_name,
       p.unit,
       p.rack_location,
       sm.source_type,
       sm.transaction_id,
       t.transaction_code,
       t.type AS transaction_type,
       sm.stock_adjustment_id,
       sa.adjustment_code,
       sm.movement_type,
       sm.quantity_delta,
       sm.stock_before,
       sm.stock_after,
       sm.notes,
       sm.created_at,
       u.name AS actor_name
     FROM stock_movements sm
     INNER JOIN products p ON p.id = sm.product_id
     INNER JOIN users u ON u.id = sm.created_by
     LEFT JOIN transactions t ON t.id = sm.transaction_id
     LEFT JOIN stock_adjustments sa ON sa.id = sm.stock_adjustment_id
     ${whereSql}
     ORDER BY sm.created_at DESC, sm.id DESC
     LIMIT $${listParams.length - 1} OFFSET $${listParams.length}`,
    listParams
  );

  return {
    items: rows,
    totalCount,
    page: safePage,
    pageSize: safePageSize,
    totalPages: Math.max(1, Math.ceil(totalCount / safePageSize)),
  };
}

export async function lockProductsForUpdate(productIds, client) {
  const sortedIds = [...new Set(productIds.map(Number))].sort((a, b) => a - b);
  const { rows } = await client.query(
    `SELECT id, sku, name, stock, minimum_stock, low_stock_threshold, unit, deleted_at
     FROM products
     WHERE id = ANY($1::bigint[])
     ORDER BY id ASC
     FOR UPDATE`,
    [sortedIds]
  );
  return rows;
}

export async function updateProductStock(productId, newStock, client) {
  await client.query(
    `UPDATE products
     SET stock = $2,
         updated_at = NOW()
     WHERE id = $1`,
    [productId, newStock]
  );
}

export async function insertStockMovement(
  {
    productId,
    sourceType,
    transactionId = null,
    stockAdjustmentId = null,
    movementType,
    quantityDelta,
    stockBefore,
    stockAfter,
    createdBy,
    notes = null,
  },
  client
) {
  const { rows } = await client.query(
    `INSERT INTO stock_movements (
       product_id, source_type, transaction_id, stock_adjustment_id,
       movement_type, quantity_delta, stock_before, stock_after,
       created_by, notes
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
     RETURNING id, product_id, movement_type, quantity_delta, stock_before, stock_after, created_at`,
    [
      productId,
      sourceType,
      transactionId,
      stockAdjustmentId,
      movementType,
      quantityDelta,
      stockBefore,
      stockAfter,
      createdBy,
      notes,
    ]
  );
  return rows[0];
}
