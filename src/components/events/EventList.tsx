import { useState } from 'react';
import { Link } from 'react-router-dom';
import { EventsCalendar } from '@/components/events/EventsCalendar';
import { Badge, Card } from '@/components/ui/misc';
import { monthLabel, monthOf } from '@/domain/calendar';
import { formatDate } from '@/domain/dates';
import { eventBase, eventTypeLabel, trainingKindLabel } from '@/domain/eventTypes';
import type { ClubEvent } from '@/domain/types';
import { useCategories, useSettings } from '@/queries/hooks';
import { categoryName, pluralise } from '@/utils/format';

/** List building blocks shared by the Events and Trainings sections. */

/** The month calendar, always showing the whole club week — both sections offer it. */
export function FullCalendar(props: { events: ClubEvent[]; onPickDay: (iso: string) => void }) {
  const settings = useSettings();
  return <EventsCalendar {...props} eventTypes={settings.eventTypes} />;
}

export function EventCard({ event }: { event: ClubEvent }) {
  const categories = useCategories(event.id);
  const settings = useSettings();
  const list = categories.data ?? [];
  const base = eventBase(event.type, settings.eventTypes);

  return (
    <Card className="transition-colors hover:surface-sunken">
      <Link to={`/events/${event.id}`} className="flex items-start justify-between gap-3 px-4 py-3.5">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-medium">{event.name}</p>
            {/* The plain built-in race is the unmarked default; everything
                else says what it is — a custom race-base type included. */}
            {event.type !== 'race' && (
              <Badge tone={base === 'other' ? 'warn' : base === 'race' ? 'brand' : 'neutral'}>
                {base === 'practice' && event.trainingKind
                  ? trainingKindLabel(event.trainingKind, settings.trainingKinds)
                  : eventTypeLabel(event.type, settings.eventTypes)}
              </Badge>
            )}
          </div>
          <p className="mt-0.5 text-sm text-muted">
            {formatDate(event.startDate)}
            {event.endDate ? ` – ${formatDate(event.endDate)}` : ''}
            {event.location ? ` · ${event.location}` : ''}
          </p>
          {list.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {list.map((category) => (
                <Badge key={category.id} tone="brand">
                  {categoryName(category)}
                </Badge>
              ))}
            </div>
          )}
        </div>
        <span className="shrink-0 text-sm text-muted">
          {list.length === 0 ? 'No categories' : pluralise(list.length, 'category', 'categories')}
        </span>
      </Link>
    </Card>
  );
}

/**
 * The past, grouped by month with the weekly noise folded away.
 *
 * Races and one-offs stay visible in every month; practice-base events
 * collapse behind a per-month toggle. On the Events section (which holds no
 * trainings) this degenerates to plain month groups; on the Trainings section
 * (all trainings) every month starts folded — exactly the density each
 * section wants. Collapsed cards are unmounted, which also spares the
 * per-card category queries.
 */
export function PastByMonth({ events }: { events: ClubEvent[] }) {
  const settings = useSettings();
  const [openMonths, setOpenMonths] = useState<Set<string>>(new Set());

  // Events arrive newest-first; bucket by YYYY-MM preserving that order.
  const months: { key: string; events: ClubEvent[] }[] = [];
  for (const event of events) {
    const last = months[months.length - 1];
    const key = event.startDate.slice(0, 7);
    if (last?.key === key) last.events.push(event);
    else months.push({ key, events: [event] });
  }

  const toggle = (key: string) =>
    setOpenMonths((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  return (
    <section>
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted">Past</h2>
      <div className="flex flex-col gap-6">
        {months.map(({ key, events: monthEvents }) => {
          const trainings = monthEvents.filter(
            (e) => eventBase(e.type, settings.eventTypes) === 'practice',
          );
          const open = openMonths.has(key);
          const shown = open
            ? monthEvents
            : monthEvents.filter((e) => eventBase(e.type, settings.eventTypes) !== 'practice');

          return (
            <div key={key}>
              <div className="mb-2 flex flex-wrap items-baseline gap-3">
                <h3 className="text-sm font-medium">{monthLabel(monthOf(`${key}-01`))}</h3>
                {trainings.length > 0 && (
                  <button
                    type="button"
                    className="text-xs font-medium text-brand-700 hover:underline dark:text-brand-300"
                    onClick={() => toggle(key)}
                  >
                    {open ? 'Hide trainings' : `Show ${pluralise(trainings.length, 'training')}`}
                  </button>
                )}
              </div>
              {shown.length > 0 && (
                <div className="flex flex-col gap-2">
                  {shown.map((event) => (
                    <EventCard key={event.id} event={event} />
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
