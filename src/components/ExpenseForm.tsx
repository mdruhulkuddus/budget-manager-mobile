import { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useRef, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, type TextInputInstance, View } from 'react-native';

import * as budgets from '../db/budgets';
import * as categories from '../db/categories';
import * as expenses from '../db/expenses';
import * as months from '../db/months';
import { bn } from '../i18n/bn';
import { amountToExclude, categoryPreview } from '../lib/calc';
import { addDays, monthRange, parseLocalDate, toLocalDate, today, yearMonthOf } from '../lib/date';
import { formatTaka, parseTaka } from '../lib/format';
import { colors, fontSize, spacing, statusColor } from '../theme';
import { dateLabel } from './dateLabel';
import { showError } from './showError';
import { useKeyboardInset } from './useKeyboardInset';

interface Props {
  /** The expense being edited; omit to add a new one. */
  original?: expenses.Expense;
  /** Called after save (not "save another") or delete. */
  onDone: () => void;
}

interface MonthStats {
  monthKey: string; // 'YYYY-MM'
  planned: Map<number, number>;
  spent: Map<number, number>;
}

function Chip({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={[styles.chip, selected && styles.chipSelected]}>
      <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{label}</Text>
    </Pressable>
  );
}

export function ExpenseForm({ original, onDone }: Props) {
  const db = useSQLiteContext();
  const amountRef = useRef<TextInputInstance>(null);
  const { containerRef, inset } = useKeyboardInset();

  const [amountText, setAmountText] = useState(original ? String(original.amount) : '');
  const [categoryId, setCategoryId] = useState<number | null>(original?.categoryId ?? null);
  const [date, setDate] = useState(original?.date ?? today());
  const [note, setNote] = useState(original?.note ?? '');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<string | null>(null);

  const [cats, setCats] = useState<categories.Category[]>([]);
  const [stats, setStats] = useState<MonthStats | null>(null);
  const [statsVersion, setStatsVersion] = useState(0);

  const monthKey = date.slice(0, 7);
  const todayDate = today();
  const yesterday = addDays(todayDate, -1);

  useEffect(() => {
    let active = true;
    categories
      .listAll(db)
      // Active ones, plus the original's category if it has since been archived.
      .then((all) => active && setCats(all.filter((c) => !c.isArchived || c.id === original?.categoryId)))
      .catch(showError);
    return () => {
      active = false;
    };
  }, [db, original?.categoryId]);

  // Plan and spent for the chosen date's month; reloaded after "save another".
  useEffect(() => {
    let active = true;
    const { year, month } = yearMonthOf(`${monthKey}-01`);
    const { from, to } = monthRange(year, month);
    Promise.all([budgets.listByYearMonth(db, year, month), expenses.sumByCategory(db, from, to)])
      .then(([planned, spent]) => {
        if (!active) return;
        setStats({
          monthKey,
          planned: new Map(planned.map((b) => [b.categoryId, b.plannedAmount])),
          spent: new Map(spent.map((s) => [s.categoryId, s.spent])),
        });
      })
      .catch(showError);
    return () => {
      active = false;
    };
  }, [db, monthKey, statsVersion]);

  // autoFocus alone can miss while the screen is still animating in on Android.
  useEffect(() => {
    const t = setTimeout(() => amountRef.current?.focus(), 300);
    return () => clearTimeout(t);
  }, []);

  const amount = parseTaka(amountText);
  const expenseCats = cats.filter((c) => c.type === 'expense');
  const savingCats = cats.filter((c) => c.type === 'saving');

  const pickDate = () =>
    DateTimePickerAndroid.open({
      value: parseLocalDate(date),
      mode: 'date',
      maximumDate: new Date(),
      onChange: (event, picked) => {
        if (event.type === 'set' && picked) {
          setDate(toLocalDate(picked));
          setError(null);
        }
      },
    });

  const save = async (another: boolean) => {
    if (saving) return;
    if (amount <= 0) return setError(bn.expense.errorAmount);
    if (categoryId === null) return setError(bn.expense.errorCategory);
    if (date > today()) return setError(bn.expense.errorFutureDate);

    setSaving(true);
    try {
      const { year, month } = yearMonthOf(date);
      await months.getOrCreate(db, year, month); // so the month shows in the month list
      const input = { categoryId, amount, date, note };
      if (original) await expenses.update(db, original.id, input);
      else await expenses.add(db, input);

      if (!another) {
        onDone();
        return;
      }
      const catName = cats.find((c) => c.id === categoryId)?.name ?? '';
      setLastSaved(`${bn.expense.savedPrefix}: ${formatTaka(amount)} · ${catName}`);
      setAmountText('');
      setNote('');
      setError(null);
      setStatsVersion((v) => v + 1);
      amountRef.current?.focus();
    } catch (e) {
      showError(e);
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = () => {
    if (!original) return;
    Alert.alert(bn.expense.delete, bn.expense.deleteConfirm, [
      { text: bn.common.cancel, style: 'cancel' },
      {
        text: bn.expense.delete,
        style: 'destructive',
        onPress: () => expenses.remove(db, original.id).then(onDone).catch(showError),
      },
    ]);
  };

  const renderPreview = () => {
    if (categoryId === null || !stats || stats.monthKey !== monthKey) return null;
    const planned = stats.planned.get(categoryId) ?? 0;
    const spentSoFar = (stats.spent.get(categoryId) ?? 0) - amountToExclude(original ?? null, categoryId, date);
    const p = categoryPreview({ planned, spentSoFar, amount });

    return (
      <View style={styles.preview}>
        {p.hasPlan ? (
          <Text style={styles.previewLine}>
            {bn.preview.planned} {formatTaka(planned)} · {bn.preview.spent} {formatTaka(spentSoFar)} · {bn.preview.remaining}{' '}
            {formatTaka(p.remainingBefore)}
          </Text>
        ) : (
          <Text style={styles.previewLine}>{bn.preview.noPlan}</Text>
        )}
        {amount > 0 &&
          (p.overBy > 0 ? (
            <Text style={[styles.previewAfter, { color: colors.over }]}>
              {bn.preview.afterThisOver}: {formatTaka(p.overBy)} {bn.preview.over}
            </Text>
          ) : (
            <Text style={[styles.previewAfter, { color: statusColor[p.status] }]}>
              {bn.preview.afterThis}: {formatTaka(p.remainingAfter)}
            </Text>
          ))}
      </View>
    );
  };

  const isCustomDate = date !== todayDate && date !== yesterday;

  return (
    <View ref={containerRef} style={styles.screen}>
      {/* "handled": tapping a chip while typing the amount selects it without closing the keyboard. */}
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
        <TextInput
          ref={amountRef}
          style={styles.amount}
          value={amountText}
          onChangeText={(t) => {
            setAmountText(t);
            setError(null);
            setLastSaved(null);
          }}
          keyboardType="number-pad"
          placeholder={bn.expense.amountPlaceholder}
          placeholderTextColor={colors.border}
          autoFocus
        />

        <View style={styles.chips}>
          {expenseCats.map((c) => (
            <Chip
              key={c.id}
              label={c.name}
              selected={c.id === categoryId}
              onPress={() => {
                setCategoryId(c.id);
                setError(null);
              }}
            />
          ))}
        </View>
        {savingCats.length > 0 && (
          <View style={styles.savingRow}>
            <Text style={styles.savingLabel}>{bn.expense.savingRow}</Text>
            {savingCats.map((c) => (
              <Chip
                key={c.id}
                label={c.name}
                selected={c.id === categoryId}
                onPress={() => {
                  setCategoryId(c.id);
                  setError(null);
                }}
              />
            ))}
          </View>
        )}

        {renderPreview()}

        <View style={styles.chips}>
          <Chip label={bn.date.today} selected={date === todayDate} onPress={() => setDate(todayDate)} />
          <Chip label={bn.date.yesterday} selected={date === yesterday} onPress={() => setDate(yesterday)} />
          <Chip label={isCustomDate ? dateLabel(date, todayDate) : bn.date.pick} selected={isCustomDate} onPress={pickDate} />
        </View>

        <TextInput
          style={styles.note}
          value={note}
          onChangeText={setNote}
          placeholder={bn.expense.notePlaceholder}
          placeholderTextColor={colors.textMuted}
          returnKeyType="done"
        />

        {error && <Text style={styles.error}>{error}</Text>}
        {!error && lastSaved && <Text style={styles.saved}>{lastSaved}</Text>}
      </ScrollView>

      {/* Footer lifted by the measured keyboard overlap, so the buttons stay visible while typing. */}
      <View style={[styles.footer, { paddingBottom: spacing.md + inset }]}>
        {original ? (
          <Pressable onPress={confirmDelete} style={[styles.button, styles.deleteButton]}>
            <Text style={styles.deleteText}>{bn.expense.delete}</Text>
          </Pressable>
        ) : (
          <Pressable onPress={() => save(true)} disabled={saving} style={[styles.button, styles.secondaryButton]}>
            <Text style={styles.secondaryText}>{bn.expense.saveAnother}</Text>
          </Pressable>
        )}
        <Pressable onPress={() => save(false)} disabled={saving} style={[styles.button, styles.primaryButton]}>
          <Text style={styles.primaryText}>{bn.expense.save}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.md, gap: spacing.md },
  amount: {
    fontSize: 40,
    fontWeight: '700',
    color: colors.text,
    textAlign: 'center',
    paddingVertical: spacing.sm,
    borderBottomWidth: 2,
    borderBottomColor: colors.primary,
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  savingRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing.sm },
  savingLabel: { fontSize: fontSize.sm, color: colors.textMuted },
  chip: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    borderRadius: 18,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  chipSelected: { borderColor: colors.primary, backgroundColor: colors.primary },
  chipText: { fontSize: fontSize.md, color: colors.text },
  chipTextSelected: { color: colors.onPrimary, fontWeight: '600' },
  preview: { backgroundColor: colors.surface, borderRadius: 8, padding: spacing.sm, gap: spacing.xs },
  previewLine: { fontSize: fontSize.sm, color: colors.textMuted },
  previewAfter: { fontSize: fontSize.md, fontWeight: '600' },
  note: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    borderRadius: 6,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    fontSize: fontSize.md,
    color: colors.text,
  },
  error: { fontSize: fontSize.md, color: colors.over },
  saved: { fontSize: fontSize.md, color: colors.ok },
  footer: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  button: { flex: 1, alignItems: 'center', paddingVertical: spacing.md, borderRadius: 8 },
  primaryButton: { backgroundColor: colors.primary },
  primaryText: { color: colors.onPrimary, fontSize: fontSize.md, fontWeight: '700' },
  secondaryButton: { borderWidth: 1, borderColor: colors.primary },
  secondaryText: { color: colors.primary, fontSize: fontSize.md, fontWeight: '600' },
  deleteButton: { borderWidth: 1, borderColor: colors.over },
  deleteText: { color: colors.over, fontSize: fontSize.md, fontWeight: '600' },
});
