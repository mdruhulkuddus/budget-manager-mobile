import type { SQLiteDatabase } from 'expo-sqlite';

import type { BackupCategory, BackupData } from '../lib/backup';

/** Every row of every data table, ids included. `app_settings` is device state and is not part of a backup. */
export async function readAll(db: SQLiteDatabase): Promise<BackupData> {
  const [categories, months, incomes, budgets, expenses] = await Promise.all([
    db.getAllAsync<Omit<BackupCategory, 'isArchived'> & { isArchived: number }>(
      'SELECT id, name, type, sort_order AS sortOrder, is_archived AS isArchived FROM categories ORDER BY id',
    ),
    db.getAllAsync<BackupData['months'][number]>('SELECT id, year, month FROM months ORDER BY id'),
    db.getAllAsync<BackupData['incomes'][number]>('SELECT id, month_id AS monthId, source, amount FROM incomes ORDER BY id'),
    db.getAllAsync<BackupData['budgets'][number]>(
      'SELECT id, month_id AS monthId, category_id AS categoryId, planned_amount AS plannedAmount FROM budgets ORDER BY id',
    ),
    db.getAllAsync<BackupData['expenses'][number]>(
      'SELECT id, category_id AS categoryId, amount, date, note, created_at AS createdAt FROM expenses ORDER BY id',
    ),
  ]);
  return {
    categories: categories.map((c) => ({ ...c, isArchived: c.isArchived === 1 })),
    months,
    incomes,
    budgets,
    expenses,
  };
}

/**
 * Replaces all data with `data` (already validated by `parseBackup`), keeping the original ids.
 * One exclusive transaction: if any statement fails, nothing changes.
 */
export async function replaceAll(db: SQLiteDatabase, data: BackupData): Promise<void> {
  await db.withExclusiveTransactionAsync(async (txn) => {
    // Children first, so foreign keys hold at every step.
    await txn.execAsync('DELETE FROM expenses; DELETE FROM budgets; DELETE FROM incomes; DELETE FROM months; DELETE FROM categories;');

    for (const c of data.categories) {
      await txn.runAsync(
        'INSERT INTO categories (id, name, type, sort_order, is_archived) VALUES (?, ?, ?, ?, ?)',
        c.id,
        c.name,
        c.type,
        c.sortOrder,
        c.isArchived ? 1 : 0,
      );
    }
    for (const m of data.months) {
      await txn.runAsync('INSERT INTO months (id, year, month) VALUES (?, ?, ?)', m.id, m.year, m.month);
    }
    for (const i of data.incomes) {
      await txn.runAsync('INSERT INTO incomes (id, month_id, source, amount) VALUES (?, ?, ?, ?)', i.id, i.monthId, i.source, i.amount);
    }
    for (const b of data.budgets) {
      await txn.runAsync(
        'INSERT INTO budgets (id, month_id, category_id, planned_amount) VALUES (?, ?, ?, ?)',
        b.id,
        b.monthId,
        b.categoryId,
        b.plannedAmount,
      );
    }
    for (const e of data.expenses) {
      await txn.runAsync(
        'INSERT INTO expenses (id, category_id, amount, date, note, created_at) VALUES (?, ?, ?, ?, ?, ?)',
        e.id,
        e.categoryId,
        e.amount,
        e.date,
        e.note,
        e.createdAt,
      );
    }
  });
}
