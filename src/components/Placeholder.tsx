import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { bn } from '../i18n/bn';
import { colors, fontSize, spacing } from '../theme';

export function Placeholder({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.subtitle}>{bn.placeholder}</Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.background,
    padding: spacing.md,
  },
  title: { fontSize: fontSize.lg, color: colors.text, fontWeight: '600' },
  subtitle: { fontSize: fontSize.md, color: colors.textMuted },
});
