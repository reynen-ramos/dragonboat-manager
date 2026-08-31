/**
 * Month-grid arithmetic for the events calendar.
 *
 * All arithmetic is UTC-pinned, matching the rest of this codebase's treatment
 * of stored `YYYY-MM-DD` strings: a written-down date must render as the same
 * square in every timezone. Weeks start on Monday.
 */

export interface MonthRef {
  year: number;
  /** 1-12, matching how humans (and ISO strings) count months. */
  month: number;
}

const isoOf = (d: Date): string => d.toISOString().slice(0, 10);

/** The month a stored ISO date falls in. */
export function monthOf(iso: string): MonthRef {
  return { year: Number(iso.slice(0, 4)), month: Number(iso.slice(5, 7)) };
}

export function addMonths({ year, month }: MonthRef, delta: number): MonthRef {
  // Zero-based arithmetic so the year carries correctly in both directions.
  const total = year * 12 + (month - 1) + delta;
  return { year: Math.floor(total / 12), month: (((total % 12) + 12) % 12) + 1 };
}

export function sameMonth(a: MonthRef, b: MonthRef): boolean {
  return a.year === b.year && a.month === b.month;
}

/** "September 2026" - for the calendar header. */
export function monthLabel({ year, month }: MonthRef): string {
  return new Date(Date.UTC(year, month - 1, 1)).toLocaleDateString(undefined, {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

/** True when the ISO date falls inside the given month (not a spill-over day). */
export function inMonth(iso: string, ref: MonthRef): boolean {
  return sameMonth(monthOf(iso), ref);
}

export function dayNumber(iso: string): number {
  return Number(iso.slice(8, 10));
}

/** The Monday that starts the week containing the given date. */
export function startOfWeek(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`);
  const lead = (d.getUTCDay() + 6) % 7; // getUTCDay: 0 = Sunday
  d.setUTCDate(d.getUTCDate() - lead);
  return d.toISOString().slice(0, 10);
}

/** The date `days` after the given one — ISO in, ISO out, UTC-pinned. */
export function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** 0 = Sunday … 6 = Saturday, matching getUTCDay. */
export function dayOfWeek(iso: string): number {
  return new Date(`${iso}T00:00:00Z`).getUTCDay();
}

/**
 * Every date in [start, until] (both inclusive) falling on one of the given
 * weekdays. The building block for "repeats weekly" — a series is nothing
 * more than its dates, materialised.
 */
export function weeklyDates(start: string, until: string, weekdays: readonly number[]): string[] {
  const wanted = new Set(weekdays);
  const dates: string[] = [];
  for (let d = start; d <= until; d = addDays(d, 1)) {
    if (wanted.has(dayOfWeek(d))) dates.push(d);
  }
  return dates;
}

/**
 * The month as full Monday-to-Sunday weeks of ISO dates.
 *
 * Leading and trailing days spill into the neighbouring months on purpose:
 * a regatta on the 1st should be visible while August is still on screen.
 */
export function monthGrid({ year, month }: MonthRef): string[][] {
  const first = new Date(Date.UTC(year, month - 1, 1));
  const lead = (first.getUTCDay() + 6) % 7; // getUTCDay: 0 = Sunday
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const total = Math.ceil((lead + daysInMonth) / 7) * 7;

  const weeks: string[][] = [];
  for (let offset = 0; offset < total; offset += 7) {
    weeks.push(
      Array.from({ length: 7 }, (_, day) =>
        isoOf(new Date(Date.UTC(year, month - 1, 1 - lead + offset + day))),
      ),
    );
  }
  return weeks;
}

/**
 * Whether an event covers a given day. `endDate` is inclusive - a two-day
 * regatta occupies both squares. Plain string comparison is exact for ISO.
 */
export function occursOn(
  event: { startDate: string; endDate?: string },
  iso: string,
): boolean {
  return event.startDate <= iso && iso <= (event.endDate ?? event.startDate);
}
