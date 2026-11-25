import { query } from '../../lib/db/pool.js';

export async function findUserByEmail(email, client = null) {
  const executor = client || { query };
  const { rows } = await executor.query(
    `SELECT
       u.id,
       u.name,
       u.email,
       u.password_hash,
       u.role,
       u.status,
       u.created_at,
       sup.id AS supplier_id,
       sup.company_name AS supplier_company_name,
       sup.rejection_reason AS supplier_rejection_reason
     FROM users u
     LEFT JOIN suppliers sup ON sup.user_id = u.id
     WHERE LOWER(u.email) = LOWER($1)
     LIMIT 1`,
    [email]
  );
  return rows[0] || null;
}

export async function findUserById(id, client = null) {
  const executor = client || { query };
  const { rows } = await executor.query(
    `SELECT
       u.id,
       u.name,
       u.email,
       u.phone,
       u.role,
       u.status,
       u.created_at,
       u.updated_at,
       sup.id AS supplier_id,
       sup.company_name AS supplier_company_name,
       sup.contact_name AS supplier_contact_name,
       sup.phone AS supplier_phone,
       sup.address AS supplier_address,
       sup.rejection_reason AS supplier_rejection_reason
     FROM users u
     LEFT JOIN suppliers sup ON sup.user_id = u.id
     WHERE u.id = $1
     LIMIT 1`,
    [id]
  );
  return rows[0] || null;
}

export async function listUsers({ search = '', role = '', status = '' } = {}, client = null) {
  const executor = client || { query };
  const conditions = [];
  const params = [];

  if (role && ['admin', 'manager', 'staff', 'supplier'].includes(role)) {
    params.push(role);
    conditions.push(`u.role = $${params.length}`);
  }
  if (status && ['active', 'pending', 'rejected', 'inactive'].includes(status)) {
    params.push(status);
    conditions.push(`u.status = $${params.length}`);
  }
  if (search) {
    params.push(`%${search}%`);
    conditions.push(`(u.name ILIKE $${params.length} OR u.email ILIKE $${params.length})`);
  }

  const whereSql = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const { rows } = await executor.query(
    `SELECT
       u.id,
       u.name,
       u.email,
       u.role,
       u.status,
       u.created_at,
       u.updated_at,
       sup.company_name AS supplier_company_name
     FROM users u
     LEFT JOIN suppliers sup ON sup.user_id = u.id
     ${whereSql}
     ORDER BY u.created_at DESC, u.id DESC`,
    params
  );
  return rows;
}

export async function countActiveAdmins(client = null) {
  const executor = client || { query };
  const { rows } = await executor.query(
    `SELECT COUNT(*)::int AS total
     FROM users
     WHERE role = 'admin' AND status = 'active'`
  );
  return rows[0]?.total ?? 0;
}

export async function createUser(
  { name, email, passwordHash, role, status },
  client = null
) {
  const executor = client || { query };
  const { rows } = await executor.query(
    `INSERT INTO users (name, email, password_hash, role, status)
     VALUES ($1, LOWER($2), $3, $4, $5)
     RETURNING id, name, email, role, status, created_at`,
    [name, email, passwordHash, role, status]
  );
  return rows[0];
}

export async function updateUserStatus(userId, newStatus, client = null) {
  const executor = client || { query };
  const { rows } = await executor.query(
    `UPDATE users
     SET status = $2,
         updated_at = NOW()
     WHERE id = $1
     RETURNING id, name, email, role, status, updated_at`,
    [userId, newStatus]
  );
  return rows[0] || null;
}

export async function updateUserOwnProfile(
  userId,
  { name, phone = null },
  client = null
) {
  const executor = client || { query };
  const { rows } = await executor.query(
    `UPDATE users
     SET name = $2,
         phone = $3,
         updated_at = NOW()
     WHERE id = $1
     RETURNING id, name, email, phone, role, status, updated_at`,
    [userId, name, phone || null]
  );
  return rows[0] || null;
}

export async function updateSupplierOwnContactProfile(
  userId,
  { contactName, phone, address },
  client = null
) {
  const executor = client || { query };
  const { rows } = await executor.query(
    `UPDATE suppliers
     SET contact_name = $2,
         phone = $3,
         address = $4,
         updated_at = NOW()
     WHERE user_id = $1
     RETURNING id, user_id, company_name, contact_name, phone, address, updated_at`,
    [userId, contactName, phone, address]
  );
  return rows[0] || null;
}
