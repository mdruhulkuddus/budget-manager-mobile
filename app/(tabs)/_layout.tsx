import { Link } from 'expo-router';
import { Tabs } from 'expo-router/js-tabs';
import { StyleSheet, Text } from 'react-native';

import { bn } from '../../src/i18n/bn';
import { colors, fontSize, spacing } from '../../src/theme';

/** Gear in the dashboard header. A text glyph, since the app uses no icon library. */
function SettingsLink() {
  return (
    <Link href="/settings" accessibilityLabel={bn.settingsLink} style={styles.settingsLink}>
      <Text style={styles.settingsLinkText}>⚙</Text>
    </Link>
  );
}

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: colors.surface },
        headerTintColor: colors.text,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarIcon: () => null,
        tabBarHideOnKeyboard: true,
        tabBarLabelStyle: { fontSize: fontSize.md },
      }}>
      <Tabs.Screen name="index" options={{ title: bn.tabs.dashboard, headerRight: () => <SettingsLink /> }} />
      <Tabs.Screen name="plan" options={{ title: bn.tabs.plan }} />
      <Tabs.Screen name="months" options={{ title: bn.tabs.months }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  settingsLink: { paddingHorizontal: spacing.md, paddingVertical: spacing.xs },
  settingsLinkText: { color: colors.text, fontSize: 24 },
});
