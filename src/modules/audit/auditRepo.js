import { query } from '../../lib/db/pool.js';

export async function insertAuditLog(
  {
    actorId = null,
    actorRole = null,
    action,
    entityType,
    entityId = null,
    previousState = null,
    newState = null,
    metadata = null,
  },
  client = null
) {
  const executor = client || { query };
  const { rows } = await executor.query(
    `INSERT INTO audit_logs (
       actor_id, actor_role, action, entity_type, entity_id,
       previous_state, new_state, metadata
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING id, created_at`,
    [
      actorId,
      actorRole,
      action,
      entityType,
      entityId,
      previousState ? JSON.stringify(previousState) : null,
      newState ? JSON.stringify(newState) : null,
      metadata ? JSON.stringify(metadata) : null,
    ]
  );
  return rows[0];
}

export async function listAuditLogs(
  { search = '', entityType = '', actorRole = '', page = 1, pageSize = 20 } = {},
  client = null
) {
  const executor = client || { query };
  const conditions = [];
  const params = [];

  if (entityType) {
    params.push(entityType);
    conditions.push(`al.entity_type = $${params.length}`);
  }
  if (actorRole && ['admin', 'manager', 'staff', 'supplier'].includes(actorRole)) {
    params.push(actorRole);
    conditions.push(`al.actor_role = $${params.length}`);
  }
  if (search) {
    params.push(`%${search}%`);
    conditions.push(
      `(al.action ILIKE $${params.length} OR al.entity_type ILIKE $${params.length} OR COALESCE(u.name, '') ILIKE $${params.length})`
    );
  }

  const whereSql = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const safePage = Math.max(1, Number(page) || 1);
  const safePageSize = Math.min(50, Math.max(1, Number(pageSize) || 20));
  const offset = (safePage - 1) * safePageSize;

  const countRes = await executor.query(
    `SELECT COUNT(*)::int AS total
     FROM audit_logs al
     LEFT JOIN users u ON u.id = al.actor_id
     ${whereSql}`,
    params
  );
  const totalCount = countRes.rows[0]?.total ?? 0;

  const listParams = [...params, safePageSize, offset];
  const { rows } = await executor.query(
    `SELECT
       al.*,
       u.name AS actor_name,
       u.email AS actor_email
     FROM audit_logs al
     LEFT JOIN users u ON u.id = al.actor_id
     ${whereSql}
     ORDER BY al.created_at DESC, al.id DESC
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
