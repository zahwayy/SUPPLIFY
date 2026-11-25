'use server';

import { revalidatePath } from 'next/cache';
import { getCurrentUser } from '../../lib/auth/session.js';
import { actionFailure, actionSuccess } from '../../lib/utils/response.js';
import {
  createInternalAccount,
  setUserAccountStatus,
  updateOwnProfile,
} from './userService.js';

export async function createInternalUserAction(prevState, formData) {
  try {
    const adminUser = await getCurrentUser();
    const created = await createInternalAccount(adminUser, {
      name: formData.get('name'),
      email: formData.get('email'),
      password: formData.get('password'),
      role: formData.get('role'),
    });
    revalidatePath('/users');
    revalidatePath('/dashboard');
    return actionSuccess(created, `Akun "${created.name}" (${created.role}) berhasil dibuat.`);
  } catch (err) {
    return actionFailure(err, 'userActions.createInternalUserAction');
  }
}

export async function toggleUserStatusAction(userId, nextStatus) {
  try {
    const adminUser = await getCurrentUser();
    const updated = await setUserAccountStatus(adminUser, Number(userId), nextStatus);
    revalidatePath('/users');
    revalidatePath('/supplier-verification');
    revalidatePath('/dashboard');
    return actionSuccess(
      updated,
      `Status akun "${updated.name}" berhasil diubah menjadi ${updated.status}.`
    );
  } catch (err) {
    return actionFailure(err, 'userActions.toggleUserStatusAction');
  }
}

export async function updateOwnProfileAction(prevState, formData) {
  try {
    const currentUser = await getCurrentUser();
    const payload = {
      name: formData.get('name'),
      phone: formData.get('phone'),
    };
    if (formData.has('contactName')) {
      payload.contactName = formData.get('contactName');
    }
    if (formData.has('address')) {
      payload.address = formData.get('address');
    }

    for (const restricted of ['role', 'status', 'email', 'companyName', 'id', 'userId']) {
      if (formData.has(restricted)) {
        payload[restricted] = formData.get(restricted);
      }
    }

    const updated = await updateOwnProfile(currentUser, payload);
    revalidatePath('/profile');
    revalidatePath('/dashboard');
    revalidatePath('/', 'layout');

    return actionSuccess(updated, 'Profil Anda berhasil diperbarui.');
  } catch (err) {
    return actionFailure(err, 'userActions.updateOwnProfileAction');
  }
}
