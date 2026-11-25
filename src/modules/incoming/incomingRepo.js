import { query } from '../../lib/db/pool.js';

export async function listIncomingTransactions(
  { status = '', search = '', page = 1, pageSize = 15 } = {},
  client = null
) {
  const executor = client || { query };
  const conditions = [`t.type = 'incoming'`];
  const params = [];

  if (status && ['pending', 'approved', 'rejected', 'cancelled'].includes(status)) {
    params.push(status);
    conditions.push(`t.status = $${params.length}`);
  }
  if (search) {
    params.push(`%${search}%`);
    conditions.push(
      `(t.transaction_code ILIKE $${params.length} OR po.po_code ILIKE $${params.length} OR s.company_name ILIKE $${params.length})`
    );
  }

  const whereSql = `WHERE ${conditions.join(' AND ')}`;
  const safePage = Math.max(1, Number(page) || 1);
  const safePageSize = Math.min(50, Math.max(1, Number(pageSize) || 15));
  const offset = (safePage - 1) * safePageSize;

  const countRes = await executor.query(
    `SELECT COUNT(*)::int AS total
     FROM transactions t
     INNER JOIN purchase_orders po ON po.id = t.purchase_order_id
     INNER JOIN suppliers s ON s.id = po.supplier_id
     ${whereSql}`,
    params
  );
  const totalCount = countRes.rows[0]?.total ?? 0;

  const listParams = [...params, safePageSize, offset];
  const { rows } = await executor.query(
    `SELECT
       t.id,
       t.transaction_code,
       t.status,
       t.purchase_order_id,
       po.po_code,
       po.status AS po_status,
       s.company_name AS supplier_name,
       t.created_by,
       creator.name AS created_by_name,
       t.processed_by,
       proc.name AS processed_by_name,
       t.transaction_date,
       t.processed_at,
       COUNT(ti.id)::int AS item_count,
       COALESCE(SUM(ti.quantity), 0)::int AS total_quantity,
       COALESCE(SUM(COALESCE(ti.good_quantity, ti.quantity)), 0)::int AS total_good_quantity,
       COALESCE(SUM(COALESCE(ti.damaged_quantity, 0)), 0)::int AS total_damaged_quantity,
       COALESCE(SUM(ti.approved_quantity), 0)::int AS total_approved_quantity,
       BOOL_OR(
         COALESCE(ti.damaged_quantity, 0) > 0
         OR (ti.condition_status IS NOT NULL AND ti.condition_status <> 'good')
       ) AS has_issue
     FROM transactions t
     INNER JOIN purchase_orders po ON po.id = t.purchase_order_id
     INNER JOIN suppliers s ON s.id = po.supplier_id
     INNER JOIN users creator ON creator.id = t.created_by
     LEFT JOIN users proc ON proc.id = t.processed_by
     LEFT JOIN transaction_items ti ON ti.transaction_id = t.id
     ${whereSql}
     GROUP BY t.id, po.po_code, po.status, s.company_name, creator.name, proc.name
     ORDER BY (t.status = 'pending') DESC, t.transaction_date DESC, t.id DESC
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

export async function listEligiblePosForIncoming(client = null) {
  const executor = client || { query };
  const { rows } = await executor.query(
    `SELECT
       po.id,
       po.po_code,
       po.status,
       po.order_date,
       po.received_at,
       po.arrival_confirmed_at,
       po.arrival_notes,
       po.inspection_requested_at,
       po.inspection_request_notes,
       s.company_name AS supplier_name,
       sd.courier_name,
       sd.tracking_number
     FROM purchase_orders po
     INNER JOIN suppliers s ON s.id = po.supplier_id
     LEFT JOIN shipment_details sd ON sd.purchase_order_id = po.id
     LEFT JOIN transactions active_inc
       ON active_inc.purchase_order_id = po.id
       AND active_inc.type = 'incoming'
       AND active_inc.status IN ('pending', 'approved')
     WHERE po.status IN ('inspecting', 'returned')
       AND active_inc.id IS NULL
     ORDER BY COALESCE(po.inspection_requested_at, po.updated_at) DESC, po.id DESC`
  );
  return rows;
}

// Legacy alias kept for compatibility
export const listEligibleReceivedPos = listEligiblePosForIncoming;

export async function findIncomingById(id, client = null, { forUpdate = false } = {}) {
  const executor = client || { query };
  const lockSql = forUpdate ? 'FOR UPDATE OF t' : '';
  const { rows } = await executor.query(
    `SELECT
       t.*,
       po.po_code,
       po.supplier_id,
       po.status AS po_status,
       po.order_date AS po_order_date,
       po.arrival_confirmed_at,
       po.arrival_notes,
       po.inspection_requested_at,
       po.inspection_request_notes,
       po.supplier_followup_notes,
       sd.courier_name,
       sd.tracking_number,
       sd.shipped_at,
       s.company_name AS supplier_name,
       creator.name AS created_by_name,
       proc.name AS processed_by_name
     FROM transactions t
     INNER JOIN purchase_orders po ON po.id = t.purchase_order_id
     INNER JOIN suppliers s ON s.id = po.supplier_id
     INNER JOIN users creator ON creator.id = t.created_by
     LEFT JOIN users proc ON proc.id = t.processed_by
     LEFT JOIN shipment_details sd ON sd.purchase_order_id = po.id
     WHERE t.id = $1 AND t.type = 'incoming'
     LIMIT 1
     ${lockSql}`,
    [id]
  );
  return rows[0] || null;
}

export async function findTransactionItems(transactionId, client = null) {
  const executor = client || { query };
  const { rows } = await executor.query(
    `SELECT
       ti.*,
       p.sku,
       p.name AS product_name,
       p.unit,
       p.rack_location,
       p.stock AS current_stock,
       poi.quantity AS ordered_quantity,
       poi.unit_price AS po_unit_price,
       COALESCE(prev_app.prev_approved_qty, 0)::int AS previously_approved_quantity,
       CASE
         WHEN poi.quantity IS NOT NULL
         THEN GREATEST(0, poi.quantity - COALESCE(prev_app.prev_approved_qty, 0))::int
         ELSE NULL
       END AS remaining_before_this
     FROM transaction_items ti
     INNER JOIN products p ON p.id = ti.product_id
     INNER JOIN transactions t ON t.id = ti.transaction_id
     LEFT JOIN purchase_order_items poi
       ON poi.purchase_order_id = t.purchase_order_id
       AND poi.product_id = ti.product_id
     LEFT JOIN LATERAL (
       SELECT
         COALESCE(SUM(COALESCE(ti2.approved_quantity, ti2.quantity)), 0)::int AS prev_approved_qty
       FROM transaction_items ti2
       INNER JOIN transactions t2 ON t2.id = ti2.transaction_id
       WHERE t.purchase_order_id IS NOT NULL
         AND t2.purchase_order_id = t.purchase_order_id
         AND t2.type = 'incoming'
         AND t2.status = 'approved'
         AND t2.id <> t.id
         AND ti2.product_id = ti.product_id
     ) prev_app ON TRUE
     WHERE ti.transaction_id = $1
     ORDER BY p.sku ASC`,
    [transactionId]
  );
  return rows;
}

export async function insertIncomingHeader(
  { transactionCode, createdBy, purchaseOrderId, receivingDate = null, notes },
  client
) {
  const { rows } = await client.query(
    `INSERT INTO transactions (
       transaction_code, type, status, created_by, purchase_order_id, notes, transaction_date
     )
     VALUES (
       $1,
       'incoming',
       'pending',
       $2,
       $3,
       $4,
       CASE WHEN $5::date IS NOT NULL THEN ($5::date + CURRENT_TIME)::timestamptz ELSE NOW() END
     )
     RETURNING *`,
    [transactionCode, createdBy, purchaseOrderId, notes, receivingDate]
  );
  return rows[0];
}

export async function insertTransactionItem(
  {
    transactionId,
    productId,
    quantity,
    unitPrice = null,
    goodQuantity = null,
    damagedQuantity = 0,
    conditionStatus = null,
    notes = null,
  },
  client
) {
  const resolvedGood =
    goodQuantity !== null && goodQuantity !== undefined ? goodQuantity : quantity;
  await client.query(
    `INSERT INTO transaction_items (
       transaction_id, product_id, quantity, unit_price, good_quantity, damaged_quantity, condition_status, notes
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [
      transactionId,
      productId,
      quantity,
      unitPrice,
      resolvedGood,
      damagedQuantity,
      conditionStatus,
      notes,
    ]
  );
}

export async function updateTransactionItemApproval(
  { transactionId, productId, approvedQuantity, discrepancyAction = null, managerNotes = null },
  client
) {
  await client.query(
    `UPDATE transaction_items
     SET approved_quantity = $3,
         discrepancy_action = $4,
         manager_notes = $5
     WHERE transaction_id = $1 AND product_id = $2`,
    [transactionId, productId, approvedQuantity, discrepancyAction, managerNotes]
  );
}

export async function updateTransactionReviewStatus(
  transactionId,
  { status, processedBy = null, rejectionReason = null },
  client
) {
  const { rows } = await client.query(
    `UPDATE transactions
     SET status = $2,
         processed_by = COALESCE($3, processed_by),
         processed_at = CASE WHEN $3 IS NOT NULL THEN NOW() ELSE processed_at END,
         rejection_reason = COALESCE($4, rejection_reason),
         updated_at = NOW()
     WHERE id = $1
     RETURNING *`,
    [transactionId, status, processedBy, rejectionReason]
  );
  return rows[0];
}
