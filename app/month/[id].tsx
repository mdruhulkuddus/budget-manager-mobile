import { router, Stack, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { type ReactNode, useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { ExpenseList } from '../../src/components/ExpenseList';
import { monthLabel } from '../../src/components/MonthSwitcher';
import { ReportTable } from '../../src/components/ReportTable';
import { showError } from '../../src/components/showError';
import { SummaryCard } from '../../src/components/SummaryCard';
import { getMonthReport, type MonthReport } from '../../src/db/report';
import { bn } from '../../src/i18n/bn';
import type { Verdict } from '../../src/lib/calc';
import { formatTaka } from '../../src/lib/format';
import { colors, fontSize, spacing } from '../../src/theme';

function verdictText(v: Verdict): { text: string; color: string } {
  switch (v.kind) {
    case 'under':
      return { text: bn.report.verdictUnder(formatTaka(v.amount)), color: colors.ok };
    case 'over':
      return { text: bn.report.verdictOver(formatTaka(v.amount)), color: colors.over };
    case 'onPlan':
      return { text: bn.report.verdictOnPlan, color: colors.text };
    case 'noPlan':
      return { text: bn.report.verdictNoPlan, color: colors.textMuted };
  }
}

function Card({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <View style={styles.card}>
      {title && <Text style={styles.cardTitle}>{title}</Text>}
      {children}
    </View>
  );
}

export default function MonthReportScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const db = useSQLiteContext();
  // undefined = loading, null = not found
  const [report, setReport] = useState<MonthReport | null | undefined>(undefined);
  const [filterCategoryId, setFilterCategoryId] = useState<number | null>(null);

  // Refresh on return from the expense form (edits can change any number here).
  useFocusEffect(
    useCallback(() => {
      let active = true;
      getMonthReport(db, Number(id))
        .then((r) => active && setReport(r))
        .catch(showError);
      return () => {
        active = false;
      };
    }, [db, id]),
  );

  if (report === undefined) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }
  if (report === null) {
    return (
      <View style={styles.center}>
        <Text style={styles.muted}>{bn.report.notFound}</Text>
      </View>
    );
  }

  const { summary } = report;
  const verdict = verdictText(report.verdict);
  // Drop a filter whose category no longer has rows (e.g. its last expense was moved).
  const activeFilter = report.expenses.some((e) => e.categoryId === filterCategoryId) ? filterCategoryId : null;
  const toggleFilter = (categoryId: number) => setFilterCategoryId((cur) => (cur === categoryId ? null : categoryId));

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Stack.Screen options={{ title: monthLabel(report.month) }} />

      <View>
        <Text style={styles.month}>{monthLabel(report.month)}</Text>
        {report.isCurrentMonth && <Text style={styles.muted}>{bn.report.currentNote}</Text>}
      </View>

      <View style={styles.cards}>
        <SummaryCard label={bn.dashboard.income} amount={summary.totals.income} />
        <SummaryCard label={bn.dashboard.expense} amount={summary.totals.expense} />
        <SummaryCard label={bn.dashboard.saving} amount={summary.totals.saving} />
        <SummaryCard label={bn.dashboard.inHand} amount={summary.totals.inHand} redWhenNegative />
      </View>

      <Text style={[styles.verdict, { color: verdict.color }]}>{verdict.text}</Text>

      {report.expenseRows.length > 0 && (
        <Card title={bn.report.expenseTable}>
          <ReportTable
            kind="expense"
            rows={report.expenseRows}
            selectedCategoryId={activeFilter}
            onRowPress={(r) => toggleFilter(r.categoryId)}
          />
          <Text style={styles.hint}>{bn.report.tapToFilter}</Text>
        </Card>
      )}

      {report.savingRows.length > 0 && (
        <Card title={bn.report.savingTable}>
          <ReportTable
            kind="saving"
            rows={report.savingRows}
            selectedCategoryId={activeFilter}
            onRowPress={(r) => toggleFilter(r.categoryId)}
          />
        </Card>
      )}

      <Card title={bn.report.incomes}>
        {report.incomes.length === 0 ? (
          <Text style={styles.muted}>{bn.report.noIncome}</Text>
        ) : (
          report.incomes.map((i) => (
            <View key={i.id} style={styles.incomeRow}>
              <Text style={styles.incomeSource}>{i.source}</Text>
              <Text style={styles.incomeAmount}>{formatTaka(i.amount)}</Text>
            </View>
          ))
        )}
      </Card>

      <Card title={bn.report.expenseList}>
        {activeFilter !== null && (
          <Pressable style={styles.filterChip} onPress={() => setFilterCategoryId(null)}>
            <Text style={styles.filterChipText}>
              {report.categoryNames.get(activeFilter)} · {bn.report.clearFilter}
            </Text>
          </Pressable>
        )}
        {report.expenses.length === 0 ? (
          <Text style={styles.muted}>{bn.report.noExpenses}</Text>
        ) : (
          <ExpenseList
            expenses={report.expenses}
            categoryNames={report.categoryNames}
            filterCategoryId={activeFilter}
            onPress={(e) => router.push({ pathname: '/expense/[id]', params: { id: String(e.id) } })}
          />
        )}
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background },
  content: { padding: spacing.md, gap: spacing.md, paddingBottom: spacing.lg },
  month: { fontSize: fontSize.xl, fontWeight: '700', color: colors.text },
  muted: { fontSize: fontSize.sm, color: colors.textMuted },
  cards: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  verdict: { fontSize: fontSize.lg, fontWeight: '700', textAlign: 'center', paddingVertical: spacing.xs },
  // Narrower side padding than other cards so the 4-column table fits a 6.4" screen.
  card: { backgroundColor: colors.surface, borderRadius: 10, paddingHorizontal: spacing.sm, paddingVertical: spacing.sm, gap: spacing.xs },
  cardTitle: { fontSize: fontSize.md, fontWeight: '700', color: colors.text, paddingHorizontal: spacing.xs },
  hint: { fontSize: 11, color: colors.textMuted, paddingHorizontal: spacing.xs },
  incomeRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: spacing.xs, paddingHorizontal: spacing.xs },
  incomeSource: { fontSize: fontSize.md, color: colors.text },
  incomeAmount: { fontSize: fontSize.md, color: colors.text, fontWeight: '600' },
  filterChip: {
    alignSelf: 'flex-start',
    backgroundColor: colors.primary,
    borderRadius: 16,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  filterChipText: { color: colors.onPrimary, fontSize: fontSize.sm, fontWeight: '600' },
});
