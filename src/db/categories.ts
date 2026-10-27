import type { SQLiteDatabase } from 'expo-sqlite';

import type { CategoryType } from '../lib/calc';

export interface Category {
  id: number;
  name: string;
  type: CategoryType;
  sortOrder: number;
  isArchived: boolean;
}

interface CategoryRow {
  id: number;
  name: string;
  type: CategoryType;
  sortOrder: number;
  isArchived: number;
}

const SELECT = 'SELECT id, name, type, sort_order AS sortOrder, is_archived AS isArchived FROM categories';

const toCategory = (r: CategoryRow): Category => ({ ...r, isArchived: r.isArchived === 1 });

export async function listActive(db: SQLiteDatabase): Promise<Category[]> {
  const rows = await db.getAllAsync<CategoryRow>(`${SELECT} WHERE is_archived = 0 ORDER BY sort_order, id`);
  return rows.map(toCategory);
}

/** Includes archived categories — needed to label old expenses and month reports. */
export async function listAll(db: SQLiteDatabase): Promise<Category[]> {
  const rows = await db.getAllAsync<CategoryRow>(`${SELECT} ORDER BY sort_order, id`);
  return rows.map(toCategory);
}

export async function create(db: SQLiteDatabase, input: { name: string; type: CategoryType }): Promise<number> {
  const result = await db.runAsync(
    'INSERT INTO categories (name, type, sort_order) VALUES (?, ?, (SELECT COALESCE(MAX(sort_order), -1) + 1 FROM categories))',
    input.name,
    input.type,
  );
  return result.lastInsertRowId;
}

export async function rename(db: SQLiteDatabase, id: number, name: string): Promise<void> {
  await db.runAsync('UPDATE categories SET name = ? WHERE id = ?', name, id);
}

/** Sets sort_order to each id's position in `orderedIds`. */
export async function reorder(db: SQLiteDatabase, orderedIds: number[]): Promise<void> {
  await db.withExclusiveTransactionAsync(async (txn) => {
    for (const [i, id] of orderedIds.entries()) {
      await txn.runAsync('UPDATE categories SET sort_order = ? WHERE id = ?', i, id);
    }
  });
}

export async function archive(db: SQLiteDatabase, id: number): Promise<void> {
  await db.runAsync('UPDATE categories SET is_archived = 1 WHERE id = ?', id);
}
