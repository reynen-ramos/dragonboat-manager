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
  pinned,
  compact,
  className,
}: {
  member: Member;
  wrongSide?: boolean;
  unavailable?: boolean;
  doubleBooked?: boolean;
  pinned?: boolean;
  compact?: boolean;
  className?: string;
}) {
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
            {unavailable && <span className="ml-1 text-amber-600">unavailable</span>}
            {doubleBooked && <span className="ml-1 text-red-600">in another crew</span>}
          </span>
        ) : (
          // Compact hides the weight line to fit the reserves strip, but the
          // warnings on it are the reason a reserve is worth looking at. An
          // icon rather than a colour, so it survives a colour-blind reader.
          (unavailable || doubleBooked) && (
            <span
              className={cn(
                'flex items-center gap-0.5 text-[0.6rem] leading-tight',
                doubleBooked ? 'text-red-600' : 'text-amber-600',
              )}
            >
              <AlertTriangle className="size-2.5 shrink-0" aria-hidden="true" />
              {doubleBooked ? 'other crew' : 'unavailable'}
            </span>
          )
        )}
      </span>
    </div>
  );
}
