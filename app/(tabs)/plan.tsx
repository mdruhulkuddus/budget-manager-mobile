import { useFocusEffect } from 'expo-router';
import { type SQLiteDatabase, useSQLiteContext } from 'expo-sqlite';
import { type ReactNode, useCallback, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Keyboard, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { AmountInput } from '../../src/components/AmountInput';
import { CategoryModal } from '../../src/components/CategoryModal';
import { IncomeModal } from '../../src/components/IncomeModal';
import { MonthSwitcher } from '../../src/components/MonthSwitcher';
import { PlanSummaryStrip } from '../../src/components/PlanSummaryStrip';
import { showError } from '../../src/components/showError';
import { useKeyboardAwareScroll } from '../../src/components/useKeyboardAwareScroll';
import * as budgets from '../../src/db/budgets';
import * as categories from '../../src/db/categories';
import * as incomes from '../../src/db/incomes';
import * as months from '../../src/db/months';
import { bn } from '../../src/i18n/bn';
import { planSummary } from '../../src/lib/calc';
import { currentYearMonth, type YearMonth } from '../../src/lib/date';
import { formatTaka } from '../../src/lib/format';
import { colors, fontSize, spacing } from '../../src/theme';

interface PlanData {
  month: months.Month;
  categories: categories.Category[];
  /** categoryId → planned amount */
  planned: Map<number, number>;
  incomes: incomes.Income[];
  previous: months.Month | null;
}

type ModalState =
  | { kind: 'add' }
  | { kind: 'edit'; income: incomes.Income }
  | { kind: 'addCategory'; type: categories.Category['type'] }
  | null;

async function loadPlan(db: SQLiteDatabase, { year, month }: YearMonth): Promise<PlanData> {
  const m = await months.getOrCreate(db, year, month);
  const [cats, monthBudgets, monthIncomes, previous] = await Promise.all([
    categories.listActive(db),
    budgets.listByMonth(db, m.id),
    incomes.listByMonth(db, m.id),
    months.getPreviousWithPlan(db, m.id),
  ]);
  return {
    month: m,
    categories: cats,
    planned: new Map(monthBudgets.map((b) => [b.categoryId, b.plannedAmount])),
    incomes: monthIncomes,
    previous,
  };
}

function Section({ title, total, children }: { title: string; total: number; children: ReactNode }) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>{title}</Text>
        <Text style={styles.sectionTotal}>{formatTaka(total)}</Text>
      </View>
      {children}
    </View>
  );
}

