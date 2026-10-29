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

/** Local calendar date of a Date object. */
export function toLocalDate(d: Date): string {
  return formatDate(d.getFullYear(), d.getMonth() + 1, d.getDate());
}

/** 'YYYY-MM-DD' → Date at local midnight. */
export function parseLocalDate(date: string): Date {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function today(now: Date = new Date()): string {
  return toLocalDate(now);
}

/** Days after `date` until the end of its month; 0 on the last day. */
export function daysLeftInMonth(date: string): number {
  const { year, month } = yearMonthOf(date);
  return daysInMonth(year, month) - Number(date.slice(8, 10));
}

export function addDays(date: string, delta: number): string {
  const d = parseLocalDate(date);
  d.setDate(d.getDate() + delta);
  return toLocalDate(d);
}

export function yearMonthOf(date: string): YearMonth {
  const [year, month] = date.split('-').map(Number);
  return { year, month };
}

export function isSameMonth(a: string, b: string): boolean {
  return a.slice(0, 7) === b.slice(0, 7);
}

/** Groups consecutive items by `date`, keeping input order (pass items already sorted). */
export function groupByDate<T extends { date: string }>(items: T[]): { date: string; items: T[] }[] {
  const groups: { date: string; items: T[] }[] = [];
  for (const item of items) {
    const last = groups[groups.length - 1];
    if (last && last.date === item.date) last.items.push(item);
    else groups.push({ date: item.date, items: [item] });
  }
  return groups;
}

export function addMonths(ym: YearMonth, delta: number): YearMonth {
  const index = ym.year * 12 + (ym.month - 1) + delta;
  return { year: Math.floor(index / 12), month: (index % 12) + 1 };
}

export function currentYearMonth(now: Date = new Date()): YearMonth {
  return { year: now.getFullYear(), month: now.getMonth() + 1 };
}

/** Whole days from `from` to `to` (both 'YYYY-MM-DD'); negative if `to` is earlier. */
export function daysBetween(from: string, to: string): number {
  return Math.round((parseLocalDate(to).getTime() - parseLocalDate(from).getTime()) / 86_400_000);
}

/** Local time with its UTC offset, e.g. '2026-10-29T21:15:04+06:00'. Its first 10 chars are the local date. */
export function localTimestamp(now: Date = new Date()): string {
  const offset = -now.getTimezoneOffset();
  const sign = offset >= 0 ? '+' : '-';
  const abs = Math.abs(offset);
  const time = `${pad2(now.getHours())}:${pad2(now.getMinutes())}:${pad2(now.getSeconds())}`;
  return `${toLocalDate(now)}T${time}${sign}${pad2(Math.floor(abs / 60))}:${pad2(abs % 60)}`;
}
