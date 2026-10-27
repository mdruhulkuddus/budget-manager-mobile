import { buildMonthSummary, CalcCategory, MonthSummaryInput, percentOf, statusOf } from '../src/lib/calc';

const cat = (id: number, name: string, type: CalcCategory['type'] = 'expense', extra: Partial<CalcCategory> = {}) => ({
  id,
  name,
  type,
  sortOrder: id,
  isArchived: false,
  ...extra,
});

const categories: CalcCategory[] = [
  cat(1, 'rent'),
  cat(2, 'groceries'),
  cat(3, 'transport'),
  cat(4, 'bank', 'saving'),
];

function input(overrides: Partial<MonthSummaryInput> = {}): MonthSummaryInput {
  return {
    categories,
    budgets: [
      { categoryId: 1, plannedAmount: 15000 },
      { categoryId: 2, plannedAmount: 8000 },
      { categoryId: 3, plannedAmount: 2000 },
      { categoryId: 4, plannedAmount: 5000 },
    ],
    spent: [
      { categoryId: 1, spent: 15000 },
      { categoryId: 2, spent: 4000 },
      { categoryId: 3, spent: 2500 },
      { categoryId: 4, spent: 5000 },
    ],
    incomes: [{ amount: 40000 }, { amount: 5000 }],
    ...overrides,
  };
}

const byId = (s: ReturnType<typeof buildMonthSummary>, id: number) => s.categories.find((c) => c.categoryId === id)!;

describe('buildMonthSummary', () => {
  it('computes planned, spent, remaining and percent per category', () => {
    const groceries = byId(buildMonthSummary(input()), 2);
    expect(groceries).toMatchObject({ planned: 8000, spent: 4000, remaining: 4000, percent: 50, status: 'ok' });
  });

  it('reports overspent categories with negative remaining', () => {
    const transport = byId(buildMonthSummary(input()), 3);
    expect(transport).toMatchObject({ remaining: -500, percent: 125, status: 'over' });
  });

  it('treats planned = 0 with spending as over', () => {
    const s = buildMonthSummary(input({ budgets: [], spent: [{ categoryId: 2, spent: 300 }] }));
    expect(byId(s, 2)).toMatchObject({ planned: 0, spent: 300, remaining: -300, percent: Infinity, status: 'over' });
  });

  it('treats planned = 0 with no spending as 0% ok', () => {
    const s = buildMonthSummary(input({ budgets: [], spent: [] }));
    expect(byId(s, 1)).toMatchObject({ planned: 0, spent: 0, percent: 0, status: 'ok' });
  });

  it('excludes saving categories from the overall bar', () => {
    const { overall } = buildMonthSummary(input());
    expect(overall).toMatchObject({ planned: 25000, spent: 21500, remaining: 3500, percent: 86, status: 'warn' });
  });

  it('computes totals and inHand = income − expense − saving', () => {
    const { totals } = buildMonthSummary(input());
    expect(totals).toEqual({ income: 45000, expense: 21500, saving: 5000, inHand: 18500 });
  });

  it('allows a negative inHand', () => {
    const { totals } = buildMonthSummary(input({ incomes: [{ amount: 10000 }] }));
    expect(totals.inHand).toBe(-16500);
  });

  it('sorts categories by percent desc, ties by sort order', () => {
    const s = buildMonthSummary(input());
    // transport 125%, rent 100%, bank 100%, groceries 50%
    expect(s.categories.map((c) => c.categoryId)).toEqual([3, 1, 4, 2]);
  });

  it('puts unplanned spending (Infinity) first', () => {
    const s = buildMonthSummary(
      input({ budgets: [{ categoryId: 1, plannedAmount: 100 }], spent: [{ categoryId: 1, spent: 500 }, { categoryId: 2, spent: 1 }] }),
    );
    expect(s.categories[0].categoryId).toBe(2);
  });

  it('hides archived categories unless they have data', () => {
    const withArchived = [...categories, cat(5, 'old', 'expense', { isArchived: true }), cat(6, 'old2', 'expense', { isArchived: true })];
    const s = buildMonthSummary(input({ categories: withArchived, spent: [...input().spent, { categoryId: 6, spent: 100 }] }));
    const ids = s.categories.map((c) => c.categoryId);
    expect(ids).not.toContain(5);
    expect(ids).toContain(6);
  });

  it('handles an empty month', () => {
    const s = buildMonthSummary(input({ budgets: [], spent: [], incomes: [] }));
    expect(s.totals).toEqual({ income: 0, expense: 0, saving: 0, inHand: 0 });
    expect(s.overall).toMatchObject({ planned: 0, spent: 0, percent: 0, status: 'ok' });
  });
});

describe('status thresholds', () => {
  it.each([
    [0, 'ok'],
    [79.99, 'ok'],
    [80, 'ok'],
    [80.01, 'warn'],
    [100, 'warn'],
    [100.01, 'over'],
    [Infinity, 'over'],
  ])('%p%% → %s', (percent, status) => {
    expect(statusOf(percent)).toBe(status);
  });

  it('is ok at exactly 80% and warn at exactly 100% of a plan', () => {
    expect(statusOf(percentOf(800, 1000))).toBe('ok');
    expect(statusOf(percentOf(1000, 1000))).toBe('warn');
  });
});
