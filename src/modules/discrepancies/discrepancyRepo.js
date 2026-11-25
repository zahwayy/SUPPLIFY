import { query } from '../../lib/db/pool.js';

export async function listDiscrepancies(
  { status = '', sourceType = '', search = '', page = 1, pageSize = 15 } = {},
  client = null
) {
  const executor = client || { query };
  const conditions = [];
  const params = [];

  if (status && ['open', 'investigating', 'resolved', 'closed'].includes(status)) {
    params.push(status);
    conditions.push(`dr.status = $${params.length}`);
  }
  if (
    sourceType &&
    ['incoming', 'outgoing', 'purchase_order', 'stock_count'].includes(sourceType)
  ) {
    params.push(sourceType);
    conditions.push(`dr.source_type = $${params.length}`);
  }
  if (search) {
    params.push(`%${search}%`);
    conditions.push(
      `(dr.issue_code ILIKE $${params.length} OR p.sku ILIKE $${params.length} OR p.name ILIKE $${params.length} OR COALESCE(t.transaction_code, '') ILIKE $${params.length} OR COALESCE(po.po_code, '') ILIKE $${params.length})`
    );
  }

  const whereSql = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const safePage = Math.max(1, Number(page) || 1);
  const safePageSize = Math.min(50, Math.max(1, Number(pageSize) || 15));
  const offset = (safePage - 1) * safePageSize;

  const countRes = await executor.query(
    `SELECT COUNT(*)::int AS total
     FROM discrepancy_reports dr
     INNER JOIN products p ON p.id = dr.product_id
     LEFT JOIN transactions t ON t.id = dr.transaction_id
     LEFT JOIN purchase_orders po ON po.id = COALESCE(dr.purchase_order_id, t.purchase_order_id)
     ${whereSql}`,
    params
  );
  const totalCount = countRes.rows[0]?.total ?? 0;

  const listParams = [...params, safePageSize, offset];
  const { rows } = await executor.query(
    `SELECT
       dr.*,
       p.sku,
       p.name AS product_name,
       p.unit,
       p.rack_location,
       p.purchase_price,
       t.transaction_code,
       po.id AS resolved_purchase_order_id,
       po.po_code,
       po.supplier_id,
       s.company_name AS supplier_name,
       fpo.po_code AS follow_up_po_code,
       rep.name AS reported_by_name,
       res_u.name AS resolved_by_name,
       ref_u.name AS refund_requested_by_name
     FROM discrepancy_reports dr
     INNER JOIN products p ON p.id = dr.product_id
     INNER JOIN users rep ON rep.id = dr.reported_by
     LEFT JOIN users res_u ON res_u.id = dr.resolved_by
     LEFT JOIN users ref_u ON ref_u.id = dr.refund_requested_by
     LEFT JOIN transactions t ON t.id = dr.transaction_id
     LEFT JOIN purchase_orders po ON po.id = COALESCE(dr.purchase_order_id, t.purchase_order_id)
     LEFT JOIN suppliers s ON s.id = po.supplier_id
     LEFT JOIN purchase_orders fpo ON fpo.id = dr.follow_up_po_id
     ${whereSql}
     ORDER BY (dr.status IN ('open','investigating')) DESC, dr.reported_at DESC, dr.id DESC
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

export async function listOpenDiscrepanciesSimple(client = null) {
  const executor = client || { query };
  const { rows } = await executor.query(
    `SELECT dr.id, dr.issue_code, dr.issue_type, dr.product_id, p.sku, p.name AS product_name, dr.difference
     FROM discrepancy_reports dr
     INNER JOIN products p ON p.id = dr.product_id
     WHERE dr.status IN ('open', 'investigating', 'resolved')
     ORDER BY dr.reported_at DESC
     LIMIT 50`
  );
  return rows;
}

export async function findDiscrepancyById(id, client = null, { forUpdate = false } = {}) {
  const executor = client || { query };
  const lockSql = forUpdate ? 'FOR UPDATE OF dr' : '';
  const { rows } = await executor.query(
    `SELECT
       dr.*,
       p.sku,
       p.name AS product_name,
       p.unit,
       p.rack_location,
       p.purchase_price,
       t.transaction_code,
       po.id AS resolved_purchase_order_id,
       po.po_code,
       po.supplier_id,
       s.company_name AS supplier_name,
       fpo.po_code AS follow_up_po_code,
       rep.name AS reported_by_name,
       res_u.name AS resolved_by_name,
       ref_u.name AS refund_requested_by_name
     FROM discrepancy_reports dr
     INNER JOIN products p ON p.id = dr.product_id
     INNER JOIN users rep ON rep.id = dr.reported_by
     LEFT JOIN users res_u ON res_u.id = dr.resolved_by
     LEFT JOIN users ref_u ON ref_u.id = dr.refund_requested_by
     LEFT JOIN transactions t ON t.id = dr.transaction_id
     LEFT JOIN purchase_orders po ON po.id = COALESCE(dr.purchase_order_id, t.purchase_order_id)
     LEFT JOIN suppliers s ON s.id = po.supplier_id
     LEFT JOIN purchase_orders fpo ON fpo.id = dr.follow_up_po_id
     WHERE dr.id = $1
     LIMIT 1
     ${lockSql}`,
    [id]
  );
  return rows[0] || null;
}

export async function insertDiscrepancy(
  {
    issueCode,
    issueType,
    sourceType,
    transactionId = null,
    purchaseOrderId = null,
    productId,
    expectedQuantity,
    inspectedQuantity = null,
    acceptedQuantity = null,
    actualQuantity,
    difference,
    description,
    reportedBy,
  },
  client
) {
  const { rows } = await client.query(
    `INSERT INTO discrepancy_reports (
       issue_code, issue_type, source_type, transaction_id, purchase_order_id,
       product_id, expected_quantity, inspected_quantity, accepted_quantity,
       actual_quantity, difference, description, status, reported_by
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 'open', $13)
     RETURNING *`,
    [
      issueCode,
      issueType,
      sourceType,
      transactionId,
      purchaseOrderId,
      productId,
      expectedQuantity,
      inspectedQuantity,
      acceptedQuantity,
      actualQuantity,
      difference,
      description,
      reportedBy,
    ]
  );
  return rows[0];
}

export async function updateDiscrepancyRefundClaim(
  id,
  { refundStatus, refundAmount = null, refundNotes = null, actorId = null, isInitialRequest = false },
  client
) {
  const { rows } = await client.query(
    `UPDATE discrepancy_reports
     SET refund_status = $2,
         refund_amount = COALESCE($3, refund_amount),
         refund_notes = COALESCE($4, refund_notes),
         refund_requested_by = CASE WHEN $5 THEN $6 ELSE refund_requested_by END,
         refund_requested_at = CASE WHEN $5 THEN NOW() ELSE refund_requested_at END,
         refund_updated_at = NOW()
     WHERE id = $1
     RETURNING *`,
    [id, refundStatus, refundAmount, refundNotes, isInitialRequest, actorId]
  );
  return rows[0];
}

export async function updateDiscrepancyResolution(
  id,
  { status, investigationNotes, resolutionType, resolutionNotes, resolvedBy },
  client
) {
  const isResolvedOrClosed = status === 'resolved' || status === 'closed';
  const { rows } = await client.query(
    `UPDATE discrepancy_reports
     SET status = $2,
         investigation_notes = COALESCE($3, investigation_notes),
         resolution_type = COALESCE($4, resolution_type),
         resolution_notes = COALESCE($5, resolution_notes),
         resolved_by = CASE WHEN $6 THEN $7 ELSE resolved_by END,
         resolved_at = CASE WHEN $6 THEN NOW() ELSE resolved_at END
     WHERE id = $1
     RETURNING *`,
    [
      id,
      status,
      investigationNotes,
      resolutionType,
      resolutionNotes,
      isResolvedOrClosed,
      resolvedBy,
    ]
  );
  return rows[0];
}
