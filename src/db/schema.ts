// Schema version 1 — must match the data model in CLAUDE.md.
export const SCHEMA_V1 = `
CREATE TABLE categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('expense','saving')),
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_archived INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE months (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  year INTEGER NOT NULL,
  month INTEGER NOT NULL CHECK (month BETWEEN 1 AND 12),
  UNIQUE (year, month)
);

CREATE TABLE incomes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  month_id INTEGER NOT NULL REFERENCES months(id) ON DELETE CASCADE,
  source TEXT NOT NULL,
  amount INTEGER NOT NULL CHECK (amount >= 0)
);

CREATE TABLE budgets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  month_id INTEGER NOT NULL REFERENCES months(id) ON DELETE CASCADE,
  category_id INTEGER NOT NULL REFERENCES categories(id),
  planned_amount INTEGER NOT NULL CHECK (planned_amount >= 0),
  UNIQUE (month_id, category_id)
);

CREATE TABLE expenses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  category_id INTEGER NOT NULL REFERENCES categories(id),
  amount INTEGER NOT NULL CHECK (amount > 0),
  date TEXT NOT NULL,
  note TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_expenses_date ON expenses(date);
`;

export const SEED_CATEGORIES: { name: string; type: 'expense' | 'saving' }[] = [
  { name: 'বাসা ভাড়া', type: 'expense' },
  { name: 'বাজার', type: 'expense' },
  { name: 'খাবার', type: 'expense' },
  { name: 'যাতায়াত', type: 'expense' },
  { name: 'বিল (বিদ্যুৎ/গ্যাস/পানি)', type: 'expense' },
  { name: 'মোবাইল ও ইন্টারনেট', type: 'expense' },
  { name: 'চিকিৎসা', type: 'expense' },
  { name: 'পরিবার', type: 'expense' },
  { name: 'অন্যান্য', type: 'expense' },
  { name: 'ব্যাংক জমা', type: 'saving' },
];

export const SCHEMA_V2 = `
CREATE TABLE app_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
`;

/** Latest migration version; also written into backup files. */
export const SCHEMA_VERSION = 2;
