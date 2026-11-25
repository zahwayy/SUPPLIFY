export class AppError extends Error {
  constructor(message, { statusCode = 400, code = 'APP_ERROR', fieldErrors = null } = {}) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.code = code;
    this.fieldErrors = fieldErrors;
  }
}

export class ValidationError extends AppError {
  constructor(message = 'Input tidak valid.', fieldErrors = null) {
    super(message, { statusCode: 400, code: 'VALIDATION_ERROR', fieldErrors });
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'Sesi tidak valid atau sudah berakhir. Silakan login kembali.') {
    super(message, { statusCode: 401, code: 'UNAUTHORIZED' });
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'Anda tidak memiliki izin untuk melakukan tindakan ini.') {
    super(message, { statusCode: 403, code: 'FORBIDDEN' });
  }
}

export class AccountStatusError extends ForbiddenError {
  constructor(message, { userId, accountStatus, rejectionReason = null } = {}) {
    super(message);
    this.code = 'ACCOUNT_STATUS_BLOCKED';
    this.userId = userId;
    this.accountStatus = accountStatus;
    this.rejectionReason = rejectionReason;
  }
}

export class NotFoundError extends AppError {
  constructor(message = 'Data yang diminta tidak ditemukan.') {
    super(message, { statusCode: 404, code: 'NOT_FOUND' });
  }
}

export class ConflictError extends AppError {
  constructor(message = 'Terjadi konflik data.', fieldErrors = null) {
    super(message, { statusCode: 409, code: 'CONFLICT', fieldErrors });
  }
}
