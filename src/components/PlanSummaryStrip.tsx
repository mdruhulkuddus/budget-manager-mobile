import { StyleSheet, Text, View } from 'react-native';

import { bn } from '../i18n/bn';
import type { PlanSummary } from '../lib/calc';
import { formatTaka } from '../lib/format';
import { colors, fontSize, spacing } from '../theme';

function Cell({ label, amount }: { label: string; amount: number }) {
  return (
    <View style={styles.cell}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.amount}>{formatTaka(amount)}</Text>
    </View>
  );
}

export function PlanSummaryStrip({ summary }: { summary: PlanSummary }) {
  const over = summary.isOverPlanned;
  return (
    <View style={styles.container}>
      <View style={styles.row}>
        <Cell label={bn.plan.totalIncome} amount={summary.income} />
        <Cell label={bn.plan.totalExpensePlan} amount={summary.plannedExpense} />
        <Cell label={bn.plan.totalSavingPlan} amount={summary.plannedSaving} />
      </View>
      <View style={[styles.unplanned, over && styles.unplannedOver]}>
        <Text style={[styles.unplannedLabel, over && styles.overText]}>{bn.plan.unplanned}</Text>
        <Text style={[styles.unplannedAmount, over && styles.overText]}>{formatTaka(summary.unplanned)}</Text>
      </View>
      {over && <Text style={styles.warning}>{bn.plan.overPlanned}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  row: { flexDirection: 'row', gap: spacing.sm },
  cell: { flex: 1 },
  label: { fontSize: fontSize.sm, color: colors.textMuted },
  amount: { fontSize: fontSize.md, color: colors.text, fontWeight: '600' },
  unplanned: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: 6,
    backgroundColor: colors.background,
  },
  unplannedOver: { backgroundColor: '#FDECEC' },
  unplannedLabel: { fontSize: fontSize.md, color: colors.text, fontWeight: '600' },
  unplannedAmount: { fontSize: fontSize.lg, color: colors.text, fontWeight: '700' },
  overText: { color: colors.over },
  warning: { fontSize: fontSize.sm, color: colors.over, textAlign: 'right' },
});
