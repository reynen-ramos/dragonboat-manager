import { CalendarDays, Sparkles, Users } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/Button';
import { Card, EmptyState, LoadFailed, PageHeader, Spinner } from '@/components/ui/misc';
import { formatDate, todayIso } from '@/domain/dates';
import { useEvents, useLoadDemoClub, useMembers } from '@/queries/hooks';
import { categoryName, pluralise } from '@/utils/format';
import { useCategories } from '@/queries/hooks';

export function DashboardPage() {
  const members = useMembers();
  const events = useEvents();
  const loadDemo = useLoadDemoClub();

  if (members.isLoading || events.isLoading) return <Spinner />;
  if (members.isError || events.isError) {
    return <LoadFailed onRetry={() => { void members.refetch(); void events.refetch(); }} />;
  }

  const activeMembers = (members.data ?? []).filter((m) => m.status === 'active');
  const today = todayIso();
  const upcoming = (events.data ?? [])
    .filter((e) => (e.endDate ?? e.startDate) >= today)
    .sort((a, b) => a.startDate.localeCompare(b.startDate));

  const isEmpty = (members.data ?? []).length === 0 && (events.data ?? []).length === 0;

  if (isEmpty) {
    return (
      <>
        <PageHeader title="Dragonboat Manager" />
        <EmptyState
          icon={<Sparkles />}
          title="Nothing here yet"
          description="Load a demo club to see how it all fits together, or start by adding your paddlers."
          action={
            <div className="flex flex-wrap justify-center gap-2">
              <Button
                variant="primary"
                onClick={() => loadDemo.mutate(undefined)}
                disabled={loadDemo.isPending}
              >
                <Sparkles />
                {loadDemo.isPending ? 'Loading…' : 'Load demo club'}
              </Button>
              <Button asChild>
                <Link to="/members">Add paddlers</Link>
              </Button>
            </div>
          }
        />
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Dashboard"
        description={`${pluralise(activeMembers.length, 'active paddler')} · ${pluralise(
          upcoming.length,
          'upcoming event',
        )}`}
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <Card className="p-5">
          <div className="flex items-center gap-2 text-sm font-medium text-muted">
            <Users className="size-4" /> Club roster
          </div>
          <p className="tabular mt-2 text-3xl font-semibold">{activeMembers.length}</p>
          <p className="text-sm text-muted">
            active of {pluralise(members.data?.length ?? 0, 'member')}
          </p>
          <Button asChild className="mt-4" size="sm">
            <Link to="/members">Manage members</Link>
          </Button>
        </Card>

        <Card className="p-5">
          <div className="flex items-center gap-2 text-sm font-medium text-muted">
            <CalendarDays className="size-4" /> Next up
          </div>
          {upcoming[0] ? (
            <>
              <p className="mt-2 text-lg font-semibold">{upcoming[0].name}</p>
              <p className="text-sm text-muted">
                {formatDate(upcoming[0].startDate)}
                {upcoming[0].location ? ` · ${upcoming[0].location}` : ''}
              </p>
              <Button asChild className="mt-4" size="sm">
                <Link to={`/events/${upcoming[0].id}`}>Open event</Link>
              </Button>
            </>
          ) : (
            <>
              <p className="mt-2 text-sm text-muted">No upcoming events.</p>
              <Button asChild className="mt-4" size="sm">
                <Link to="/events">Create one</Link>
              </Button>
            </>
          )}
        </Card>
      </div>

      {upcoming.length > 0 && (
        <section className="mt-8">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted">
            Upcoming events
          </h2>
          <div className="flex flex-col gap-2">
            {upcoming.map((event) => (
              <EventRow key={event.id} eventId={event.id} name={event.name} date={event.startDate} />
            ))}
          </div>
        </section>
      )}
    </>
  );
}

function EventRow({ eventId, name, date }: { eventId: string; name: string; date: string }) {
  const categories = useCategories(eventId);

  return (
    <Link
      to={`/events/${eventId}`}
      className="surface flex items-center justify-between gap-3 rounded-xl border px-4 py-3 hover:surface-sunken"
    >
      <div className="min-w-0">
        <p className="truncate font-medium">{name}</p>
        <p className="truncate text-sm text-muted">
          {formatDate(date)}
          {categories.data?.length
            ? ` · ${categories.data.map(categoryName).join(', ')}`
            : ' · No categories yet'}
        </p>
      </div>
      <span className="text-muted" aria-hidden>
        ›
      </span>
    </Link>
  );
}
