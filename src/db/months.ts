import type { SQLiteDatabase } from 'expo-sqlite';

export interface Month {
  id: number;
  year: number;
  month: number;
}

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

/** The most recent month row before `monthId` (not necessarily the previous calendar month). */
export async function getPrevious(db: SQLiteDatabase, monthId: number): Promise<Month | null> {
  return db.getFirstAsync<Month>(
    `SELECT p.id, p.year, p.month
       FROM months p, months c
      WHERE c.id = ?
        AND (p.year * 12 + p.month) < (c.year * 12 + c.month)
      ORDER BY p.year DESC, p.month DESC
      LIMIT 1`,
    monthId,
  );
}
