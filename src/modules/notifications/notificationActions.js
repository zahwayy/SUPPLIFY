'use server';

import { revalidatePath } from 'next/cache';
import { getCurrentUser } from '../../lib/auth/session.js';
import { readStatusNoticeCookie } from '../../lib/auth/statusNotice.js';
import { ROLES, USER_STATUSES } from '../../lib/constants/roles.js';
import { UnauthorizedError } from '../../lib/constants/errors.js';
import { actionFailure, actionSuccess } from '../../lib/utils/response.js';
import { findUserById } from '../users/userRepo.js';
import {
  markUserNotificationRead,
  markAllUserNotificationsRead,
  markRejectedSupplierNotificationRead,
} from './notificationService.js';

export async function markNotificationReadAction(notificationId) {
  try {
    const user = await getCurrentUser();
    const updated = await markUserNotificationRead(user, Number(notificationId));
    revalidatePath('/', 'layout');
    return actionSuccess(updated, 'Notifikasi ditandai telah dibaca.');
  } catch (err) {
    return actionFailure(err, 'notificationActions.markNotificationReadAction');
  }
}

export async function markAllNotificationsReadAction() {
  try {
    const user = await getCurrentUser();
    const res = await markAllUserNotificationsRead(user);
    revalidatePath('/', 'layout');
    return actionSuccess(res, 'Semua notifikasi ditandai telah dibaca.');
  } catch (err) {
    return actionFailure(err, 'notificationActions.markAllNotificationsReadAction');
  }
}

export async function markRejectedNoticeReadAction(notificationId) {
  try {
    const notice = await readStatusNoticeCookie();
    if (!notice?.userId) {
      throw new UnauthorizedError('Sesi verifikasi penolakan sudah berakhir. Silakan masuk kembali.');
    }
    const user = await findUserById(notice.userId);
    if (!user || user.role !== ROLES.SUPPLIER || user.status !== USER_STATUSES.REJECTED) {
      throw new UnauthorizedError('Akses notifikasi tidak valid untuk status akun saat ini.');
    }
    const updated = await markRejectedSupplierNotificationRead(user.id, Number(notificationId));
    revalidatePath('/rejected-account');
    return actionSuccess(updated, 'Notifikasi ditandai telah dibaca.');
  } catch (err) {
    return actionFailure(err, 'notificationActions.markRejectedNoticeReadAction');
  }
}
