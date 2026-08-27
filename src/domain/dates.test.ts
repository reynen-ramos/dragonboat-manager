import { describe, expect, it } from 'vitest';
import { ageOn, formatRaceTime, parseRaceTime, todayIso } from './dates';

describe('todayIso', () => {
  it('reports the local date, not the UTC one', () => {
    // 07:00 on 15 May in UTC+8 is still 14 May in UTC. Answering in UTC
    // filed the regatta a coach was standing at under past events.
    //
    // Deliberately not today's date: an implementation that ignores this
    // argument and reports the real today would pass such a test by accident.
    const raceMorning = new Date(2020, 4, 15, 7, 0, 0);
    expect(todayIso(raceMorning)).toBe('2020-05-15');
  });

  it('holds just before midnight', () => {
    expect(todayIso(new Date(2020, 4, 15, 23, 59, 59))).toBe('2020-05-15');
  });

  it('pads single-digit months and days', () => {
    expect(todayIso(new Date(2020, 0, 5))).toBe('2020-01-05');
  });
});

describe('ageOn', () => {
  it('counts a birthday that has passed', () => {
    expect(ageOn('1996-03-12', '2026-08-27')).toBe(30);
  });

  it('does not count a birthday still to come', () => {
    expect(ageOn('1996-12-12', '2026-08-27')).toBe(29);
  });

  it('counts the birthday itself', () => {
    expect(ageOn('1996-08-27', '2026-08-27')).toBe(30);
  });

  it('gives up on an unparseable date', () => {
    expect(ageOn('not a date', '2026-08-27')).toBeUndefined();
  });
});

describe('formatRaceTime', () => {
  it('formats a whole number of milliseconds', () => {
    expect(formatRaceTime(125_420)).toBe('2:05.420');
  });

  it('rounds a fractional millisecond instead of printing its float tail', () => {
    // Previously produced "2:05.420.6999999999971".
    expect(formatRaceTime(125_420.7)).toBe('2:05.421');
  });

  it('refuses a negative or non-finite time', () => {
    expect(formatRaceTime(-1000)).toBe('-');
    expect(formatRaceTime(NaN)).toBe('-');
  });
});

describe('parseRaceTime', () => {
  it('reads m:ss.SSS', () => {
    expect(parseRaceTime('2:05.42')).toBe(125_420);
  });

  it('reads plain seconds beyond 99, as the docstring promises', () => {
    // Every 500m result over 1:39 entered this way used to be refused.
    expect(parseRaceTime('125')).toBe(125_000);
    expect(parseRaceTime('125.5')).toBe(125_500);
  });

  it('refuses seconds above 59 when minutes are given', () => {
    // "2:99" parsed as 3:39, so the entry and the display disagreed.
    expect(parseRaceTime('2:99')).toBeUndefined();
  });

  it('refuses nonsense', () => {
    expect(parseRaceTime('abc')).toBeUndefined();
    expect(parseRaceTime('')).toBeUndefined();
  });

  it('round-trips with formatRaceTime', () => {
    expect(formatRaceTime(parseRaceTime('2:05.420')!)).toBe('2:05.420');
  });
});
