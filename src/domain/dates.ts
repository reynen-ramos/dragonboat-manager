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

export function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
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

/** Race times are entered and shown as `m:ss.SSS`. */
export function formatRaceTime(ms: number): string {
  const minutes = Math.floor(ms / 60_000);
  const seconds = Math.floor((ms % 60_000) / 1000);
  const millis = ms % 1000;
  return `${minutes}:${String(seconds).padStart(2, '0')}.${String(millis).padStart(3, '0')}`;
}

/** Parses `m:ss.SSS`, `ss.SSS`, or plain seconds into milliseconds. */
export function parseRaceTime(input: string): number | undefined {
  const trimmed = input.trim();
  if (!trimmed) return undefined;
  const match = /^(?:(\d+):)?(\d{1,2})(?:\.(\d{1,3}))?$/.exec(trimmed);
  if (!match) return undefined;
  const [, min, sec, frac] = match;
  const millis = frac ? Number(frac.padEnd(3, '0')) : 0;
  return (Number(min ?? 0) * 60 + Number(sec)) * 1000 + millis;
}
