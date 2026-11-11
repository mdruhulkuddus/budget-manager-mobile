import { Stack } from 'expo-router';
import { SQLiteProvider } from 'expo-sqlite';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';

import { LockScreen } from '../src/components/LockScreen';
import { migrate } from '../src/db/migrations';
import { bn } from '../src/i18n/bn';
import { colors } from '../src/theme';

export default function RootLayout() {
  return (
    <SQLiteProvider databaseName="budget.db" onInit={migrate}>
      <StatusBar style="dark" />
      <App />
    </SQLiteProvider>
  );
}

/**
 * Holds the lock state *inside* SQLiteProvider: the provider is memo'd with a comparator that
 * ignores `children`, so state kept above it never reaches the screen when it changes.
 * The navigator mounts only after unlocking, so it starts on the dashboard.
 */
function App() {
  // In memory only, so every cold start begins locked.
  const [unlocked, setUnlocked] = useState(false);

  if (!unlocked) return <LockScreen onUnlock={() => setUnlocked(true)} />;

  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.surface },
        headerTintColor: colors.text,
        contentStyle: { backgroundColor: colors.background },
      }}>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="expense/new" options={{ title: bn.screens.newExpense, presentation: 'modal' }} />
      <Stack.Screen name="expense/[id]" options={{ title: bn.screens.editExpense }} />
      <Stack.Screen name="month/[id]" options={{ title: bn.screens.monthReport }} />
      <Stack.Screen name="settings" options={{ title: bn.screens.settings }} />
    </Stack>
  );
}
