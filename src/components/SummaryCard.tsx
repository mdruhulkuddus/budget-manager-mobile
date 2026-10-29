import { StyleSheet, Text, View } from 'react-native';

import { formatTaka } from '../lib/format';
import { colors, fontSize, spacing } from '../theme';

interface Props {
  label: string;
  amount: number;
  /** Show the amount in red when it is below zero (used for "হাতে আছে"). */
  redWhenNegative?: boolean;
}

export function SummaryCard({ label, amount, redWhenNegative = false }: Props) {
  const red = redWhenNegative && amount < 0;
  return (
    <View style={[styles.card, red && styles.cardRed]}>
      <Text style={styles.label}>{label}</Text>
      <Text style={[styles.amount, red && styles.amountRed]} numberOfLines={1} adjustsFontSizeToFit>
        {formatTaka(amount)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  // Two per row: the parent wraps, each card takes just under half the width.
  card: { flexBasis: '47%', flexGrow: 1, backgroundColor: colors.surface, borderRadius: 10, padding: spacing.md, gap: spacing.xs },
  cardRed: { backgroundColor: colors.overSoft },
  label: { fontSize: fontSize.sm, color: colors.textMuted },
  amount: { fontSize: fontSize.lg, fontWeight: '700', color: colors.text },
  amountRed: { color: colors.over },
});
