import { CalendarDays, Plus } from 'lucide-react';
import { useState } from 'react';
import { EventCard, FullCalendar, PastByMonth } from '@/components/events/EventList';
import { EventForm } from '@/components/events/EventForm';
import { Button } from '@/components/ui/Button';
import { EmptyState, LoadFailed, PageHeader, Spinner } from '@/components/ui/misc';
import { RadioCards } from '@/components/ui/RadioCards';
import { todayIso } from '@/domain/dates';
import { eventBase } from '@/domain/eventTypes';
import type { ClubEvent } from '@/domain/types';
import { useEvents, useSettings } from '@/queries/hooks';

type View = 'list' | 'calendar';

/**
 * Races and one-off club events. Trainings live in their own section — the
 * weekly rhythm would bury the season's story here — but the calendar view
 * deliberately shows everything: the month grid is where the whole club week
 * is read at once, whichever door it is opened through.
 */
export function EventsPage() {
  const events = useEvents();
  const settings = useSettings();
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
  const listed = all.filter((e) => eventBase(e.type, settings.eventTypes) !== 'practice');
  const upcoming = listed
    .filter((e) => (e.endDate ?? e.startDate) >= today)
    .sort((a, b) => a.startDate.localeCompare(b.startDate));
  const past = listed
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
            <FullCalendar events={all} onPickDay={(iso) => setCreating({ startDate: iso })} />
          ) : listed.length === 0 ? (
            <EmptyState
              title="No races or club events yet"
              description="The training schedule lives under Trainings; races and one-offs appear here."
            />
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
