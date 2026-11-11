import { fromBengaliDigits } from './format';

// A cover lock, not real security: the code ships inside the app and the database isn't encrypted.
// It only keeps a casual look at the phone from opening the budget.
const APP_PASSWORD = '2026';

/** Accepts ASCII or Bengali digits ("২০২৬"), ignoring surrounding spaces. */
export function checkPassword(input: string): boolean {
  return fromBengaliDigits(input.trim()) === APP_PASSWORD;
}