export default function PlanScreen() {
  const db = useSQLiteContext();
  const [ym, setYm] = useState(currentYearMonth);
  const [data, setData] = useState<PlanData | null>(null);
  const [modal, setModal] = useState<ModalState>(null);
  const requestId = useRef(0);
  const { keyboardHeight, onInputFocus, scrollProps } = useKeyboardAwareScroll();

  const reload = useCallback(async () => {
    const id = ++requestId.current;
    try {
      const next = await loadPlan(db, ym);
      if (id === requestId.current) setData(next); // ignore results of a month we've already left
    } catch (e) {
      showError(e);
    }
  }, [db, ym]);

  // Reload on focus too, so categories changed in Settings show up.
  useFocusEffect(
    useCallback(() => {
      reload();
    }, [reload]),
  );

  if (!data) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  const monthId = data.month.id;
  const summary = planSummary({
    categories: data.categories,
    budgets: [...data.planned].map(([categoryId, plannedAmount]) => ({ categoryId, plannedAmount })),
    incomes: data.incomes,
  });

  const changeMonth = (next: YearMonth) => {
    Keyboard.dismiss();
    setYm(next);
  };

  const commitPlanned = (categoryId: number, amount: number) => {
    if ((data.planned.get(categoryId) ?? 0) === amount) return;
    budgets
      .upsert(db, monthId, categoryId, amount)
      .then(() =>
        setData((d) =>
          d && d.month.id === monthId ? { ...d, planned: new Map(d.planned).set(categoryId, amount) } : d,
        ),
      )
      .catch(showError);
  };

  const saveIncome = (input: { source: string; amount: number }) => {
    const current = modal;
    setModal(null);
    const task =
      current?.kind === 'edit' ? incomes.update(db, current.income.id, input) : incomes.add(db, { monthId, ...input });
    task.then(reload).catch(showError);
  };

  const deleteIncome = () => {
    if (modal?.kind !== 'edit') return;
    const { id } = modal.income;
    setModal(null);
    incomes.remove(db, id).then(reload).catch(showError);
  };

  const saveCategory = (input: { name: string; type: categories.Category['type'] }) => {
    setModal(null);
    categories.create(db, input).then(reload).catch(showError);
  };

  const copyFromPrevious = async () => {
    const previous = data.previous;
    if (!previous) return;
    const doCopy = () => months.copyPlanFromMonth(db, previous.id, monthId).then(reload).catch(showError);
    try {
      if (await months.hasPlan(db, monthId)) {
        Alert.alert(bn.plan.copyFromLast, bn.plan.copyConfirm, [
          { text: bn.common.cancel, style: 'cancel' },
          { text: bn.common.confirm, style: 'destructive', onPress: doCopy },
        ]);
      } else {
        await doCopy();
      }
    } catch (e) {
      showError(e);
    }
  };

  const renderCategoryRows = (type: categories.Category['type']) =>
    data.categories
      .filter((c) => c.type === type)
      .map((c) => (
        // Keyed by month so an input focused during a month switch commits to the month it was typed in.
        <View key={`${monthId}-${c.id}`} style={styles.row}>
          <Text style={styles.rowName}>{c.name}</Text>
          <AmountInput
            value={data.planned.get(c.id) ?? 0}
            onCommit={(amount) => commitPlanned(c.id, amount)}
            onFocus={onInputFocus}
            accessibilityLabel={c.name}
          />
        </View>
      ));

  const renderAddCategory = (type: categories.Category['type']) => (
    <Pressable style={styles.addButton} onPress={() => setModal({ kind: 'addCategory', type })}>
      <Text style={styles.addText}>{bn.plan.addCategory}</Text>
    </Pressable>
  );

  return (
    <View style={styles.screen}>
      <View style={styles.sticky}>
        <MonthSwitcher value={ym} onChange={changeMonth} />
        <PlanSummaryStrip summary={summary} />
      </View>

      {/* Default keyboardShouldPersistTaps: a tap outside the focused input first dismisses the keyboard,
          which commits that input before any button (copy, add income) can act. */}
      <ScrollView
        {...scrollProps}
        contentContainerStyle={[styles.content, { paddingBottom: spacing.lg + keyboardHeight }]}>
        {data.previous && (
          <Pressable style={styles.copyButton} onPress={copyFromPrevious}>
            <Text style={styles.copyText}>{bn.plan.copyFromLast}</Text>
          </Pressable>
        )}

        <Section title={bn.plan.income} total={summary.income}>
          {data.incomes.length === 0 && <Text style={styles.empty}>{bn.plan.noIncome}</Text>}
          {data.incomes.map((income) => (
            <Pressable key={income.id} style={styles.row} onPress={() => setModal({ kind: 'edit', income })}>
              <Text style={styles.rowName}>{income.source}</Text>
              <Text style={styles.rowAmount}>{formatTaka(income.amount)}</Text>
            </Pressable>
          ))}
          <Pressable style={styles.addButton} onPress={() => setModal({ kind: 'add' })}>
            <Text style={styles.addText}>{bn.plan.addIncome}</Text>
          </Pressable>
        </Section>

        <Section title={bn.plan.expenseGroup} total={summary.plannedExpense}>
          {renderCategoryRows('expense')}
          {renderAddCategory('expense')}
        </Section>

        <Section title={bn.plan.savingGroup} total={summary.plannedSaving}>
          {renderCategoryRows('saving')}
          {renderAddCategory('saving')}
        </Section>
      </ScrollView>

      {modal?.kind === 'addCategory' && (
        <CategoryModal
          key={modal.type}
          defaultType={modal.type}
          existing={data.categories}
          onSave={saveCategory}
          onClose={() => setModal(null)}
        />
      )}

      {modal && modal.kind !== 'addCategory' && (
        <IncomeModal
          key={modal.kind === 'edit' ? modal.income.id : 'new'}
          initial={modal.kind === 'edit' ? modal.income : undefined}
          onSave={saveIncome}
          onDelete={modal.kind === 'edit' ? deleteIncome : undefined}
          onClose={() => setModal(null)}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background },
  sticky: { backgroundColor: colors.surface },
  content: { padding: spacing.md, gap: spacing.md },
  section: { backgroundColor: colors.surface, borderRadius: 10, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  sectionTitle: { fontSize: fontSize.md, fontWeight: '700', color: colors.text },
  sectionTotal: { fontSize: fontSize.md, fontWeight: '700', color: colors.text },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
  },
  rowName: { flex: 1, fontSize: fontSize.md, color: colors.text },
  rowAmount: { fontSize: fontSize.md, color: colors.text },
  empty: { fontSize: fontSize.sm, color: colors.textMuted, paddingVertical: spacing.sm },
  addButton: { paddingVertical: spacing.sm },
  addText: { fontSize: fontSize.md, color: colors.primary, fontWeight: '600' },
  copyButton: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: 6,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  copyText: { color: colors.primary, fontSize: fontSize.md, fontWeight: '600' },
});
