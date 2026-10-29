import { StyleSheet, Text, View } from 'react-native';

import { bn } from '../i18n/bn';
import type { CategoryRow } from '../lib/calc';
import { formatPercent, formatTaka } from '../lib/format';
import { colors, fontSize, spacing, statusColor } from '../theme';
import { ProgressBar } from './ProgressBar';

export type ProgressRowData = Pick<
  CategoryRow,
  'name' | 'type' | 'planned' | 'spent' | 'remaining' | 'percent' | 'hasPlan' | 'status'
>;

/** The line under the bar: "৮৭% · বাকি ৳৮০০", "৳৩০০ বেশি", "প্ল্যান নেই" or "✓". */
function caption(row: ProgressRowData): { text: string; color: string } {
  if (!row.hasPlan) {
    // Unplanned spending is a problem; unplanned saving is not.
    return { text: bn.progress.noPlan, color: row.type === 'expense' ? colors.over : colors.textMuted };
  }
  if (row.status === 'done') return { text: bn.progress.done, color: colors.done };
  if (row.remaining < 0) return { text: `${formatTaka(-row.remaining)} ${bn.progress.over}`, color: colors.over };
  const text = `${formatPercent(row.percent)} · ${bn.progress.remaining} ${formatTaka(row.remaining)}`;
  return { text, color: row.status === 'warn' ? colors.warn : colors.textMuted };
}

export function CategoryProgressRow({ row, large = false }: { row: ProgressRowData; large?: boolean }) {
  const { text, color } = caption(row);
  return (
    <View style={styles.row}>
      <View style={styles.header}>
        <Text style={[styles.name, large && styles.large]} numberOfLines={1}>
          {row.name}
        </Text>
        <Text style={[styles.amounts, large && styles.large]}>
          {formatTaka(row.spent)}
          {row.hasPlan && <Text style={styles.planned}> / {formatTaka(row.planned)}</Text>}
        </Text>
      </View>
      <ProgressBar percent={row.percent} status={row.status} height={large ? 12 : 8} />
      <Text style={[styles.caption, { color }, row.status === 'over' || row.status === 'done' ? styles.bold : null]}>
        {text}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { gap: spacing.xs, paddingVertical: spacing.sm },
  header: { flexDirection: 'row', alignItems: 'baseline', gap: spacing.sm },
  name: { flex: 1, fontSize: fontSize.md, color: colors.text },
  amounts: { fontSize: fontSize.md, fontWeight: '600', color: colors.text },
  planned: { fontWeight: '400', color: colors.textMuted },
  large: { fontSize: fontSize.lg, fontWeight: '700' },
  caption: { fontSize: fontSize.sm },
  bold: { fontWeight: '700' },
});
