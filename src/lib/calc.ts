export type CategoryType = 'expense' | 'saving';
export type Status = 'ok' | 'warn' | 'over';

export interface CalcCategory {
  id: number;
  name: string;
  type: CategoryType;
  sortOrder: number;
  isArchived: boolean;
}

export interface PlannedInput {
  categoryId: number;
  plannedAmount: number;
}

export interface SpentInput {
  categoryId: number;
  spent: number;
}

export interface IncomeInput {
  amount: number;
}

export interface Progress {
  planned: number;
  spent: number;
  remaining: number;
  /** spent / planned × 100. Infinity when planned = 0 and spent > 0. */
  percent: number;
  status: Status;
}

export interface CategorySummary extends Progress {
  categoryId: number;
  name: string;
  type: CategoryType;
}

export interface MonthSummary {
  categories: CategorySummary[];
  totals: {
    income: number;
    expense: number;
    saving: number;
    inHand: number;
  };
  /** Planned vs spent over 'expense' categories only. */
  overall: Progress;
}

export interface MonthSummaryInput {
  /** All categories, archived included; archived ones are shown only if they have data. */
  categories: CalcCategory[];
  budgets: PlannedInput[];
  spent: SpentInput[];
  incomes: IncomeInput[];
}

export const WARN_THRESHOLD = 80;
export const OVER_THRESHOLD = 100;

export function percentOf(spent: number, planned: number): number {
  if (planned > 0) return (spent / planned) * 100;
  return spent > 0 ? Infinity : 0;
}

export function statusOf(percent: number): Status {
  if (percent > OVER_THRESHOLD) return 'over';
  if (percent > WARN_THRESHOLD) return 'warn';
  return 'ok';
}

export function progress(planned: number, spent: number): Progress {
  const percent = percentOf(spent, planned);
  return { planned, spent, remaining: planned - spent, percent, status: statusOf(percent) };
}

function sumBy<T>(items: T[], pick: (item: T) => number): number {
  return items.reduce((acc, item) => acc + pick(item), 0);
}

export interface CategoryPreviewInput {
  planned: number;
  /** Already spent in this category this month, excluding the expense being edited. */
  spentSoFar: number;
  /** Amount of the expense being entered (0 if nothing typed yet). */
  amount: number;
}

export interface CategoryPreview {
  hasPlan: boolean;
  remainingBefore: number;
  remainingAfter: number;
  /** How far over the plan this expense takes the category (0 if not over). */
  overBy: number;
  /** Status after this expense. */
  status: Status;
}

export function categoryPreview({ planned, spentSoFar, amount }: CategoryPreviewInput): CategoryPreview {
  const remainingAfter = planned - spentSoFar - amount;
  return {
    hasPlan: planned > 0,
    remainingBefore: planned - spentSoFar,
    remainingAfter,
    overBy: Math.max(0, -remainingAfter),
    status: statusOf(percentOf(spentSoFar + amount, planned)),
  };
}

/**
 * In edit mode, the original expense is already inside the month's spent total.
 * Returns how much to subtract so it isn't counted twice — only when the form still
 * targets the original's category and month.
 */
export function amountToExclude(
  original: { categoryId: number; date: string; amount: number } | null,
  categoryId: number,
  date: string,
): number {
  if (!original || original.categoryId !== categoryId) return 0;
  return original.date.slice(0, 7) === date.slice(0, 7) ? original.amount : 0;
}

export interface PlanSummaryInput {
  /** Only budgets of these categories are counted (the plan screen passes active ones). */
  categories: Pick<CalcCategory, 'id' | 'type'>[];
  budgets: PlannedInput[];
  incomes: IncomeInput[];
}

export interface PlanSummary {
  income: number;
  plannedExpense: number;
  plannedSaving: number;
  /** income − planned expense − planned saving; negative = planned more than income. */
  unplanned: number;
  isOverPlanned: boolean;
}

export function planSummary(input: PlanSummaryInput): PlanSummary {
  const typeById = new Map(input.categories.map((c) => [c.id, c.type]));
  let plannedExpense = 0;
  let plannedSaving = 0;
  for (const b of input.budgets) {
    const type = typeById.get(b.categoryId);
    if (type === 'expense') plannedExpense += b.plannedAmount;
    else if (type === 'saving') plannedSaving += b.plannedAmount;
  }
  const income = sumBy(input.incomes, (i) => i.amount);
  const unplanned = income - plannedExpense - plannedSaving;
  return { income, plannedExpense, plannedSaving, unplanned, isOverPlanned: unplanned < 0 };
}

export function buildMonthSummary(input: MonthSummaryInput): MonthSummary {
  const plannedById = new Map<number, number>();
  for (const b of input.budgets) plannedById.set(b.categoryId, b.plannedAmount);

  const spentById = new Map<number, number>();
  for (const s of input.spent) spentById.set(s.categoryId, (spentById.get(s.categoryId) ?? 0) + s.spent);

  const rows = input.categories
    .map((c) => {
      const planned = plannedById.get(c.id) ?? 0;
      const spent = spentById.get(c.id) ?? 0;
      return { category: c, summary: { categoryId: c.id, name: c.name, type: c.type, ...progress(planned, spent) } };
    })
    .filter(({ category, summary }) => !category.isArchived || summary.planned > 0 || summary.spent > 0)
    .sort(
      (a, b) =>
        b.summary.percent - a.summary.percent ||
        a.category.sortOrder - b.category.sortOrder ||
        a.category.id - b.category.id,
    )
    .map(({ summary }) => summary);

  const expenseRows = rows.filter((r) => r.type === 'expense');
  const savingRows = rows.filter((r) => r.type === 'saving');

  const income = sumBy(input.incomes, (i) => i.amount);
  const expense = sumBy(expenseRows, (r) => r.spent);
  const saving = sumBy(savingRows, (r) => r.spent);

  return {
    categories: rows,
    totals: { income, expense, saving, inHand: income - expense - saving },
    overall: progress(sumBy(expenseRows, (r) => r.planned), expense),
  };
}
