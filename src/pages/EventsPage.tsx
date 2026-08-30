import { CalendarDays, Plus } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { EventForm } from '@/components/events/EventForm';
import { EventsCalendar } from '@/components/events/EventsCalendar';
import { Button } from '@/components/ui/Button';
import { Badge, Card, EmptyState, LoadFailed, PageHeader, Spinner } from '@/components/ui/misc';
import { RadioCards } from '@/components/ui/RadioCards';
import { formatDate, todayIso } from '@/domain/dates';
import type { ClubEvent } from '@/domain/types';
import { useCategories, useEvents } from '@/queries/hooks';
import { categoryName, pluralise, TRAINING_KIND_LABEL } from '@/utils/format';

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
            <EventsCalendar events={all} onPickDay={(iso) => setCreating({ startDate: iso })} />
          ) : (
            <div className="flex flex-col gap-8">
              {upcoming.length > 0 && <EventGroup title="Upcoming" events={upcoming} />}
              {past.length > 0 && <EventGroup title="Past" events={past} />}
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

function EventCard({ event }: { event: ClubEvent }) {
  const categories = useCategories(event.id);
  const list = categories.data ?? [];

  return (
    <Card className="transition-colors hover:surface-sunken">
      <Link to={`/events/${event.id}`} className="flex items-start justify-between gap-3 px-4 py-3.5">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-medium">{event.name}</p>
            {event.type === 'practice' && (
              <Badge>
                {event.trainingKind ? TRAINING_KIND_LABEL[event.trainingKind] : 'Practice'}
              </Badge>
            )}
            {event.type === 'other' && <Badge tone="warn">Other</Badge>}
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
