import type { SQLiteDatabase } from 'expo-sqlite';

import { readAll, replaceAll } from '../src/db/backup';
import * as budgets from '../src/db/budgets';
import * as categories from '../src/db/categories';
import * as expenses from '../src/db/expenses';
import * as incomes from '../src/db/incomes';
import { migrate } from '../src/db/migrations';
import * as months from '../src/db/months';
import { SCHEMA_VERSION, SEED_CATEGORIES } from '../src/db/schema';
import * as settings from '../src/db/settings';
import { parseBackup, serializeBackup } from '../src/lib/backup';
import { describeDb, openTestDb } from './helpers/nodeDb';

const userVersion = async (db: SQLiteDatabase) =>
  (await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version'))!.user_version;

/** A month with income, a plan, expenses (one with a note) and an archived category. */
async function fillSampleData(db: SQLiteDatabase) {
  const [bazar, food] = await categories.listActive(db);
  const oct = await months.getOrCreate(db, 2026, 10);
  await months.getOrCreate(db, 2026, 9);
  await incomes.add(db, { monthId: oct.id, source: 'স্যালারি', amount: 50000 });
  await budgets.upsert(db, oct.id, bazar.id, 8000);
  await expenses.add(db, { categoryId: bazar.id, amount: 450, date: '2026-10-29', note: 'সবজি' });
  await expenses.add(db, { categoryId: food.id, amount: 120, date: '2026-09-30' });
  await categories.archive(db, food.id);
  return { bazar, food, oct };
}

describeDb('migrations', () => {
  it('a fresh database ends at the latest version with seeded categories', async () => {
    const db = await openTestDb();
    expect(await userVersion(db)).toBe(SCHEMA_VERSION);
    expect((await categories.listAll(db)).map((c) => c.name)).toEqual(SEED_CATEGORIES.map((c) => c.name));
  });

  it('v1 → v2 keeps all existing data and adds app_settings', async () => {
    const db = await openTestDb(1);
    expect(await userVersion(db)).toBe(1);
    await fillSampleData(db);
    const before = await readAll(db);

    await migrate(db);

    expect(await userVersion(db)).toBe(2);
    expect(await readAll(db)).toEqual(before);
    expect(await settings.get(db, 'last_backup_at')).toBeNull();
    await settings.set(db, 'last_backup_at', '2026-10-29T21:00:00+06:00');
    await settings.set(db, 'last_backup_at', '2026-10-30T08:00:00+06:00');
    expect(await settings.get(db, 'last_backup_at')).toBe('2026-10-30T08:00:00+06:00');
  });

  it('running migrate again changes nothing', async () => {
    const db = await openTestDb();
    await fillSampleData(db);
    const before = await readAll(db);
    await migrate(db);
    expect(await readAll(db)).toEqual(before);
  });
});

describeDb('categories: the "is used" rule', () => {
  const usage = async (db: SQLiteDatabase, id: number) => {
    const c = (await categories.listWithUsage(db)).find((x) => x.id === id)!;
    return { expenseCount: c.expenseCount, plannedCount: c.plannedCount };
  };

  it('counts expenses and planned amounts > 0, not budget rows saved as 0', async () => {
    const db = await openTestDb();
    const [a, b, c] = await categories.listActive(db);
    const oct = await months.getOrCreate(db, 2026, 10);
    await expenses.add(db, { categoryId: a.id, amount: 100, date: '2026-10-01' });
    await budgets.upsert(db, oct.id, b.id, 500);
    await budgets.upsert(db, oct.id, c.id, 0);

    expect(await usage(db, a.id)).toEqual({ expenseCount: 1, plannedCount: 0 });
    expect(await usage(db, b.id)).toEqual({ expenseCount: 0, plannedCount: 1 });
    expect(await usage(db, c.id)).toEqual({ expenseCount: 0, plannedCount: 0 });
  });

  it('remove refuses a used category and leaves it in place', async () => {
    const db = await openTestDb();
    const [a] = await categories.listActive(db);
    await expenses.add(db, { categoryId: a.id, amount: 100, date: '2026-10-01' });
    await expect(categories.remove(db, a.id)).rejects.toBeInstanceOf(categories.CategoryInUseError);
    expect((await categories.listAll(db)).some((c) => c.id === a.id)).toBe(true);
  });

  it('remove deletes an unused category together with its 0-amount budget rows', async () => {
    const db = await openTestDb();
    const id = await categories.create(db, { name: ' শিক্ষা ', type: 'expense' });
    const oct = await months.getOrCreate(db, 2026, 10);
    await budgets.upsert(db, oct.id, id, 0);
    await categories.remove(db, id);
    expect((await categories.listAll(db)).some((c) => c.id === id)).toBe(false);
    expect((await budgets.listByMonth(db, oct.id)).some((x) => x.categoryId === id)).toBe(false);
  });

  it('setType works only while unused', async () => {
    const db = await openTestDb();
    const id = await categories.create(db, { name: 'শিক্ষা', type: 'expense' });
    await categories.setType(db, id, 'saving');
    expect((await categories.listAll(db)).find((c) => c.id === id)!.type).toBe('saving');

    const oct = await months.getOrCreate(db, 2026, 10);
    await budgets.upsert(db, oct.id, id, 1000);
    await expect(categories.setType(db, id, 'expense')).rejects.toBeInstanceOf(categories.CategoryInUseError);
  });

  it('create stores the normalized name at the end of the order; archive and restore toggle', async () => {
    const db = await openTestDb();
    const id = await categories.create(db, { name: '  শিক্ষা   খরচ ', type: 'expense' });
    const all = await categories.listAll(db);
    expect(all[all.length - 1]).toMatchObject({ id, name: 'শিক্ষা খরচ', isArchived: false });

    await categories.archive(db, id);
    expect((await categories.listActive(db)).some((c) => c.id === id)).toBe(false);
    await categories.restore(db, id);
    expect((await categories.listActive(db)).some((c) => c.id === id)).toBe(true);
  });
});

describeDb('backup restore', () => {
  it('export → import into another database recreates it exactly', async () => {
    const source = await openTestDb();
    await fillSampleData(source);
    const exported = await readAll(source);

    const target = await openTestDb();
    await expenses.add(target, { categoryId: 1, amount: 999, date: '2026-10-29' });
    const parsed = parseBackup(serializeBackup(exported, '2026-10-29T21:00:00+06:00'));
    if (!parsed.ok) throw new Error('backup did not parse');
    await replaceAll(target, parsed.data);

    expect(await readAll(target)).toEqual(exported);
  });

  it('an expense added after the backup is gone after importing it', async () => {
    const db = await openTestDb();
    const { bazar } = await fillSampleData(db);
    const backup = await readAll(db);
    await expenses.add(db, { categoryId: bazar.id, amount: 5, date: '2026-10-29', note: 'test' });

    await replaceAll(db, backup);

    expect(await readAll(db)).toEqual(backup);
  });

  it('a failing restore rolls back and leaves the data unchanged', async () => {
    const db = await openTestDb();
    await fillSampleData(db);
    const before = await readAll(db);
    // Bypasses parseBackup on purpose: an expense pointing at a missing category breaks the foreign key.
    const broken = { ...before, expenses: [{ ...before.expenses[0], categoryId: 999 }] };

    await expect(replaceAll(db, broken)).rejects.toThrow();
    expect(await readAll(db)).toEqual(before);
  });

  it('new rows after a restore get fresh ids', async () => {
    const db = await openTestDb();
    await fillSampleData(db);
    await replaceAll(db, await readAll(db));
    const id = await categories.create(db, { name: 'শিক্ষা', type: 'expense' });
    expect(id).toBeGreaterThan(SEED_CATEGORIES.length);
  });
});
