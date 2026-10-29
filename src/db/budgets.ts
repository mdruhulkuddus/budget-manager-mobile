import type { SQLiteDatabase } from 'expo-sqlite';

import type { PlannedInput } from '../lib/calc';

export interface Budget {
  id: number;
  monthId: number;
  categoryId: number;
  plannedAmount: number;
}

export async function listByMonth(db: SQLiteDatabase, monthId: number): Promise<Budget[]> {
  return db.getAllAsync<Budget>(
    `SELECT id, month_id AS monthId, category_id AS categoryId, planned_amount AS plannedAmount
       FROM budgets WHERE month_id = ?`,
    monthId,
  );
}

export async function upsert(db: SQLiteDatabase, monthId: number, categoryId: number, amount: number): Promise<void> {
  await db.runAsync(
    `INSERT INTO budgets (month_id, category_id, planned_amount) VALUES (?, ?, ?)
     ON CONFLICT (month_id, category_id) DO UPDATE SET planned_amount = excluded.planned_amount`,
    monthId,
    categoryId,
    amount,
  );
}

/**
 * Replaces the target month's planned amounts for active categories with the source month's.
 * Budget rows of archived categories are left untouched in both months.
 * Not transactional by itself — callers pair it with incomes.copyFromMonth via months.copyPlanFromMonth.
 */
export async function copyFromMonth(db: SQLiteDatabase, fromMonthId: number, toMonthId: number): Promise<void> {
  await db.runAsync(
    `DELETE FROM budgets
      WHERE month_id = ? AND category_id IN (SELECT id FROM categories WHERE is_archived = 0)`,
    toMonthId,
  );
  await db.runAsync(
    `INSERT INTO budgets (month_id, category_id, planned_amount)
     SELECT ?, b.category_id, b.planned_amount
       FROM budgets b
       JOIN categories c ON c.id = b.category_id
      WHERE b.month_id = ? AND c.is_archived = 0
     ON CONFLICT (month_id, category_id) DO UPDATE SET planned_amount = excluded.planned_amount`,
    toMonthId,
    fromMonthId,
  );
}

/** Planned amounts for a calendar month, without creating the month row. */
export async function listByYearMonth(db: SQLiteDatabase, year: number, month: number): Promise<PlannedInput[]> {
  return db.getAllAsync<PlannedInput>(
    `SELECT b.category_id AS categoryId, b.planned_amount AS plannedAmount
       FROM budgets b JOIN months m ON m.id = b.month_id
      WHERE m.year = ? AND m.month = ?`,
    year,
    month,
  );
}
