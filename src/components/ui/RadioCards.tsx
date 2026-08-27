import type { ReactNode } from 'react';
import { cn } from '@/utils/cn';

/**
 * One choice from a set, as buttons.
 *
 * `role="radiogroup"` rather than a row of `aria-pressed` buttons. Those
 * announce as independent toggles — "Mixed, pressed" says nothing about the
 * three other classes it just turned off, so a screen reader user has to press
 * each one to discover the set is exclusive. A radio group announces the whole
 * set, the position within it, and which one is chosen.
 *
 * The keyboard contract comes with it: arrow keys move between options and
 * only the selected one is in the tab order, so a long row is one tab stop
 * rather than five.
 */
export interface RadioCardOption<T extends string> {
  value: T;
  label: string;
  /** Optional second line, e.g. "10 paddlers". */
  description?: string;
  /** Classes applied when this option is the selected one. */
  selectedClassName?: string;
}

export function RadioCards<T extends string>({
  label,
  value,
  options,
  onChange,
  className,
  optionClassName,
  renderOption,
}: {
  label: string;
  value: T | undefined;
  options: RadioCardOption<T>[];
  onChange: (value: T) => void;
  className?: string;
  optionClassName?: string;
  renderOption?: (option: RadioCardOption<T>, selected: boolean) => ReactNode;
}) {
  const move = (from: number, delta: number) => {
    const next = (from + delta + options.length) % options.length;
    onChange(options[next].value);
    // Selection follows focus in a radio group, so move focus with it.
    document.getElementById(radioId(label, options[next].value))?.focus();
  };

  return (
    <div role="radiogroup" aria-label={label} className={className}>
      {options.map((option, index) => {
        const selected = option.value === value;
        return (
          <button
            key={option.value}
            id={radioId(label, option.value)}
            type="button"
            role="radio"
            aria-checked={selected}
            // Only the active option is tabbable; arrows move within the set.
            tabIndex={selected || (value === undefined && index === 0) ? 0 : -1}
            onClick={() => onChange(option.value)}
            onKeyDown={(e) => {
              if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
                e.preventDefault();
                move(index, 1);
              } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
                e.preventDefault();
                move(index, -1);
              }
            }}
            className={cn(
              optionClassName,
              selected ? option.selectedClassName : undefined,
            )}
          >
            {renderOption ? (
              renderOption(option, selected)
            ) : (
              <>
                <span className="block font-semibold">{option.label}</span>
                {option.description && (
                  <span className="block text-xs text-muted">{option.description}</span>
                )}
              </>
            )}
          </button>
        );
      })}
    </div>
  );
}

const radioId = (group: string, value: string) =>
  `radio-${group.replace(/\W+/g, '-')}-${value}`.toLowerCase();
