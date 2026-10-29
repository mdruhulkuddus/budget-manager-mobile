import type { SQLiteDatabase } from 'expo-sqlite';

import type { MonthTotals } from '../lib/calc';
import * as budgets from './budgets';
import * as incomes from './incomes';

export interface Month {
  id: number;
  year: number;
  month: number;
}

// A month "has a plan" if it has any income or any non-zero planned amount.
// Opening a month creates an empty row, so row existence alone means nothing.
const HAS_PLAN = (alias: string) => `(
  EXISTS (SELECT 1 FROM incomes i WHERE i.month_id = ${alias}.id)
  OR EXISTS (SELECT 1 FROM budgets b WHERE b.month_id = ${alias}.id AND b.planned_amount > 0)
)`;

export async function getOrCreate(db: SQLiteDatabase, year: number, month: number): Promise<Month> {
  await db.runAsync('INSERT OR IGNORE INTO months (year, month) VALUES (?, ?)', year, month);
  const row = await db.getFirstAsync<Month>('SELECT id, year, month FROM months WHERE year = ? AND month = ?', year, month);
  if (!row) throw new Error(`Month ${year}-${month} missing after insert`);
  return row;
}

export async function getById(db: SQLiteDatabase, id: number): Promise<Month | null> {
  return db.getFirstAsync<Month>('SELECT id, year, month FROM months WHERE id = ?', id);
}

/** Newest first. */
export async function list(db: SQLiteDatabase): Promise<Month[]> {
  return db.getAllAsync<Month>('SELECT id, year, month FROM months ORDER BY year DESC, month DESC');
}

/**
 * Every month row with its totals, newest first, in one query: each table is aggregated
 * once and joined. Empty months are included — filter them with calc.buildMonthList.
 * Archived categories count, matching the dashboard and report totals.
 */
export async function listWithTotals(db: SQLiteDatabase): Promise<MonthTotals[]> {
  return db.getAllAsync<MonthTotals>(
    `WITH
       spent AS (
         SELECT substr(e.date, 1, 7) AS ym,
                SUM(CASE WHEN c.type = 'expense' THEN e.amount ELSE 0 END) AS spentExpense,
                SUM(CASE WHEN c.type = 'saving' THEN e.amount ELSE 0 END) AS spentSaving,
                COUNT(*) AS expenseCount
           FROM expenses e JOIN categories c ON c.id = e.category_id
          GROUP BY ym
       ),
       planned AS (
         SELECT b.month_id,
                SUM(CASE WHEN c.type = 'expense' THEN b.planned_amount ELSE 0 END) AS plannedExpense,
                SUM(b.planned_amount) AS plannedTotal
           FROM budgets b JOIN categories c ON c.id = b.category_id
          GROUP BY b.month_id
       ),
       inc AS (SELECT month_id, COUNT(*) AS incomeCount FROM incomes GROUP BY month_id)
     SELECT m.id, m.year, m.month,
            COALESCE(p.plannedExpense, 0) AS plannedExpense,
            COALESCE(p.plannedTotal, 0) AS plannedTotal,
            COALESCE(s.spentExpense, 0) AS spentExpense,
            COALESCE(s.spentSaving, 0) AS spentSaving,
            COALESCE(i.incomeCount, 0) AS incomeCount,
            COALESCE(s.expenseCount, 0) AS expenseCount
       FROM months m
       LEFT JOIN planned p ON p.month_id = m.id
       LEFT JOIN inc i ON i.month_id = m.id
       LEFT JOIN spent s ON s.ym = printf('%04d-%02d', m.year, m.month)
      ORDER BY m.year DESC, m.month DESC`,
  );
}

/**
 * The most recent month before `monthId` that has a plan — the source for "copy from last month".
 * Skips empty months (e.g. ones only browsed in the month switcher).
 */
export async function getPreviousWithPlan(db: SQLiteDatabase, monthId: number): Promise<Month | null> {
  return db.getFirstAsync<Month>(
    `SELECT p.id, p.year, p.month
       FROM months p, months c
      WHERE c.id = ?
        AND (p.year * 12 + p.month) < (c.year * 12 + c.month)
        AND ${HAS_PLAN('p')}
      ORDER BY p.year DESC, p.month DESC
      LIMIT 1`,
    monthId,
  );
}

export async function hasPlan(db: SQLiteDatabase, monthId: number): Promise<boolean> {
  const row = await db.getFirstAsync<{ yes: number }>(`SELECT ${HAS_PLAN('m')} AS yes FROM months m WHERE m.id = ?`, monthId);
  return row?.yes === 1;
}

/** Replaces the target month's budgets and incomes with the source month's, atomically. */
export async function copyPlanFromMonth(db: SQLiteDatabase, fromMonthId: number, toMonthId: number): Promise<void> {
  await db.withExclusiveTransactionAsync(async (txn) => {
    await budgets.copyFromMonth(txn, fromMonthId, toMonthId);
    await incomes.copyFromMonth(txn, fromMonthId, toMonthId);
  });
}
