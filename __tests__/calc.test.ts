import {
  amountToExclude,
  buildMonthList,
  buildMonthSummary,
  CalcCategory,
  categoryPreview,
  MonthSummaryInput,
  type MonthTotals,
  monthVerdict,
  percentOf,
  planSummary,
  reportRows,
  savingStatusOf,
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

type Summary = ReturnType<typeof buildMonthSummary>;
const allRows = (s: Summary) => [...s.expenseRows, ...s.savingRows];
const byId = (s: Summary, id: number) => allRows(s).find((c) => c.categoryId === id)!;

describe('buildMonthSummary', () => {
  it('computes planned, spent, remaining and percent per category', () => {
    const groceries = byId(buildMonthSummary(input()), 2);
    expect(groceries).toMatchObject({ planned: 8000, spent: 4000, remaining: 4000, percent: 50, status: 'ok', hasPlan: true });
  });

  it('reports overspent categories with negative remaining', () => {
    const transport = byId(buildMonthSummary(input()), 3);
    expect(transport).toMatchObject({ remaining: -500, percent: 125, status: 'over' });
  });

  it('shows a no-plan expense row with spending as over, hasPlan false', () => {
    const s = buildMonthSummary(input({ budgets: [], spent: [{ categoryId: 2, spent: 300 }] }));
    expect(byId(s, 2)).toMatchObject({ planned: 0, spent: 300, remaining: -300, percent: Infinity, status: 'over', hasPlan: false });
  });

  it('hides rows with planned = 0 and spent = 0', () => {
    const s = buildMonthSummary(input({ budgets: [{ categoryId: 1, plannedAmount: 100 }], spent: [{ categoryId: 2, spent: 50 }] }));
    expect(allRows(s).map((r) => r.categoryId).sort()).toEqual([1, 2]);
  });

  it('keeps a planned row with no spending yet', () => {
    const s = buildMonthSummary(input({ spent: [] }));
    expect(byId(s, 1)).toMatchObject({ planned: 15000, spent: 0, percent: 0, status: 'ok' });
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

  it('splits rows by type', () => {
    const s = buildMonthSummary(input());
    expect(s.expenseRows.every((r) => r.type === 'expense')).toBe(true);
    expect(s.savingRows.map((r) => r.categoryId)).toEqual([4]);
  });

  it('sorts expense rows by percent desc, ties by sort order', () => {
    const s = buildMonthSummary(
      input({
        spent: [
          { categoryId: 1, spent: 15000 },
          { categoryId: 2, spent: 8000 },
          { categoryId: 3, spent: 2500 },
        ],
      }),
    );
    // transport 125%, rent 100%, groceries 100% (rent first by sort order)
    expect(s.expenseRows.map((c) => c.categoryId)).toEqual([3, 1, 2]);
  });

  it('puts unplanned spending (Infinity) first, two unplanned rows by sort order', () => {
    const s = buildMonthSummary(
      input({
        budgets: [{ categoryId: 1, plannedAmount: 100 }],
        spent: [
          { categoryId: 1, spent: 500 },
          { categoryId: 3, spent: 1 },
          { categoryId: 2, spent: 1 },
        ],
      }),
    );
    expect(s.expenseRows.map((c) => c.categoryId)).toEqual([2, 3, 1]);
  });

  it('sorts saving rows by sort order, not percent', () => {
    const cats = [...categories, cat(5, 'dps', 'saving', { sortOrder: 0 })];
    const s = buildMonthSummary(
      input({
        categories: cats,
        budgets: [
          { categoryId: 4, plannedAmount: 100 },
          { categoryId: 5, plannedAmount: 100 },
        ],
        spent: [
          { categoryId: 4, spent: 100 },
          { categoryId: 5, spent: 10 },
        ],
      }),
    );
    expect(s.savingRows.map((r) => r.categoryId)).toEqual([5, 4]);
  });

  it('counts spending in an archived category and shows its row', () => {
    const withArchived = [...categories, cat(5, 'old', 'expense', { isArchived: true }), cat(6, 'old2', 'expense', { isArchived: true })];
    const s = buildMonthSummary(input({ categories: withArchived, spent: [...input().spent, { categoryId: 6, spent: 100 }] }));
    const ids = allRows(s).map((c) => c.categoryId);
    expect(ids).not.toContain(5);
    expect(ids).toContain(6);
    expect(s.totals.expense).toBe(21600);
  });

  it('reports hasPlan only when some planned amount > 0', () => {
    expect(buildMonthSummary(input()).hasPlan).toBe(true);
    expect(buildMonthSummary(input({ budgets: [{ categoryId: 1, plannedAmount: 0 }] })).hasPlan).toBe(false);
    expect(buildMonthSummary(input({ budgets: [] })).hasPlan).toBe(false);
  });

  it('handles an empty month', () => {
    const s = buildMonthSummary(input({ budgets: [], spent: [], incomes: [] }));
    expect(s.totals).toEqual({ income: 0, expense: 0, saving: 0, inHand: 0 });
    expect(s.overall).toMatchObject({ planned: 0, spent: 0, percent: 0, status: 'ok' });
    expect(allRows(s)).toEqual([]);
  });
});

describe('saving status', () => {
  const saving = (planned: number, spent: number) =>
    buildMonthSummary(input({ budgets: [{ categoryId: 4, plannedAmount: planned }], spent: [{ categoryId: 4, spent }] }))
      .savingRows[0];

  it.each([
    [10000, 0, 'progress'],
    [10000, 9999, 'progress'],
    [10000, 10000, 'done'],
    [10000, 25000, 'done'], // saving more than planned is never red
  ])('planned %p, saved %p → %s', (planned, spent, status) => {
    expect(savingStatusOf(planned, spent)).toBe(status);
    expect(saving(planned, spent).status).toBe(status);
  });

  it('a saving without a plan is progress, not done or over', () => {
    expect(saving(0, 500)).toMatchObject({ status: 'progress', hasPlan: false });
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

describe('monthVerdict', () => {
  const verdictFor = (planned: number, spent: number) =>
    monthVerdict(buildMonthSummary(input({ budgets: [{ categoryId: 1, plannedAmount: planned }], spent: [{ categoryId: 1, spent }] })));

  it('under plan → amount saved', () => {
    expect(verdictFor(35000, 28500)).toEqual({ kind: 'under', amount: 6500 });
  });

  it('exactly on plan', () => {
    expect(verdictFor(35000, 35000)).toEqual({ kind: 'onPlan' });
  });

  it('over plan → amount over', () => {
    expect(verdictFor(35000, 37000)).toEqual({ kind: 'over', amount: 2000 });
  });

  it('no expense plan', () => {
    expect(verdictFor(0, 500)).toEqual({ kind: 'noPlan' });
    expect(monthVerdict(buildMonthSummary(input({ budgets: [], spent: [] })))).toEqual({ kind: 'noPlan' });
  });

  it('ignores savings: only a saving plan still counts as no plan', () => {
    const s = buildMonthSummary(input({ budgets: [{ categoryId: 4, plannedAmount: 5000 }], spent: [] }));
    expect(monthVerdict(s)).toEqual({ kind: 'noPlan' });
  });
});

describe('reportRows', () => {
  const s = buildMonthSummary(input()); // rent 15000/15000, groceries 4000/8000, transport 2500/2000
  const rows = reportRows(s.expenseRows);

  it('sorts by spent desc', () => {
    expect(rows.map((r) => r.categoryId)).toEqual([1, 2, 3]);
  });

  it('difference = planned − spent: positive saved, negative over, zero on plan', () => {
    expect(rows.map((r) => r.difference)).toEqual([0, 4000, -500]);
  });

  it('share is % of the group total and adds up to 100', () => {
    const total = 15000 + 4000 + 2500;
    expect(rows[1].share).toBeCloseTo((4000 / total) * 100);
    expect(rows.reduce((acc, r) => acc + r.share, 0)).toBeCloseTo(100);
  });

  it('share is 0 when nothing was spent', () => {
    const planned = buildMonthSummary(input({ spent: [] }));
    expect(reportRows(planned.expenseRows).every((r) => r.share === 0)).toBe(true);
  });

  it('has no rows for categories with planned and spent both 0', () => {
    const sparse = buildMonthSummary(input({ budgets: [{ categoryId: 1, plannedAmount: 100 }], spent: [] }));
    expect(reportRows(sparse.expenseRows).map((r) => r.categoryId)).toEqual([1]);
  });
});

describe('buildMonthList', () => {
  const totals = (id: number, extra: Partial<MonthTotals> = {}): MonthTotals => ({
    id,
    year: 2026,
    month: id,
    plannedExpense: 0,
    plannedTotal: 0,
    spentExpense: 0,
    spentSaving: 0,
    incomeCount: 0,
    expenseCount: 0,
    ...extra,
  });

  it('excludes empty months and keeps any month with income, plan or expenses (in input order)', () => {
    const list = buildMonthList([
      totals(12), // empty: created by browsing
      totals(11, { incomeCount: 1 }),
      totals(10, { plannedTotal: 500 }),
      totals(9, { expenseCount: 2, spentExpense: 100 }),
      totals(8, { plannedTotal: 0, incomeCount: 0, expenseCount: 0 }),
    ]);
    expect(list.map((m) => m.id)).toEqual([11, 10, 9]);
  });

  it('marks months spent over the expense plan', () => {
    const [within, exact, over, noPlan] = buildMonthList([
      totals(1, { plannedExpense: 1000, plannedTotal: 1000, spentExpense: 900, expenseCount: 1 }),
      totals(2, { plannedExpense: 1000, plannedTotal: 1000, spentExpense: 1000, expenseCount: 1 }),
      totals(3, { plannedExpense: 1000, plannedTotal: 1000, spentExpense: 1001, expenseCount: 1 }),
      totals(4, { spentExpense: 500, expenseCount: 1 }),
    ]);
    expect([within.isOver, exact.isOver, over.isOver, noPlan.isOver]).toEqual([false, false, true, false]);
  });
});
