import { router, useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { ExpenseList } from '../../src/components/ExpenseList';
import { showError } from '../../src/components/showError';
import * as categories from '../../src/db/categories';
import * as expenses from '../../src/db/expenses';
import { bn } from '../../src/i18n/bn';
import { colors, fontSize, spacing } from '../../src/theme';

const RECENT_LIMIT = 10;

export default function DashboardScreen() {
  const db = useSQLiteContext();
  const [recent, setRecent] = useState<expenses.Expense[]>([]);
  const [categoryNames, setCategoryNames] = useState(new Map<number, string>());

  // Refresh whenever the tab regains focus, e.g. after closing the expense form.
  useFocusEffect(
    useCallback(() => {
      let active = true;
      Promise.all([expenses.listRecent(db, RECENT_LIMIT), categories.listAll(db)])
        .then(([rows, cats]) => {
          if (!active) return;
          setRecent(rows);
          setCategoryNames(new Map(cats.map((c) => [c.id, c.name])));
        })
        .catch(showError);
      return () => {
        active = false;
      };
    }, [db]),
  );

  return (
    <View style={styles.screen}>
      {/* TODO(session-4): replace with the real dashboard; the recent list is temporary. */}
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.card}>
          <Text style={styles.title}>{bn.dashboard.recent}</Text>
          {recent.length === 0 ? (
            <Text style={styles.empty}>{bn.dashboard.noExpenses}</Text>
          ) : (
            <ExpenseList
              expenses={recent}
              categoryNames={categoryNames}
              onPress={(e) => router.push({ pathname: '/expense/[id]', params: { id: String(e.id) } })}
            />
          )}
        </View>
      </ScrollView>

      <Pressable style={styles.fab} onPress={() => router.push('/expense/new')} accessibilityRole="button">
        <Text style={styles.fabText}>{bn.dashboard.addExpense}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  // Bottom padding keeps the last row clear of the FAB.
  content: { padding: spacing.md, paddingBottom: 96 },
  card: { backgroundColor: colors.surface, borderRadius: 10, padding: spacing.md, gap: spacing.sm },
  title: { fontSize: fontSize.md, fontWeight: '700', color: colors.text },
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
