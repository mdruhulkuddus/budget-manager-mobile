import { formatTaka, groupDigits, parseTaka, toBengaliDigits } from '../src/lib/format';

describe('toBengaliDigits', () => {
  it('maps every ASCII digit', () => {
    expect(toBengaliDigits('0123456789')).toBe('০১২৩৪৫৬৭৮৯');
  });

  it('leaves non-digits alone', () => {
    expect(toBengaliDigits('2026-10-27 ৳,')).toBe('২০২৬-১০-২৭ ৳,');
  });

  it('accepts numbers', () => {
    expect(toBengaliDigits(42)).toBe('৪২');
  });
});

describe('groupDigits', () => {
  it.each([
    [0, '0'],
    [999, '999'],
    [1000, '1,000'],
    [28500, '28,500'],
    [100000, '1,00,000'],
    [1234567, '12,34,567'],
    [123456789, '12,34,56,789'],
  ])('%p → %s', (n, expected) => {
    expect(groupDigits(n)).toBe(expected);
  });
});

describe('formatTaka', () => {
  it('formats with taka sign, Bengali digits and separators', () => {
    expect(formatTaka(28500)).toBe('৳২৮,৫০০');
  });

  it('uses lakh grouping', () => {
    expect(formatTaka(125000)).toBe('৳১,২৫,০০০');
  });

  it('formats zero', () => {
    expect(formatTaka(0)).toBe('৳০');
  });

  it('puts a leading minus on negatives', () => {
    expect(formatTaka(-1200)).toBe('-৳১,২০০');
  });

  it('does not show -0', () => {
    expect(formatTaka(-0.2)).toBe('৳০');
  });
});

describe('parseTaka', () => {
  it.each([
    ['50000', 50000],
    ['৫০০০০', 50000],
    ['50,000', 50000],
    ['৳২৮,৫০০', 28500],
    ['  1 200 ', 1200],
    ['1২3', 123],
    ['0', 0],
    ['007', 7],
  ])('%p → %p', (input, expected) => {
    expect(parseTaka(input)).toBe(expected);
  });

  it.each([[''], ['   '], ['abc'], ['12a'], ['-500'], ['12.5'], ['৳'], ['99999999999999999999']])(
    'invalid %p → 0',
    (input) => {
      expect(parseTaka(input)).toBe(0);
    },
  );

  it('round-trips formatTaka', () => {
    expect(parseTaka(formatTaka(1234567))).toBe(1234567);
  });
});
