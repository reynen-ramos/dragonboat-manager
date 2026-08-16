import type { Category, Gender, Member, SidePreference } from '@/domain/types';
import { AGE_DIVISION_BOUNDS } from '@/domain/rules.config';

export const fullName = (m: Member): string => `${m.firstName} ${m.lastName}`.trim();

export const shortName = (m: Member): string =>
  `${m.firstName} ${m.lastName.charAt(0)}${m.lastName ? '.' : ''}`.trim();

export const initials = (m: Member): string =>
  `${m.firstName.charAt(0)}${m.lastName.charAt(0)}`.toUpperCase();

/** Single-letter side marker used on seat and roster cards. */
export const SIDE_MARK: Record<SidePreference, string> = {
  left: 'L',
  right: 'R',
  both: 'B',
};

export const SIDE_PREFERENCE_LABEL: Record<SidePreference, string> = {
  left: 'Left only',
  right: 'Right only',
  both: 'Either side',
};

export const GENDER_LABEL: Record<Gender, string> = {
  male: 'Male',
  female: 'Female',
  other: 'Other',
};

export const formatWeight = (kg?: number): string => (kg == null ? '—' : `${Math.round(kg)}kg`);

/**
 * A category's display name, e.g. "20s Mixed · 500m".
 *
 * A custom label replaces the composed boat-size and class name entirely, since
 * clubs that set one are naming something the standard vocabulary can't express.
 */
export function categoryName(category: Category): string {
  if (category.label) return category.label;

  const genderClass = { open: 'Open', mixed: 'Mixed', women: "Women's" }[category.genderClass];
  const parts = [`${category.boatSize}s ${genderClass}`];
  if (category.ageDivision) parts.push(AGE_DIVISION_BOUNDS[category.ageDivision].label);
  if (category.distanceM) parts.push(`${category.distanceM}m`);
  return parts.join(' · ');
}

export const pluralise = (count: number, singular: string, plural = `${singular}s`): string =>
  `${count} ${count === 1 ? singular : plural}`;
