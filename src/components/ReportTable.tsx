import { Pressable, StyleSheet, Text, View } from 'react-native';

import { bn } from '../i18n/bn';
import type { ReportRow } from '../lib/calc';
import { formatAmount, formatPercent, formatSigned } from '../lib/format';
import { colors, fontSize, spacing } from '../theme';

interface Props {
  kind: 'expense' | 'saving';
  rows: ReportRow[];
  selectedCategoryId?: number | null;
  onRowPress?: (row: ReportRow) => void;
}

/**
 * Planned / spent / difference per category, sized for a ~360dp-wide phone: amounts without ৳,
 * fixed-width right-aligned number columns, the name column takes the rest and wraps.
 */
export function ReportTable({ kind, rows, selectedCategoryId, onRowPress }: Props) {
  const isExpense = kind === 'expense';
  const planned = rows.reduce((acc, r) => acc + r.planned, 0);
  const spent = rows.reduce((acc, r) => acc + r.spent, 0);

  // Expense: left over is good (green), over plan is bad (red).
  // Saving: reaching or passing the target is good; never red.
  const diffColor = (difference: number) => {
    if (isExpense) return difference > 0 ? colors.ok : difference < 0 ? colors.over : colors.textMuted;
    return difference <= 0 ? colors.done : colors.textMuted;
  };

  return (
    <View>
      <View style={[styles.row, styles.headerRow]}>
        <Text style={[styles.name, styles.headerText]}>{bn.report.colCategory}</Text>
        <Text style={[styles.num, styles.headerText]}>{bn.report.colPlanned}</Text>
        <Text style={[styles.num, styles.headerText]}>{isExpense ? bn.report.colSpent : bn.report.colSaved}</Text>
        <Text style={[styles.num, styles.headerText]}>{bn.report.colDifference}</Text>
      </View>

      {rows.map((r) => {
        const overRow = isExpense && r.difference < 0;
        const selected = r.categoryId === selectedCategoryId;
        return (
          <Pressable
            key={r.categoryId}
            onPress={onRowPress ? () => onRowPress(r) : undefined}
            style={[styles.row, overRow && styles.overRow, selected && styles.selectedRow]}>
            <Text style={[styles.name, overRow && styles.overText]} numberOfLines={2}>
              {r.name}
              {isExpense && <Text style={styles.share}> {formatPercent(r.share)}</Text>}
            </Text>
            <Text style={[styles.num, overRow && styles.overText]} numberOfLines={1} adjustsFontSizeToFit>
              {formatAmount(r.planned)}
            </Text>
            <Text style={[styles.num, overRow && styles.overText]} numberOfLines={1} adjustsFontSizeToFit>
              {formatAmount(r.spent)}
            </Text>
            <Text style={[styles.num, styles.diff, { color: diffColor(r.difference) }]} numberOfLines={1} adjustsFontSizeToFit>
              {formatSigned(r.difference)}
            </Text>
          </Pressable>
        );
      })}

      <View style={[styles.row, styles.totalRow]}>
        <Text style={[styles.name, styles.totalText]}>{bn.report.total}</Text>
        <Text style={[styles.num, styles.totalText]} numberOfLines={1} adjustsFontSizeToFit>
          {formatAmount(planned)}
        </Text>
        <Text style={[styles.num, styles.totalText]} numberOfLines={1} adjustsFontSizeToFit>
          {formatAmount(spent)}
        </Text>
        <Text style={[styles.num, styles.totalText, { color: diffColor(planned - spent) }]} numberOfLines={1} adjustsFontSizeToFit>
          {formatSigned(planned - spent)}
        </Text>
      </View>
    </View>
  );
}

const NUM_WIDTH = 66;

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xs,
    borderRadius: 4,
  },
  headerRow: { paddingVertical: spacing.xs, borderBottomWidth: 1, borderBottomColor: colors.border, borderRadius: 0 },
  headerText: { fontSize: fontSize.sm, color: colors.textMuted, fontWeight: '600' },
  name: { flex: 1, fontSize: fontSize.sm, color: colors.text },
  share: { fontSize: 11, color: colors.textMuted },
  num: { width: NUM_WIDTH, fontSize: fontSize.sm, color: colors.text, textAlign: 'right' },
  diff: { fontWeight: '600' },
  overRow: { backgroundColor: colors.overSoft },
  overText: { color: colors.over },
  selectedRow: { borderWidth: 1, borderColor: colors.primary },
  totalRow: { borderTopWidth: 1, borderTopColor: colors.text, borderRadius: 0, marginTop: spacing.xs },
  totalText: { fontWeight: '700' },
});
