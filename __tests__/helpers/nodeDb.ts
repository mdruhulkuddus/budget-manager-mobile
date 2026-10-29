import type { SQLiteDatabase } from 'expo-sqlite';

import { migrate } from '../../src/db/migrations';

// Repository tests run on Node's built-in SQLite (node:sqlite) behind a thin
// adapter that mimics the part of expo-sqlite's async API the repositories use.
// Node < 22.13 only has it with --experimental-sqlite, which `npm test` passes.

interface Statement {
  run(...params: unknown[]): { changes: number | bigint; lastInsertRowid: number | bigint };
  get(...params: unknown[]): unknown;
  all(...params: unknown[]): unknown[];
}

interface DatabaseSync {
  exec(sql: string): void;
  prepare(sql: string): Statement;
  close(): void;
}

type Proc = { getBuiltinModule?: (id: string) => unknown };
const nodeSqlite = (globalThis as { process?: Proc }).process?.getBuiltinModule?.('node:sqlite') as
  | { DatabaseSync: new (path: string) => DatabaseSync }
  | undefined;

if (!nodeSqlite) {
  console.warn('node:sqlite is unavailable — database tests are SKIPPED. Run `npm test` (passes --experimental-sqlite).');
}

/** `describe` for suites that need a real database; skipped when node:sqlite is unavailable. */
export const describeDb = nodeSqlite ? describe : describe.skip;

/** A fresh in-memory database, migrated to `version` (default: latest). */
export async function openTestDb(version?: number): Promise<SQLiteDatabase> {
  const raw = new nodeSqlite!.DatabaseSync(':memory:');
  // expo-sqlite accepts params either spread or as one array.
  const args = (params: unknown[]) => (params.length === 1 && Array.isArray(params[0]) ? params[0] : params);

  const transaction = async (begin: string, fn: () => Promise<void>) => {
    raw.exec(begin);
    try {
      await fn();
      raw.exec('COMMIT');
    } catch (e) {
      raw.exec('ROLLBACK');
      throw e;
    }
  };

  const db = {
    execAsync: async (sql: string) => raw.exec(sql),
    runAsync: async (sql: string, ...params: unknown[]) => {
      const r = raw.prepare(sql).run(...args(params));
      return { lastInsertRowId: Number(r.lastInsertRowid), changes: Number(r.changes) };
    },
    getFirstAsync: async (sql: string, ...params: unknown[]) => raw.prepare(sql).get(...args(params)) ?? null,
    getAllAsync: async (sql: string, ...params: unknown[]) => raw.prepare(sql).all(...args(params)),
    withTransactionAsync: (fn: () => Promise<void>) => transaction('BEGIN', fn),
    withExclusiveTransactionAsync: (fn: (txn: unknown) => Promise<void>) => transaction('BEGIN EXCLUSIVE', () => fn(db)),
    closeAsync: async () => raw.close(),
  } as unknown as SQLiteDatabase;

  await migrate(db, version);
  return db;
}
