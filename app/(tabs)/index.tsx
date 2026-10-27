import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';
import { StyleSheet, Text } from 'react-native';

import { Placeholder } from '../../src/components/Placeholder';
import { listActive } from '../../src/db/categories';
import { bn } from '../../src/i18n/bn';
import { toBengaliDigits } from '../../src/lib/format';
import { colors, fontSize } from '../../src/theme';

export default function DashboardScreen() {
  // TODO(session-4): remove — dev check that migrations + seed ran.
  const db = useSQLiteContext();
  const [categoryCount, setCategoryCount] = useState<number | null>(null);
  useEffect(() => {
    listActive(db).then((rows) => setCategoryCount(rows.length));
  }, [db]);

  return (
    <Placeholder title={bn.tabs.dashboard}>
      <Text style={styles.dev}>
        {bn.dev.seededCategories}: {categoryCount === null ? '…' : toBengaliDigits(categoryCount)}
      </Text>
    </Placeholder>
  );
}

const styles = StyleSheet.create({
  dev: { fontSize: fontSize.md, color: colors.primary },
});
