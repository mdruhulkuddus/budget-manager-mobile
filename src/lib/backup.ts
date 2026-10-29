import { SCHEMA_VERSION } from '../db/schema';
import type { CategoryType } from './calc';
import { daysBetween, daysInMonth } from './date';

// Backup file = one JSON object holding every table, ids included, so a restore
// recreates the database exactly. Field names follow the app's camelCase row types.

export const BACKUP_APP = 'budget-mobile';

export interface BackupCategory {
  id: number;
  name: string;
  type: CategoryType;
  sortOrder: number;
  isArchived: boolean;
}

export interface BackupMonth {
  id: number;
  year: number;
  month: number;
}

export interface BackupIncome {
  id: number;
  monthId: number;
  source: string;
  amount: number;
}

export interface BackupBudget {
  id: number;
  monthId: number;
  categoryId: number;
  plannedAmount: number;
}

export interface BackupExpense {
  id: number;
  categoryId: number;
  amount: number;
  date: string;
  note: string | null;
  createdAt: string;
}

export interface BackupData {
  categories: BackupCategory[];
  months: BackupMonth[];
  incomes: BackupIncome[];
  budgets: BackupBudget[];
  expenses: BackupExpense[];
}

export interface BackupFile extends BackupData {
  app: typeof BACKUP_APP;
  schemaVersion: number;
  exportedAt: string;
}

export function backupFileName(date: string): string {
  return `budget-backup-${date}.json`;
}

export function serializeBackup(data: BackupData, exportedAt: string): string {
  const file: BackupFile = {
    app: BACKUP_APP,
    schemaVersion: SCHEMA_VERSION,
    exportedAt,
    categories: data.categories,
    months: data.months,
    incomes: data.incomes,
    budgets: data.budgets,
    expenses: data.expenses,
  };
  return JSON.stringify(file, null, 1);
}

export type BackupError =
  | { kind: 'notJson' }
  | { kind: 'wrongApp' }
  | { kind: 'newerVersion'; version: number }
  /** `table` + `index` point at the first bad row; index is null when the table itself is missing. */
  | { kind: 'invalid'; table: string; index: number | null };

export type ParseResult = { ok: true; data: BackupData; exportedAt: string } | { ok: false; error: BackupError };

type Obj = Record<string, unknown>;

const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v);
const isInt = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v);
const isId = (v: unknown): v is number => isInt(v) && v > 0;
const isText = (v: unknown): v is string => typeof v === 'string' && v.trim() !== '';

function isDate(v: unknown): v is string {
  if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
  const [y, m, d] = v.split('-').map(Number);
  return m >= 1 && m <= 12 && d >= 1 && d <= daysInMonth(y, m);
}

class Invalid extends Error {
  constructor(
    readonly table: string,
    readonly index: number | null,
  ) {
    super(`invalid ${table}[${index}]`);
  }
}

/** Checks every row of one table, returning them typed; ids must be unique. */
function rows<T extends { id: number }>(file: Obj, table: keyof BackupData, check: (r: Obj) => boolean): T[] {
  const list = file[table];
  if (!Array.isArray(list)) throw new Invalid(table, null);
  const ids = new Set<number>();
  list.forEach((r: unknown, i) => {
    if (!isObj(r) || !isId(r.id) || ids.has(r.id) || !check(r)) throw new Invalid(table, i);
    ids.add(r.id);
  });
  return list as T[];
}

/** Rejects a row whose `key` repeats an earlier row's (UNIQUE constraints). */
function unique<T>(table: string, list: T[], key: (r: T) => string): void {
  const seen = new Set<string>();
  list.forEach((r, i) => {
    const k = key(r);
    if (seen.has(k)) throw new Invalid(table, i);
    seen.add(k);
  });
}

/**
 * Parses and validates a backup file. Every rule the database enforces (types,
 * CHECKs, UNIQUEs, foreign keys) is checked here, so a valid file always restores.
 */
export function parseBackup(text: string): ParseResult {
  let file: unknown;
  try {
    file = JSON.parse(text);
  } catch {
    return { ok: false, error: { kind: 'notJson' } };
  }
  if (!isObj(file) || file.app !== BACKUP_APP) return { ok: false, error: { kind: 'wrongApp' } };
  if (!isInt(file.schemaVersion) || file.schemaVersion < 1) {
    return { ok: false, error: { kind: 'invalid', table: 'schemaVersion', index: null } };
  }
  if (file.schemaVersion > SCHEMA_VERSION) {
    return { ok: false, error: { kind: 'newerVersion', version: file.schemaVersion } };
  }
  if (typeof file.exportedAt !== 'string') return { ok: false, error: { kind: 'invalid', table: 'exportedAt', index: null } };

  try {
    const categories = rows<BackupCategory>(
      file,
      'categories',
      (r) => isText(r.name) && (r.type === 'expense' || r.type === 'saving') && isInt(r.sortOrder) && typeof r.isArchived === 'boolean',
    );
    const months = rows<BackupMonth>(file, 'months', (r) => isInt(r.year) && r.year >= 1 && isInt(r.month) && r.month >= 1 && r.month <= 12);
    unique('months', months, (m) => `${m.year}-${m.month}`);

    const monthIds = new Set(months.map((m) => m.id));
    const categoryIds = new Set(categories.map((c) => c.id));

    const incomes = rows<BackupIncome>(
      file,
      'incomes',
      (r) => monthIds.has(r.monthId as number) && isText(r.source) && isInt(r.amount) && r.amount >= 0,
    );
    const budgets = rows<BackupBudget>(
      file,
      'budgets',
      (r) =>
        monthIds.has(r.monthId as number) &&
        categoryIds.has(r.categoryId as number) &&
        isInt(r.plannedAmount) &&
        r.plannedAmount >= 0,
    );
    unique('budgets', budgets, (b) => `${b.monthId}-${b.categoryId}`);
    const expenses = rows<BackupExpense>(
      file,
      'expenses',
      (r) =>
        categoryIds.has(r.categoryId as number) &&
        isInt(r.amount) &&
        r.amount > 0 &&
        isDate(r.date) &&
        (r.note === null || typeof r.note === 'string') &&
        isText(r.createdAt),
    );

    // Copy only the known fields, so stray keys in the file never reach the database.
    return {
      ok: true,
      exportedAt: file.exportedAt,
      data: {
        categories: categories.map(({ id, name, type, sortOrder, isArchived }) => ({ id, name, type, sortOrder, isArchived })),
        months: months.map(({ id, year, month }) => ({ id, year, month })),
        incomes: incomes.map(({ id, monthId, source, amount }) => ({ id, monthId, source, amount })),
        budgets: budgets.map(({ id, monthId, categoryId, plannedAmount }) => ({ id, monthId, categoryId, plannedAmount })),
        expenses: expenses.map(({ id, categoryId, amount, date, note, createdAt }) => ({ id, categoryId, amount, date, note, createdAt })),
      },
    };
  } catch (e) {
    if (e instanceof Invalid) return { ok: false, error: { kind: 'invalid', table: e.table, index: e.index } };
    throw e;
  }
}

export type BackupStatus = { kind: 'never' } | { kind: 'done'; date: string; stale: boolean };

export const BACKUP_STALE_DAYS = 30;

/** From the stored `last_backup_at` (a local timestamp). Stale = older than 30 days. */
export function backupStatus(lastBackupAt: string | null, todayDate: string): BackupStatus {
  if (!lastBackupAt) return { kind: 'never' };
  const date = lastBackupAt.slice(0, 10);
  return { kind: 'done', date, stale: daysBetween(date, todayDate) > BACKUP_STALE_DAYS };
}
