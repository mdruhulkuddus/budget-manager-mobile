import type { SQLiteDatabase } from 'expo-sqlite';

import { buildMonthSummary, type MonthSummary } from '../lib/calc';
import { monthRange } from '../lib/date';
import * as budgets from './budgets';
import * as categories from './categories';
import * as expenses from './expenses';
import * as incomes from './incomes';
import * as months from './months';

export interface MonthData {
  month: months.Month;
  summary: MonthSummary;
  /** The month's expenses, newest first (possibly limited). */
  expenses: expenses.Expense[];
  incomes: incomes.Income[];
  /** All categories (archived included), for labelling expenses. */
  categoryNames: Map<number, string>;
}

export interface DashboardData {
  month: months.Month;
  summary: MonthSummary;
  /** This month's latest expenses, newest first. */
  recent: expenses.Expense[];
  categoryNames: Map<number, string>;
}

/**
 * Shared by the dashboard and the month report, so both always show the same numbers.
 * Fixed number of queries, none per row.
 */
export async function loadMonthData(db: SQLiteDatabase, m: months.Month, expenseLimit?: number): Promise<MonthData> {
  const { from, to } = monthRange(m.year, m.month);
  const [cats, monthBudgets, monthIncomes, spent, monthExpenses] = await Promise.all([
    // All, not just active: spending in a since-archived category must still count.
    categories.listAll(db),
    budgets.listByMonth(db, m.id),
    incomes.listByMonth(db, m.id),
    expenses.sumByCategory(db, from, to),
    expenses.listByDateRange(db, from, to, expenseLimit),
  ]);
  return {
    month: m,
    summary: buildMonthSummary({ categories: cats, budgets: monthBudgets, spent, incomes: monthIncomes }),
    expenses: monthExpenses,
    incomes: monthIncomes,
    categoryNames: new Map(cats.map((c) => [c.id, c.name])),
  };
}

/** Everything the dashboard shows for one month. */
export async function getMonthSummary(
  db: SQLiteDatabase,
  year: number,
  month: number,
  recentLimit = 5,
): Promise<DashboardData> {
  const m = await months.getOrCreate(db, year, month);
  const { summary, expenses: recent, categoryNames } = await loadMonthData(db, m, recentLimit);
  return { month: m, summary, recent, categoryNames };
}
