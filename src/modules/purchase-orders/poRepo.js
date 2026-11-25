import { query } from '../../lib/db/pool.js';

export async function listPurchaseOrders(
  { supplierIdScope = null, status = '', search = '', page = 1, pageSize = 15 } = {},
  client = null
) {
  const executor = client || { query };
  const conditions = [];
  const params = [];

  if (supplierIdScope) {
    params.push(Number(supplierIdScope));
    conditions.push(`po.supplier_id = $${params.length}`);
  }
  if (status) {
    if (status === 'confirmed' || status === 'processing') {
      conditions.push(`po.status IN ('confirmed', 'processing', 'preparing')`);
    } else if (
      [
        'pending',
        'rejected',
        'in_transit',
        'inspecting',
        'delivered',
        'received',
        'returned',
        'completed',
        'cancelled',
      ].includes(status)
    ) {
      params.push(status);
      conditions.push(`po.status = $${params.length}`);
    }
  }
  if (search) {
    params.push(`%${search}%`);
    conditions.push(
      `(po.po_code ILIKE $${params.length} OR s.company_name ILIKE $${params.length})`
    );
  }

  const whereSql = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const safePage = Math.max(1, Number(page) || 1);
  const safePageSize = Math.min(50, Math.max(1, Number(pageSize) || 15));
  const offset = (safePage - 1) * safePageSize;

  const countRes = await executor.query(
    `SELECT COUNT(*)::int AS total
     FROM purchase_orders po
     INNER JOIN suppliers s ON s.id = po.supplier_id
     ${whereSql}`,
    params
  );
  const totalCount = countRes.rows[0]?.total ?? 0;

  const listParams = [...params, safePageSize, offset];
  const { rows } = await executor.query(
    `SELECT
       po.id,
       po.po_code,
       po.supplier_id,
       s.company_name AS supplier_name,
       po.created_by,
       creator.name AS created_by_name,
       po.status,
       po.order_date,
       po.expected_arrival,
       po.confirmed_at,
       po.received_at,
       po.arrival_confirmed_at,
       po.inspection_requested_at,
       po.completed_at,
       po.reference_po_id,
       ref_po.po_code AS reference_po_code,
       po.source_discrepancy_id,
       src_disc.issue_code AS source_discrepancy_code,
       po.created_at,
       sd.tracking_number,
       sd.courier_name,
       COALESCE(item_agg.item_count, 0)::int AS item_count,
       COALESCE(item_agg.total_quantity, 0)::int AS total_quantity,
       item_agg.total_amount,
       COALESCE(inc_agg.incoming_count, 0)::int AS incoming_count,
       COALESCE(inc_agg.approved_incoming_count, 0)::int AS approved_incoming_count,
       COALESCE(inc_agg.total_approved_quantity, 0)::int AS total_approved_quantity,
       pending_inc.id AS pending_incoming_id,
       pending_inc.transaction_code AS pending_incoming_code,
       pending_inc.status AS pending_incoming_status,
       COALESCE(pending_inc.id, latest_inc.id) AS active_incoming_id,
       COALESCE(pending_inc.transaction_code, latest_inc.transaction_code) AS active_incoming_code,
       COALESCE(pending_inc.status, latest_inc.status) AS active_incoming_status
     FROM purchase_orders po
     INNER JOIN suppliers s ON s.id = po.supplier_id
     INNER JOIN users creator ON creator.id = po.created_by
     LEFT JOIN purchase_orders ref_po ON ref_po.id = po.reference_po_id
     LEFT JOIN discrepancy_reports src_disc ON src_disc.id = po.source_discrepancy_id
     LEFT JOIN shipment_details sd ON sd.purchase_order_id = po.id
     LEFT JOIN LATERAL (
       SELECT
         COUNT(poi.id)::int AS item_count,
         COALESCE(SUM(poi.quantity), 0)::int AS total_quantity,
         CASE
           WHEN COUNT(poi.id) > 0 AND COUNT(poi.unit_price) = COUNT(poi.id)
           THEN SUM(poi.quantity * poi.unit_price)::numeric(14, 2)
           ELSE NULL
         END AS total_amount
       FROM purchase_order_items poi
       WHERE poi.purchase_order_id = po.id
     ) item_agg ON TRUE
     LEFT JOIN LATERAL (
       SELECT
         COUNT(DISTINCT t.id)::int AS incoming_count,
         COUNT(DISTINCT t.id) FILTER (WHERE t.status = 'approved')::int AS approved_incoming_count,
         COALESCE(
           SUM(COALESCE(ti.approved_quantity, ti.quantity)) FILTER (WHERE t.status = 'approved'),
           0
         )::int AS total_approved_quantity
       FROM transactions t
       LEFT JOIN transaction_items ti ON ti.transaction_id = t.id
       WHERE t.purchase_order_id = po.id
         AND t.type = 'incoming'
         AND t.status NOT IN ('rejected', 'cancelled')
     ) inc_agg ON TRUE
     LEFT JOIN transactions pending_inc
       ON pending_inc.purchase_order_id = po.id
       AND pending_inc.type = 'incoming'
       AND pending_inc.status = 'pending'
     LEFT JOIN LATERAL (
       SELECT id, transaction_code, status
       FROM transactions
       WHERE purchase_order_id = po.id
         AND type = 'incoming'
         AND status NOT IN ('rejected', 'cancelled')
       ORDER BY transaction_date DESC, id DESC
       LIMIT 1
     ) latest_inc ON TRUE
     ${whereSql}
     ORDER BY po.created_at DESC, po.id DESC
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

export async function findPoById(poId, client = null, { forUpdate = false } = {}) {
  const executor = client || { query };
  const lockSql = forUpdate ? 'FOR UPDATE OF po' : '';
  const { rows } = await executor.query(
    `SELECT
       po.*,
       s.company_name AS supplier_name,
       s.contact_name AS supplier_contact,
       s.phone AS supplier_phone,
       creator.name AS created_by_name,
       arr_actor.name AS arrival_confirmed_by_name,
       insp_actor.name AS inspection_requested_by_name,
       comp_actor.name AS completed_by_name,
       ref_po.po_code AS reference_po_code,
       src_disc.issue_code AS source_discrepancy_code,
       sd.id AS shipment_id,
       sd.shipped_at,
       sd.courier_name,
       sd.tracking_number,
       sd.no_tracking_reason,
       sd.notes AS shipment_notes,
       pending_inc.id AS pending_incoming_id,
       pending_inc.transaction_code AS pending_incoming_code,
       pending_inc.status AS pending_incoming_status,
       active_inc.id AS active_incoming_id,
       active_inc.transaction_code AS active_incoming_code,
       active_inc.status AS active_incoming_status
     FROM purchase_orders po
     INNER JOIN suppliers s ON s.id = po.supplier_id
     INNER JOIN users creator ON creator.id = po.created_by
     LEFT JOIN purchase_orders ref_po ON ref_po.id = po.reference_po_id
     LEFT JOIN discrepancy_reports src_disc ON src_disc.id = po.source_discrepancy_id
     LEFT JOIN users arr_actor ON arr_actor.id = po.arrival_confirmed_by
     LEFT JOIN users insp_actor ON insp_actor.id = po.inspection_requested_by
     LEFT JOIN users comp_actor ON comp_actor.id = po.completed_by
     LEFT JOIN shipment_details sd ON sd.purchase_order_id = po.id
     LEFT JOIN transactions pending_inc
       ON pending_inc.purchase_order_id = po.id
       AND pending_inc.type = 'incoming'
       AND pending_inc.status = 'pending'
     LEFT JOIN LATERAL (
       SELECT id, transaction_code, status
       FROM transactions
       WHERE purchase_order_id = po.id
         AND type = 'incoming'
         AND status IN ('pending', 'approved')
       ORDER BY (status = 'pending') DESC, id DESC
       LIMIT 1
     ) active_inc ON TRUE
     WHERE po.id = $1
     LIMIT 1
     ${lockSql}`,
    [poId]
  );
  return rows[0] || null;
}

export async function findPoItems(poId, client = null) {
  const executor = client || { query };
  const { rows } = await executor.query(
    `SELECT
       poi.id,
       poi.purchase_order_id,
       poi.product_id,
       poi.quantity,
       poi.unit_price,
       p.sku,
       p.name AS product_name,
       p.unit,
       p.rack_location,
       p.purchase_price,
       COALESCE(app.approved_qty, 0)::int AS approved_quantity,
       GREATEST(0, poi.quantity - COALESCE(app.approved_qty, 0))::int AS remaining_quantity
     FROM purchase_order_items poi
     INNER JOIN products p ON p.id = poi.product_id
     LEFT JOIN (
       SELECT
         ti.product_id,
         COALESCE(SUM(COALESCE(ti.approved_quantity, ti.quantity)), 0)::int AS approved_qty
       FROM transaction_items ti
       INNER JOIN transactions t ON t.id = ti.transaction_id
       WHERE t.purchase_order_id = $1
         AND t.type = 'incoming'
         AND t.status = 'approved'
       GROUP BY ti.product_id
     ) app ON app.product_id = poi.product_id
     WHERE poi.purchase_order_id = $1
     ORDER BY p.sku ASC`,
    [poId]
  );
  return rows;
}

export async function findIncomingsForPo(poId, client = null) {
  const executor = client || { query };
  const { rows } = await executor.query(
    `SELECT
       t.id,
       t.transaction_code,
       t.status,
       t.notes,
       t.rejection_reason,
       t.transaction_date,
       t.processed_at,
       creator.name AS created_by_name,
       proc.name AS processed_by_name,
       COUNT(ti.id)::int AS item_count,
       COALESCE(SUM(ti.quantity), 0)::int AS total_received_quantity,
       COALESCE(SUM(COALESCE(ti.good_quantity, ti.quantity)), 0)::int AS total_good_quantity,
       COALESCE(SUM(COALESCE(ti.damaged_quantity, 0)), 0)::int AS total_damaged_quantity,
       COALESCE(SUM(ti.approved_quantity), 0)::int AS total_approved_quantity
     FROM transactions t
     INNER JOIN users creator ON creator.id = t.created_by
     LEFT JOIN users proc ON proc.id = t.processed_by
     LEFT JOIN transaction_items ti ON ti.transaction_id = t.id
     WHERE t.purchase_order_id = $1
       AND t.type = 'incoming'
     GROUP BY t.id, creator.name, proc.name
     ORDER BY t.transaction_date DESC, t.id DESC`,
    [poId]
  );
  return rows;
}

export async function listShipments(
  { supplierIdScope = null, search = '', status = '' } = {},
  client = null
) {
  const executor = client || { query };
  const conditions = [];
  const params = [];

  if (supplierIdScope) {
    params.push(Number(supplierIdScope));
    conditions.push(`po.supplier_id = $${params.length}`);
  }
  if (
    status &&
    [
      'confirmed',
      'processing',
      'preparing',
      'in_transit',
      'inspecting',
      'delivered',
      'received',
      'returned',
      'completed',
    ].includes(status)
  ) {
    params.push(status);
    conditions.push(`po.status = $${params.length}`);
  } else {
    conditions.push(
      `po.status IN ('confirmed', 'processing', 'preparing', 'in_transit', 'inspecting', 'delivered', 'received', 'returned', 'completed')`
    );
  }
  if (search) {
    params.push(`%${search}%`);
    conditions.push(
      `(po.po_code ILIKE $${params.length} OR COALESCE(sd.tracking_number, '') ILIKE $${params.length} OR COALESCE(sd.courier_name, '') ILIKE $${params.length})`
    );
  }

  const { rows } = await executor.query(
    `SELECT
       po.id AS po_id,
       po.po_code,
       po.status AS po_status,
       po.order_date,
       po.expected_arrival,
       po.arrival_confirmed_at,
       s.company_name AS supplier_name,
       sd.id AS shipment_id,
       sd.shipped_at,
       sd.courier_name,
       sd.tracking_number,
       sd.no_tracking_reason,
       sd.notes
     FROM purchase_orders po
     INNER JOIN suppliers s ON s.id = po.supplier_id
     LEFT JOIN shipment_details sd ON sd.purchase_order_id = po.id
     WHERE ${conditions.join(' AND ')}
     ORDER BY COALESCE(sd.shipped_at, po.updated_at) DESC`,
    params
  );

  return rows;
}

export async function insertPurchaseOrder(
  {
    poCode,
    supplierId,
    createdBy,
    orderDate,
    expectedArrival,
    notes,
    referencePoId = null,
    sourceDiscrepancyId = null,
  },
  client
) {
  const { rows } = await client.query(
    `INSERT INTO purchase_orders (
       po_code, supplier_id, created_by, status, order_date, expected_arrival,
       notes, reference_po_id, source_discrepancy_id
     )
     VALUES ($1, $2, $3, 'pending', $4, $5, $6, $7, $8)
     RETURNING *`,
    [
      poCode,
      supplierId,
      createdBy,
      orderDate,
      expectedArrival,
      notes,
      referencePoId,
      sourceDiscrepancyId,
    ]
  );
  return rows[0];
}

export async function insertPurchaseOrderItem(
  { purchaseOrderId, productId, quantity, unitPrice = null },
  client
) {
  await client.query(
    `INSERT INTO purchase_order_items (purchase_order_id, product_id, quantity, unit_price)
     VALUES ($1, $2, $3, $4)`,
    [purchaseOrderId, productId, quantity, unitPrice]
  );
}

export async function updatePurchaseOrderStatus(
  poId,
  { status, rejectionReason = null, setConfirmedAt = false, setReceivedAt = false },
  client
) {
  const { rows } = await client.query(
    `UPDATE purchase_orders
     SET status = $2,
         rejection_reason = COALESCE($3, rejection_reason),
         confirmed_at = CASE WHEN $4 THEN NOW() ELSE confirmed_at END,
         received_at = CASE WHEN $5 THEN NOW() ELSE received_at END,
         updated_at = NOW()
     WHERE id = $1
     RETURNING *`,
    [poId, status, rejectionReason, setConfirmedAt, setReceivedAt]
  );
  return rows[0];
}

export async function recordSupplierArrivalConfirmation(
  poId,
  { userId, arrivalNotes = null },
  client
) {
  const { rows } = await client.query(
    `UPDATE purchase_orders
     SET arrival_confirmed_at = NOW(),
         arrival_confirmed_by = $2,
         arrival_notes = $3,
         inspection_requested_at = NULL,
         inspection_requested_by = NULL,
         inspection_request_notes = NULL,
         updated_at = NOW()
     WHERE id = $1
     RETURNING *`,
    [poId, userId, arrivalNotes]
  );
  return rows[0];
}

export async function recordManagerInspectionRequest(
  poId,
  { userId, notes = null },
  client
) {
  const { rows } = await client.query(
    `UPDATE purchase_orders
     SET status = 'inspecting',
         inspection_requested_at = NOW(),
         inspection_requested_by = $2,
         inspection_request_notes = $3,
         updated_at = NOW()
     WHERE id = $1
     RETURNING *`,
    [poId, userId, notes]
  );
  return rows[0];
}

export async function updatePoFollowupNotes(poId, followupNotes, client) {
  const { rows } = await client.query(
    `UPDATE purchase_orders
     SET supplier_followup_notes = $2,
         updated_at = NOW()
     WHERE id = $1
     RETURNING *`,
    [poId, followupNotes]
  );
  return rows[0];
}

export async function markPurchaseOrderCompleted(
  poId,
  { userId, completionNotes = null },
  client
) {
  const { rows } = await client.query(
    `UPDATE purchase_orders
     SET status = 'completed',
         completed_at = NOW(),
         completed_by = $2,
         received_at = COALESCE(received_at, NOW()),
         completion_notes = COALESCE($3, completion_notes),
         updated_at = NOW()
     WHERE id = $1
     RETURNING *`,
    [poId, userId, completionNotes]
  );
  return rows[0];
}

export async function upsertShipmentDetails(
  {
    purchaseOrderId,
    shippedAt,
    courierName,
    trackingNumber,
    noTrackingReason,
    notes,
    submittedBy,
  },
  client
) {
  const { rows } = await client.query(
    `INSERT INTO shipment_details (
       purchase_order_id, shipped_at, courier_name, tracking_number,
       no_tracking_reason, notes, submitted_by
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     ON CONFLICT (purchase_order_id) DO UPDATE SET
       shipped_at = EXCLUDED.shipped_at,
       courier_name = EXCLUDED.courier_name,
       tracking_number = EXCLUDED.tracking_number,
       no_tracking_reason = EXCLUDED.no_tracking_reason,
       notes = EXCLUDED.notes,
       submitted_by = EXCLUDED.submitted_by,
       updated_at = NOW()
     RETURNING *`,
    [
      purchaseOrderId,
      shippedAt,
      courierName,
      trackingNumber,
      noTrackingReason,
      notes,
      submittedBy,
    ]
  );
  return rows[0];
}
