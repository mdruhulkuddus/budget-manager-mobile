import { Pressable, StyleSheet, Text, View } from 'react-native';

import { bn } from '../i18n/bn';
import { addMonths, type YearMonth } from '../lib/date';
import { toBengaliDigits } from '../lib/format';
import { colors, fontSize, spacing } from '../theme';

export function monthLabel({ year, month }: YearMonth): string {
  return `${bn.monthNames[month - 1]} ${toBengaliDigits(year)}`;
}

export function MonthSwitcher({ value, onChange }: { value: YearMonth; onChange: (next: YearMonth) => void }) {
  return (
    <View style={styles.row}>
      <Pressable
        onPress={() => onChange(addMonths(value, -1))}
        hitSlop={spacing.md}
        accessibilityRole="button"
        accessibilityLabel={bn.monthSwitcher.prev}
        style={styles.arrow}>
        <Text style={styles.arrowText}>◀</Text>
      </Pressable>
      <Text style={styles.label}>{monthLabel(value)}</Text>
      <Pressable
        onPress={() => onChange(addMonths(value, 1))}
        hitSlop={spacing.md}
        accessibilityRole="button"
        accessibilityLabel={bn.monthSwitcher.next}
        style={styles.arrow}>
        <Text style={styles.arrowText}>▶</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.lg, paddingVertical: spacing.sm },
  arrow: { paddingHorizontal: spacing.sm },
  arrowText: { fontSize: fontSize.lg, color: colors.primary },
  label: { fontSize: fontSize.lg, fontWeight: '600', color: colors.text, minWidth: 150, textAlign: 'center' },
});
