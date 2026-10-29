import { isCategoryUsed, moveCategory, normalizeName, validateCategoryName } from '../src/lib/categories';

const c = (id: number, name: string, extra: { type?: 'expense' | 'saving'; isArchived?: boolean } = {}) => ({
  id,
  name,
  type: extra.type ?? ('expense' as const),
  isArchived: extra.isArchived ?? false,
});

describe('normalizeName', () => {
  it('trims and collapses inner whitespace', () => {
    expect(normalizeName('  বাসা   ভাড়া ')).toBe('বাসা ভাড়া');
  });
});

describe('validateCategoryName', () => {
  const list = [c(1, 'বাজার'), c(2, 'Food'), c(3, 'পুরনো', { isArchived: true })];

  it('rejects empty and whitespace-only names', () => {
    expect(validateCategoryName('', list)).toBe('empty');
    expect(validateCategoryName('   ', list)).toBe('empty');
  });

  it('rejects a duplicate active name, trimmed and case-insensitive', () => {
    expect(validateCategoryName(' বাজার ', list)).toBe('duplicate');
    expect(validateCategoryName('fOOD', list)).toBe('duplicate');
  });

  it('allows the name of an archived category', () => {
    expect(validateCategoryName('পুরনো', list)).toBeNull();
  });

  it('allows keeping (or re-casing) the own name when renaming', () => {
    expect(validateCategoryName('food', list, 2)).toBeNull();
    expect(validateCategoryName('বাজার', list, 2)).toBe('duplicate');
  });
});

describe('isCategoryUsed', () => {
  it('is unused with no expenses and no planned amount', () => {
    expect(isCategoryUsed({ expenseCount: 0, plannedCount: 0 })).toBe(false);
  });
  it('is used with any expense', () => {
    expect(isCategoryUsed({ expenseCount: 1, plannedCount: 0 })).toBe(true);
  });
  it('is used with any planned amount', () => {
    expect(isCategoryUsed({ expenseCount: 0, plannedCount: 1 })).toBe(true);
  });
});

describe('moveCategory', () => {
  // Global sort order mixes types; archived rows sit in between.
  const all = [
    c(1, 'a'),
    c(2, 'bank', { type: 'saving' }),
    c(3, 'old', { isArchived: true }),
    c(4, 'b'),
    c(5, 'c'),
  ];

  it('swaps with the previous active category of the same type', () => {
    expect(moveCategory(all, 4, 'up')).toEqual([4, 2, 3, 1, 5]);
  });

  it('swaps with the next one going down', () => {
    expect(moveCategory(all, 4, 'down')).toEqual([1, 2, 3, 5, 4]);
  });

  it('returns null at the edges of its own type', () => {
    expect(moveCategory(all, 1, 'up')).toBeNull();
    expect(moveCategory(all, 5, 'down')).toBeNull();
    expect(moveCategory(all, 2, 'up')).toBeNull();
    expect(moveCategory(all, 2, 'down')).toBeNull();
  });

  it('returns null for an unknown id', () => {
    expect(moveCategory(all, 99, 'up')).toBeNull();
  });
});
