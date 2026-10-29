// Own digit mapping: Hermes' Intl does not reliably support the 'bn' locale.

const BENGALI_DIGITS = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];

export function toBengaliDigits(input: string | number): string {
  return String(input).replace(/[0-9]/g, (d) => BENGALI_DIGITS[Number(d)]);
}

/** For tables: no ৳ sign. 20000 → "২০,০০০", -300 → "−৩০০". */
export function formatAmount(n: number): string {
  const rounded = Math.round(n);
  return `${rounded < 0 ? '−' : ''}${toBengaliDigits(groupDigits(rounded))}`;
}

/** A difference with an explicit sign: 800 → "+৮০০", -300 → "−৩০০", 0 → "০". */
export function formatSigned(n: number): string {
  const rounded = Math.round(n);
  return rounded > 0 ? `+${formatAmount(rounded)}` : formatAmount(rounded);
}

/** 81.6 → "৮২%". Callers handle Infinity (no plan) themselves. */
export function formatPercent(percent: number): string {
  return `${toBengaliDigits(Math.round(percent))}%`;
}

export function fromBengaliDigits(input: string): string {
  return input.replace(/[০-৯]/g, (d) => String(BENGALI_DIGITS.indexOf(d)));
}

/**
 * Parses user-typed money: ASCII or Bengali digits; commas, spaces and ৳ ignored.
 * Returns a non-negative integer; anything else (decimals, minus, letters) → 0.
 */
export function parseTaka(input: string): number {
  const cleaned = fromBengaliDigits(input).replace(/[,\s৳]/g, '');
  if (!/^\d+$/.test(cleaned)) return 0;
  const n = Number(cleaned);
  return Number.isSafeInteger(n) ? n : 0;
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
