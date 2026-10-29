import { useState } from 'react';
import { Alert, Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import type { Category, CategoryWithUsage } from '../db/categories';
import { bn } from '../i18n/bn';
import type { CategoryType } from '../lib/calc';
import { isCategoryUsed, normalizeName, validateCategoryName } from '../lib/categories';
import { colors, fontSize, spacing } from '../theme';

interface Props {
  /** Category to edit; omit to add a new one. */
  category?: CategoryWithUsage;
  /** Default type for a new category. */
  defaultType?: CategoryType;
  /** All categories, for the duplicate-name check. */
  existing: Category[];
  onSave: (input: { name: string; type: CategoryType }) => void;
  onArchive?: () => void;
  onDelete?: () => void;
  onClose: () => void;
}

const TYPES: { type: CategoryType; label: string }[] = [
  { type: 'expense', label: bn.categoryModal.typeExpense },
  { type: 'saving', label: bn.categoryModal.typeSaving },
];

/** Add / rename a category; in edit mode also archive, and delete or change type while unused. Mount only while open. */
export function CategoryModal({ category, defaultType = 'expense', existing, onSave, onArchive, onDelete, onClose }: Props) {
  const [name, setName] = useState(category?.name ?? '');
  const [type, setType] = useState<CategoryType>(category?.type ?? defaultType);
  // Show "empty" only after the user tried to save; a duplicate shows while typing.
  const [triedSave, setTriedSave] = useState(false);

  const used = category ? isCategoryUsed(category) : false;
  const error = validateCategoryName(name, existing, category?.id);
  const visibleError = error === 'duplicate' || (error === 'empty' && triedSave) ? error : null;

  const save = () => {
    setTriedSave(true);
    if (error) return;
    onSave({ name: normalizeName(name), type });
  };

  const confirm = (message: string, action: string, onPress?: () => void) =>
    Alert.alert(category?.name ?? '', message, [
      { text: bn.common.cancel, style: 'cancel' },
      { text: action, style: 'destructive', onPress },
    ]);

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        {/* Card sits near the top so the keyboard never covers it. */}
        <Pressable style={styles.card} onPress={() => {}}>
          <Text style={styles.title}>{category ? bn.categoryModal.editTitle : bn.categoryModal.addTitle}</Text>

          <Text style={styles.label}>{bn.categoryModal.name}</Text>
          <TextInput
            style={[styles.input, visibleError && styles.inputError]}
            value={name}
            onChangeText={setName}
            autoFocus={!category}
            onSubmitEditing={save}
          />
          {visibleError && (
            <Text style={styles.error}>
              {visibleError === 'empty' ? bn.categoryModal.errorEmpty : bn.categoryModal.errorDuplicate}
            </Text>
          )}

          {!used && (
            <>
              <Text style={styles.label}>{bn.categoryModal.type}</Text>
              <View style={styles.chips}>
                {TYPES.map((t) => (
                  <Pressable key={t.type} style={[styles.chip, type === t.type && styles.chipActive]} onPress={() => setType(t.type)}>
                    <Text style={[styles.chipText, type === t.type && styles.chipTextActive]}>{t.label}</Text>
                  </Pressable>
                ))}
              </View>
            </>
          )}
          {used && <Text style={styles.note}>{bn.categoryModal.usedNote}</Text>}

          <View style={styles.actions}>
            {onDelete && !used && (
              <Pressable onPress={() => confirm(bn.categoryModal.deleteConfirm, bn.common.delete, onDelete)} style={styles.button}>
                <Text style={styles.dangerText}>{bn.common.delete}</Text>
              </Pressable>
            )}
            {onArchive && (
              <Pressable onPress={() => confirm(bn.categoryModal.archiveConfirm, bn.categoryModal.archive, onArchive)} style={styles.button}>
                <Text style={styles.dangerText}>{bn.categoryModal.archive}</Text>
              </Pressable>
            )}
            <View style={styles.spacer} />
            <Pressable onPress={onClose} style={styles.button}>
              <Text style={styles.cancelText}>{bn.common.cancel}</Text>
            </Pressable>
            <Pressable onPress={save} style={[styles.button, styles.saveButton, error === 'duplicate' && styles.disabled]}>
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
  inputError: { borderColor: colors.over },
  error: { fontSize: fontSize.sm, color: colors.over },
  note: { fontSize: fontSize.sm, color: colors.textMuted },
  chips: { flexDirection: 'row', gap: spacing.sm },
  chip: { borderWidth: 1, borderColor: colors.border, borderRadius: 16, paddingHorizontal: spacing.md, paddingVertical: spacing.xs },
  chipActive: { borderColor: colors.primary, backgroundColor: colors.primary },
  chipText: { color: colors.text, fontSize: fontSize.sm },
  chipTextActive: { color: colors.onPrimary },
  actions: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginTop: spacing.sm },
  spacer: { flex: 1 },
  button: { paddingHorizontal: spacing.sm, paddingVertical: spacing.sm, borderRadius: 6 },
  saveButton: { backgroundColor: colors.primary, paddingHorizontal: spacing.md },
  disabled: { opacity: 0.4 },
  saveText: { color: colors.onPrimary, fontSize: fontSize.md, fontWeight: '600' },
  cancelText: { color: colors.textMuted, fontSize: fontSize.md },
  dangerText: { color: colors.over, fontSize: fontSize.md },
});
