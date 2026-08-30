import { AlertTriangle, Pin } from 'lucide-react';
import type { Member } from '@/domain/types';
import { cn } from '@/utils/cn';
import { formatWeight, shortName, SIDE_MARK } from '@/utils/format';

/**
 * The card representing a paddler, used in seats, the roster, and the reserves.
 *
 * The side marker is always visible and turns red when the paddler is on the
 * wrong side — that is the mistake a coach most needs to catch at a glance.
 */
export function PaddlerChip({
  member,
  wrongSide,
  unavailable,
  doubleBooked,
  notSignedUp,
  tentative,
  pinned,
  compact,
  className,
}: {
  member: Member;
  wrongSide?: boolean;
  unavailable?: boolean;
  doubleBooked?: boolean;
  /** In a lineup for an event this member never signed up for. */
  notSignedUp?: boolean;
  /** Signed up Maybe — in the pool, but not a firm commitment. */
  tentative?: boolean;
  pinned?: boolean;
  compact?: boolean;
  className?: string;
}) {
  // One word at most, worst first — a chip reciting three problems reads as
  // noise, and the Checks panel already lists everything.
  const warning = doubleBooked
    ? { text: 'in another crew', short: 'other crew', tone: 'text-red-600' }
    : unavailable
      ? { text: 'unavailable', short: 'unavailable', tone: 'text-amber-600' }
      : notSignedUp
        ? { text: 'not signed up', short: 'unsigned', tone: 'text-amber-600' }
        : tentative
          ? { text: 'maybe', short: 'maybe', tone: 'text-amber-600' }
          : undefined;

  return (
    <div className={cn('flex min-w-0 items-center gap-1.5', className)}>
      <span
        className={cn(
          'grid size-5 shrink-0 place-items-center rounded text-[0.65rem] font-bold',
          wrongSide
            ? 'bg-red-600 text-white'
            : member.sidePreference === 'both'
              ? 'surface-sunken text-muted'
              : 'bg-brand-600 text-white',
        )}
      >
        <span aria-hidden="true">{SIDE_MARK[member.sidePreference]}</span>
        <span className="sr-only">
          {wrongSide
            ? `Paddles ${member.sidePreference}, seated on the wrong side`
            : `Paddles ${member.sidePreference}`}
        </span>
      </span>

      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1">
          <span className="truncate text-xs font-medium leading-tight">{shortName(member)}</span>
          {pinned && (
            <>
              <Pin className="size-3 shrink-0 text-brand-600" aria-hidden="true" />
              <span className="sr-only">Pinned</span>
            </>
          )}
        </span>
        {!compact ? (
          <span className="tabular block text-[0.65rem] leading-tight text-muted">
            {formatWeight(member.weightKg)}
            {warning && <span className={cn('ml-1', warning.tone)}>{warning.text}</span>}
          </span>
        ) : (
          // Compact hides the weight line to fit the reserves strip, but the
          // warnings on it are the reason a reserve is worth looking at. An
          // icon rather than a colour, so it survives a colour-blind reader.
          warning && (
            <span
              className={cn('flex items-center gap-0.5 text-[0.6rem] leading-tight', warning.tone)}
            >
              <AlertTriangle className="size-2.5 shrink-0" aria-hidden="true" />
              {warning.short}
            </span>
          )
        )}
      </span>
    </div>
  );
}
