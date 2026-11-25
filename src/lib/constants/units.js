export const PRODUCT_UNITS = Object.freeze([
  { value: 'PCS', label: 'PCS (Pcs / Buah)' },
  { value: 'PACK', label: 'PACK (Pack / Kemasan)' },
  { value: 'BOX', label: 'BOX (Box / Kotak)' },
  { value: 'UNIT', label: 'UNIT (Unit)' },
  { value: 'SET', label: 'SET (Set)' },
  { value: 'BOTOL', label: 'BOTOL (Botol)' },
  { value: 'RIM', label: 'RIM (Rim Kertas)' },
  { value: 'LUSIN', label: 'LUSIN (Lusin)' },
  { value: 'ROLL', label: 'ROLL (Roll / Gulungan)' },
  { value: 'DUS', label: 'DUS (Dus / Karton)' },
  { value: 'LEMBAR', label: 'LEMBAR (Lembar)' },
]);

export const PRODUCT_UNIT_OPTIONS = PRODUCT_UNITS;

export const ALLOWED_PRODUCT_UNIT_VALUES = new Set(
  PRODUCT_UNITS.map((unit) => unit.value)
);

export function normalizeProductUnit(rawUnit) {
  if (rawUnit === null || rawUnit === undefined) return '';
  return String(rawUnit).trim().toUpperCase();
}
