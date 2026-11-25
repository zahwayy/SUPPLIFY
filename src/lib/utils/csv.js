/**
 * Pure JavaScript RFC 4180 CSV builder with UTF-8 BOM (Excel-friendly)
 * and spreadsheet formula-injection sanitization.
 */

const PURE_NUMBER_RE = /^[+-]?\d+(\.\d+)?$/;

export function sanitizeCsvCell(value) {
  if (value === null || value === undefined) return '';

  let str;
  if (value instanceof Date) {
    str = formatCsvTimestamp(value);
  } else if (typeof value === 'boolean') {
    str = value ? 'Ya' : 'Tidak';
  } else {
    str = String(value);
  }

  // Neutralize spreadsheet formula injection while preserving valid pure numbers (e.g. -5, +10)
  const trimmedLeading = str.trimStart();
  if (
    trimmedLeading.length > 0 &&
    !PURE_NUMBER_RE.test(trimmedLeading) &&
    ['=', '+', '-', '@', '\t', '\r'].includes(trimmedLeading[0])
  ) {
    str = `'${str}`;
  }

  if (/[",\r\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function formatCsvDate(value) {
  if (!value) return '';
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toISOString().slice(0, 10);
}

export function formatCsvTimestamp(value) {
  if (!value) return '';
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(
    d.getHours()
  )}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

export function buildCsv(columns, rows) {
  const headerLine = columns.map((col) => sanitizeCsvCell(col.header)).join(',');
  const dataLines = rows.map((row) =>
    columns
      .map((col) => {
        const raw = typeof col.value === 'function' ? col.value(row) : row?.[col.key];
        return sanitizeCsvCell(raw);
      })
      .join(',')
  );

  // Prefix UTF-8 BOM (\uFEFF) so Microsoft Excel opens UTF-8 / Indonesian text cleanly
  return `\uFEFF${[headerLine, ...dataLines].join('\r\n')}\r\n`;
}

export function buildExportFilename(prefix, date = new Date()) {
  const safePrefix = String(prefix).replace(/[^a-z0-9_-]/gi, '_');
  const datePart = date.toISOString().slice(0, 10);
  return `${safePrefix}_${datePart}.csv`;
}
