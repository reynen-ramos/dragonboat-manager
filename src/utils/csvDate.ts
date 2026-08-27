/**
 * Dates of birth arriving from a spreadsheet.
 *
 * Previously any string at all was stored verbatim. `ageOn` then returned
 * `undefined` for anything that was not ISO, and the age-division check
 * `continue`s on `undefined` — so a roster imported with slash dates got no
 * age checking at all, silently, and looked completely fine.
 */

const ISO = /^(\d{4})-(\d{1,2})-(\d{1,2})$/;

export type DateParse =
  | { ok: true; date: string }
  | { ok: false; reason: string };

/**
 * Accepts `YYYY-MM-DD` only.
 *
 * `03/04/1996` is deliberately refused rather than guessed at: it is 3 April
 * in most of the world and 4 March in the US, and nothing in a CSV says which.
 * Picking one silently would put paddlers in the wrong age division, which is
 * exactly the failure this function exists to prevent.
 */
export function parseCsvDate(raw: string, today: string): DateParse {
  const value = raw.trim();
  if (!value) return { ok: false, reason: 'empty' };

  const match = ISO.exec(value);
  if (!match) {
    return {
      ok: false,
      reason: `"${value}" is not a date in YYYY-MM-DD form`,
    };
  }

  const [, y, m, d] = match;
  const year = Number(y);
  const month = Number(m);
  const day = Number(d);

  const iso = `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  const parsed = new Date(`${iso}T00:00:00Z`);

  // Catches 2025-02-30, which Date would roll forward to 2 March.
  if (
    Number.isNaN(parsed.getTime()) ||
    parsed.getUTCFullYear() !== year ||
    parsed.getUTCMonth() + 1 !== month ||
    parsed.getUTCDate() !== day
  ) {
    return { ok: false, reason: `"${value}" is not a real date` };
  }

  if (iso > today) {
    return { ok: false, reason: `"${value}" is in the future` };
  }

  return { ok: true, date: iso };
}
