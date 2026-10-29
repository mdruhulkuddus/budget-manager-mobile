import type { SQLiteDatabase } from 'expo-sqlite';

import { SCHEMA_V1, SCHEMA_V2, SCHEMA_VERSION, SEED_CATEGORIES } from './schema';

interface Migration {
  version: number;
  up: (db: SQLiteDatabase) => Promise<void>;
}

// Append new migrations here; never edit one that has shipped.
const MIGRATIONS: Migration[] = [
  {
    version: 1,
    up: async (db) => {
      await db.execAsync(SCHEMA_V1);
      const row = await db.getFirstAsync<{ n: number }>('SELECT COUNT(*) AS n FROM categories');
      if ((row?.n ?? 0) === 0) {
        for (const [i, c] of SEED_CATEGORIES.entries()) {
          await db.runAsync('INSERT INTO categories (name, type, sort_order) VALUES (?, ?, ?)', c.name, c.type, i);
        }
      }
    },
  },
  {
    version: 2,
    up: async (db) => {
      await db.execAsync(SCHEMA_V2);
    },
  },
];

if (MIGRATIONS[MIGRATIONS.length - 1].version !== SCHEMA_VERSION) {
  throw new Error('SCHEMA_VERSION must match the last migration');
}

/**
 * Passed to SQLiteProvider's onInit; runs on every app start.
 * `targetVersion` exists for tests (e.g. build a v1 database, then upgrade it).
 */
export async function migrate(db: SQLiteDatabase, targetVersion: number = SCHEMA_VERSION): Promise<void> {
  // Must run outside a transaction — SQLite ignores it inside one.
  await db.execAsync('PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL;');

  const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  let current = row?.user_version ?? 0;

  for (const m of MIGRATIONS) {
    if (m.version <= current || m.version > targetVersion) continue;
    await db.withTransactionAsync(async () => {
      await m.up(db);
      // PRAGMA does not accept bound parameters; version is a trusted integer.
      await db.execAsync(`PRAGMA user_version = ${m.version}`);
    });
    current = m.version;
  }
}
