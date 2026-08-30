import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/Button';
import {
  addMonths,
  dayNumber,
  inMonth,
  monthGrid,
  monthLabel,
  monthOf,
  occursOn,
  type MonthRef,
} from '@/domain/calendar';
import { formatDate, todayIso } from '@/domain/dates';
import { eventBase } from '@/domain/eventTypes';
import type { ClubEvent, EventBase, EventTypeDef } from '@/domain/types';
import { cn } from '@/utils/cn';

/**
 * The month view of the club's events.
 *
 * Every day an event covers gets a chip — a two-day regatta sits on both
 * squares — colour-coded by kind so a glance separates race weekends from
 * the weekly training rhythm. Days spilling in from neighbouring months are
 * dimmed but still carry their chips: a regatta on the 1st should be visible
 * while the previous month is on screen.
 */

const TYPE_STYLE: Record<EventBase, { chip: string; dot: string; label: string }> = {
  race: {
    chip: 'bg-brand-600 text-white hover:bg-brand-700',
    dot: 'bg-brand-600',
    label: 'Race / regatta',
  },
  practice: {
    chip: 'surface-sunken hover:bg-brand-50 dark:hover:bg-brand-900',
    dot: 'bg-gray-400 dark:bg-gray-500',
    label: 'Practice',
  },
  other: {
    chip: 'bg-amber-100 text-amber-900 hover:bg-amber-200 dark:bg-amber-950 dark:text-amber-200 dark:hover:bg-amber-900',
    dot: 'bg-amber-400',
    label: 'Other',
  },
};

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export function EventsCalendar({
  events,
  eventTypes,
  onPickDay,
}: {
  events: ClubEvent[];
  /** The club's event types — chips are coloured by each type's behaviour. */
  eventTypes: EventTypeDef[];
  /** Called with the day's ISO date — the page opens a pre-dated event form. */
  onPickDay?: (iso: string) => void;
}) {
  const today = todayIso();
  const [month, setMonth] = useState<MonthRef>(() => monthOf(today));

  const weeks = monthGrid(month);
  const sorted = [...events].sort((a, b) => a.startDate.localeCompare(b.startDate));

  return (
    <div>
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-1">
          <Button size="sm" aria-label="Previous month" onClick={() => setMonth((m) => addMonths(m, -1))}>
            <ChevronLeft />
          </Button>
          <Button size="sm" aria-label="Next month" onClick={() => setMonth((m) => addMonths(m, 1))}>
            <ChevronRight />
          </Button>
          <h2 className="ml-2 text-sm font-semibold" aria-live="polite">
            {monthLabel(month)}
          </h2>
        </div>
        <Button size="sm" onClick={() => setMonth(monthOf(today))}>
          Today
        </Button>
      </div>

      <div className="overflow-x-auto">
        <div className="min-w-[560px]">
          <div className="grid grid-cols-7 text-center text-xs font-semibold uppercase tracking-wide text-muted">
            {WEEKDAYS.map((day) => (
              <div key={day} className="pb-1.5">
                {day}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-px overflow-hidden rounded-xl border border-subtle bg-[var(--border-subtle)]">
            {weeks.flat().map((iso) => (
              <DayCell
                key={iso}
                iso={iso}
                dimmed={!inMonth(iso, month)}
                isToday={iso === today}
                events={sorted.filter((e) => occursOn(e, iso))}
                eventTypes={eventTypes}
                onPickDay={onPickDay}
              />
            ))}
          </div>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted">
        {(Object.keys(TYPE_STYLE) as EventBase[]).map((base) => (
          <span key={base} className="flex items-center gap-1.5">
            <span aria-hidden="true" className={cn('size-2.5 rounded-full', TYPE_STYLE[base].dot)} />
            {TYPE_STYLE[base].label}
          </span>
        ))}
      </div>
    </div>
  );
}

function DayCell({
  iso,
  dimmed,
  isToday,
  events,
  eventTypes,
  onPickDay,
}: {
  iso: string;
  dimmed: boolean;
  isToday: boolean;
  events: ClubEvent[];
  eventTypes: EventTypeDef[];
  onPickDay?: (iso: string) => void;
}) {
  return (
    <div
      className={cn('flex min-h-20 flex-col gap-1 p-1', dimmed ? 'surface-sunken' : 'surface')}
    >
      {onPickDay ? (
        // The day number doubles as "new event here" — a title and a focus
        // ring make it discoverable without a hover-only plus icon that
        // would not exist on touch.
        <button
          type="button"
          onClick={() => onPickDay(iso)}
          title={`New event on ${formatDate(iso)}`}
          aria-label={`New event on ${formatDate(iso)}`}
          className={cn(
            'self-start rounded-md px-1.5 py-0.5 text-xs tabular-nums hover:bg-brand-50 dark:hover:bg-brand-900',
            dimmed && 'text-muted/60',
            isToday && 'bg-brand-600 font-bold text-white hover:bg-brand-700 dark:hover:bg-brand-700',
          )}
        >
          {dayNumber(iso)}
        </button>
      ) : (
        <span
          className={cn(
            'self-start px-1.5 py-0.5 text-xs tabular-nums',
            dimmed && 'text-muted/60',
            isToday && 'rounded-md bg-brand-600 font-bold text-white',
          )}
        >
          {dayNumber(iso)}
        </span>
      )}

      {events.map((event) => (
        <Link
          key={event.id}
          to={`/events/${event.id}`}
          title={event.name}
          className={cn(
            'block truncate rounded px-1.5 py-0.5 text-[11px] font-medium leading-tight transition-colors',
            TYPE_STYLE[eventBase(event.type, eventTypes)].chip,
          )}
        >
          {event.name}
        </Link>
      ))}
    </div>
  );
}
