import Constants from 'expo-constants';
import { useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { type ReactNode, useCallback, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { backupErrorMessage, exportBackup, pickBackup } from '../src/components/backupActions';
import { CategoryModal } from '../src/components/CategoryModal';
import { fullDateLabel } from '../src/components/dateLabel';
import { showError } from '../src/components/showError';
import { replaceAll } from '../src/db/backup';
import * as categories from '../src/db/categories';
import type { CategoryWithUsage } from '../src/db/categories';
import * as settings from '../src/db/settings';
import { bn } from '../src/i18n/bn';
import { backupStatus } from '../src/lib/backup';
import type { CategoryType } from '../src/lib/calc';
import { moveCategory, validateCategoryName } from '../src/lib/categories';
import { today } from '../src/lib/date';
import { toBengaliDigits } from '../src/lib/format';
import { colors, fontSize, spacing } from '../src/theme';

/** Open modal: editing an existing category, or adding one of a type. */
type ModalState = { mode: 'edit'; category: CategoryWithUsage } | { mode: 'add'; type: CategoryType } | null;

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.card}>{children}</View>
    </View>
  );
}

function ArrowButton({ label, glyph, onPress }: { label: string; glyph: string; onPress: (() => void) | null }) {
  return (
    <Pressable
      accessibilityLabel={label}
      disabled={!onPress}
      onPress={onPress ?? undefined}
      hitSlop={4}
      style={[styles.arrow, !onPress && styles.arrowDisabled]}>
      <Text style={styles.arrowText}>{glyph}</Text>
    </Pressable>
  );
}

