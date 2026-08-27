/** Date helpers. Dates are stored as plain ISO `YYYY-MM-DD` strings. */

/**
 * Age in whole years on a given date.
 *
 * Dragonboat age divisions are conventionally judged on age reached within the
 * competition year, but the stricter "age on the day" reading is the safe one
 * for a warning — it never lets an ineligible paddler through unflagged.
 */
export function ageOn(dateOfBirth: string, onDate: string): number | undefined {
  const dob = new Date(`${dateOfBirth}T00:00:00Z`);
  const on = new Date(`${onDate}T00:00:00Z`);
  if (Number.isNaN(dob.getTime()) || Number.isNaN(on.getTime())) return undefined;

  let age = on.getUTCFullYear() - dob.getUTCFullYear();
  const monthDiff = on.getUTCMonth() - dob.getUTCMonth();
  if (monthDiff < 0 || (monthDiff === 0 && on.getUTCDate() < dob.getUTCDate())) {
    age--;
  }
  return age < 0 ? undefined : age;
}

/**
 * Today's date where the user is standing.
 *
 * Stored dates are UTC-pinned throughout this file, which is right for a date
 * that was written down. "Today" is a different question: it is wall-clock, and
 * `toISOString()` answers it in UTC. For a club in UTC+8 that made every
 * morning before 8am report yesterday, so on race morning the regatta you were
 * standing at was filed under past events.
 */
export function todayIso(now: Date = new Date()): string {
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return year + '-' + month + '-' + day;
}

export function formatDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

/**
 * Race times are entered and shown as `m:ss.SSS`.
 *
 * Guards the inputs it can be handed: `timeMs` is a plain number off storage,
 * and an un-floored fraction produced strings like "2:05.420.6999999999971".
 */
export function formatRaceTime(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) return "-";
  const total = Math.round(ms);
  const minutes = Math.floor(total / 60_000);
  const seconds = Math.floor((total % 60_000) / 1000);
  const millis = total % 1000;
  return minutes + ":" + String(seconds).padStart(2, "0") + "." + String(millis).padStart(3, "0");
}

/**
 * Parses `m:ss.SSS`, `ss.SSS`, or plain seconds into milliseconds.
 *
 * The seconds group is unbounded when no minutes part is given, so "125" is a
 * time. Capping it at two digits refused every 500m result over 1:39 entered
 * the way the docstring invited. When minutes *are* given, seconds above 59
 * are refused: "2:99" used to parse as 3:39, so the entry and the display
 * disagreed about what had been typed.
 */
export function parseRaceTime(input: string): number | undefined {
  const trimmed = input.trim();
  if (!trimmed) return undefined;

  const match = /^(?:(\d+):)?(\d+)(?:\.(\d{1,3}))?$/.exec(trimmed);
  if (!match) return undefined;

  const [, min, sec, frac] = match;
  const seconds = Number(sec);
  if (min !== undefined && seconds > 59) return undefined;

  const millis = frac ? Number(frac.padEnd(3, "0")) : 0;
  return (Number(min ?? 0) * 60 + seconds) * 1000 + millis;
}
