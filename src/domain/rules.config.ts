import type { AgeDivision, BoatSize, ClubSettings } from './types';

/**
 * Defaults for the rules that vary between federations and regattas.
 *
 * These are settings rather than constants on purpose: the minimum number of
 * women in a mixed crew in particular differs by governing body, so it must
 * never be hardcoded inside the validator.
 */
export const DEFAULT_CLUB_SETTINGS: ClubSettings = {
  minWomenMixed: { 10: 4, 20: 8 },
  sideBalanceTolerance: 0.03,
  bowSternBalanceTolerance: 0.05,
};

/** Inclusive age bounds per division. `undefined` means unbounded on that end. */
export const AGE_DIVISION_BOUNDS: Record<
  AgeDivision,
  { min?: number; max?: number; label: string }
> = {
  junior: { max: 18, label: 'Junior' },
  u24: { max: 23, label: 'U24' },
  premier: { label: 'Premier' },
  seniorA: { min: 40, label: 'Senior A (40+)' },
  seniorB: { min: 50, label: 'Senior B (50+)' },
  seniorC: { min: 60, label: 'Senior C (60+)' },
};

export const BOAT_SIZES: BoatSize[] = [10, 20];

/** Common regatta distances, offered as suggestions rather than a fixed list. */
export const COMMON_DISTANCES_M = [200, 500, 1000, 2000];
