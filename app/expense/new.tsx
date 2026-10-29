import { router } from 'expo-router';

import { ExpenseForm } from '../../src/components/ExpenseForm';

export default function NewExpenseScreen() {
  return <ExpenseForm onDone={() => router.back()} />;
}
