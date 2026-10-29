import { router, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { ExpenseForm } from '../../src/components/ExpenseForm';
import { showError } from '../../src/components/showError';
import * as expenses from '../../src/db/expenses';
import { bn } from '../../src/i18n/bn';
import { colors, fontSize } from '../../src/theme';

export default function EditExpenseScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const db = useSQLiteContext();
  // undefined = loading, null = not found
  const [expense, setExpense] = useState<expenses.Expense | null | undefined>(undefined);

  useEffect(() => {
    let active = true;
    expenses
      .getById(db, Number(id))
      .then((e) => active && setExpense(e))
      .catch(showError);
    return () => {
      active = false;
    };
  }, [db, id]);

  if (expense === undefined) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }
  if (expense === null) {
    return (
      <View style={styles.center}>
        <Text style={styles.notFound}>{bn.expense.notFound}</Text>
      </View>
    );
  }
  return <ExpenseForm original={expense} onDone={() => router.back()} />;
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background },
  notFound: { fontSize: fontSize.md, color: colors.textMuted },
});
