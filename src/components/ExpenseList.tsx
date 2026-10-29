import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { Expense } from '../db/expenses';
import { groupByDate } from '../lib/date';
import { formatTaka } from '../lib/format';
import { colors, fontSize, spacing } from '../theme';
import { dateLabel } from './dateLabel';

interface Props {
  /** Already sorted newest first. */
  expenses: Expense[];
  categoryNames: Map<number, string>;
  onPress: (expense: Expense) => void;
}

export function ExpenseList({ expenses, categoryNames, onPress }: Props) {
  return (
    <View style={styles.list}>
      {groupByDate(expenses).map((group) => (
        <View key={group.date}>
          <View style={styles.groupHeader}>
            <Text style={styles.groupDate}>{dateLabel(group.date)}</Text>
            <Text style={styles.groupTotal}>{formatTaka(group.items.reduce((sum, e) => sum + e.amount, 0))}</Text>
          </View>
          {group.items.map((e) => (
            <Pressable key={e.id} style={styles.row} onPress={() => onPress(e)}>
              <Text style={styles.rowText} numberOfLines={1}>
                {categoryNames.get(e.categoryId) ?? '?'}
                {e.note ? <Text style={styles.note}> · {e.note}</Text> : null}
              </Text>
              <Text style={styles.amount}>{formatTaka(e.amount)}</Text>
            </Pressable>
          ))}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: spacing.sm },
  groupHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  groupDate: { fontSize: fontSize.sm, fontWeight: '600', color: colors.textMuted },
  groupTotal: { fontSize: fontSize.sm, color: colors.textMuted },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.sm },
  rowText: { flex: 1, fontSize: fontSize.md, color: colors.text },
  note: { color: colors.textMuted },
  amount: { fontSize: fontSize.md, fontWeight: '600', color: colors.text },
});
