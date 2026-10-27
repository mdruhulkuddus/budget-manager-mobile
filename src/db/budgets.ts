import type { SQLiteDatabase } from 'expo-sqlite';

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
 * Copies planned amounts of active categories from one month to another,
 * overwriting the target's values for those categories.
 */
export async function copyFromMonth(db: SQLiteDatabase, fromMonthId: number, toMonthId: number): Promise<void> {
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
