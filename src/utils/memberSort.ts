import type { Member } from '@/domain/types';
import { fullName } from './format';

/**
 * The member orderings the roster views offer.
 *
 * One definition, because the two copies were byte-identical and any future
 * divergence between "sort by weight" on the members page and in the lineup
 * roster would be a bug, not a feature.
 */
export type MemberSortKey = 'name' | 'weight' | 'side';

export const compareMembers =
  (sort: MemberSortKey) =>
  (a: Member, b: Member): number => {
    if (sort === 'weight') return (b.weightKg ?? 0) - (a.weightKg ?? 0);
    if (sort === 'side') return a.sidePreference.localeCompare(b.sidePreference);
    return fullName(a).localeCompare(fullName(b));
  };
