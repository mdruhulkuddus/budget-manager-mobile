import type { SQLiteDatabase } from 'expo-sqlite';

import type { CategoryType } from '../lib/calc';
import { type CategoryUsage, isCategoryUsed, normalizeName } from '../lib/categories';

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
    normalizeName(input.name),
    input.type,
  );
  return result.lastInsertRowId;
}

export async function rename(db: SQLiteDatabase, id: number, name: string): Promise<void> {
  await db.runAsync('UPDATE categories SET name = ? WHERE id = ?', normalizeName(name), id);
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

export async function restore(db: SQLiteDatabase, id: number): Promise<void> {
  await db.runAsync('UPDATE categories SET is_archived = 0 WHERE id = ?', id);
}

export type CategoryWithUsage = Category & CategoryUsage;

/** Every category (archived included) with how often it is used, for the settings screen. */
export async function listWithUsage(db: SQLiteDatabase): Promise<CategoryWithUsage[]> {
  const rows = await db.getAllAsync<CategoryRow & CategoryUsage>(
    `SELECT c.id, c.name, c.type, c.sort_order AS sortOrder, c.is_archived AS isArchived,
       (SELECT COUNT(*) FROM expenses e WHERE e.category_id = c.id) AS expenseCount,
       (SELECT COUNT(*) FROM budgets b WHERE b.category_id = c.id AND b.planned_amount > 0) AS plannedCount
     FROM categories c
     ORDER BY c.sort_order, c.id`,
  );
  return rows.map((r) => ({ ...r, isArchived: r.isArchived === 1 }));
}

async function usageOf(db: SQLiteDatabase, id: number): Promise<CategoryUsage> {
  const row = await db.getFirstAsync<CategoryUsage>(
    `SELECT (SELECT COUNT(*) FROM expenses WHERE category_id = ?) AS expenseCount,
       (SELECT COUNT(*) FROM budgets WHERE category_id = ? AND planned_amount > 0) AS plannedCount`,
    id,
    id,
  );
  return row ?? { expenseCount: 0, plannedCount: 0 };
}

export class CategoryInUseError extends Error {
  constructor() {
    super('Category is used by expenses or budgets');
  }
}

/** Only for unused categories; throws CategoryInUseError otherwise. */
export async function setType(db: SQLiteDatabase, id: number, type: CategoryType): Promise<void> {
  await db.withExclusiveTransactionAsync(async (txn) => {
    if (isCategoryUsed(await usageOf(txn, id))) throw new CategoryInUseError();
    await txn.runAsync('UPDATE categories SET type = ? WHERE id = ?', type, id);
  });
}

/**
 * Hard delete — only for unused categories; throws CategoryInUseError otherwise.
 * Budget rows saved as 0 don't count as use, so they are removed with the category.
 */
export async function remove(db: SQLiteDatabase, id: number): Promise<void> {
  await db.withExclusiveTransactionAsync(async (txn) => {
    if (isCategoryUsed(await usageOf(txn, id))) throw new CategoryInUseError();
    await txn.runAsync('DELETE FROM budgets WHERE category_id = ?', id);
    await txn.runAsync('DELETE FROM categories WHERE id = ?', id);
  });
}
