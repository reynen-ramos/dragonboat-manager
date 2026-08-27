import type { BoatSize, SeatPosition, SeatZone, Side } from './types';

/**
 * Boat geometry as data.
 *
 * The seat map is generated from these definitions rather than hardcoded in
 * JSX, so a new boat size is a table entry and not a new component.
 */

export const SIDES: Side[] = ['left', 'right'];

export interface BoatLayout {
  boatSize: BoatSize;
  /** Number of bench rows; each row holds one left and one right paddler. */
  rows: number;
  /** Which zone each row belongs to, indexed by row number. */
  zoneForRow: (row: number) => SeatZone;
}

const ZONE_RANGES: Record<BoatSize, { zone: SeatZone; from: number; to: number }[]> = {
  20: [
    { zone: 'stroke', from: 1, to: 2 },
    { zone: 'engine', from: 3, to: 8 },
    { zone: 'rockets', from: 9, to: 10 },
  ],
  10: [
    { zone: 'stroke', from: 1, to: 1 },
    { zone: 'engine', from: 2, to: 4 },
    { zone: 'rockets', from: 5, to: 5 },
  ],
};

export const ZONE_LABELS: Record<SeatZone, string> = {
  stroke: 'Stroke',
  engine: 'Engine Room',
  rockets: 'Rockets',
};

export function getBoatLayout(boatSize: BoatSize): BoatLayout {
  const rows = boatSize / 2;
  const ranges = ZONE_RANGES[boatSize];
  return {
    boatSize,
    rows,
    zoneForRow: (row) =>
      ranges.find((r) => row >= r.from && row <= r.to)?.zone ?? 'engine',
  };
}

/** Every seat in the boat, bow to stern, left before right. */
export function allSeats(boatSize: BoatSize): SeatPosition[] {
  const { rows } = getBoatLayout(boatSize);
  const seats: SeatPosition[] = [];
  for (let row = 1; row <= rows; row++) {
    for (const side of SIDES) seats.push({ row, side });
  }
  return seats;
}

/**
 * Which end of the boat a row sits in, for fore/aft trim.
 *
 * A 10s boat has five rows, so there is no even split and the middle row
 * belongs to neither end -- counting it as stern (which `row <= rows / 2`
 * did) reported every 10s boat as stern-heavy even when perfectly trimmed.
 * Excluding it measures the imbalance that actually exists.
 */
export function bowSternZone(row: number, boatSize: BoatSize): "bow" | "stern" | "middle" {
  const { rows } = getBoatLayout(boatSize);
  const half = rows / 2;
  if (row <= Math.floor(half)) return "bow";
  if (row > Math.ceil(half)) return "stern";
  return "middle";
}

/** True for rows in the bow half. The middle row of an odd boat is not. */
export function isBowHalf(row: number, boatSize: BoatSize): boolean {
  return bowSternZone(row, boatSize) === "bow";
}

export function seatKey(seat: SeatPosition): string {
  return `${seat.row}-${seat.side}`;
}

export function sameSeat(a?: SeatPosition, b?: SeatPosition): boolean {
  if (!a || !b) return false;
  return a.row === b.row && a.side === b.side;
}

/** Human label for a seat, e.g. "Row 3 Left". */
export function seatLabel(seat: SeatPosition): string {
  return `Row ${seat.row} ${seat.side === 'left' ? 'Left' : 'Right'}`;
}

export const SIDE_LABELS: Record<Side, string> = {
  left: 'Left',
  right: 'Right',
};

export function oppositeSide(side: Side): Side {
  return side === 'left' ? 'right' : 'left';
}
