import { Alert } from 'react-native';

import { bn } from '../i18n/bn';

/** For unexpected failures (DB errors). Validation errors are shown inline instead. */
export function showError(e: unknown) {
  console.error(e);
  Alert.alert(bn.common.error);
}
