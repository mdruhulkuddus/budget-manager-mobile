// All dates are local calendar dates as 'YYYY-MM-DD'.
// Never derive them from toISOString(): that is UTC, and Bangladesh is UTC+6,
// so between 00:00 and 06:00 local time it would return yesterday.

export interface YearMonth {
  year: number;
  month: number; // 1–12
}

export interface DateRange {
  from: string;
  to: string;
}

function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

export function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

export function daysInMonth(year: number, month: number): number {
  if (month === 2) return isLeapYear(year) ? 29 : 28;
  return [4, 6, 9, 11].includes(month) ? 30 : 31;
}

export function formatDate(year: number, month: number, day: number): string {
  return `${year}-${pad2(month)}-${pad2(day)}`;
}

/** First and last day of a calendar month, inclusive. */
export function monthRange(year: number, month: number): DateRange {
  return {
    from: formatDate(year, month, 1),
    to: formatDate(year, month, daysInMonth(year, month)),
  };
}

export function today(now: Date = new Date()): string {
  return formatDate(now.getFullYear(), now.getMonth() + 1, now.getDate());
}

export function addMonths(ym: YearMonth, delta: number): YearMonth {
  const index = ym.year * 12 + (ym.month - 1) + delta;
  return { year: Math.floor(index / 12), month: (index % 12) + 1 };
}

export function currentYearMonth(now: Date = new Date()): YearMonth {
  return { year: now.getFullYear(), month: now.getMonth() + 1 };
}
