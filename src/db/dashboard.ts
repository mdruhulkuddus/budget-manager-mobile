import type { SQLiteDatabase } from 'expo-sqlite';

import { buildMonthSummary, type MonthSummary } from '../lib/calc';
import { monthRange } from '../lib/date';
import * as budgets from './budgets';
import * as categories from './categories';
import * as expenses from './expenses';
import * as incomes from './incomes';
import * as months from './months';

export interface DashboardData {
  month: months.Month;
  summary: MonthSummary;
  /** This month's latest expenses, newest first. */
  recent: expenses.Expense[];
  /** All categories (archived included), for labelling expenses. */
  categoryNames: Map<number, string>;
}

/** Everything the dashboard shows for one month, in a fixed number of queries (none per row). */
export async function getMonthSummary(
  db: SQLiteDatabase,
  year: number,
  month: number,
  recentLimit = 5,
): Promise<DashboardData> {
  const m = await months.getOrCreate(db, year, month);
  const { from, to } = monthRange(year, month);
  const [cats, monthBudgets, monthIncomes, spent, recent] = await Promise.all([
    // All, not just active: spending in a since-archived category must still count.
    categories.listAll(db),
    budgets.listByMonth(db, m.id),
    incomes.listByMonth(db, m.id),
    expenses.sumByCategory(db, from, to),
    expenses.listByDateRange(db, from, to, recentLimit),
  ]);
  return {
    month: m,
    summary: buildMonthSummary({ categories: cats, budgets: monthBudgets, spent, incomes: monthIncomes }),
    recent,
    categoryNames: new Map(cats.map((c) => [c.id, c.name])),
  };
}
