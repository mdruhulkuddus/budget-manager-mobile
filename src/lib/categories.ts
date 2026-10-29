import type { CategoryType } from './calc';

/** Trimmed, inner whitespace collapsed — the form names are stored in. */
export function normalizeName(name: string): string {
  return name.trim().replace(/\s+/g, ' ');
}

export type NameError = 'empty' | 'duplicate';

/**
 * Checks a new or renamed category name against the *active* categories
 * (case-insensitive, after normalizing). `excludeId` is the category being renamed.
 */
export function validateCategoryName(
  name: string,
  categories: { id: number; name: string; isArchived: boolean }[],
  excludeId?: number,
): NameError | null {
  const key = normalizeName(name).toLowerCase();
  if (key === '') return 'empty';
  const taken = categories.some((c) => !c.isArchived && c.id !== excludeId && normalizeName(c.name).toLowerCase() === key);
  return taken ? 'duplicate' : null;
}

export interface CategoryUsage {
  /** Number of expenses in this category. */
  expenseCount: number;
  /** Number of budget rows with planned_amount > 0. Rows saved as 0 don't count. */
  plannedCount: number;
}

/** A used category can only be archived; an unused one can also be deleted or change type. */
export function isCategoryUsed(u: CategoryUsage): boolean {
  return u.expenseCount > 0 || u.plannedCount > 0;
}

interface Orderable {
  id: number;
  type: CategoryType;
  isArchived: boolean;
}

/**
 * Moves a category one step up or down among the active categories of its type.
 * `all` is every category in current sort order; returns the new order of all ids,
 * or null when the category is already at that edge.
 */
export function moveCategory(all: Orderable[], id: number, direction: 'up' | 'down'): number[] | null {
  const from = all.findIndex((c) => c.id === id);
  if (from < 0) return null;
  const { type } = all[from];
  const step = direction === 'up' ? -1 : 1;
  let to = from + step;
  while (to >= 0 && to < all.length && (all[to].type !== type || all[to].isArchived)) to += step;
  if (to < 0 || to >= all.length) return null;

  const ids = all.map((c) => c.id);
  [ids[from], ids[to]] = [ids[to], ids[from]];
  return ids;
}
