import { useState } from 'react';
import { Alert, Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { bn } from '../i18n/bn';
import { parseTaka } from '../lib/format';
import { colors, fontSize, spacing } from '../theme';

interface Props {
  /** Existing income to edit; omit to add a new one. */
  initial?: { source: string; amount: number };
  onSave: (input: { source: string; amount: number }) => void;
  onDelete?: () => void;
  onClose: () => void;
}

/** Mount only while open (with a `key`), so the form starts fresh each time. */
export function IncomeModal({ initial, onSave, onDelete, onClose }: Props) {
  const [source, setSource] = useState(initial?.source ?? '');
  const [amountText, setAmountText] = useState(initial ? String(initial.amount) : '');

  const amount = parseTaka(amountText);
  const canSave = source.trim().length > 0 && amount > 0;

  const confirmDelete = () =>
    Alert.alert(bn.incomeModal.editTitle, bn.incomeModal.deleteConfirm, [
      { text: bn.common.cancel, style: 'cancel' },
      { text: bn.common.delete, style: 'destructive', onPress: onDelete },
    ]);

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        {/* Card sits near the top so the keyboard never covers it. */}
        <Pressable style={styles.card} onPress={() => {}}>
          <Text style={styles.title}>{initial ? bn.incomeModal.editTitle : bn.incomeModal.addTitle}</Text>

          <Text style={styles.label}>{bn.incomeModal.source}</Text>
          <TextInput style={styles.input} value={source} onChangeText={setSource} autoFocus={!initial} />
          <View style={styles.chips}>
            {bn.incomeModal.sourceSuggestions.map((s) => (
              <Pressable key={s} style={[styles.chip, source === s && styles.chipActive]} onPress={() => setSource(s)}>
                <Text style={[styles.chipText, source === s && styles.chipTextActive]}>{s}</Text>
              </Pressable>
            ))}
          </View>

          <Text style={styles.label}>{bn.incomeModal.amount}</Text>
          <TextInput style={styles.input} value={amountText} onChangeText={setAmountText} keyboardType="number-pad" />

          <View style={styles.actions}>
            {onDelete && (
              <Pressable onPress={confirmDelete} style={styles.button}>
                <Text style={styles.deleteText}>{bn.common.delete}</Text>
              </Pressable>
            )}
            <View style={styles.spacer} />
            <Pressable onPress={onClose} style={styles.button}>
              <Text style={styles.cancelText}>{bn.common.cancel}</Text>
            </Pressable>
            <Pressable
              onPress={() => onSave({ source: source.trim(), amount })}
              disabled={!canSave}
              style={[styles.button, styles.saveButton, !canSave && styles.disabled]}>
              <Text style={styles.saveText}>{bn.common.save}</Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', paddingHorizontal: spacing.md, paddingTop: 80 },
  card: { backgroundColor: colors.surface, borderRadius: 12, padding: spacing.md, gap: spacing.sm },
  title: { fontSize: fontSize.lg, fontWeight: '600', color: colors.text, marginBottom: spacing.xs },
  label: { fontSize: fontSize.sm, color: colors.textMuted },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 6,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    fontSize: fontSize.md,
    color: colors.text,
  },
  chips: { flexDirection: 'row', gap: spacing.sm },
  chip: { borderWidth: 1, borderColor: colors.border, borderRadius: 16, paddingHorizontal: spacing.md, paddingVertical: spacing.xs },
  chipActive: { borderColor: colors.primary, backgroundColor: colors.primary },
  chipText: { color: colors.text, fontSize: fontSize.sm },
  chipTextActive: { color: colors.onPrimary },
  actions: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.sm },
  spacer: { flex: 1 },
  button: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: 6 },
  saveButton: { backgroundColor: colors.primary },
  disabled: { opacity: 0.4 },
  saveText: { color: colors.onPrimary, fontSize: fontSize.md, fontWeight: '600' },
  cancelText: { color: colors.textMuted, fontSize: fontSize.md },
  deleteText: { color: colors.over, fontSize: fontSize.md },
});
