import { CalendarDays, HardDriveDownload, Sparkles, Users } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/Button';
import { Badge, Card, EmptyState, LoadFailed, PageHeader, Spinner } from '@/components/ui/misc';
import { formatDate, todayIso } from '@/domain/dates';
import type { ClubEvent } from '@/domain/types';
import { exportSnapshot, useEvents, useLoadDemoClub, useMembers } from '@/queries/hooks';
import { backupDue, useBackupReminder } from '@/stores/backupReminder';
import { downloadTextFile } from '@/utils/download';
import { eventBase, trainingKindLabel } from '@/domain/eventTypes';
import { categoryName, pluralise } from '@/utils/format';
import { useCategories, useSettings } from '@/queries/hooks';

export function DashboardPage() {
  const members = useMembers();
  const events = useEvents();
  const settings = useSettings();
  const loadDemo = useLoadDemoClub();
  const baseOf = (e: ClubEvent) => eventBase(e.type, settings.eventTypes);

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

      <BackupNudge />

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

      {/* Races and trainings answer different questions — "what are we
          entering?" versus "when do we meet this week?" — so each gets its
          own list instead of one interleaved feed. Custom types group by
          the behaviour they declare in Settings. */}
      <UpcomingGroup title="Upcoming races" events={upcoming.filter((e) => baseOf(e) === 'race')} />
      <UpcomingGroup
        title="Upcoming trainings"
        events={upcoming.filter((e) => baseOf(e) === 'practice')}
      />
      <UpcomingGroup
        title="Other upcoming events"
        events={upcoming.filter((e) => baseOf(e) === 'other')}
      />
    </>
  );
}

function UpcomingGroup({ title, events }: { title: string; events: ClubEvent[] }) {
  if (events.length === 0) return null;
  return (
    <section className="mt-8">
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted">{title}</h2>
      <div className="flex flex-col gap-2">
        {events.map((event) => (
          <EventRow key={event.id} event={event} />
        ))}
      </div>
    </section>
  );
}

function EventRow({ event }: { event: ClubEvent }) {
  const categories = useCategories(event.id);
  const settings = useSettings();
  const base = eventBase(event.type, settings.eventTypes);

  return (
    <Link
      to={`/events/${event.id}`}
      className="surface flex items-center justify-between gap-3 rounded-xl border px-4 py-3 hover:surface-sunken"
    >
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <p className="truncate font-medium">{event.name}</p>
          {event.trainingKind && (
            <Badge>{trainingKindLabel(event.trainingKind, settings.trainingKinds)}</Badge>
          )}
        </div>
        <p className="truncate text-sm text-muted">
          {formatDate(event.startDate)}
          {categories.data?.length
            ? ` · ${categories.data.map(categoryName).join(', ')}`
            : // "No categories yet" is a nudge to plan a race; on a training
              // or social it is just noise, so those show where to turn up.
              base === 'race'
              ? ' · No categories yet'
              : event.location
                ? ` · ${event.location}`
                : ''}
        </p>
      </div>
      <span className="text-muted" aria-hidden>
        ›
      </span>
    </Link>
  );
}

/**
 * The dismissible reminder that the club lives in one browser.
 *
 * Rendered only past the empty state, so there is data worth losing. Export
 * happens right here — a nudge that merely links to Settings is a chore; one
 * that finishes the job in a tap builds the habit it exists for.
 */
function BackupNudge() {
  const lastExportAt = useBackupReminder((s) => s.lastExportAt);
  const snoozedUntil = useBackupReminder((s) => s.snoozedUntil);
  const markExported = useBackupReminder((s) => s.markExported);
  const snooze = useBackupReminder((s) => s.snooze);

  if (!backupDue(lastExportAt, snoozedUntil, new Date())) return null;

  const exportNow = async () => {
    downloadTextFile(
      `dragonboat-backup-${todayIso()}.json`,
      JSON.stringify(await exportSnapshot(), null, 2),
      'application/json',
    );
    markExported();
  };

  return (
    <Card className="mb-4 flex flex-wrap items-center gap-3 border-amber-300 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-950">
      <HardDriveDownload
        className="size-5 shrink-0 text-amber-700 dark:text-amber-300"
        aria-hidden="true"
      />
      <p className="min-w-0 flex-1 text-sm text-amber-900 dark:text-amber-100">
        {lastExportAt
          ? `Last backup ${formatDate(lastExportAt.slice(0, 10))}. Everything here lives in this browser only.`
          : 'This club has never been backed up. Everything here lives in this browser only — clearing its data deletes the club.'}
      </p>
      <div className="flex shrink-0 gap-2">
        <Button size="sm" variant="primary" onClick={() => void exportNow()}>
          Export backup
        </Button>
        <Button size="sm" variant="ghost" onClick={snooze}>
          Remind me in a week
        </Button>
      </div>
    </Card>
  );
}
