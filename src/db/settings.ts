import type { SQLiteDatabase } from 'expo-sqlite';

/** Keys of the `app_settings` key/value table. */
export type SettingKey = 'last_backup_at';

export async function get(db: SQLiteDatabase, key: SettingKey): Promise<string | null> {
  const row = await db.getFirstAsync<{ value: string }>('SELECT value FROM app_settings WHERE key = ?', key);
  return row?.value ?? null;
}

export async function set(db: SQLiteDatabase, key: SettingKey, value: string): Promise<void> {
  await db.runAsync(
    'INSERT INTO app_settings (key, value) VALUES (?, ?) ON CONFLICT (key) DO UPDATE SET value = excluded.value',
    key,
    value,
  );
}
