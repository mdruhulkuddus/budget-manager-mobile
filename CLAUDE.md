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

- Expo **SDK 58** (React Native 0.88, React 19.3) + TypeScript 6 (strict)
- expo-router (file-based routing; routes live in root `app/`, not `src/app/`)
  - Tabs: `import { Tabs } from 'expo-router/js-tabs'` (`Tabs` from `expo-router` is deprecated). Stack: `import { Stack } from 'expo-router'`.
- expo-sqlite (async API, `SQLiteProvider` + `useSQLiteContext`)
- Plain `StyleSheet` — no UI library, no chart library, no icon library (tab bar is labels only)
- Jest (`jest-expo`) for unit tests of pure logic
- Build: EAS Build, `preview` profile → installable APK

Do NOT add: Redux/Zustand, TanStack Query, UI kits, chart libs, ORMs, auth, network calls.
Ask before adding any dependency not listed above. When adding one, use `npx expo install <pkg>` (picks SDK-compatible versions), never plain `npm install`.

SDK 58 is newer than most training data — check the installed type definitions in `node_modules` (or the docs at `https://docs.expo.dev/versions/v58.0.0/`) instead of assuming an API from memory.

## Commands

- `npx expo start` — dev server (open in Expo Go / dev build on the phone)
- `npx tsc --noEmit` — type-check
- `npx jest` — all tests; `npx jest __tests__/calc.test.ts` — one file; `npx jest -t "remaining"` — by test name
- `npx expo export --platform android --output-dir <tmp>` — full Android bundle; use it to catch route/import errors when the phone isn't available
- `npx expo-doctor` — dependency/config check
- `eas build -p android --profile preview` — installable APK

TypeScript 6 no longer loads `@types/*` automatically: `tsconfig.json` lists `"types": ["jest"]`. Add to that list if another global type package is needed.

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

## Architecture (how the layers connect)

- **DB lifecycle:** `app/_layout.tsx` wraps everything in `<SQLiteProvider databaseName="budget.db" onInit={migrate}>`. `migrate()` in `src/db/migrations.ts` runs on every start. It sets `foreign_keys = ON` and WAL mode *outside* any transaction (SQLite ignores `foreign_keys` inside one), then applies each entry in `MIGRATIONS` whose version is above `PRAGMA user_version`, in its own transaction. To change the schema, append a new migration. Never edit a shipped one. `src/db/schema.ts` holds only the v1 SQL and the seed list.
- **Repositories** (`src/db/*.ts`) are plain async functions that take `db: SQLiteDatabase` as the first argument. Components get `db` from `useSQLiteContext()` and pass it in. SQL aliases columns to camelCase (`planned_amount AS plannedAmount`), so row types are camelCase. `is_archived` is mapped to a boolean.
- **Months ↔ expenses:** expenses have no `month_id`. A month's expenses are fetched by date range: `monthRange(year, month)` → `expenses.listByDateRange` / `sumByCategory(from, to)`. Incomes and budgets *do* reference `months.id`, created via `months.getOrCreate`.
- **Summary pipeline:** screen → repositories (`categories.listAll`, `budgets.listByMonth`, `expenses.sumByCategory`, `incomes.listByMonth`) → `buildMonthSummary()` in `src/lib/calc.ts` → render. The repository return shapes match calc's input types directly (`SpentInput` is reused by `sumByCategory`).

## Behaviour decisions (settled in session 1)

- **Dates** are local calendar dates and always come from `src/lib/date.ts` (`today()`, `monthRange()`). Never use `toISOString()` for a date: it's UTC, and in Bangladesh (UTC+6) it gives yesterday's date between 00:00 and 06:00.
- **`formatTaka`** uses South Asian (lakh) grouping: `৳১,২৫,০০০`. Negatives: `-৳১,২০০`.
- **`percent`** is `Infinity` when planned = 0 and spent > 0. It sorts first and is `'over'`; the UI must display it specially (e.g. "—"). Sort ties fall back to `sort_order`.
- **Archived categories:** `buildMonthSummary` receives *all* categories and shows an archived one only if it has planned > 0 or spent > 0 that month. Pickers and the plan screen should use `categories.listActive`.
- **A month "has a plan"** if it has any income or any planned amount > 0 (`months.hasPlan`). Opening a month in the switcher creates an empty `months` row, so row existence means nothing. The month list (session 5) should keep that in mind.
- **Copy from last month:** the source is `months.getPreviousWithPlan` (most recent earlier month *with a plan*, skipping empty ones). `months.copyPlanFromMonth` runs `budgets.copyFromMonth` + `incomes.copyFromMonth` in one exclusive transaction. Both *replace* the target's data. Budget rows of archived categories are neither copied nor deleted.
- **Plan screen totals** (`planSummary`) count only active categories, matching the visible rows. Amounts commit on blur and skip the write if unchanged. `parseTaka` turns invalid input (decimals, minus, letters) into 0.
- **Keyboard:** `KeyboardAvoidingView` isn't used: Android edge-to-edge (mandatory since SDK 54) makes it unreliable. Scroll screens with inputs use `src/components/useKeyboardAwareScroll.ts` (bottom padding = keyboard height + scroll the focused input into view). They keep the default `keyboardShouldPersistTaps`, so the first tap outside an input only dismisses the keyboard. That commits the input before any button acts.
- **RN 0.88 types:** components are function types. Use `ScrollViewInstance` / `TextInputInstance` for refs, not `ScrollView` / `TextInput`.
- **Expense notes:** an empty or whitespace-only note is stored as `NULL`.
- **Navigation:** `settings` is reached through a "সেটিংস" header link on the tabs. `expense/new` is presented as a modal.

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

1. ✅ Project setup, DB + migrations + seed, repositories, calc/format/date libs + tests, tab skeleton
   (The dashboard placeholder has a temporary seeded-category count marked `TODO(session-4): remove`.)
2. ✅ Budget plan screen (incomes, planned amounts, copy from last month)
3. Add/edit/delete expense
4. Dashboard with overall + per-category progress bars
5. Month list + month report
6. Settings: category management + JSON backup/restore; EAS APK build