export default function SettingsScreen() {
  const db = useSQLiteContext();
  const [all, setAll] = useState<CategoryWithUsage[] | null>(null);
  const [lastBackupAt, setLastBackupAt] = useState<string | null>(null);
  const [modal, setModal] = useState<ModalState>(null);
  const [showArchived, setShowArchived] = useState(false);
  const [busy, setBusy] = useState(false);

  const reload = useCallback(async () => {
    const [list, last] = await Promise.all([categories.listWithUsage(db), settings.get(db, 'last_backup_at')]);
    setAll(list);
    setLastBackupAt(last);
  }, [db]);

  useFocusEffect(
    useCallback(() => {
      reload().catch(showError);
    }, [reload]),
  );

  if (!all) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  const run = (action: () => Promise<unknown>) => {
    setModal(null);
    action()
      .then(reload)
      .catch(showError);
  };

  const move = (id: number, direction: 'up' | 'down') => {
    const order = moveCategory(all, id, direction);
    return order ? () => run(() => categories.reorder(db, order)) : null;
  };

  const save = (input: { name: string; type: CategoryType }) => {
    if (!modal) return;
    if (modal.mode === 'add') return run(() => categories.create(db, input));
    const c = modal.category;
    run(async () => {
      if (input.name !== c.name) await categories.rename(db, c.id, input.name);
      if (input.type !== c.type) await categories.setType(db, c.id, input.type);
    });
  };

  const restore = (c: CategoryWithUsage) => {
    if (validateCategoryName(c.name, all, c.id) === 'duplicate') {
      Alert.alert(c.name, bn.settings.restoreDuplicate);
      return;
    }
    run(() => categories.restore(db, c.id));
  };

  const doExport = async () => {
    setBusy(true);
    try {
      const stored = await exportBackup(db);
      if (stored) setLastBackupAt(stored);
      else Alert.alert(bn.backupError.shareUnavailable);
    } catch (e) {
      showError(e);
    } finally {
      setBusy(false);
    }
  };

  const doImport = async () => {
    setBusy(true);
    try {
      const result = await pickBackup();
      if (!result) return;
      if (!result.ok) {
        Alert.alert(bn.backupError.title, `${backupErrorMessage(result.error)}\n${bn.backupError.nothingChanged}`);
        return;
      }
      const { data, exportedAt } = result;
      const exportedDate = /^\d{4}-\d{2}-\d{2}/.test(exportedAt) ? fullDateLabel(exportedAt.slice(0, 10)) : exportedAt;
      const details = bn.settings.importDetails(
        exportedDate,
        toBengaliDigits(data.months.length),
        toBengaliDigits(data.expenses.length),
      );
      Alert.alert(bn.settings.importTitle, `${bn.settings.importConfirm}\n\n${details}`, [
        { text: bn.common.cancel, style: 'cancel' },
        {
          text: bn.common.confirm,
          style: 'destructive',
          onPress: () =>
            replaceAll(db, data)
              .then(reload)
              .then(() => Alert.alert(bn.settings.importTitle, bn.settings.importDone))
              .catch(showError),
        },
      ]);
    } catch (e) {
      showError(e);
    } finally {
      setBusy(false);
    }
  };

  const active = all.filter((c) => !c.isArchived);
  const archived = all.filter((c) => c.isArchived);
  const status = backupStatus(lastBackupAt, today());
  const backupWarn = status.kind === 'never' || status.stale;
  const version = Constants.expoConfig?.version;

  const group = (type: CategoryType, title: string) => {
    const rows = active.filter((c) => c.type === type);
    return (
      <View style={styles.group}>
        <View style={styles.groupHeader}>
          <Text style={styles.groupTitle}>{title}</Text>
          <Pressable onPress={() => setModal({ mode: 'add', type })} hitSlop={8}>
            <Text style={styles.link}>{bn.settings.addCategory}</Text>
          </Pressable>
        </View>
        {rows.map((c) => (
          <View key={c.id} style={styles.row}>
            <Pressable style={styles.rowName} onPress={() => setModal({ mode: 'edit', category: c })}>
              <Text style={styles.rowText}>{c.name}</Text>
            </Pressable>
            <ArrowButton label={bn.settings.moveUp} glyph="▲" onPress={move(c.id, 'up')} />
            <ArrowButton label={bn.settings.moveDown} glyph="▼" onPress={move(c.id, 'down')} />
          </View>
        ))}
      </View>
    );
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Section title={bn.settings.categories}>
        {group('expense', bn.settings.expenseGroup)}
        {group('saving', bn.settings.savingGroup)}

        {archived.length > 0 && (
          <View style={styles.group}>
            <Pressable style={styles.groupHeader} onPress={() => setShowArchived((v) => !v)}>
              <Text style={styles.groupTitle}>
                {showArchived ? '▾ ' : '▸ '}
                {bn.settings.archived(toBengaliDigits(archived.length))}
              </Text>
            </Pressable>
            {showArchived &&
              archived.map((c) => (
                <View key={c.id} style={styles.row}>
                  <Text style={[styles.rowText, styles.rowName, styles.muted]}>{c.name}</Text>
                  <Pressable onPress={() => restore(c)} hitSlop={8}>
                    <Text style={styles.link}>{bn.settings.restore}</Text>
                  </Pressable>
                </View>
              ))}
          </View>
        )}
      </Section>

      <Section title={bn.settings.backup}>
        <Text style={[styles.backupStatus, backupWarn && styles.warnText]}>
          {status.kind === 'never' ? bn.settings.neverBackedUp : bn.settings.lastBackup(fullDateLabel(status.date))}
        </Text>
        <Text style={styles.hint}>{bn.settings.backupHint}</Text>
        <Pressable style={[styles.button, styles.primaryButton, busy && styles.disabled]} disabled={busy} onPress={doExport}>
          <Text style={styles.primaryButtonText}>{bn.settings.exportBackup}</Text>
        </Pressable>
        <Pressable style={[styles.button, styles.secondaryButton, busy && styles.disabled]} disabled={busy} onPress={doImport}>
          <Text style={styles.secondaryButtonText}>{bn.settings.importBackup}</Text>
        </Pressable>
      </Section>

      <Section title={bn.settings.about}>
        <Text style={styles.rowText}>
          {bn.appName}
          {version ? ` · ${bn.settings.version(toBengaliDigits(version))}` : ''}
        </Text>
        <Text style={styles.hint}>{bn.settings.offlineNote}</Text>
      </Section>

      {modal && (
        <CategoryModal
          key={modal.mode === 'edit' ? `edit-${modal.category.id}` : `add-${modal.type}`}
          category={modal.mode === 'edit' ? modal.category : undefined}
          defaultType={modal.mode === 'add' ? modal.type : undefined}
          existing={all}
          onSave={save}
          onArchive={modal.mode === 'edit' ? () => run(() => categories.archive(db, modal.category.id)) : undefined}
          onDelete={modal.mode === 'edit' ? () => run(() => categories.remove(db, modal.category.id)) : undefined}
          onClose={() => setModal(null)}
        />
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background },
  content: { padding: spacing.md, gap: spacing.lg, paddingBottom: spacing.lg * 2 },
  section: { gap: spacing.sm },
  sectionTitle: { fontSize: fontSize.lg, fontWeight: '700', color: colors.text },
  card: { backgroundColor: colors.surface, borderRadius: 10, padding: spacing.md, gap: spacing.sm },
  group: { gap: spacing.xs },
  groupHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  groupTitle: { fontSize: fontSize.sm, fontWeight: '600', color: colors.textMuted },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minHeight: 44 },
  rowName: { flex: 1, paddingVertical: spacing.sm },
  rowText: { fontSize: fontSize.md, color: colors.text },
  muted: { color: colors.textMuted },
  link: { color: colors.primary, fontSize: fontSize.md },
  arrow: {
    width: 40,
    height: 36,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  arrowDisabled: { opacity: 0.3 },
  arrowText: { fontSize: fontSize.sm, color: colors.text },
  backupStatus: { fontSize: fontSize.md, fontWeight: '600', color: colors.text },
  warnText: { color: colors.over },
  hint: { fontSize: fontSize.sm, color: colors.textMuted },
  button: { borderRadius: 8, paddingVertical: spacing.sm + 4, alignItems: 'center' },
  primaryButton: { backgroundColor: colors.primary, marginTop: spacing.xs },
  primaryButtonText: { color: colors.onPrimary, fontSize: fontSize.md, fontWeight: '600' },
  secondaryButton: { borderWidth: 1, borderColor: colors.primary },
  secondaryButtonText: { color: colors.primary, fontSize: fontSize.md, fontWeight: '600' },
  disabled: { opacity: 0.4 },
});
