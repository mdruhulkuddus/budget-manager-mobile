import { useRef, useState } from 'react';
import { StyleSheet, TextInput, type TextInputInstance } from 'react-native';

import { formatTaka, parseTaka } from '../lib/format';
import { colors, fontSize, spacing } from '../theme';
import type { Measurable } from './useKeyboardAwareScroll';

interface Props {
  value: number;
  /** Called on blur with the parsed amount (empty/invalid → 0). */
  onCommit: (amount: number) => void;
  onFocus?: (input: Measurable | null) => void;
  accessibilityLabel?: string;
}

/** Shows the formatted amount; switches to the raw number while editing. */
export function AmountInput({ value, onCommit, onFocus, accessibilityLabel }: Props) {
  const ref = useRef<TextInputInstance>(null);
  const [editingText, setEditingText] = useState<string | null>(null);

  return (
    <TextInput
      ref={ref}
      style={[styles.input, editingText !== null && styles.inputFocused]}
      value={editingText ?? formatTaka(value)}
      keyboardType="number-pad"
      returnKeyType="done"
      selectTextOnFocus
      accessibilityLabel={accessibilityLabel}
      onFocus={() => {
        setEditingText(value > 0 ? String(value) : '');
        onFocus?.(ref.current);
      }}
      onChangeText={setEditingText}
      onBlur={() => {
        const amount = parseTaka(editingText ?? '');
        setEditingText(null);
        onCommit(amount);
      }}
    />
  );
}

const styles = StyleSheet.create({
  input: {
    minWidth: 120,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 6,
    backgroundColor: colors.surface,
    color: colors.text,
    fontSize: fontSize.md,
    textAlign: 'right',
  },
  inputFocused: { borderColor: colors.primary },
});
