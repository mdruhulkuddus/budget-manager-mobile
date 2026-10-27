import type { SQLiteDatabase } from 'expo-sqlite';

export interface Income {
  id: number;
  monthId: number;
  source: string;
  amount: number;
}

export async function listByMonth(db: SQLiteDatabase, monthId: number): Promise<Income[]> {
  return db.getAllAsync<Income>(
    'SELECT id, month_id AS monthId, source, amount FROM incomes WHERE month_id = ? ORDER BY id',
    monthId,
  );
}

export async function add(db: SQLiteDatabase, input: { monthId: number; source: string; amount: number }): Promise<number> {
  const result = await db.runAsync(
    'INSERT INTO incomes (month_id, source, amount) VALUES (?, ?, ?)',
    input.monthId,
    input.source,
    input.amount,
  );
  return result.lastInsertRowId;
}

export async function update(db: SQLiteDatabase, id: number, input: { source: string; amount: number }): Promise<void> {
  await db.runAsync('UPDATE incomes SET source = ?, amount = ? WHERE id = ?', input.source, input.amount, id);
}

export async function remove(db: SQLiteDatabase, id: number): Promise<void> {
  await db.runAsync('DELETE FROM incomes WHERE id = ?', id);
}
