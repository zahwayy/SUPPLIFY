'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import {
  createUserSession,
  destroyCurrentSession,
  getCurrentUser,
} from '../../lib/auth/session.js';
import { setStatusNoticeCookie } from '../../lib/auth/statusNotice.js';
import { AccountStatusError } from '../../lib/constants/errors.js';
import { USER_STATUSES } from '../../lib/constants/roles.js';
import { actionFailure } from '../../lib/utils/response.js';
import { recordAuditEvent } from '../audit/auditService.js';
import { loginWithCredentials, registerSupplier } from './authService.js';

export async function loginAction(prevState, formData) {
  let redirectTarget = '/dashboard';
  try {
    const user = await loginWithCredentials({
      email: formData.get('email'),
      password: formData.get('password'),
    });

    await destroyCurrentSession();
    await createUserSession(user.id);
    await recordAuditEvent({
      actorId: user.id,
      actorRole: user.role,
      action: 'AUTH_LOGIN',
      entityType: 'user',
      entityId: user.id,
    });
    revalidatePath('/', 'layout');
  } catch (err) {
    if (err instanceof AccountStatusError) {
      await destroyCurrentSession();
      await setStatusNoticeCookie({
        userId: err.userId,
        expectedStatus: err.accountStatus,
      });
      redirectTarget =
        err.accountStatus === USER_STATUSES.REJECTED
          ? '/rejected-account'
          : '/pending-verification';
    } else {
      return actionFailure(err, 'authActions.loginAction');
    }
  }

  redirect(redirectTarget);
}

export async function registerSupplierAction(prevState, formData) {
  try {
    const result = await registerSupplier({
      name: formData.get('name'),
      email: formData.get('email'),
      password: formData.get('password'),
      confirmPassword: formData.get('confirmPassword'),
      companyName: formData.get('companyName'),
      contactName: formData.get('contactName'),
      phone: formData.get('phone'),
      address: formData.get('address'),
      categoryIds: formData.getAll('categoryIds'),
    });

    await setStatusNoticeCookie({
      userId: result.user.id,
      expectedStatus: USER_STATUSES.PENDING,
    });
  } catch (err) {
    return actionFailure(err, 'authActions.registerSupplierAction');
  }

  redirect('/pending-verification');
}

export async function logoutAction() {
  try {
    const currentUser = await getCurrentUser();
    if (currentUser) {
      await recordAuditEvent({
        actorId: currentUser.id,
        actorRole: currentUser.role,
        action: 'AUTH_LOGOUT',
        entityType: 'user',
        entityId: currentUser.id,
      });
    }
    await destroyCurrentSession();
  } catch {
    // Ensure cookie is cleared even if audit fails
    await destroyCurrentSession();
  }

  revalidatePath('/', 'layout');
  redirect('/login?loggedOut=1');
}
