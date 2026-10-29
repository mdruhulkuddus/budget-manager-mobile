import * as DocumentPicker from 'expo-document-picker';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import type { SQLiteDatabase } from 'expo-sqlite';

import { readAll } from '../db/backup';
import * as settings from '../db/settings';
import { bn } from '../i18n/bn';
import { type BackupError, backupFileName, type ParseResult, parseBackup, serializeBackup } from '../lib/backup';
import { localTimestamp, today } from '../lib/date';
import { toBengaliDigits } from '../lib/format';

// File I/O around the pure backup format: everything stays on the phone;
// the Android share sheet is the only way the file leaves the app.

/**
 * Writes the backup to the cache directory, opens the share sheet and records `last_backup_at`.
 * Returns the stored timestamp, or null when sharing isn't available.
 */
export async function exportBackup(db: SQLiteDatabase): Promise<string | null> {
  if (!(await Sharing.isAvailableAsync())) return null;
  const now = localTimestamp();
  const text = serializeBackup(await readAll(db), now);

  const file = new File(Paths.cache, backupFileName(today()));
  if (file.exists) file.delete();
  file.create();
  await file.write(text);

  // Resolves once the sheet closes. Android doesn't report whether the file was
  // actually saved, so closing the sheet counts as a backup.
  await Sharing.shareAsync(file.uri, { mimeType: 'application/json', dialogTitle: bn.settings.shareTitle });
  await settings.set(db, 'last_backup_at', now);
  return now;
}

/** Lets the user pick a file and parses it. null = picker cancelled. */
export async function pickBackup(): Promise<ParseResult | { ok: false; error: { kind: 'readFailed' } } | null> {
  // Drive and other providers often label .json files as octet-stream or plain text.
  const result = await DocumentPicker.getDocumentAsync({
    type: ['application/json', 'application/octet-stream', 'text/plain'],
    copyToCacheDirectory: true,
  });
  if (result.canceled) return null;
  let text: string;
  try {
    text = await new File(result.assets[0].uri).text();
  } catch {
    return { ok: false, error: { kind: 'readFailed' } };
  }
  return parseBackup(text);
}

export function backupErrorMessage(error: BackupError | { kind: 'readFailed' }): string {
  switch (error.kind) {
    case 'notJson':
      return bn.backupError.notJson;
    case 'wrongApp':
      return bn.backupError.wrongApp;
    case 'newerVersion':
      return bn.backupError.newerVersion;
    case 'readFailed':
      return bn.backupError.readFailed;
    case 'invalid':
      return bn.backupError.invalid(error.index === null ? error.table : `${error.table} #${toBengaliDigits(error.index + 1)}`);
  }
}
