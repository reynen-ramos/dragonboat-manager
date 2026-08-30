import type { EventBase, EventTypeDef, TrainingKindDef } from './types';

/**
 * Club-maintained event types and training kinds.
 *
 * An event stores only an id; the label and behaviour live in settings, so a
 * rename in Settings renames every event at once. Resolution never throws:
 * an id that has fallen out of settings (an old backup, a hand-edited file)
 * degrades to a readable label and the safest behaviour rather than a crash.
 */

export const BUILTIN_EVENT_TYPES: EventTypeDef[] = [
  { id: 'race', label: 'Race / regatta', base: 'race' },
  { id: 'practice', label: 'Practice', base: 'practice' },
  { id: 'other', label: 'Other', base: 'other' },
];

export const BUILTIN_TRAINING_KINDS: TrainingKindDef[] = [
  { id: 'water', label: 'Water training' },
  { id: 'land', label: 'Land training' },
  { id: 'supplementary', label: 'Supplementary training' },
];

/**
 * The behaviour of an event type id. Unknown ids fall back to the built-in
 * of the same name first (so pre-settings data behaves unchanged even if the
 * stored list is damaged), then to 'other' — the base that grants nothing.
 */
export function eventBase(typeId: string, types: EventTypeDef[]): EventBase {
  return (
    types.find((t) => t.id === typeId)?.base ??
    BUILTIN_EVENT_TYPES.find((t) => t.id === typeId)?.base ??
    'other'
  );
}

/** The display label for an event type id; the raw id when unknown. */
export function eventTypeLabel(typeId: string, types: EventTypeDef[]): string {
  return (
    types.find((t) => t.id === typeId)?.label ??
    BUILTIN_EVENT_TYPES.find((t) => t.id === typeId)?.label ??
    typeId
  );
}

/** The display label for a training kind id; the raw id when unknown. */
export function trainingKindLabel(kindId: string, kinds: TrainingKindDef[]): string {
  return (
    kinds.find((k) => k.id === kindId)?.label ??
    BUILTIN_TRAINING_KINDS.find((k) => k.id === kindId)?.label ??
    kindId
  );
}

/**
 * A stable id for a new settings entry, from its label. Ids are permanent —
 * events keep referencing them across renames — so collisions get a numeric
 * suffix rather than replacing what exists.
 */
export function slugId(label: string, taken: Iterable<string>): string {
  const set = new Set(taken);
  const stripDiacritics = new RegExp('[\\u0300-\\u036f]', 'g');
  const base =
    label
      .toLowerCase()
      .normalize('NFD')
      .replace(stripDiacritics, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'type';
  if (!set.has(base)) return base;
  let n = 2;
  while (set.has(`${base}-${n}`)) n++;
  return `${base}-${n}`;
}
