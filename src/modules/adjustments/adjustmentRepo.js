import { query } from '../../lib/db/pool.js';

export async function listStockAdjustments(
  { status = '', search = '', page = 1, pageSize = 15 } = {},
  client = null
) {
  const executor = client || { query };
  const conditions = [];
  const params = [];

  if (status && ['pending', 'approved', 'rejected'].includes(status)) {
    params.push(status);
    conditions.push(`sa.status = $${params.length}`);
  }
  if (search) {
    params.push(`%${search}%`);
    conditions.push(
      `(sa.adjustment_code ILIKE $${params.length} OR p.sku ILIKE $${params.length} OR p.name ILIKE $${params.length} OR sa.reason ILIKE $${params.length})`
    );
  }

  const whereSql = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const safePage = Math.max(1, Number(page) || 1);
  const safePageSize = Math.min(50, Math.max(1, Number(pageSize) || 15));
  const offset = (safePage - 1) * safePageSize;

  const countRes = await executor.query(
    `SELECT COUNT(*)::int AS total
     FROM stock_adjustments sa
     INNER JOIN products p ON p.id = sa.product_id
     ${whereSql}`,
    params
  );
  const totalCount = countRes.rows[0]?.total ?? 0;

  const listParams = [...params, safePageSize, offset];
  const { rows } = await executor.query(
    `SELECT
       sa.*,
       p.sku,
       p.name AS product_name,
       p.unit,
       p.rack_location,
       p.minimum_stock,
       p.stock AS current_stock,
       dr.issue_code AS discrepancy_code,
       req.name AS requested_by_name,
       rev.name AS reviewed_by_name,
       sm.stock_before,
       sm.stock_after
     FROM stock_adjustments sa
     INNER JOIN products p ON p.id = sa.product_id
     INNER JOIN users req ON req.id = sa.requested_by
     LEFT JOIN users rev ON rev.id = sa.reviewed_by
     LEFT JOIN discrepancy_reports dr ON dr.id = sa.discrepancy_id
     LEFT JOIN stock_movements sm ON sm.stock_adjustment_id = sa.id
     ${whereSql}
     ORDER BY (sa.status = 'pending') DESC, sa.created_at DESC, sa.id DESC
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

export async function findAdjustmentById(id, client = null, { forUpdate = false } = {}) {
  const executor = client || { query };
  const lockSql = forUpdate ? 'FOR UPDATE OF sa' : '';
  const { rows } = await executor.query(
    `SELECT sa.*, p.sku, p.name AS product_name, p.unit, p.rack_location, p.minimum_stock, p.stock AS current_stock
     FROM stock_adjustments sa
     INNER JOIN products p ON p.id = sa.product_id
     WHERE sa.id = $1
     LIMIT 1
     ${lockSql}`,
    [id]
  );
  return rows[0] || null;
}

export async function insertStockAdjustment(
  {
    adjustmentCode,
    productId,
    discrepancyId,
    adjustmentType,
    quantityDelta,
    reason,
    requestedBy,
  },
  client
) {
  const { rows } = await client.query(
    `INSERT INTO stock_adjustments (
       adjustment_code, product_id, discrepancy_id, adjustment_type,
       quantity_delta, reason, status, requested_by
     )
     VALUES ($1, $2, $3, $4, $5, $6, 'pending', $7)
     RETURNING *`,
    [
      adjustmentCode,
      productId,
      discrepancyId,
      adjustmentType,
      quantityDelta,
      reason,
      requestedBy,
    ]
  );
  return rows[0];
}

export async function updateAdjustmentReviewStatus(
  id,
  { status, reviewedBy, rejectionReason = null },
  client
) {
  const { rows } = await client.query(
    `UPDATE stock_adjustments
     SET status = $2,
         reviewed_by = $3,
         reviewed_at = NOW(),
         rejection_reason = COALESCE($4, rejection_reason)
     WHERE id = $1
     RETURNING *`,
    [id, status, reviewedBy, rejectionReason]
  );
  return rows[0];
}
