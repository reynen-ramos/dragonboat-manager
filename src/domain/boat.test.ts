import { describe, expect, it } from 'vitest';
import { bowSternZone, isBowHalf, seatKey, sameSeat, seatLabel } from './boat';

describe('bowSternZone', () => {
  it('splits a 20s boat evenly', () => {
    // Ten rows: 1-5 bow, 6-10 stern, nothing in between.
    expect([1, 5].map((r) => bowSternZone(r, 20))).toEqual(['bow', 'bow']);
    expect([6, 10].map((r) => bowSternZone(r, 20))).toEqual(['stern', 'stern']);
  });

  it('leaves the middle row of a 10s boat out of the trim', () => {
    // Five rows have no even split. Counting row 3 as stern reported every
    // 10s boat as stern-heavy even when it was perfectly trimmed.
    expect([1, 2].map((r) => bowSternZone(r, 10))).toEqual(['bow', 'bow']);
    expect(bowSternZone(3, 10)).toBe('middle');
    expect([4, 5].map((r) => bowSternZone(r, 10))).toEqual(['stern', 'stern']);
  });

  it('gives a 10s boat as many bow rows as stern rows', () => {
    const zones = [1, 2, 3, 4, 5].map((r) => bowSternZone(r, 10));
    expect(zones.filter((z) => z === 'bow')).toHaveLength(2);
    expect(zones.filter((z) => z === 'stern')).toHaveLength(2);
  });
});

describe('isBowHalf', () => {
  it('excludes the middle row of an odd-rowed boat', () => {
    expect(isBowHalf(2, 10)).toBe(true);
    expect(isBowHalf(3, 10)).toBe(false);
  });
});

describe('seat helpers', () => {
  it('round-trips a seat through its key', () => {
    const [row, side] = seatKey({ row: 3, side: 'left' }).split('-');
    expect(Number(row)).toBe(3);
    expect(side).toBe('left');
  });

  it('treats a missing seat as matching nothing', () => {
    expect(sameSeat(undefined, { row: 1, side: 'left' })).toBe(false);
    expect(sameSeat(undefined, undefined)).toBe(false);
  });

  it('labels a seat for a human', () => {
    expect(seatLabel({ row: 3, side: 'right' })).toBe('Row 3 Right');
  });
});
