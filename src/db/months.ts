import type { SQLiteDatabase } from 'expo-sqlite';

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

/** Newest first. */
export async function list(db: SQLiteDatabase): Promise<Month[]> {
  return db.getAllAsync<Month>('SELECT id, year, month FROM months ORDER BY year DESC, month DESC');
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
