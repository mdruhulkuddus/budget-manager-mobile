import type { SQLiteDatabase } from 'expo-sqlite';

import { type MonthSummary, monthVerdict, type ReportRow, reportRows, type Verdict } from '../lib/calc';
import { currentYearMonth } from '../lib/date';
import { loadMonthData } from './dashboard';
import type { Expense } from './expenses';
import type { Income } from './incomes';
import * as months from './months';

export interface MonthReport {
  month: months.Month;
  isCurrentMonth: boolean;
  summary: MonthSummary;
  verdict: Verdict;
  /** Sorted by spent desc; `share` = % of total expense. */
  expenseRows: ReportRow[];
  /** Sorted by spent desc; `share` = % of total saving. */
  savingRows: ReportRow[];
  incomes: Income[];
  /** All of the month's expenses, newest first. */
  expenses: Expense[];
  categoryNames: Map<number, string>;
}

/** null if the month row doesn't exist. */
export async function getMonthReport(db: SQLiteDatabase, monthId: number): Promise<MonthReport | null> {
  const m = await months.getById(db, monthId);
  if (!m) return null;
  const data = await loadMonthData(db, m);
  const now = currentYearMonth();
  return {
    month: m,
    isCurrentMonth: m.year === now.year && m.month === now.month,
    summary: data.summary,
    verdict: monthVerdict(data.summary),
    expenseRows: reportRows(data.summary.expenseRows),
    savingRows: reportRows(data.summary.savingRows),
    incomes: data.incomes,
    expenses: data.expenses,
    categoryNames: data.categoryNames,
  };
}
