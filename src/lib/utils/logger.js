const SENSITIVE_KEYS = new Set([
  'password',
  'passwordHash',
  'password_hash',
  'token',
  'tokenHash',
  'token_hash',
  'secret',
  'cookie',
  'authorization',
]);

function redactObject(value) {
  if (!value || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map(redactObject);

  const sanitized = {};
  for (const [k, v] of Object.entries(value)) {
    if (SENSITIVE_KEYS.has(k)) {
      sanitized[k] = '[REDACTED]';
    } else if (v && typeof v === 'object') {
      sanitized[k] = redactObject(v);
    } else {
      sanitized[k] = v;
    }
  }
  return sanitized;
}

export function logError(context, err, meta = null) {
  const payload = {
    level: 'error',
    context,
    message: err?.message || 'Unknown error',
    code: err?.code || undefined,
    meta: meta ? redactObject(meta) : undefined,
    timestamp: new Date().toISOString(),
  };
  console.error(JSON.stringify(payload));
}

export function logInfo(context, message, meta = null) {
  const payload = {
    level: 'info',
    context,
    message,
    meta: meta ? redactObject(meta) : undefined,
    timestamp: new Date().toISOString(),
  };
  console.info(JSON.stringify(payload));
}
