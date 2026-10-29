import { router, useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { type ReactNode, useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { CategoryProgressRow } from '../../src/components/CategoryProgressRow';
import { ExpenseList } from '../../src/components/ExpenseList';
import { monthLabel } from '../../src/components/MonthSwitcher';
import { showError } from '../../src/components/showError';
import { SummaryCard } from '../../src/components/SummaryCard';
import { type DashboardData, getMonthSummary } from '../../src/db/dashboard';
import { bn } from '../../src/i18n/bn';
import { currentYearMonth, daysLeftInMonth, today } from '../../src/lib/date';
import { toBengaliDigits } from '../../src/lib/format';
import { colors, fontSize, spacing } from '../../src/theme';

function Card({ children }: { children: ReactNode }) {
  return <View style={styles.card}>{children}</View>;
}

export default function DashboardScreen() {
  const db = useSQLiteContext();
  const [data, setData] = useState<DashboardData | null>(null);

  // Always the current calendar month, re-read on every focus (also picks up a month rollover).
  useFocusEffect(
    useCallback(() => {
      let active = true;
      const { year, month } = currentYearMonth();
      getMonthSummary(db, year, month)
        .then((d) => active && setData(d))
        .catch(showError);
      return () => {
        active = false;
      };
    }, [db]),
  );

  if (!data) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  const { month, summary, recent, categoryNames } = data;
  const daysLeft = daysLeftInMonth(today());

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Text style={styles.month}>{monthLabel(month)}</Text>
          <Text style={styles.daysLeft}>
            {daysLeft === 0 ? bn.dashboard.lastDay : bn.dashboard.daysLeft(toBengaliDigits(daysLeft))}
          </Text>
        </View>

        <View style={styles.cards}>
          <SummaryCard label={bn.dashboard.income} amount={summary.totals.income} />
          <SummaryCard label={bn.dashboard.expense} amount={summary.totals.expense} />
          <SummaryCard label={bn.dashboard.saving} amount={summary.totals.saving} />
          <SummaryCard label={bn.dashboard.inHand} amount={summary.totals.inHand} redWhenNegative />
        </View>

        {summary.hasPlan ? (
          <Card>
            <CategoryProgressRow
              large
              row={{
                ...summary.overall,
                name: bn.dashboard.totalExpense,
                type: 'expense',
                hasPlan: summary.overall.planned > 0,
              }}
            />
          </Card>
        ) : (
          <Card>
            <Text style={styles.noPlan}>{bn.dashboard.noPlanTitle}</Text>
            <Pressable style={styles.planButton} onPress={() => router.navigate('/plan')}>
              <Text style={styles.planButtonText}>{bn.dashboard.planNow}</Text>
            </Pressable>
          </Card>
        )}

        {summary.expenseRows.length > 0 && (
          <Card>
            <Text style={styles.sectionTitle}>{bn.dashboard.expenseGroup}</Text>
            {summary.expenseRows.map((row) => (
              <CategoryProgressRow key={row.categoryId} row={row} />
            ))}
          </Card>
        )}

        {summary.savingRows.length > 0 && (
          <Card>
            <Text style={styles.sectionTitle}>{bn.dashboard.savingGroup}</Text>
            {summary.savingRows.map((row) => (
              <CategoryProgressRow key={row.categoryId} row={row} />
            ))}
          </Card>
        )}

        <Card>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>{bn.dashboard.recent}</Text>
            <Pressable
              hitSlop={spacing.sm}
              onPress={() => router.push({ pathname: '/month/[id]', params: { id: String(month.id) } })}>
              <Text style={styles.seeAll}>{bn.dashboard.seeAll}</Text>
            </Pressable>
          </View>
          {recent.length === 0 ? (
            <Text style={styles.empty}>{bn.dashboard.noExpenses}</Text>
          ) : (
            <ExpenseList
              expenses={recent}
              categoryNames={categoryNames}
              onPress={(e) => router.push({ pathname: '/expense/[id]', params: { id: String(e.id) } })}
            />
          )}
        </Card>
      </ScrollView>

      <Pressable style={styles.fab} onPress={() => router.push('/expense/new')} accessibilityRole="button">
        <Text style={styles.fabText}>{bn.dashboard.addExpense}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background },
  // Bottom padding keeps the last row clear of the FAB.
  content: { padding: spacing.md, paddingBottom: 96, gap: spacing.md },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: spacing.sm },
  month: { fontSize: fontSize.xl, fontWeight: '700', color: colors.text },
  daysLeft: { flexShrink: 1, fontSize: fontSize.sm, color: colors.textMuted, textAlign: 'right' },
  cards: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  card: { backgroundColor: colors.surface, borderRadius: 10, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sectionTitle: { fontSize: fontSize.md, fontWeight: '700', color: colors.text, paddingVertical: spacing.xs },
  seeAll: { fontSize: fontSize.sm, color: colors.primary, fontWeight: '600' },
  noPlan: { fontSize: fontSize.md, color: colors.text, paddingVertical: spacing.sm },
  planButton: {
    alignSelf: 'flex-start',
    backgroundColor: colors.primary,
    borderRadius: 6,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginBottom: spacing.sm,
  },
  planButtonText: { color: colors.onPrimary, fontSize: fontSize.md, fontWeight: '600' },
  empty: { fontSize: fontSize.sm, color: colors.textMuted, paddingVertical: spacing.sm },
  fab: {
    position: 'absolute',
    right: spacing.md,
    bottom: spacing.md,
    backgroundColor: colors.primary,
    borderRadius: 28,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    elevation: 4,
  },
  fabText: { color: colors.onPrimary, fontSize: fontSize.lg, fontWeight: '700' },
});
