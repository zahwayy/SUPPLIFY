export function cleanString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

export function isNonEmptyString(value, { min = 1, max = 500 } = {}) {
  if (typeof value !== 'string') return false;
  const trimmed = value.trim();
  return trimmed.length >= min && trimmed.length <= max;
}

export function isValidEmail(value) {
  if (typeof value !== 'string') return false;
  const trimmed = value.trim().toLowerCase();
  if (trimmed.length > 150) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed);
}

export function isPositiveInt(value) {
  return Number.isInteger(value) && value > 0;
}

export function isNonNegativeNumber(value) {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0;
}
