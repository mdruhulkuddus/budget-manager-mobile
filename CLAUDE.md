# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

# Budget Mobile — Project Context

Personal, offline-only Android app for monthly budget planning and expense tracking.
Single user (the owner), runs on his own phone (Xiaomi Redmi Note 11). No backend, no login, no sync.

## Goal

Answer one question at a glance: **"How much did I spend this month, and in which category?"**
Keep it minimal. Do not add features that are not listed here.

## Core flow

1. **Start of month** — set income and a planned amount per category (budget plan).
2. **Every day** — add expenses: amount + category + date (+ optional note).
3. **Anytime** — dashboard shows spent vs planned, per category and overall.
4. **End of month** — open the month from the month list and view its report.

"Actual" is never typed in by hand. It is always the sum of expense entries.

## Tech stack

- Expo (latest SDK) + React Native + TypeScript (strict)
- expo-router (file-based routing, bottom tabs)
- expo-sqlite (async API, `SQLiteProvider` + `useSQLiteContext`)
- Plain `StyleSheet` — no UI library, no chart library
- Jest (`jest-expo`) for unit tests of pure logic
- Build: EAS Build, `preview` profile → installable APK

Do NOT add: Redux/Zustand, TanStack Query, UI kits, chart libs, ORMs, auth, network calls.
Ask before adding any dependency not listed above.

## Commands

- `npx expo start` — dev server (open in Expo Go / dev build on the phone)
- `npx tsc --noEmit` — type-check
- `npx jest` — all tests; `npx jest __tests__/calc.test.ts` — one file; `npx jest -t "remaining"` — by test name
- `eas build -p android --profile preview` — installable APK

## Data model (SQLite)

```sql
categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('expense','saving')),
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_archived INTEGER NOT NULL DEFAULT 0
)

months (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  year INTEGER NOT NULL,
  month INTEGER NOT NULL CHECK (month BETWEEN 1 AND 12),
  UNIQUE (year, month)
)

incomes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  month_id INTEGER NOT NULL REFERENCES months(id) ON DELETE CASCADE,
  source TEXT NOT NULL,
  amount INTEGER NOT NULL CHECK (amount >= 0)
)

budgets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  month_id INTEGER NOT NULL REFERENCES months(id) ON DELETE CASCADE,
  category_id INTEGER NOT NULL REFERENCES categories(id),
  planned_amount INTEGER NOT NULL CHECK (planned_amount >= 0),
  UNIQUE (month_id, category_id)
)

expenses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  category_id INTEGER NOT NULL REFERENCES categories(id),
  amount INTEGER NOT NULL CHECK (amount > 0),
  date TEXT NOT NULL,          -- 'YYYY-MM-DD'
  note TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
)
CREATE INDEX idx_expenses_date ON expenses(date);
```

Rules:
- Money is stored as **INTEGER taka** (no paisa, no floats).
- A month = **calendar month** (1st to last day). An expense belongs to a month by its `date`.
- Categories are never hard-deleted once used — archive them (`is_archived = 1`).
- Never store computed values (spent, remaining, totals). Always compute from queries.
- `PRAGMA foreign_keys = ON` on every open.
- Migrations: versioned via `PRAGMA user_version`, in `src/db/migrations.ts`.

## Calculations (pure functions in `src/lib/calc.ts`, unit-tested)

- `spent(category)` = sum of that category's expenses in the month
- `remaining(category)` = planned − spent (negative = overspent)
- `percent` = spent / planned × 100 (planned = 0 and spent > 0 → treat as over)
- **Total expense** = spent across `type = 'expense'` categories
- **Total saving** = spent across `type = 'saving'` categories (e.g. "Bank deposit")
- **Total income** = sum of incomes for the month
- **In hand** = income − total expense − total saving
- **Overall bar** = planned vs spent over `expense` categories only (savings excluded)
- Bar color: ≤ 80% green, 80–100% yellow, > 100% red

## Screens

| Route | Screen | Content |
|---|---|---|
| `(tabs)/index` | Dashboard | Current month: income / expense / saving / in hand. Overall expense progress bar. Per-category bars sorted by % used (desc). FAB "+ খরচ". |
| `(tabs)/plan` | Budget plan | Income list (add/edit/remove). Planned amount per active category. "Copy from last month" button. |
| `(tabs)/months` | Month list | All months, newest first, with total spent. Tap → report. |
| `expense/new` | Add expense | Amount (numeric keypad, autofocus), category picker, date (default today), note. Save in ≤ 5 seconds. |
| `month/[id]` | Report | Totals, per-category planned vs spent vs remaining (overspent in red), expense list grouped by date with edit/delete. |
| `settings` | Settings | Manage categories (add, rename, reorder, archive). Backup/restore JSON. |

## UI conventions

- UI text in **Bengali**. Code, identifiers, comments, commits in **English**.
- Numbers shown with Bengali digits and thousand separators via `formatTaka()` in `src/lib/format.ts` (own digit mapping — do not rely on `Intl` locale support in Hermes).
- Keep all user-facing strings in `src/i18n/bn.ts`.
- Light theme only for MVP. Colors as tokens in `src/theme.ts`.

## Folder structure

```
app/                 expo-router routes
src/db/              schema, migrations, repositories (one file per table)
src/lib/             calc.ts, format.ts, date.ts (pure, tested)
src/components/      ProgressBar, MoneyText, CategoryRow, ...
src/i18n/bn.ts
src/theme.ts
__tests__/           Jest tests
```

## Working rules

- Business logic stays out of components — in `src/lib` or `src/db` repositories.
- Every repository function is async and typed; no raw SQL inside components.
- Run `npx tsc --noEmit` and `npx jest` before declaring a session done.
- Small commits per feature with clear English messages.
- If a requirement is unclear, ask instead of guessing.

## Default seed categories (first launch only)

expense: বাসা ভাড়া, বাজার, খাবার, যাতায়াত, বিল (বিদ্যুৎ/গ্যাস/পানি), মোবাইল ও ইন্টারনেট, চিকিৎসা, পরিবার, অন্যান্য
saving: ব্যাংক জমা

## Session roadmap

1. Project setup, DB + migrations + seed, repositories, calc/format/date libs + tests, tab skeleton
2. Budget plan screen (incomes, planned amounts, copy from last month)
3. Add/edit/delete expense
4. Dashboard with overall + per-category progress bars
5. Month list + month report
6. Settings: category management + JSON backup/restore; EAS APK build
