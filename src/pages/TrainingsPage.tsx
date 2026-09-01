import { ClipboardCheck, Dumbbell, Plus, Timer } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { FullCalendar, PastByMonth } from '@/components/events/EventList';
import { EventForm } from '@/components/events/EventForm';
import { Button } from '@/components/ui/Button';
import { Badge, Card, EmptyState, LoadFailed, PageHeader, Spinner } from '@/components/ui/misc';
import { RadioCards } from '@/components/ui/RadioCards';
import { addDays, startOfWeek } from '@/domain/calendar';
import { formatDate, todayIso } from '@/domain/dates';
import { eventBase, trainingKindLabel } from '@/domain/eventTypes';
import type { ClubEvent } from '@/domain/types';
import { useCanManage } from '@/auth/session';
import { useEvents, useSettings } from '@/queries/hooks';

type View = 'list' | 'calendar';

/**
 * The training schedule — every practice-base session, read the way a coach
 * plans a week: what's on this week, what's next, and the season behind,
 * folded by month. Races and one-offs live under Events; the calendar view
 * still shows the whole club week, because the month grid is where everything
 * is read at once.
 */
export function TrainingsPage() {
  const canManage = useCanManage();
  const events = useEvents();
  const settings = useSettings();
  const [view, setView] = useState<View>('list');
  const [creating, setCreating] = useState<false | { startDate?: string }>(false);

  if (events.isLoading) return <Spinner />;
  if (events.isError) {
    return <LoadFailed onRetry={() => { void events.refetch(); }} />;
  }

  const today = todayIso();
  const all = events.data ?? [];
  const trainings = all.filter((e) => eventBase(e.type, settings.eventTypes) === 'practice');

  const weekEnd = addDays(startOfWeek(today), 7);
  const upcoming = trainings
    .filter((e) => (e.endDate ?? e.startDate) >= today)
    .sort((a, b) => a.startDate.localeCompare(b.startDate));
  const thisWeek = upcoming.filter((e) => e.startDate < weekEnd);
  const nextWeek = upcoming.filter((e) => e.startDate >= weekEnd && e.startDate < addDays(weekEnd, 7));
  const later = upcoming.filter((e) => e.startDate >= addDays(weekEnd, 7));
  const past = trainings
    .filter((e) => (e.endDate ?? e.startDate) < today)
    .sort((a, b) => b.startDate.localeCompare(a.startDate));

  // "New training" pre-selects the club's first practice-like type.
  const defaultTrainingType = settings.eventTypes.find((t) => t.base === 'practice')?.id;

  const newTraining = (startDate?: string) => setCreating({ startDate });

  return (
    <>
      <PageHeader
        title="Trainings"
        actions={
          <div className="flex flex-wrap gap-2">
            <Button asChild>
              <Link to="/time-trials">
                <Timer /> Time trials
              </Link>
            </Button>
            {canManage && (
              <Button variant="primary" onClick={() => newTraining()}>
                <Plus /> New training
              </Button>
            )}
          </div>
        }
      />

      {trainings.length === 0 && view === 'list' ? (
        <EmptyState
          icon={<Dumbbell />}
          title="No trainings yet"
          description="Schedule a water or land session — sign-ups and attendance follow from there."
          action={
            canManage ? (
              <Button variant="primary" onClick={() => newTraining()}>
                <Plus /> New training
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className="flex flex-col gap-4">
          <RadioCards<View>
            label="Trainings view"
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
            <FullCalendar events={all} onPickDay={canManage ? (iso) => newTraining(iso) : undefined} />
          ) : (
            <div className="flex flex-col gap-8">
              <TrainingGroup title="This week" sessions={thisWeek} emptyCopy="Nothing more this week." />
              <TrainingGroup title="Next week" sessions={nextWeek} />
              {later.length > 0 && <TrainingGroup title="Later" sessions={later} />}
              {past.length > 0 && <PastByMonth events={past} />}
            </div>
          )}
        </div>
      )}

      {creating && (
        <EventForm
          open
          initialDate={creating.startDate}
          initialType={defaultTrainingType}
          onOpenChange={(open) => !open && setCreating(false)}
        />
      )}
    </>
  );
}

function TrainingGroup({
  title,
  sessions,
  emptyCopy,
}: {
  title: string;
  sessions: ClubEvent[];
  emptyCopy?: string;
}) {
  if (sessions.length === 0 && !emptyCopy) return null;
  return (
    <section>
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted">{title}</h2>
      {sessions.length === 0 ? (
        <p className="text-sm text-muted">{emptyCopy}</p>
      ) : (
        <div className="flex flex-col gap-2">
          {sessions.map((session) => (
            <TrainingRow key={session.id} session={session} />
          ))}
        </div>
      )}
    </section>
  );
}

const weekdayName = (iso: string): string =>
  new Date(`${iso}T00:00:00Z`).toLocaleDateString(undefined, { weekday: 'long', timeZone: 'UTC' });

/**
 * One session. The row opens the event; the button jumps straight to its
 * sign-up sheet — the thing a coach actually does with an upcoming training.
 */
function TrainingRow({ session }: { session: ClubEvent }) {
  const settings = useSettings();
  return (
    <Card className="flex items-center gap-3 transition-colors hover:surface-sunken">
      <Link to={`/events/${session.id}`} className="min-w-0 flex-1 px-4 py-3">
        <div className="flex flex-wrap items-center gap-2">
          <p className="font-medium">{session.name}</p>
          {session.trainingKind && (
            <Badge tone="neutral">
              {trainingKindLabel(session.trainingKind, settings.trainingKinds)}
            </Badge>
          )}
        </div>
        <p className="mt-0.5 text-sm text-muted">
          {weekdayName(session.startDate)} · {formatDate(session.startDate)}
          {session.location ? ` · ${session.location}` : ''}
        </p>
      </Link>
      <Button asChild size="sm" className="mr-3 shrink-0">
        <Link to={`/events/${session.id}/signups`}>
          <ClipboardCheck /> Sign-ups
        </Link>
      </Button>
    </Card>
  );
}
