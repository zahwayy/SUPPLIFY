'use server';

import { revalidatePath } from 'next/cache';
import { getCurrentUser } from '../../lib/auth/session.js';
import { readStatusNoticeCookie } from '../../lib/auth/statusNotice.js';
import { UnauthorizedError } from '../../lib/constants/errors.js';
import { actionFailure, actionSuccess } from '../../lib/utils/response.js';
import {
  approveSupplierRegistration,
  rejectSupplierRegistration,
  submitSupplierAppeal,
  updateSubmittedSupplierAppeal,
  reviewSupplierAppeal,
} from './supplierService.js';
import { SUPPLIER_APPEAL_STATUSES } from '../../lib/constants/statuses.js';

function revalidateAppealPaths() {
  revalidatePath('/rejected-account');
  revalidatePath('/supplier-verification');
  revalidatePath('/users');
  revalidatePath('/dashboard');
  revalidatePath('/', 'layout');
}

export async function approveSupplierAction(supplierId) {
  try {
    const adminUser = await getCurrentUser();
    const result = await approveSupplierRegistration(adminUser, Number(supplierId));
    revalidateAppealPaths();
    return actionSuccess(
      result,
      `Akun supplier "${result.company_name}" telah diverifikasi dan diaktifkan.`
    );
  } catch (err) {
    return actionFailure(err, 'supplierActions.approveSupplierAction');
  }
}

export async function rejectSupplierAction(prevState, formData) {
  try {
    const adminUser = await getCurrentUser();
    const supplierId = Number(formData.get('supplierId'));
    const result = await rejectSupplierRegistration(adminUser, supplierId, {
      rejectionReason: formData.get('rejectionReason'),
    });
    revalidateAppealPaths();
    return actionSuccess(
      result,
      `Pendaftaran supplier "${result.company_name}" telah ditolak.`
    );
  } catch (err) {
    return actionFailure(err, 'supplierActions.rejectSupplierAction');
  }
}

export async function submitSupplierAppealAction(prevState, formData) {
  try {
    const notice = await readStatusNoticeCookie();
    if (!notice?.userId) {
      throw new UnauthorizedError(
        'Sesi peninjauan penolakan sudah berakhir. Silakan masuk kembali dengan email dan kata sandi Anda.'
      );
    }

    const appeal = await submitSupplierAppeal(Number(notice.userId), {
      appealReason: formData.get('appealReason'),
      companyName: formData.get('companyName'),
      contactName: formData.get('contactName'),
      phone: formData.get('phone'),
      address: formData.get('address'),
      additionalNotes: formData.get('additionalNotes'),
    });

    revalidateAppealPaths();
    return actionSuccess(
      appeal,
      'Pengajuan banding berhasil dikirim dan sedang menunggu peninjauan Admin.'
    );
  } catch (err) {
    return actionFailure(err, 'supplierActions.submitSupplierAppealAction');
  }
}

export async function updateSupplierAppealAction(prevState, formData) {
  try {
    const notice = await readStatusNoticeCookie();
    if (!notice?.userId) {
      throw new UnauthorizedError(
        'Sesi peninjauan penolakan sudah berakhir. Silakan masuk kembali dengan email dan kata sandi Anda.'
      );
    }

    const appealId = Number(formData.get('appealId'));
    const appeal = await updateSubmittedSupplierAppeal(Number(notice.userId), appealId, {
      appealReason: formData.get('appealReason'),
      companyName: formData.get('companyName'),
      contactName: formData.get('contactName'),
      phone: formData.get('phone'),
      address: formData.get('address'),
      additionalNotes: formData.get('additionalNotes'),
    });

    revalidateAppealPaths();
    return actionSuccess(
      appeal,
      'Informasi pengajuan banding berhasil diperbarui.'
    );
  } catch (err) {
    return actionFailure(err, 'supplierActions.updateSupplierAppealAction');
  }
}

export async function markAppealUnderReviewAction(appealId) {
  try {
    const adminUser = await getCurrentUser();
    const res = await reviewSupplierAppeal(adminUser, Number(appealId), {
      decision: SUPPLIER_APPEAL_STATUSES.UNDER_REVIEW,
    });
    revalidateAppealPaths();
    return actionSuccess(
      res,
      'Status pengajuan banding diubah menjadi Ditinjau Admin.'
    );
  } catch (err) {
    return actionFailure(err, 'supplierActions.markAppealUnderReviewAction');
  }
}

export async function approveSupplierAppealAction(prevStateOrId, maybeFormData) {
  try {
    const adminUser = await getCurrentUser();
    let appealId;
    let adminDecisionNotes = '';

    if (maybeFormData && typeof maybeFormData.get === 'function') {
      appealId = Number(maybeFormData.get('appealId'));
      adminDecisionNotes = maybeFormData.get('adminDecisionNotes') || '';
    } else {
      appealId = Number(prevStateOrId);
    }

    const res = await reviewSupplierAppeal(adminUser, appealId, {
      decision: SUPPLIER_APPEAL_STATUSES.APPROVED,
      adminDecisionNotes,
    });
    revalidateAppealPaths();
    return actionSuccess(
      res,
      `Banding disetujui. Akun supplier "${res.appeal.company_name}" kini aktif dan dapat masuk ke sistem.`
    );
  } catch (err) {
    return actionFailure(err, 'supplierActions.approveSupplierAppealAction');
  }
}

export async function rejectSupplierAppealAction(prevState, formData) {
  try {
    const adminUser = await getCurrentUser();
    const appealId = Number(formData.get('appealId'));
    const res = await reviewSupplierAppeal(adminUser, appealId, {
      decision: SUPPLIER_APPEAL_STATUSES.REJECTED,
      adminDecisionNotes: formData.get('adminDecisionNotes'),
    });
    revalidateAppealPaths();
    return actionSuccess(
      res,
      `Pengajuan banding untuk "${res.appeal.company_name}" ditolak kembali.`
    );
  } catch (err) {
    return actionFailure(err, 'supplierActions.rejectSupplierAppealAction');
  }
}
