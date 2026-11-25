import { query } from '../../lib/db/pool.js';

export async function createSupplierProfile(
  { userId, companyName, contactName, phone, address },
  client = null
) {
  const executor = client || { query };
  const { rows } = await executor.query(
    `INSERT INTO suppliers (user_id, company_name, contact_name, phone, address)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, user_id, company_name, contact_name, phone, address, created_at`,
    [userId, companyName, contactName, phone, address]
  );
  return rows[0];
}

export async function replaceSupplierCategories(supplierId, categoryIds, client = null) {
  const executor = client || { query };
  const cleanIds = Array.isArray(categoryIds)
    ? [...new Set(categoryIds.map((v) => Number(v)).filter((n) => Number.isInteger(n) && n > 0))]
    : [];

  await executor.query('DELETE FROM supplier_categories WHERE supplier_id = $1', [supplierId]);
  if (cleanIds.length === 0) return [];

  const { rows } = await executor.query(
    `INSERT INTO supplier_categories (supplier_id, category_id)
     SELECT $1, cat_id
     FROM UNNEST($2::bigint[]) AS cat_id
     ON CONFLICT (supplier_id, category_id) DO NOTHING
     RETURNING supplier_id, category_id`,
    [supplierId, cleanIds]
  );
  return rows;
}

export async function listSuppliers({ search = '', status = '' } = {}, client = null) {
  const executor = client || { query };
  const conditions = [`u.role = 'supplier'`];
  const params = [];

  if (status === 'appeals') {
    conditions.push(`u.status = 'rejected'`);
    conditions.push(`latest_appeal.status IN ('submitted', 'under_review')`);
  } else if (status && ['pending', 'active', 'rejected', 'inactive'].includes(status)) {
    params.push(status);
    conditions.push(`u.status = $${params.length}`);
  }

  if (search) {
    params.push(`%${search}%`);
    conditions.push(
      `(s.company_name ILIKE $${params.length} OR s.contact_name ILIKE $${params.length} OR u.email ILIKE $${params.length})`
    );
  }

  const { rows } = await executor.query(
    `SELECT
       s.id,
       s.user_id,
       s.company_name,
       s.contact_name,
       s.phone,
       s.address,
       s.rejection_reason,
       s.verified_by,
       s.verified_at,
       s.created_at,
       u.name AS account_name,
       u.email,
       u.status,
       verifier.name AS verified_by_name,
       COALESCE(cat_agg.categories, '[]'::json) AS categories,
       latest_appeal.data AS latest_appeal
     FROM suppliers s
     INNER JOIN users u ON u.id = s.user_id
     LEFT JOIN users verifier ON verifier.id = s.verified_by
     LEFT JOIN LATERAL (
       SELECT json_agg(
         json_build_object('id', c.id, 'code', c.code, 'name', c.name)
         ORDER BY c.name ASC
       ) AS categories
       FROM supplier_categories sc
       INNER JOIN categories c ON c.id = sc.category_id
       WHERE sc.supplier_id = s.id
     ) cat_agg ON TRUE
     LEFT JOIN LATERAL (
       SELECT
         json_build_object(
           'id', sa.id,
           'status', sa.status,
           'rejection_reason_snapshot', sa.rejection_reason_snapshot,
           'appeal_reason', sa.appeal_reason,
           'proposed_updates', sa.proposed_updates,
           'admin_decision_notes', sa.admin_decision_notes,
           'reviewed_by', sa.reviewed_by,
           'reviewed_by_name', rev.name,
           'reviewed_at', sa.reviewed_at,
           'created_at', sa.created_at,
           'updated_at', sa.updated_at
         ) AS data,
         sa.status AS status,
         sa.created_at AS created_at
       FROM supplier_appeals sa
       LEFT JOIN users rev ON rev.id = sa.reviewed_by
       WHERE sa.supplier_id = s.id
       ORDER BY sa.created_at DESC, sa.id DESC
       LIMIT 1
     ) latest_appeal ON TRUE
     WHERE ${conditions.join(' AND ')}
     ORDER BY (u.status = 'pending') DESC,
              (latest_appeal.status IN ('submitted', 'under_review')) DESC,
              COALESCE(latest_appeal.created_at, s.created_at) DESC`,
    params
  );

  return rows;
}

