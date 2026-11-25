import { query } from '../../lib/db/pool.js';

export async function createNotification(
  {
    recipientUserId,
    type,
    title,
    message,
    entityType = null,
    entityId = null,
    href = null,
  },
  client = null
) {
  const executor = client || { query };
  const { rows } = await executor.query(
    `INSERT INTO notifications (
       recipient_user_id, type, title, message, entity_type, entity_id, href
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING id, recipient_user_id, type, title, message, entity_type, entity_id, href, is_read, read_at, created_at`,
    [recipientUserId, type, title, message, entityType, entityId, href]
  );
  return rows[0];
}

export async function createNotificationsForRole(
  role,
  { type, title, message, entityType = null, entityId = null, href = null },
  client = null
) {
  const executor = client || { query };
  const { rows } = await executor.query(
    `INSERT INTO notifications (
       recipient_user_id, type, title, message, entity_type, entity_id, href
     )
     SELECT u.id, $2, $3, $4, $5, $6, $7
     FROM users u
     WHERE u.role = $1
       AND u.status = 'active'
     RETURNING id, recipient_user_id, type, title, message, entity_type, entity_id, href, is_read, read_at, created_at`,
    [role, type, title, message, entityType, entityId, href]
  );
  return rows;
}

export async function listNotificationsForUser(
  userId,
  { limit = 15 } = {},
  client = null
) {
  const executor = client || { query };
  const safeLimit = Math.min(50, Math.max(1, Number(limit) || 15));

  const [listRes, unreadRes] = await Promise.all([
    executor.query(
      `SELECT id, recipient_user_id, type, title, message, entity_type, entity_id, href, is_read, read_at, created_at
       FROM notifications
       WHERE recipient_user_id = $1
       ORDER BY is_read ASC, created_at DESC, id DESC
       LIMIT $2`,
      [userId, safeLimit]
    ),
    executor.query(
      `SELECT COUNT(*)::int AS unread_count
       FROM notifications
       WHERE recipient_user_id = $1
         AND is_read = FALSE`,
      [userId]
    ),
  ]);

  return {
    items: listRes.rows,
    unreadCount: unreadRes.rows[0]?.unread_count ?? 0,
  };
}

export async function markNotificationRead(userId, notificationId, client = null) {
  const executor = client || { query };
  const { rows } = await executor.query(
    `UPDATE notifications
     SET is_read = TRUE,
         read_at = COALESCE(read_at, NOW())
     WHERE id = $1
       AND recipient_user_id = $2
     RETURNING id, recipient_user_id, type, title, message, entity_type, entity_id, href, is_read, read_at, created_at`,
    [notificationId, userId]
  );
  return rows[0] || null;
}

export async function markAllNotificationsRead(userId, client = null) {
  const executor = client || { query };
  const res = await executor.query(
    `UPDATE notifications
     SET is_read = TRUE,
         read_at = NOW()
     WHERE recipient_user_id = $1
       AND is_read = FALSE`,
    [userId]
  );
  return res.rowCount || 0;
}
