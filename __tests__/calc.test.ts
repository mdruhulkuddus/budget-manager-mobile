import {
  amountToExclude,
  buildMonthSummary,
  CalcCategory,
  categoryPreview,
  MonthSummaryInput,
  percentOf,
  planSummary,
  statusOf,
} from '../src/lib/calc';

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

describe('planSummary', () => {
  const planCats = [
    { id: 1, type: 'expense' as const },
    { id: 2, type: 'expense' as const },
    { id: 10, type: 'saving' as const },
  ];

  it('matches the phone-check scenario (income 50000, rent 20000, groceries 6000, bank 10000)', () => {
    const s = planSummary({
      categories: planCats,
      budgets: [
        { categoryId: 1, plannedAmount: 20000 },
        { categoryId: 2, plannedAmount: 6000 },
        { categoryId: 10, plannedAmount: 10000 },
      ],
      incomes: [{ amount: 50000 }],
    });
    expect(s).toEqual({ income: 50000, plannedExpense: 26000, plannedSaving: 10000, unplanned: 14000, isOverPlanned: false });
  });

  it('flags a plan larger than income', () => {
    const s = planSummary({ categories: planCats, budgets: [{ categoryId: 1, plannedAmount: 60000 }], incomes: [{ amount: 50000 }] });
    expect(s.unplanned).toBe(-10000);
    expect(s.isOverPlanned).toBe(true);
  });

  it('is not over-planned when exactly balanced', () => {
    const s = planSummary({ categories: planCats, budgets: [{ categoryId: 10, plannedAmount: 500 }], incomes: [{ amount: 500 }] });
    expect(s).toMatchObject({ unplanned: 0, isOverPlanned: false });
  });

  it('sums multiple incomes', () => {
    expect(planSummary({ categories: planCats, budgets: [], incomes: [{ amount: 1 }, { amount: 2 }] }).income).toBe(3);
  });

  it('ignores budgets of categories not passed in (e.g. archived)', () => {
    const s = planSummary({ categories: planCats, budgets: [{ categoryId: 99, plannedAmount: 7000 }], incomes: [] });
    expect(s).toMatchObject({ plannedExpense: 0, plannedSaving: 0, unplanned: 0 });
  });

  it('handles an empty plan', () => {
    expect(planSummary({ categories: [], budgets: [], incomes: [] })).toEqual({
      income: 0,
      plannedExpense: 0,
      plannedSaving: 0,
      unplanned: 0,
      isOverPlanned: false,
    });
  });
});

describe('categoryPreview', () => {
  it('shows remaining before and after (phone-check numbers)', () => {
    expect(categoryPreview({ planned: 6000, spentSoFar: 5200, amount: 500 })).toEqual({
      hasPlan: true,
      remainingBefore: 800,
      remainingAfter: 300,
      overBy: 0,
      status: 'warn', // 5700 / 6000 = 95%
    });
  });

  it('with no amount typed yet, after = before', () => {
    const p = categoryPreview({ planned: 6000, spentSoFar: 1000, amount: 0 });
    expect(p).toMatchObject({ remainingBefore: 5000, remainingAfter: 5000, status: 'ok' });
  });

  it('exactly zero remaining is not over', () => {
    const p = categoryPreview({ planned: 6000, spentSoFar: 5200, amount: 800 });
    expect(p).toMatchObject({ remainingAfter: 0, overBy: 0, status: 'warn' });
  });

  it('overspent reports overBy', () => {
    const p = categoryPreview({ planned: 6000, spentSoFar: 5200, amount: 1000 });
    expect(p).toMatchObject({ remainingAfter: -200, overBy: 200, status: 'over' });
  });

  it('already over before this expense', () => {
    const p = categoryPreview({ planned: 1000, spentSoFar: 1500, amount: 100 });
    expect(p).toMatchObject({ remainingBefore: -500, remainingAfter: -600, overBy: 600, status: 'over' });
  });

  it('no plan: hasPlan false; any spending is over', () => {
    expect(categoryPreview({ planned: 0, spentSoFar: 0, amount: 0 })).toMatchObject({ hasPlan: false, status: 'ok' });
    expect(categoryPreview({ planned: 0, spentSoFar: 0, amount: 50 })).toMatchObject({
      hasPlan: false,
      overBy: 50,
      status: 'over',
    });
  });

  it('edit mode: excluding the original avoids double-counting', () => {
    // Month total 5200 already includes the 700 being edited; user changes it to 900.
    const original = { categoryId: 2, date: '2026-10-05', amount: 700 };
    const spentSoFar = 5200 - amountToExclude(original, 2, '2026-10-05');
    expect(categoryPreview({ planned: 6000, spentSoFar, amount: 900 })).toMatchObject({
      remainingBefore: 1500,
      remainingAfter: 600,
    });
  });
});

describe('amountToExclude', () => {
  const original = { categoryId: 2, date: '2026-10-05', amount: 700 };

  it('excludes when category and month match (any day)', () => {
    expect(amountToExclude(original, 2, '2026-10-31')).toBe(700);
  });

  it('does not exclude after switching category', () => {
    expect(amountToExclude(original, 3, '2026-10-05')).toBe(0);
  });

  it('does not exclude after moving to another month', () => {
    expect(amountToExclude(original, 2, '2026-11-01')).toBe(0);
  });

  it('does not exclude in add mode', () => {
    expect(amountToExclude(null, 2, '2026-10-05')).toBe(0);
  });
});