export async function listActiveSuppliersSimple(client = null) {
  const executor = client || { query };
  const { rows } = await executor.query(
    `SELECT s.id, s.company_name, s.contact_name, s.phone
     FROM suppliers s
     INNER JOIN users u ON u.id = s.user_id
     WHERE u.role = 'supplier' AND u.status = 'active'
     ORDER BY s.company_name ASC`
  );
  return rows;
}

export async function findSupplierById(supplierId, client = null) {
  const executor = client || { query };
  const { rows } = await executor.query(
    `SELECT
       s.id,
       s.user_id,
       s.company_name,
       s.contact_name,
       s.phone,
       s.address,
       s.rejection_reason,
       s.verified_by,
       s.verified_at,
       u.name AS account_name,
       u.email,
       u.status,
       COALESCE(cat_agg.categories, '[]'::json) AS categories
     FROM suppliers s
     INNER JOIN users u ON u.id = s.user_id
     LEFT JOIN LATERAL (
       SELECT json_agg(
         json_build_object('id', c.id, 'code', c.code, 'name', c.name)
         ORDER BY c.name ASC
       ) AS categories
       FROM supplier_categories sc
       INNER JOIN categories c ON c.id = sc.category_id
       WHERE sc.supplier_id = s.id
     ) cat_agg ON TRUE
     WHERE s.id = $1
     LIMIT 1`,
    [supplierId]
  );
  return rows[0] || null;
}

export async function updateSupplierVerification(
  { supplierId, userId, newStatus, adminUserId, rejectionReason = null },
  client
) {
  await client.query(
    `UPDATE users
     SET status = $2,
         updated_at = NOW()
     WHERE id = $1`,
    [userId, newStatus]
  );

  const { rows } = await client.query(
    `UPDATE suppliers
     SET verified_by = $2,
         verified_at = NOW(),
         rejection_reason = $3,
         updated_at = NOW()
     WHERE id = $1
     RETURNING id, user_id, company_name, rejection_reason, verified_by, verified_at`,
    [supplierId, adminUserId, rejectionReason]
  );

  return rows[0];
}

export async function findSupplierByUserId(userId, client = null) {
  const executor = client || { query };
  const { rows } = await executor.query(
    `SELECT
       s.id,
       s.user_id,
       s.company_name,
       s.contact_name,
       s.phone,
       s.address,
       s.rejection_reason,
       s.verified_by,
       s.verified_at,
       s.created_at,
       u.name AS account_name,
       u.email,
       u.phone AS user_phone,
       u.role,
       u.status,
       verifier.name AS verified_by_name,
       COALESCE(cat_agg.categories, '[]'::json) AS categories
     FROM suppliers s
     INNER JOIN users u ON u.id = s.user_id
     LEFT JOIN users verifier ON verifier.id = s.verified_by
     LEFT JOIN LATERAL (
       SELECT json_agg(
         json_build_object('id', c.id, 'code', c.code, 'name', c.name)
         ORDER BY c.name ASC
       ) AS categories
       FROM supplier_categories sc
       INNER JOIN categories c ON c.id = sc.category_id
       WHERE sc.supplier_id = s.id
     ) cat_agg ON TRUE
     WHERE s.user_id = $1
     LIMIT 1`,
    [userId]
  );
  return rows[0] || null;
}

export async function listAppealsBySupplierId(supplierId, client = null) {
  const executor = client || { query };
  const { rows } = await executor.query(
    `SELECT
       sa.id,
       sa.supplier_id,
       sa.submitted_by_user_id,
       sa.status,
       sa.rejection_reason_snapshot,
       sa.appeal_reason,
       sa.proposed_updates,
       sa.admin_decision_notes,
       sa.reviewed_by,
       rev.name AS reviewed_by_name,
       sa.reviewed_at,
       sa.created_at,
       sa.updated_at
     FROM supplier_appeals sa
     LEFT JOIN users rev ON rev.id = sa.reviewed_by
     WHERE sa.supplier_id = $1
     ORDER BY sa.created_at DESC, sa.id DESC`,
    [supplierId]
  );
  return rows;
}

export async function findLatestAppealBySupplierId(supplierId, client = null) {
  const rows = await listAppealsBySupplierId(supplierId, client);
  return rows[0] || null;
}

