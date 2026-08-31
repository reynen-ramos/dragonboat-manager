import { CalendarDays, Plus } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { EventForm } from '@/components/events/EventForm';
import { EventsCalendar } from '@/components/events/EventsCalendar';
import { Button } from '@/components/ui/Button';
import { Badge, Card, EmptyState, LoadFailed, PageHeader, Spinner } from '@/components/ui/misc';
import { RadioCards } from '@/components/ui/RadioCards';
import { monthLabel, monthOf } from '@/domain/calendar';
import { formatDate, todayIso } from '@/domain/dates';
import type { ClubEvent } from '@/domain/types';
import { useCategories, useEvents } from '@/queries/hooks';
import { eventBase, eventTypeLabel, trainingKindLabel } from '@/domain/eventTypes';
import { useSettings } from '@/queries/hooks';
import { categoryName, pluralise } from '@/utils/format';

type View = 'list' | 'calendar';

export function EventsPage() {
  const events = useEvents();
  const [view, setView] = useState<View>('list');
  // `false` = closed; otherwise the form is open, optionally pre-dated by the
  // calendar day that was tapped.
  const [creating, setCreating] = useState<false | { startDate?: string }>(false);

  if (events.isLoading) return <Spinner />;
  if (events.isError) {
    return <LoadFailed onRetry={() => { void events.refetch(); }} />;
  }

  const today = todayIso();
  const all = events.data ?? [];
  const upcoming = all
    .filter((e) => (e.endDate ?? e.startDate) >= today)
    .sort((a, b) => a.startDate.localeCompare(b.startDate));
  const past = all
    .filter((e) => (e.endDate ?? e.startDate) < today)
    .sort((a, b) => b.startDate.localeCompare(a.startDate));

  return (
    <>
      <PageHeader
        title="Events"
        actions={
          <Button variant="primary" onClick={() => setCreating({})}>
            <Plus /> New event
          </Button>
        }
      />

      {all.length === 0 ? (
        <EmptyState
          icon={<CalendarDays />}
          title="No events yet"
          description="Create a regatta or a practice, then add the categories you are entering."
          action={
            <Button variant="primary" onClick={() => setCreating({})}>
              <Plus /> New event
            </Button>
          }
        />
      ) : (
        <div className="flex flex-col gap-4">
          <RadioCards<View>
            label="Events view"
            className="flex w-fit gap-1 rounded-lg surface-sunken p-1"
            optionClassName="rounded-md px-3 py-1.5 text-sm font-medium text-muted transition-colors"
            value={view}
            onChange={setView}
            options={[
              { value: 'list', label: 'List', selectedClassName: 'surface text-[inherit] shadow-sm' },
              { value: 'calendar', label: 'Calendar', selectedClassName: 'surface text-[inherit] shadow-sm' },
            ]}
            renderOption={(option) => option.label}
          />

          {view === 'calendar' ? (
            <EventsCalendarWithTypes events={all} onPickDay={(iso) => setCreating({ startDate: iso })} />
          ) : (
            <div className="flex flex-col gap-8">
              {upcoming.length > 0 && <EventGroup title="Upcoming" events={upcoming} />}
              {past.length > 0 && <PastByMonth events={past} />}
            </div>
          )}
        </div>
      )}

      {creating && (
        <EventForm
          open
          initialDate={creating.startDate}
          onOpenChange={(open) => !open && setCreating(false)}
        />
      )}
    </>
  );
}

function EventsCalendarWithTypes(props: {
  events: ClubEvent[];
  onPickDay: (iso: string) => void;
}) {
  const settings = useSettings();
  return <EventsCalendar {...props} eventTypes={settings.eventTypes} />;
}

function EventGroup({ title, events }: { title: string; events: ClubEvent[] }) {
  return (
    <section>
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted">{title}</h2>
      <div className="flex flex-col gap-2">
        {events.map((event) => (
          <EventCard key={event.id} event={event} />
        ))}
      </div>
    </section>
  );
}

/**
 * The past, grouped by month with the weekly noise folded away.
 *
 * A season of recurring trainings would otherwise bury the races. Races and
 * one-offs stay visible in every month; trainings collapse behind a per-month
 * toggle, so the list reads as the season's story with the training rhythm
 * available on demand. Collapsed cards are unmounted, which also spares the
 * per-card category queries.
 */
function PastByMonth({ events }: { events: ClubEvent[] }) {
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

function EventCard({ event }: { event: ClubEvent }) {
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
