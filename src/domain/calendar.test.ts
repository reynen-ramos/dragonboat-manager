import { describe, expect, it } from 'vitest';
import {
  addDays,
  addMonths,
  dayNumber,
  inMonth,
  monthGrid,
  monthLabel,
  monthOf,
  occursOn,
  startOfWeek,
} from './calendar';

describe('monthGrid', () => {
  it('pads to full Monday-to-Sunday weeks with the neighbouring months', () => {
    // September 2026 starts on a Tuesday and ends on a Wednesday.
    const weeks = monthGrid({ year: 2026, month: 9 });

    expect(weeks).toHaveLength(5);
    expect(weeks.every((w) => w.length === 7)).toBe(true);
    expect(weeks[0][0]).toBe('2026-08-31'); // the lead-in Monday
    expect(weeks[0][1]).toBe('2026-09-01');
    expect(weeks[4][6]).toBe('2026-10-04'); // the tail Sunday
  });

  it('adds no padding when the month already fills its weeks exactly', () => {
    // February 2021: starts on a Monday, 28 days — four clean weeks.
    const weeks = monthGrid({ year: 2021, month: 2 });

    expect(weeks).toHaveLength(4);
    expect(weeks[0][0]).toBe('2021-02-01');
    expect(weeks[3][6]).toBe('2021-02-28');
  });

  it('handles a leap February', () => {
    const days = monthGrid({ year: 2024, month: 2 }).flat();
    expect(days).toContain('2024-02-29');
    expect(days).not.toContain('2024-02-30');
  });
});

describe('month arithmetic', () => {
  it('carries the year in both directions', () => {
    expect(addMonths({ year: 2026, month: 1 }, -1)).toEqual({ year: 2025, month: 12 });
    expect(addMonths({ year: 2026, month: 12 }, 1)).toEqual({ year: 2027, month: 1 });
    expect(addMonths({ year: 2026, month: 3 }, -25)).toEqual({ year: 2024, month: 2 });
  });

  it('reads month, day, and membership straight off the ISO string', () => {
    expect(monthOf('2026-09-15')).toEqual({ year: 2026, month: 9 });
    expect(dayNumber('2026-09-05')).toBe(5);
    expect(inMonth('2026-09-30', { year: 2026, month: 9 })).toBe(true);
    expect(inMonth('2026-10-01', { year: 2026, month: 9 })).toBe(false);
  });

  it('finds the Monday of any date’s week', () => {
    expect(startOfWeek('2026-09-15')).toBe('2026-09-14'); // a Tuesday
    expect(startOfWeek('2026-09-14')).toBe('2026-09-14'); // Monday is its own start
    expect(startOfWeek('2026-09-20')).toBe('2026-09-14'); // Sunday closes the week
    expect(startOfWeek('2026-01-01')).toBe('2025-12-29'); // crosses the year
  });

  it('adds days across month ends', () => {
    expect(addDays('2026-08-30', 7)).toBe('2026-09-06');
    expect(addDays('2026-01-01', -1)).toBe('2025-12-31');
  });

  it('labels every month distinctly with its year', () => {
    const sept = monthLabel({ year: 2026, month: 9 });
    expect(sept).toContain('2026');
    expect(sept).not.toBe(monthLabel({ year: 2026, month: 10 }));
    expect(sept).not.toBe(monthLabel({ year: 2025, month: 9 }));
  });
});

describe('occursOn', () => {
  it('covers a single-day event only on its date', () => {
    const event = { startDate: '2026-09-15' };
    expect(occursOn(event, '2026-09-15')).toBe(true);
    expect(occursOn(event, '2026-09-14')).toBe(false);
    expect(occursOn(event, '2026-09-16')).toBe(false);
  });

  it('covers every day of a range, both ends inclusive', () => {
    const event = { startDate: '2026-09-15', endDate: '2026-09-17' };
    expect(occursOn(event, '2026-09-15')).toBe(true);
    expect(occursOn(event, '2026-09-16')).toBe(true);
    expect(occursOn(event, '2026-09-17')).toBe(true);
    expect(occursOn(event, '2026-09-18')).toBe(false);
  });
});
