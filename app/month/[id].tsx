import { useLocalSearchParams } from 'expo-router';

import { Placeholder } from '../../src/components/Placeholder';
import { bn } from '../../src/i18n/bn';

export default function MonthReportScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <Placeholder title={`${bn.screens.monthReport} #${id}`} />;
}
