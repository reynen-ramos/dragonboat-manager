import { describe, expect, it } from 'vitest';
import {
  BUILTIN_EVENT_TYPES,
  eventBase,
  eventTypeLabel,
  slugId,
  trainingKindLabel,
} from './eventTypes';

const CUSTOM = [...BUILTIN_EVENT_TYPES, { id: 'time-trial', label: 'Time trial', base: 'race' as const }];

describe('eventBase', () => {
  it('resolves a custom type to its declared behaviour', () => {
    expect(eventBase('time-trial', CUSTOM)).toBe('race');
  });

  it('falls back to the built-in of the same id when the list is damaged', () => {
    // An old backup, or hand-edited settings: the stored list is empty but
    // the events still say 'practice'. They must keep behaving as practices.
    expect(eventBase('practice', [])).toBe('practice');
    expect(eventBase('race', [])).toBe('race');
  });

  it('treats a fully unknown id as other — the base that grants nothing', () => {
    expect(eventBase('vanished', BUILTIN_EVENT_TYPES)).toBe('other');
  });
});

describe('labels', () => {
  it('resolves labels from settings, then built-ins, then shows the raw id', () => {
    expect(eventTypeLabel('time-trial', CUSTOM)).toBe('Time trial');
    expect(eventTypeLabel('race', [])).toBe('Race / regatta');
    expect(eventTypeLabel('vanished', CUSTOM)).toBe('vanished');
    expect(trainingKindLabel('water', [])).toBe('Water training');
    expect(trainingKindLabel('gone', [])).toBe('gone');
  });
});

describe('slugId', () => {
  it('slugs a label into a stable lowercase id', () => {
    expect(slugId('Time Trial!', [])).toBe('time-trial');
    expect(slugId('Erg / intervals', [])).toBe('erg-intervals');
  });

  it('strips diacritics rather than dropping the letters', () => {
    expect(slugId('Entraînement légér', [])).toBe('entrainement-leger');
  });

  it('suffixes on collision instead of replacing what exists', () => {
    expect(slugId('Water Training', ['water-training'])).toBe('water-training-2');
    expect(slugId('Water Training', ['water-training', 'water-training-2'])).toBe(
      'water-training-3',
    );
  });

  it('never returns an empty id', () => {
    expect(slugId('!!!', [])).toBe('type');
  });
});
