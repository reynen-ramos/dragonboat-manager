import { useEffect, useRef, useState } from 'react';
import { Field, Input } from './Field';

/**
 * A number input that commits when you leave the field, not on every keystroke.
 *
 * Saving per keystroke makes the field impossible to type in: clearing it
 * writes 0, and a half-typed "3." parses to 3, so the decimal point is wiped
 * before the next character arrives. Committing on blur also gives min and max
 * somewhere to be enforced — as bare attributes they only bind the spinner.
 */
export function NumberField({
  label,
  hint,
  value,
  min,
  max,
  step,
  onCommit,
}: {
  label: string;
  hint?: string;
  value: number;
  min?: number;
  max?: number;
  step?: number;
  onCommit: (value: number) => void;
}) {
  const [draft, setDraft] = useState(String(value));
  const [editing, setEditing] = useState(false);
  // Escape blurs the field to leave it, and blur commits. A ref, not state,
  // because `onBlur` runs before a state update from the same keystroke lands.
  const abandoned = useRef(false);

  // Adopt the stored value when it changes under a field nobody is typing in.
  useEffect(() => {
    if (!editing) setDraft(String(value));
  }, [value, editing]);

  const commit = () => {
    setEditing(false);
    const parsed = Number(draft);
    if (draft.trim() === '' || Number.isNaN(parsed)) {
      setDraft(String(value)); // Nothing usable typed — put the stored value back.
      return;
    }
    const clamped = Math.min(max ?? Infinity, Math.max(min ?? -Infinity, parsed));
    setDraft(String(clamped));
    if (clamped !== value) onCommit(clamped);
  };

  return (
    <Field label={label} hint={hint}>
      {(id) => (
        <Input
          id={id}
          type="number"
          inputMode="decimal"
          min={min}
          max={max}
          step={step}
          value={draft}
          onFocus={() => setEditing(true)}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={() => {
            if (abandoned.current) {
              abandoned.current = false;
              setEditing(false);
              setDraft(String(value));
              return;
            }
            commit();
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') e.currentTarget.blur();
            if (e.key === 'Escape') {
              abandoned.current = true;
              e.currentTarget.blur();
            }
          }}
        />
      )}
    </Field>
  );
}
