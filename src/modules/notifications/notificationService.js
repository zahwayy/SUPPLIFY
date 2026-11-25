import { requireAuth } from '../../lib/auth/rbac.js';
import { NotFoundError, ValidationError } from '../../lib/constants/errors.js';
import {
  listNotificationsForUser,
  markNotificationRead,
  markAllNotificationsRead,
} from './notificationRepo.js';

export async function getUserNotifications(user, { limit = 15 } = {}) {
  requireAuth(user);
  return listNotificationsForUser(user.id, { limit });
}

export async function markUserNotificationRead(user, notificationId) {
  requireAuth(user);
  const safeId = Number(notificationId);
  if (!Number.isInteger(safeId) || safeId <= 0) {
    throw new ValidationError('ID notifikasi tidak valid.');
  }
  const updated = await markNotificationRead(user.id, safeId);
  if (!updated) {
    throw new NotFoundError('Notifikasi tidak ditemukan.');
  }
  return updated;
}

export async function markAllUserNotificationsRead(user) {
  requireAuth(user);
  const updatedCount = await markAllNotificationsRead(user.id);
  return { updatedCount };
}

export async function getRejectedSupplierNotifications(userId, { limit = 10 } = {}) {
  if (!userId) return { items: [], unreadCount: 0 };
  return listNotificationsForUser(userId, { limit });
}

export async function markRejectedSupplierNotificationRead(userId, notificationId) {
  const safeId = Number(notificationId);
  if (!Number.isInteger(safeId) || safeId <= 0) {
    throw new ValidationError('ID notifikasi tidak valid.');
  }
  const updated = await markNotificationRead(userId, safeId);
  if (!updated) {
    throw new NotFoundError('Notifikasi tidak ditemukan.');
  }
  return updated;
}
