import { bn } from '../i18n/bn';
import { addDays, today, yearMonthOf } from '../lib/date';
import { toBengaliDigits } from '../lib/format';

/** "আজ", "গতকাল", "২৫ অক্টোবর", or "২৫ অক্টোবর ২০২৫" for another year. */
export function dateLabel(date: string, todayDate: string = today()): string {
  if (date === todayDate) return bn.date.today;
  if (date === addDays(todayDate, -1)) return bn.date.yesterday;
  const { year, month } = yearMonthOf(date);
  const day = Number(date.slice(8, 10));
  const sameYear = year === yearMonthOf(todayDate).year;
  return `${toBengaliDigits(day)} ${bn.monthNames[month - 1]}${sameYear ? '' : ` ${toBengaliDigits(year)}`}`;
}

/** Always with the year: "২৯ অক্টোবর ২০২৬". */
export function fullDateLabel(date: string): string {
  const { year, month } = yearMonthOf(date);
  return `${toBengaliDigits(Number(date.slice(8, 10)))} ${bn.monthNames[month - 1]} ${toBengaliDigits(year)}`;
}
