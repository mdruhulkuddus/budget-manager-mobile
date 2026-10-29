import { SCHEMA_VERSION } from '../src/db/schema';
import { backupFileName, type BackupData, backupStatus, parseBackup, serializeBackup } from '../src/lib/backup';

const sample = (): BackupData => ({
  categories: [
    { id: 1, name: 'বাজার', type: 'expense', sortOrder: 0, isArchived: false },
    { id: 2, name: 'পুরনো খাত', type: 'expense', sortOrder: 1, isArchived: true },
    { id: 5, name: 'ব্যাংক জমা', type: 'saving', sortOrder: 2, isArchived: false },
  ],
  months: [
    { id: 1, year: 2026, month: 9 },
    { id: 3, year: 2026, month: 10 },
  ],
  incomes: [{ id: 7, monthId: 3, source: 'স্যালারি', amount: 50000 }],
  budgets: [
    { id: 1, monthId: 3, categoryId: 1, plannedAmount: 8000 },
    { id: 2, monthId: 3, categoryId: 5, plannedAmount: 0 },
  ],
  expenses: [
    { id: 10, categoryId: 1, amount: 450, date: '2026-10-29', note: null, createdAt: '2026-10-29 03:15:00' },
    { id: 11, categoryId: 2, amount: 1200, date: '2026-09-30', note: 'ওষুধ', createdAt: '2026-09-30 10:00:00' },
  ],
});

/** A serialized sample with one change applied to the parsed JSON. */
function tampered(change: (file: Record<string, any>) => void): string {
  const file = JSON.parse(serializeBackup(sample(), '2026-10-29T21:00:00+06:00'));
  change(file);
  return JSON.stringify(file);
}

describe('backup round trip', () => {
  it('export → import gives identical data', () => {
    const result = parseBackup(serializeBackup(sample(), '2026-10-29T21:00:00+06:00'));
    expect(result).toEqual({ ok: true, data: sample(), exportedAt: '2026-10-29T21:00:00+06:00' });
  });

  it('writes the app marker and current schema version', () => {
    const file = JSON.parse(serializeBackup(sample(), 'x'));
    expect(file.app).toBe('budget-mobile');
    expect(file.schemaVersion).toBe(SCHEMA_VERSION);
  });

  it('an empty database round-trips too', () => {
    const empty: BackupData = { categories: [], months: [], incomes: [], budgets: [], expenses: [] };
    expect(parseBackup(serializeBackup(empty, 'x'))).toMatchObject({ ok: true, data: empty });
  });

  it('drops unknown fields instead of passing them on', () => {
    const result = parseBackup(tampered((f) => (f.expenses[0].extra = 'x')));
    expect(result.ok && result.data.expenses[0]).toEqual(sample().expenses[0]);
  });
});

describe('parseBackup rejects', () => {
  it('a file that is not JSON', () => {
    expect(parseBackup('not json {')).toEqual({ ok: false, error: { kind: 'notJson' } });
  });

  it('JSON from another app', () => {
    expect(parseBackup(tampered((f) => (f.app = 'other')))).toEqual({ ok: false, error: { kind: 'wrongApp' } });
    expect(parseBackup('[1,2]')).toEqual({ ok: false, error: { kind: 'wrongApp' } });
  });

  it('a newer schema version', () => {
    expect(parseBackup(tampered((f) => (f.schemaVersion = SCHEMA_VERSION + 1)))).toEqual({
      ok: false,
      error: { kind: 'newerVersion', version: SCHEMA_VERSION + 1 },
    });
  });

  it('accepts an older schema version', () => {
    expect(parseBackup(tampered((f) => (f.schemaVersion = 1))).ok).toBe(true);
  });

  it('a missing table', () => {
    expect(parseBackup(tampered((f) => delete f.budgets))).toEqual({
      ok: false,
      error: { kind: 'invalid', table: 'budgets', index: null },
    });
  });

  const invalidRows: [string, string, number, (f: Record<string, any>) => void][] = [
    ['amount as a string', 'expenses', 0, (f) => (f.expenses[0].amount = '450')],
    ['a zero expense amount', 'expenses', 0, (f) => (f.expenses[0].amount = 0)],
    ['a decimal amount', 'incomes', 0, (f) => (f.incomes[0].amount = 10.5)],
    ['an impossible date', 'expenses', 1, (f) => (f.expenses[1].date = '2026-09-31')],
    ['a note that is a number', 'expenses', 0, (f) => (f.expenses[0].note = 5)],
    ['an unknown category type', 'categories', 0, (f) => (f.categories[0].type = 'other')],
    ['isArchived as 0/1', 'categories', 0, (f) => (f.categories[0].isArchived = 0)],
    ['an empty category name', 'categories', 1, (f) => (f.categories[1].name = '  ')],
    ['month 13', 'months', 0, (f) => (f.months[0].month = 13)],
    ['a duplicate id', 'months', 1, (f) => (f.months[1].id = 1)],
    ['a duplicate year+month', 'months', 1, (f) => (f.months[1].month = 9)],
    ['a duplicate budget for one month+category', 'budgets', 1, (f) => (f.budgets[1].categoryId = 1)],
    ['an expense in a missing category', 'expenses', 0, (f) => (f.expenses[0].categoryId = 99)],
    ['an income in a missing month', 'incomes', 0, (f) => (f.incomes[0].monthId = 99)],
    ['a negative planned amount', 'budgets', 0, (f) => (f.budgets[0].plannedAmount = -1)],
  ];

  it.each(invalidRows)('%s', (_label, table, index, change) => {
    expect(parseBackup(tampered(change))).toEqual({ ok: false, error: { kind: 'invalid', table, index } });
  });
});

describe('backupFileName', () => {
  it('uses the local date', () => {
    expect(backupFileName('2026-10-29')).toBe('budget-backup-2026-10-29.json');
  });
});

describe('backupStatus', () => {
  it('never backed up', () => {
    expect(backupStatus(null, '2026-10-29')).toEqual({ kind: 'never' });
  });

  it('uses the local date part of the stored timestamp', () => {
    expect(backupStatus('2026-10-29T00:30:00+06:00', '2026-10-29')).toEqual({ kind: 'done', date: '2026-10-29', stale: false });
  });

  it('is stale only when older than 30 days', () => {
    expect(backupStatus('2026-09-29T10:00:00+06:00', '2026-10-29')).toMatchObject({ stale: false }); // exactly 30
    expect(backupStatus('2026-09-28T10:00:00+06:00', '2026-10-29')).toMatchObject({ stale: true }); // 31
  });
});
