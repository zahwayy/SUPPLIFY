import { query } from '../../lib/db/pool.js';

export async function insertEvidenceFile(
  {
    entityType,
    transactionId = null,
    purchaseOrderId = null,
    discrepancyId = null,
    storageKey,
    originalName,
    mimeType,
    sizeBytes,
    description = null,
    uploadedBy,
  },
  client = null
) {
  const executor = client || { query };
  const { rows } = await executor.query(
    `INSERT INTO evidence_files (
       entity_type, transaction_id, purchase_order_id, discrepancy_id,
       storage_key, original_name, mime_type, size_bytes, description, uploaded_by
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
     RETURNING id, entity_type, transaction_id, purchase_order_id, discrepancy_id,
               storage_key, original_name, mime_type, size_bytes, description, uploaded_by, created_at`,
    [
      entityType,
      transactionId,
      purchaseOrderId,
      discrepancyId,
      storageKey,
      originalName,
      mimeType,
      sizeBytes,
      description,
      uploadedBy,
    ]
  );
  return rows[0];
}

export async function listEvidenceForEntity({ entityType, entityId }, client = null) {
  const executor = client || { query };
  let column;
  if (entityType === 'incoming_inspection' || entityType === 'outgoing_handover') {
    column = 'transaction_id';
  } else if (entityType === 'supplier_shipment' || entityType === 'supplier_arrival') {
    column = 'purchase_order_id';
  } else if (entityType === 'discrepancy') {
    column = 'discrepancy_id';
  } else {
    return [];
  }

  const { rows } = await executor.query(
    `SELECT
       ef.id,
       ef.entity_type,
       ef.original_name,
       ef.mime_type,
       ef.size_bytes,
       ef.description,
       ef.uploaded_by,
       ef.created_at,
       u.name AS uploaded_by_name
     FROM evidence_files ef
     INNER JOIN users u ON u.id = ef.uploaded_by
     WHERE ef.entity_type = $1 AND ef.${column} = $2
     ORDER BY ef.created_at DESC`,
    [entityType, entityId]
  );
  return rows;
}

export async function findEvidenceWithContextById(evidenceId, client = null) {
  const executor = client || { query };
  const { rows } = await executor.query(
    `SELECT
       ef.*,
       t.type AS tx_type,
       t.status AS tx_status,
       po.supplier_id AS po_supplier_id,
       po.status AS po_status,
       dr.status AS discrepancy_status
     FROM evidence_files ef
     LEFT JOIN transactions t ON t.id = ef.transaction_id
     LEFT JOIN purchase_orders po ON po.id = ef.purchase_order_id
     LEFT JOIN discrepancy_reports dr ON dr.id = ef.discrepancy_id
     WHERE ef.id = $1
     LIMIT 1`,
    [evidenceId]
  );
  return rows[0] || null;
}

export async function deleteEvidenceById(evidenceId, client = null) {
  const executor = client || { query };
  const res = await executor.query('DELETE FROM evidence_files WHERE id = $1', [
    evidenceId,
  ]);
  return res.rowCount > 0;
}
