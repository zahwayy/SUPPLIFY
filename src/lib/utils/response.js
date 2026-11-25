import { AppError } from '../constants/errors.js';
import { logError } from './logger.js';

export function actionSuccess(data = null, message = '') {
  return {
    ok: true,
    data,
    message,
    error: null,
    fieldErrors: null,
  };
}

export function actionFailure(err, context = 'ServerAction') {
  if (err instanceof AppError) {
    return {
      ok: false,
      data: null,
      message: '',
      error: err.message,
      code: err.code,
      fieldErrors: err.fieldErrors || null,
    };
  }

  // Never leak raw database or system errors to clients
  logError(context, err);
  return {
    ok: false,
    data: null,
    message: '',
    error: 'Data belum berhasil diproses. Silakan coba kembali.',
    code: 'INTERNAL_ERROR',
    fieldErrors: null,
  };
}
