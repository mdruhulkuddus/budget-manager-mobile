import { StyleSheet, View } from 'react-native';

import type { BarStatus } from '../lib/calc';
import { colors, statusColor } from '../theme';

interface Props {
  /** May exceed 100 or be Infinity (spent without a plan); the fill is clamped to 100%. */
  percent: number;
  status: BarStatus;
  height?: number;
}

export function ProgressBar({ percent, status, height = 8 }: Props) {
  const fill = Number.isFinite(percent) ? Math.min(100, Math.max(0, percent)) : 100;
  return (
    <View
      style={[styles.track, { height, borderRadius: height / 2 }]}
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: 100, now: Math.round(fill) }}>
      <View style={{ width: `${fill}%`, height, borderRadius: height / 2, backgroundColor: statusColor[status] }} />
    </View>
  );
}

const styles = StyleSheet.create({
  track: { width: '100%', backgroundColor: colors.track, overflow: 'hidden' },
});