export async function findAppealById(appealId, client = null) {
  const executor = client || { query };
  const { rows } = await executor.query(
    `SELECT
       sa.id,
       sa.supplier_id,
       sa.submitted_by_user_id,
       sa.status,
       sa.rejection_reason_snapshot,
       sa.appeal_reason,
       sa.proposed_updates,
       sa.admin_decision_notes,
       sa.reviewed_by,
       rev.name AS reviewed_by_name,
       sa.reviewed_at,
       sa.created_at,
       sa.updated_at,
       s.user_id AS supplier_user_id,
       s.company_name,
       s.contact_name,
       s.phone,
       s.address,
       s.rejection_reason AS current_rejection_reason,
       u.name AS account_name,
       u.email,
       u.role AS user_role,
       u.status AS user_status
     FROM supplier_appeals sa
     INNER JOIN suppliers s ON s.id = sa.supplier_id
     INNER JOIN users u ON u.id = s.user_id
     LEFT JOIN users rev ON rev.id = sa.reviewed_by
     WHERE sa.id = $1
     LIMIT 1`,
    [appealId]
  );
  return rows[0] || null;
}

export async function createSupplierAppeal(
  {
    supplierId,
    submittedByUserId,
    rejectionReasonSnapshot,
    appealReason,
    proposedUpdates = {},
  },
  client = null
) {
  const executor = client || { query };
  const { rows } = await executor.query(
    `INSERT INTO supplier_appeals (
       supplier_id,
       submitted_by_user_id,
       status,
       rejection_reason_snapshot,
       appeal_reason,
       proposed_updates
     )
     VALUES ($1, $2, 'submitted', $3, $4, $5::jsonb)
     RETURNING id, supplier_id, submitted_by_user_id, status, rejection_reason_snapshot, appeal_reason, proposed_updates, admin_decision_notes, reviewed_by, reviewed_at, created_at, updated_at`,
    [
      supplierId,
      submittedByUserId,
      rejectionReasonSnapshot || null,
      appealReason,
      JSON.stringify(proposedUpdates || {}),
    ]
  );
  return rows[0];
}

export async function updateOpenSupplierAppeal(
  { appealId, appealReason, proposedUpdates = {} },
  client = null
) {
  const executor = client || { query };
  const { rows } = await executor.query(
    `UPDATE supplier_appeals
     SET appeal_reason = $2,
         proposed_updates = $3::jsonb,
         updated_at = NOW()
     WHERE id = $1
       AND status = 'submitted'
     RETURNING id, supplier_id, submitted_by_user_id, status, rejection_reason_snapshot, appeal_reason, proposed_updates, admin_decision_notes, reviewed_by, reviewed_at, created_at, updated_at`,
    [appealId, appealReason, JSON.stringify(proposedUpdates || {})]
  );
  return rows[0] || null;
}

export async function updateSupplierAppealStatus(
  { appealId, status, adminUserId, adminDecisionNotes = null },
  client = null
) {
  const executor = client || { query };
  const { rows } = await executor.query(
    `UPDATE supplier_appeals
     SET status = $2,
         admin_decision_notes = $3,
         reviewed_by = $4,
         reviewed_at = NOW(),
         updated_at = NOW()
     WHERE id = $1
     RETURNING id, supplier_id, submitted_by_user_id, status, rejection_reason_snapshot, appeal_reason, proposed_updates, admin_decision_notes, reviewed_by, reviewed_at, created_at, updated_at`,
    [appealId, status, adminDecisionNotes || null, adminUserId]
  );
  return rows[0] || null;
}

export async function applyProposedSupplierUpdates(
  { supplierId, userId, proposedUpdates = {} },
  client
) {
  const updates = proposedUpdates && typeof proposedUpdates === 'object' ? proposedUpdates : {};
  const setClauses = [];
  const params = [supplierId];

  if (updates.companyName) {
    params.push(updates.companyName);
    setClauses.push(`company_name = $${params.length}`);
  }
  if (updates.contactName) {
    params.push(updates.contactName);
    setClauses.push(`contact_name = $${params.length}`);
  }
  if (updates.phone) {
    params.push(updates.phone);
    setClauses.push(`phone = $${params.length}`);
  }
  if (updates.address) {
    params.push(updates.address);
    setClauses.push(`address = $${params.length}`);
  }

  if (setClauses.length > 0) {
    await client.query(
      `UPDATE suppliers
       SET ${setClauses.join(', ')},
           updated_at = NOW()
       WHERE id = $1`,
      params
    );
  }

  if (updates.phone && userId) {
    await client.query(
      `UPDATE users
       SET phone = COALESCE(NULLIF(phone, ''), $2),
           updated_at = NOW()
       WHERE id = $1`,
      [userId, updates.phone]
    );
  }
}
