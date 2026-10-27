import { Link } from 'expo-router';
import { Tabs } from 'expo-router/js-tabs';
import { StyleSheet, Text } from 'react-native';

import { bn } from '../../src/i18n/bn';
import { colors, fontSize, spacing } from '../../src/theme';

function SettingsLink() {
  return (
    <Link href="/settings" style={styles.settingsLink}>
      <Text style={styles.settingsLinkText}>{bn.settingsLink}</Text>
    </Link>
  );
}

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: colors.surface },
        headerTintColor: colors.text,
        headerRight: () => <SettingsLink />,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarIcon: () => null,
        tabBarLabelStyle: { fontSize: fontSize.md },
      }}>
      <Tabs.Screen name="index" options={{ title: bn.tabs.dashboard }} />
      <Tabs.Screen name="plan" options={{ title: bn.tabs.plan }} />
      <Tabs.Screen name="months" options={{ title: bn.tabs.months }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  settingsLink: { paddingHorizontal: spacing.md },
  settingsLinkText: { color: colors.primary, fontSize: fontSize.md },
});
