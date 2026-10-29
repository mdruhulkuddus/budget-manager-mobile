import {
  addDays,
  addMonths,
  currentYearMonth,
  daysBetween,
  daysLeftInMonth,
  groupByDate,
  localTimestamp,
  monthRange,
  today,
  yearMonthOf,
} from '../src/lib/date';

describe('monthRange', () => {
  it('February in a leap year', () => {
    expect(monthRange(2024, 2)).toEqual({ from: '2024-02-01', to: '2024-02-29' });
  });

  it('February in a non-leap year', () => {
    expect(monthRange(2026, 2)).toEqual({ from: '2026-02-01', to: '2026-02-28' });
  });

  it('February in a century non-leap year and a 400-year leap year', () => {
    expect(monthRange(1900, 2).to).toBe('1900-02-28');
    expect(monthRange(2000, 2).to).toBe('2000-02-29');
  });

  it('December', () => {
    expect(monthRange(2026, 12)).toEqual({ from: '2026-12-01', to: '2026-12-31' });
  });

  it('31-day month', () => {
    expect(monthRange(2026, 1)).toEqual({ from: '2026-01-01', to: '2026-01-31' });
  });

  it('30-day month', () => {
    expect(monthRange(2026, 9)).toEqual({ from: '2026-09-01', to: '2026-09-30' });
  });
});

describe('today / currentYearMonth', () => {
  // Local-time constructor: 00:30 on 1 March is still 1 March locally, even though
  // in UTC+6 the same instant is 28 Feb in UTC.
  const justAfterMidnight = new Date(2026, 2, 1, 0, 30);

  it('uses the local calendar date', () => {
    expect(today(justAfterMidnight)).toBe('2026-03-01');
  });

  it('returns the local year and month', () => {
    expect(currentYearMonth(justAfterMidnight)).toEqual({ year: 2026, month: 3 });
  });
});

describe('addMonths', () => {
  it('moves within a year', () => {
    expect(addMonths({ year: 2026, month: 10 }, 1)).toEqual({ year: 2026, month: 11 });
  });

  it('rolls over December → January', () => {
    expect(addMonths({ year: 2026, month: 12 }, 1)).toEqual({ year: 2027, month: 1 });
  });

  it('rolls back January → December', () => {
    expect(addMonths({ year: 2026, month: 1 }, -1)).toEqual({ year: 2025, month: 12 });
  });

  it('handles multi-year deltas', () => {
    expect(addMonths({ year: 2026, month: 3 }, -27)).toEqual({ year: 2023, month: 12 });
  });
});

describe('addDays', () => {
  it('goes to yesterday across a month boundary', () => {
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
  });

  it('crosses a year boundary', () => {
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
  });

  it('handles leap day', () => {
    expect(addDays('2024-03-01', -1)).toBe('2024-02-29');
  });
});

describe('yearMonthOf', () => {
  it('extracts year and month', () => {
    expect(yearMonthOf('2026-09-15')).toEqual({ year: 2026, month: 9 });
  });
});

describe('groupByDate', () => {
  it('groups consecutive items, keeping order', () => {
    const items = [
      { id: 3, date: '2026-10-27' },
      { id: 2, date: '2026-10-27' },
      { id: 1, date: '2026-10-25' },
    ];
    expect(groupByDate(items)).toEqual([
      { date: '2026-10-27', items: [items[0], items[1]] },
      { date: '2026-10-25', items: [items[2]] },
    ]);
  });

  it('returns no groups for no items', () => {
    expect(groupByDate([])).toEqual([]);
  });
});

describe('daysLeftInMonth', () => {
  it.each([
    ['2026-10-28', 3],
    ['2026-10-31', 0],
    ['2026-10-01', 30],
    ['2026-02-28', 0],
    ['2024-02-28', 1],
    ['2026-09-29', 1],
  ])('%s → %p', (date, expected) => {
    expect(daysLeftInMonth(date)).toBe(expected);
  });
});

describe('daysBetween', () => {
  it('counts whole days across months and years', () => {
    expect(daysBetween('2026-10-29', '2026-10-29')).toBe(0);
    expect(daysBetween('2026-09-29', '2026-10-29')).toBe(30);
    expect(daysBetween('2025-12-31', '2026-01-01')).toBe(1);
    expect(daysBetween('2026-10-29', '2026-10-28')).toBe(-1);
  });
});

describe('localTimestamp', () => {
  it('starts with the local date and ends with a UTC offset', () => {
    const now = new Date(2026, 9, 29, 0, 30, 5);
    const ts = localTimestamp(now);
    expect(ts.slice(0, 19)).toBe('2026-10-29T00:30:05');
    expect(ts).toMatch(/[+-]\d{2}:\d{2}$/);
    expect(ts.slice(0, 10)).toBe(today(now));
  });
});
