import { Stack } from 'expo-router';
import { SQLiteProvider } from 'expo-sqlite';
import { StatusBar } from 'expo-status-bar';

import { migrate } from '../src/db/migrations';
import { bn } from '../src/i18n/bn';
import { colors } from '../src/theme';

export default function RootLayout() {
  return (
    <SQLiteProvider databaseName="budget.db" onInit={migrate}>
      <StatusBar style="dark" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: colors.surface },
          headerTintColor: colors.text,
          contentStyle: { backgroundColor: colors.background },
        }}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="expense/new" options={{ title: bn.screens.newExpense, presentation: 'modal' }} />
        <Stack.Screen name="month/[id]" options={{ title: bn.screens.monthReport }} />
        <Stack.Screen name="settings" options={{ title: bn.screens.settings }} />
      </Stack>
    </SQLiteProvider>
  );
}
