import { checkPassword } from '../src/lib/lock';

describe('checkPassword', () => {
  it('accepts 2026 in ASCII or Bengali digits, ignoring surrounding spaces', () => {
    expect(checkPassword('2026')).toBe(true);
    expect(checkPassword('২০২৬')).toBe(true);
    expect(checkPassword(' 2026 ')).toBe(true);
  });

  it('rejects anything else', () => {
    expect(checkPassword('')).toBe(false);
    expect(checkPassword('2025')).toBe(false);
    expect(checkPassword('20260')).toBe(false);
    expect(checkPassword('20 26')).toBe(false);
  });
});
