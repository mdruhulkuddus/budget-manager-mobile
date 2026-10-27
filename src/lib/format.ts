// Own digit mapping: Hermes' Intl does not reliably support the 'bn' locale.

const BENGALI_DIGITS = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];

export function toBengaliDigits(input: string | number): string {
  return String(input).replace(/[0-9]/g, (d) => BENGALI_DIGITS[Number(d)]);
}

/**
 * Groups digits the South Asian way: last three, then pairs.
 * 1234567 → "12,34,567"
 */
export function groupDigits(n: number): string {
  const s = String(Math.abs(Math.trunc(n)));
  if (s.length <= 3) return s;
  const last3 = s.slice(-3);
  const rest = s.slice(0, -3).replace(/\B(?=(\d{2})+$)/g, ',');
  return `${rest},${last3}`;
}

/** 28500 → "৳২৮,৫০০", -1200 → "-৳১,২০০" */
export function formatTaka(n: number): string {
  const rounded = Math.round(n);
  const sign = rounded < 0 ? '-' : '';
  return `${sign}৳${toBengaliDigits(groupDigits(rounded))}`;
}
