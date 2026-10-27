import type { SQLiteDatabase } from 'expo-sqlite';

import type { SpentInput } from '../lib/calc';

export interface Expense {
  id: number;
  categoryId: number;
  amount: number;
  date: string; // 'YYYY-MM-DD'
  note: string | null;
  createdAt: string;
}

export interface ExpenseInput {
  categoryId: number;
  amount: number;
  date: string;
  note?: string | null;
}

const normalizeNote = (note: string | null | undefined): string | null => note?.trim() || null;

export async function add(db: SQLiteDatabase, input: ExpenseInput): Promise<number> {
  const result = await db.runAsync(
    'INSERT INTO expenses (category_id, amount, date, note) VALUES (?, ?, ?, ?)',
    input.categoryId,
    input.amount,
    input.date,
    normalizeNote(input.note),
  );
  return result.lastInsertRowId;
}

export async function update(db: SQLiteDatabase, id: number, input: ExpenseInput): Promise<void> {
  await db.runAsync(
    'UPDATE expenses SET category_id = ?, amount = ?, date = ?, note = ? WHERE id = ?',
    input.categoryId,
    input.amount,
    input.date,
    normalizeNote(input.note),
    id,
  );
}

export async function remove(db: SQLiteDatabase, id: number): Promise<void> {
  await db.runAsync('DELETE FROM expenses WHERE id = ?', id);
}

/** Inclusive range, newest first. */
export async function listByDateRange(db: SQLiteDatabase, from: string, to: string): Promise<Expense[]> {
  return db.getAllAsync<Expense>(
    `SELECT id, category_id AS categoryId, amount, date, note, created_at AS createdAt
       FROM expenses WHERE date BETWEEN ? AND ?
      ORDER BY date DESC, id DESC`,
    from,
    to,
  );
}

/** Inclusive range; only categories with at least one expense are returned. */
export async function sumByCategory(db: SQLiteDatabase, from: string, to: string): Promise<SpentInput[]> {
  return db.getAllAsync<SpentInput>(
    `SELECT category_id AS categoryId, SUM(amount) AS spent
       FROM expenses WHERE date BETWEEN ? AND ?
      GROUP BY category_id`,
    from,
    to,
  );
}
