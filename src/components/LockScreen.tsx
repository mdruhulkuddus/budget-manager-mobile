import { useState } from 'react';
import { Image, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { bn } from '../i18n/bn';
import { checkPassword } from '../lib/lock';
import { colors, fontSize, spacing } from '../theme';

/**
 * Cover page rendered by the root layout instead of the app on every cold start, until the password is entered.
 * Content sits in the upper part of the screen so the keyboard never covers it.
 */
export function LockScreen({ onUnlock }: { onUnlock: () => void }) {
  const [value, setValue] = useState('');
  const [wrong, setWrong] = useState(false);

  const open = () => {
    if (checkPassword(value)) {
      onUnlock();
      return;
    }
    setWrong(true);
    setValue('');
  };

  return (
    <View style={styles.screen}>
      <Image source={require('../../assets/images/icon.png')} style={styles.icon} />
      <Text style={styles.title}>{bn.appName}</Text>

      <TextInput
        style={[styles.input, wrong && styles.inputWrong]}
        value={value}
        onChangeText={(text) => {
          setValue(text);
          setWrong(false);
        }}
        placeholder={bn.lock.prompt}
        placeholderTextColor={colors.textMuted}
        accessibilityLabel={bn.lock.prompt}
        keyboardType="number-pad"
        secureTextEntry
        autoFocus
        maxLength={8}
        onSubmitEditing={open}
      />
      <Text style={styles.error}>{wrong ? bn.lock.wrong : ' '}</Text>

      <Pressable style={styles.button} onPress={open}>
        <Text style={styles.buttonText}>{bn.lock.open}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: 'center',
    paddingTop: '22%',
    paddingHorizontal: spacing.lg,
  },
  icon: { width: 88, height: 88, borderRadius: 20 },
  title: { fontSize: fontSize.xl, fontWeight: '700', color: colors.text, marginTop: spacing.sm, marginBottom: spacing.lg },
  input: {
    width: '100%',
    maxWidth: 280,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    backgroundColor: colors.surface,
    paddingVertical: spacing.sm + 4,
    fontSize: fontSize.lg,
    color: colors.text,
    textAlign: 'center',
  },
  inputWrong: { borderColor: colors.over },
  error: { fontSize: fontSize.sm, color: colors.over, marginTop: spacing.xs, marginBottom: spacing.sm },
  button: {
    width: '100%',
    maxWidth: 280,
    backgroundColor: colors.primary,
    borderRadius: 8,
    paddingVertical: spacing.sm + 4,
    alignItems: 'center',
  },
  buttonText: { color: colors.onPrimary, fontSize: fontSize.md, fontWeight: '600' },
});
