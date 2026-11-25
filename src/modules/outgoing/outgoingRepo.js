import { query } from '../../lib/db/pool.js';

export async function listOutgoingTransactions(
  { status = '', search = '', page = 1, pageSize = 15 } = {},
  client = null
) {
  const executor = client || { query };
  const conditions = [`t.type = 'outgoing'`];
  const params = [];

  if (
    status &&
    ['pending', 'approved', 'rejected', 'shipped', 'delivered', 'cancelled'].includes(
      status
    )
  ) {
    params.push(status);
    conditions.push(`t.status = $${params.length}`);
  }
  if (search) {
    params.push(`%${search}%`);
    conditions.push(
      `(t.transaction_code ILIKE $${params.length} OR COALESCE(hd.recipient_name, t.recipient_name, '') ILIKE $${params.length} OR COALESCE(t.notes, '') ILIKE $${params.length})`
    );
  }

  const whereSql = `WHERE ${conditions.join(' AND ')}`;
  const safePage = Math.max(1, Number(page) || 1);
  const safePageSize = Math.min(50, Math.max(1, Number(pageSize) || 15));
  const offset = (safePage - 1) * safePageSize;

  const countRes = await executor.query(
    `SELECT COUNT(*)::int AS total
     FROM transactions t
     LEFT JOIN handover_details hd ON hd.transaction_id = t.id
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
       t.notes,
       t.shipment_date,
       t.recipient_name AS planned_recipient_name,
       t.created_by,
       creator.name AS created_by_name,
       t.processed_by,
       proc.name AS processed_by_name,
       t.transaction_date,
       t.processed_at,
       t.shipped_at,
       t.delivered_at,
       COALESCE(hd.recipient_name, t.recipient_name) AS recipient_name,
       hd.handover_method,
       COUNT(ti.id)::int AS item_count,
       COALESCE(SUM(ti.quantity), 0)::int AS total_quantity
     FROM transactions t
     INNER JOIN users creator ON creator.id = t.created_by
     LEFT JOIN users proc ON proc.id = t.processed_by
     LEFT JOIN handover_details hd ON hd.transaction_id = t.id
     LEFT JOIN transaction_items ti ON ti.transaction_id = t.id
     ${whereSql}
     GROUP BY t.id, creator.name, proc.name, hd.recipient_name, hd.handover_method
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

export async function findOutgoingById(id, client = null, { forUpdate = false } = {}) {
  const executor = client || { query };
  const lockSql = forUpdate ? 'FOR UPDATE OF t' : '';
  const { rows } = await executor.query(
    `SELECT
       t.*,
       t.recipient_name AS planned_recipient_name,
       creator.name AS created_by_name,
       proc.name AS processed_by_name,
       hd.id AS handover_id,
       hd.recipient_name AS handover_recipient_name,
       COALESCE(hd.recipient_name, t.recipient_name) AS recipient_name,
       hd.recipient_type,
       hd.recipient_contact,
       hd.handover_method,
       hd.handed_over_at,
       hd.courier_name,
       hd.tracking_number,
       hd.notes AS handover_notes,
       handover_actor.name AS handed_over_by_name
     FROM transactions t
     INNER JOIN users creator ON creator.id = t.created_by
     LEFT JOIN users proc ON proc.id = t.processed_by
     LEFT JOIN handover_details hd ON hd.transaction_id = t.id
     LEFT JOIN users handover_actor ON handover_actor.id = hd.handed_over_by
     WHERE t.id = $1 AND t.type = 'outgoing'
     LIMIT 1
     ${lockSql}`,
    [id]
  );
  return rows[0] || null;
}

export async function insertOutgoingHeader(
  { transactionCode, createdBy, shipmentDate, recipientName, notes },
  client
) {
  const { rows } = await client.query(
    `INSERT INTO transactions (
       transaction_code, type, status, created_by, purchase_order_id,
       shipment_date, recipient_name, notes
     )
     VALUES ($1, 'outgoing', 'pending', $2, NULL, $3, $4, $5)
     RETURNING *`,
    [transactionCode, createdBy, shipmentDate, recipientName, notes]
  );
  return rows[0];
}

export async function updateOutgoingHeader(
  id,
  { shipmentDate, recipientName, notes },
  client
) {
  const { rows } = await client.query(
    `UPDATE transactions
     SET shipment_date = $2,
         recipient_name = $3,
         notes = $4,
         updated_at = NOW()
     WHERE id = $1 AND type = 'outgoing'
     RETURNING *`,
    [id, shipmentDate, recipientName, notes]
  );
  return rows[0] || null;
}

export async function deleteTransactionItems(transactionId, client) {
  await client.query(`DELETE FROM transaction_items WHERE transaction_id = $1`, [
    transactionId,
  ]);
}

export async function deleteOutgoingTransactionById(id, client) {
  const { rows } = await client.query(
    `DELETE FROM transactions WHERE id = $1 AND type = 'outgoing' RETURNING *`,
    [id]
  );
  return rows[0] || null;
}

export async function insertHandoverDetails(
  {
    transactionId,
    recipientName,
    recipientType,
    recipientContact,
    handoverMethod,
    handedOverBy,
    courierName,
    trackingNumber,
    notes,
  },
  client
) {
  const { rows } = await client.query(
    `INSERT INTO handover_details (
       transaction_id, recipient_name, recipient_type, recipient_contact,
       handover_method, handed_over_by, courier_name, tracking_number, notes
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     RETURNING *`,
    [
      transactionId,
      recipientName,
      recipientType,
      recipientContact,
      handoverMethod,
      handedOverBy,
      courierName,
      trackingNumber,
      notes,
    ]
  );
  return rows[0];
}

export async function markOutgoingShipped(transactionId, client) {
  const { rows } = await client.query(
    `UPDATE transactions
     SET status = 'shipped',
         shipped_at = NOW(),
         updated_at = NOW()
     WHERE id = $1
     RETURNING *`,
    [transactionId]
  );
  return rows[0];
}

export async function markOutgoingDelivered(transactionId, client) {
  const { rows } = await client.query(
    `UPDATE transactions
     SET status = 'delivered',
         delivered_at = NOW(),
         updated_at = NOW()
     WHERE id = $1
     RETURNING *`,
    [transactionId]
  );
  return rows[0];
}
