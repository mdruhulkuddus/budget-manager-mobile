import { router, useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';

import { monthLabel } from '../../src/components/MonthSwitcher';
import { showError } from '../../src/components/showError';
import * as months from '../../src/db/months';
import { bn } from '../../src/i18n/bn';
import { buildMonthList, type MonthListItem } from '../../src/lib/calc';
import { currentYearMonth } from '../../src/lib/date';
import { formatTaka } from '../../src/lib/format';
import { colors, fontSize, spacing } from '../../src/theme';

function MonthRow({ item, isCurrent }: { item: MonthListItem; isCurrent: boolean }) {
  const spentColor = item.plannedExpense === 0 ? colors.text : item.isOver ? colors.over : colors.ok;
  return (
    <Pressable
      style={styles.row}
      onPress={() => router.push({ pathname: '/month/[id]', params: { id: String(item.id) } })}>
      <View style={styles.rowTop}>
        <Text style={styles.month}>{monthLabel(item)}</Text>
        {isCurrent && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{bn.monthList.current}</Text>
          </View>
        )}
      </View>
      <Text style={styles.totals}>
        {bn.monthList.expense} <Text style={[styles.spent, { color: spentColor }]}>{formatTaka(item.spentExpense)}</Text>
        {item.plannedExpense > 0 && <Text style={styles.muted}> / {formatTaka(item.plannedExpense)}</Text>}
        <Text style={styles.muted}>
          {'   ·   '}
          {bn.monthList.saving} {formatTaka(item.spentSaving)}
        </Text>
      </Text>
    </Pressable>
  );
}

export default function MonthsScreen() {
  const db = useSQLiteContext();
  const [items, setItems] = useState<MonthListItem[] | null>(null);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      months
        .listWithTotals(db)
        .then((rows) => active && setItems(buildMonthList(rows)))
        .catch(showError);
      return () => {
        active = false;
      };
    }, [db]),
  );

  if (!items) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  const now = currentYearMonth();
  return (
    <FlatList
      style={styles.screen}
      contentContainerStyle={items.length === 0 ? styles.emptyContainer : styles.content}
      data={items}
      keyExtractor={(m) => String(m.id)}
      renderItem={({ item }) => <MonthRow item={item} isCurrent={item.year === now.year && item.month === now.month} />}
      ListEmptyComponent={<Text style={styles.empty}>{bn.monthList.empty}</Text>}
    />
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background },
  content: { padding: spacing.md, gap: spacing.sm },
  emptyContainer: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.md },
  empty: { fontSize: fontSize.md, color: colors.textMuted },
  row: { backgroundColor: colors.surface, borderRadius: 10, padding: spacing.md, gap: spacing.xs },
  rowTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  month: { fontSize: fontSize.lg, fontWeight: '700', color: colors.text },
  badge: { backgroundColor: colors.primary, borderRadius: 10, paddingHorizontal: spacing.sm, paddingVertical: 2 },
  badgeText: { color: colors.onPrimary, fontSize: fontSize.sm, fontWeight: '600' },
  totals: { fontSize: fontSize.md, color: colors.text },
  spent: { fontWeight: '700' },
  muted: { color: colors.textMuted },
});
