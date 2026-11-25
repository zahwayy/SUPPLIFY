import { PERMISSIONS, requirePermission } from '../../lib/auth/rbac.js';
import { insertAuditLog, listAuditLogs } from './auditRepo.js';
import { logError } from '../../lib/utils/logger.js';

export async function recordAuditEvent(payload, client = null) {
  try {
    return await insertAuditLog(payload, client);
  } catch (err) {
    // If inside an existing DB transaction, let caller roll back cleanly;
    // for standalone non-critical logs (e.g. failed login), log safely without breaking UX.
    if (client) throw err;
    logError('AuditService.recordAuditEvent', err, { action: payload?.action });
    return null;
  }
}

export async function getAuditLogEntries(user, filters = {}) {
  requirePermission(user, PERMISSIONS.AUDIT_READ);
  return listAuditLogs(filters);
}
