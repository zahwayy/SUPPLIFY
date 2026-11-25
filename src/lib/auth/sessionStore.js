import crypto from 'node:crypto';
import { query } from '../db/pool.js';
import { USER_STATUSES } from '../constants/roles.js';
import { getSessionTtlMs } from './cookieConfig.js';

export function generateSessionToken() {
  return crypto.randomBytes(32).toString('hex');
}

export function hashSessionToken(rawToken) {
  const secret = process.env.SESSION_SECRET || '';
  return crypto
    .createHmac('sha256', secret)
    .update(String(rawToken))
    .digest('hex');
}

export async function createSessionRecord(userId, client = null) {
  const rawToken = generateSessionToken();
  const tokenHash = hashSessionToken(rawToken);
  const expiresAt = new Date(Date.now() + getSessionTtlMs());

  const sql = `
    INSERT INTO sessions (user_id, token_hash, expires_at)
    VALUES ($1, $2, $3)
    RETURNING id, user_id, expires_at, created_at
  `;
  const executor = client || { query };
  const { rows } = await executor.query(sql, [userId, tokenHash, expiresAt]);

  return {
    session: rows[0],
    rawToken,
    expiresAt,
  };
}

export async function findActiveSessionByToken(rawToken) {
  if (!rawToken || typeof rawToken !== 'string') return null;

  const tokenHash = hashSessionToken(rawToken);
  const { rows } = await query(
    `SELECT
       s.id AS session_id,
       s.expires_at,
       u.id,
       u.name,
       u.email,
       u.phone,
       u.role,
       u.status,
       sup.id AS supplier_id,
       sup.company_name AS supplier_company_name,
       sup.contact_name AS supplier_contact_name,
       sup.phone AS supplier_phone,
       sup.address AS supplier_address
     FROM sessions s
     INNER JOIN users u ON u.id = s.user_id
     LEFT JOIN suppliers sup ON sup.user_id = u.id
     WHERE s.token_hash = $1
       AND s.revoked_at IS NULL
       AND s.expires_at > NOW()
       AND u.status = $2
     LIMIT 1`,
    [tokenHash, USER_STATUSES.ACTIVE]
  );

  if (rows.length === 0) return null;

  const row = rows[0];
  return {
    sessionId: row.session_id,
    expiresAt: row.expires_at,
    id: row.id,
    name: row.name,
    email: row.email,
    phone: row.phone || null,
    role: row.role,
    status: row.status,
    supplierId: row.supplier_id || null,
    supplierCompanyName: row.supplier_company_name || null,
    supplierContactName: row.supplier_contact_name || null,
    supplierPhone: row.supplier_phone || null,
    supplierAddress: row.supplier_address || null,
  };
}

export async function revokeSessionByToken(rawToken) {
  if (!rawToken || typeof rawToken !== 'string') return false;
  const tokenHash = hashSessionToken(rawToken);
  const res = await query(
    `UPDATE sessions
     SET revoked_at = NOW()
     WHERE token_hash = $1 AND revoked_at IS NULL`,
    [tokenHash]
  );
  return res.rowCount > 0;
}

export async function revokeAllUserSessions(userId, client = null) {
  const executor = client || { query };
  await executor.query(
    `UPDATE sessions
     SET revoked_at = NOW()
     WHERE user_id = $1 AND revoked_at IS NULL`,
    [userId]
  );
}
