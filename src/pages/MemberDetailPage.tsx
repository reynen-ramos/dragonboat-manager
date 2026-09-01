import { Pencil, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { MemberForm } from '@/components/members/MemberForm';
import { BackLink } from '@/components/ui/BackLink';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Button } from '@/components/ui/Button';
import { Badge, Card, EmptyState, LoadFailed, PageHeader, Spinner } from '@/components/ui/misc';
import { seatLabel, SIDE_LABELS } from '@/domain/boat';
import { ageOn, formatDate, formatRaceTime, todayIso } from '@/domain/dates';
import type { MemberHistoryRow } from '@/domain/memberHistory';
import { disciplineLabel, progressSeries } from '@/domain/timeTrials';
import type { CrewRole } from '@/domain/types';
import { eventTypeLabel } from '@/domain/eventTypes';
import { useMemberHistory } from '@/queries/derived';
import {
  useAllTimeTrialResults,
  useDeleteMember,
  useMember,
  useSettings,
  useTimeTrialSessions,
  useUndoableDelete,
} from '@/queries/hooks';
import { cn } from '@/utils/cn';
import { ZONE_LABELS } from '@/domain/boat';
import { categoryName, fullName, formatWeight, GENDER_LABEL, pluralise, SIDE_PREFERENCE_LABEL } from '@/utils/format';

const ROLE_LABEL: Record<CrewRole, string> = {
  paddler: 'Paddler',
  drummer: 'Drummer',
  cox: 'Coxswain',
  reserve: 'Reserve',
};

export function MemberDetailPage() {
  const { memberId } = useParams();
  const navigate = useNavigate();
  const member = useMember(memberId);
  const history = useMemberHistory(memberId);
  const deleteMember = useDeleteMember();
  const undoableDelete = useUndoableDelete();
  const [editing, setEditing] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  if (member.isLoading) return <Spinner />;
  if (member.isError) {
    return <LoadFailed onRetry={() => { void member.refetch(); }} />;
  }
  if (!member.data) return <EmptyState title="That member no longer exists." />;

  const m = member.data;
  const age = m.dateOfBirth ? ageOn(m.dateOfBirth, todayIso()) : undefined;
  const { summary } = history;

  return (
    <>
      <BackLink to="/members">All members</BackLink>

      <PageHeader
        title={fullName(m)}
        description={[
          GENDER_LABEL[m.gender],
          age != null ? `${age} years old` : null,
          m.status !== 'active' ? m.status : null,
        ]
          .filter(Boolean)
          .join(' · ')}
        actions={
          <>
            <Button onClick={() => setEditing(true)}>
              <Pencil /> Edit
            </Button>
            <Button variant="danger" onClick={() => setConfirmingDelete(true)}>
              <Trash2 /> Delete
            </Button>
          </>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <Card className="p-5">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted">
            Paddling
          </h2>
          <dl className="flex flex-col gap-2 text-sm">
            <Row label="Weight" value={formatWeight(m.weightKg)} />
            <Row label="Side" value={SIDE_PREFERENCE_LABEL[m.sidePreference]} />
            {m.preferredZones && m.preferredZones.length > 0 && (
              <Row
                label="Zones"
                value={m.preferredZones.map((z) => ZONE_LABELS[z]).join(', ')}
              />
            )}
            <Row
              label="Other roles"
              value={
                [m.canDrum ? 'Drummer' : null, m.canSteer ? 'Coxswain' : null]
                  .filter(Boolean)
                  .join(', ') || 'Paddler only'
              }
            />
            {m.joinedAt && <Row label="Joined" value={formatDate(m.joinedAt)} />}
            {(summary.racesCrewed > 0 || summary.practicesCrewed > 0) && (
              <Row
                label="Season"
                value={[
                  summary.racesCrewed > 0 ? pluralise(summary.racesCrewed, 'race') : null,
                  summary.practicesCrewed > 0
                    ? pluralise(summary.practicesCrewed, 'practice')
                    : null,
                ]
                  .filter(Boolean)
                  .join(' · ')}
              />
            )}
            {summary.asked > 0 && (
              <Row label="Said In" value={`${summary.saidIn} of ${summary.asked} asked`} />
            )}
            {summary.usualSpot && (
              <Row
                label="Usual spot"
                value={`${ZONE_LABELS[summary.usualSpot.zone]}, ${SIDE_LABELS[summary.usualSpot.side].toLowerCase()}`}
              />
            )}
          </dl>
        </Card>

        <Card className="p-5">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted">
            Contact
          </h2>
          <dl className="flex flex-col gap-2 text-sm">
            <Row label="Email" value={m.email ?? '—'} />
            <Row label="Phone" value={m.phone ?? '—'} />
            <Row label="Emergency" value={m.emergencyContactName ?? '—'} />
            <Row label="Emergency phone" value={m.emergencyContactPhone ?? '—'} />
          </dl>
          {m.notes && <p className="mt-3 border-t border-subtle pt-3 text-sm">{m.notes}</p>}
        </Card>
      </div>

      <TrialProgress memberId={m.id} />

      {history.isError ? (
        <section className="mt-8">
          <LoadFailed onRetry={history.refetch} />
        </section>
      ) : history.isLoading ? (
        <section className="mt-8">
          <Spinner />
        </section>
      ) : (
        <>
          {history.upcoming.length > 0 && (
            <section className="mt-8">
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted">
                Coming up
              </h2>
              <div className="flex flex-col gap-2">
                {history.upcoming.map((row) => (
                  <HistoryRow key={row.event.id} row={row} />
                ))}
              </div>
            </section>
          )}

          <section className="mt-8">
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted">
              History
            </h2>
            {history.past.length === 0 ? (
              <EmptyState
                title="No history yet"
                description="Past events they were seated at or answered for will collect here."
              />
            ) : (
              <div className="flex flex-col gap-2">
                {history.past.map((row) => (
                  <HistoryRow key={row.event.id} row={row} />
                ))}
              </div>
            )}
          </section>
        </>
      )}

      {editing && (
        <MemberForm member={m} open onOpenChange={(open) => !open && setEditing(false)} />
      )}

      <ConfirmDialog
        open={confirmingDelete}
        onOpenChange={setConfirmingDelete}
        title={`Delete ${fullName(m)}?`}
        description="They will also be removed from every crew they are in. This cannot be undone."
        confirmLabel="Delete member"
        pending={deleteMember.isPending}
        onConfirm={async () => {
          const name = fullName(m);
          const bundle = await deleteMember.mutateAsync(m.id);
          undoableDelete(`Deleted ${name}.`, bundle);
          navigate('/members');
        }}
      >
        <p className="text-sm text-muted">
          Consider setting their status to <strong>Inactive</strong> or <strong>Alumni</strong>{' '}
          instead — that keeps their race history intact.
        </p>
      </ConfirmDialog>
    </>
  );
}

/**
 * The member's time trials: their best per kind, and every timed run behind it
 * as a bar — long is slow, short is fast, so a shrinking stack reads as
 * progress at a glance. Renders nothing for the untried.
 */
function TrialProgress({ memberId }: { memberId: string }) {
  const sessions = useTimeTrialSessions();
  const results = useAllTimeTrialResults();
  const settings = useSettings();

  const series = progressSeries(memberId, sessions.data ?? [], results.data ?? []);
  if (series.length === 0) return null;

  return (
    <section className="mt-8">
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted">Time trials</h2>
      <div className="grid gap-4 sm:grid-cols-2">
        {series.map((kind) => {
          const best = Math.min(...kind.points.map((p) => p.timeMs));
          const slowest = Math.max(...kind.points.map((p) => p.timeMs));
          return (
            <Card key={`${kind.distanceM}:${kind.discipline ?? ''}`} className="p-5">
              <div className="flex items-baseline justify-between gap-3">
                <h3 className="text-sm font-semibold">
                  {kind.distanceM}m
                  {kind.discipline
                    ? ` · ${disciplineLabel(kind.discipline, settings.disciplines)}`
                    : ''}
                </h3>
                <p className="text-sm">
                  <span className="text-muted">Best </span>
                  <span className="tabular font-medium">{formatRaceTime(best)}</span>
                </p>
              </div>
              <ul className="mt-3 flex flex-col gap-1.5">
                {kind.points.map((point) => (
                  <li key={point.sessionId} className="flex items-center gap-2 text-sm">
                    <Link
                      to={`/time-trials/${point.sessionId}`}
                      className="w-24 shrink-0 truncate text-muted hover:underline"
                    >
                      {formatDate(point.date)}
                    </Link>
                    <span className="h-2 flex-1 overflow-hidden rounded-full surface-sunken">
                      <span
                        className={cn(
                          'block h-full rounded-full',
                          point.timeMs === best ? 'bg-brand-600' : 'bg-brand-600/40',
                        )}
                        style={{ width: `${(point.timeMs / slowest) * 100}%` }}
                      />
                    </span>
                    <span className="tabular w-20 shrink-0 text-right">
                      {formatRaceTime(point.timeMs)}
                    </span>
                  </li>
                ))}
              </ul>
            </Card>
          );
        })}
      </div>
    </section>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-muted">{label}</dt>
      <dd className="text-right">{value}</dd>
    </div>
  );
}

const STATUS_TONE = { in: 'good', maybe: 'warn', out: 'bad' } as const;
const STATUS_LABEL = { in: 'In', maybe: 'Maybe', out: 'Out' } as const;

function HistoryRow({ row }: { row: MemberHistoryRow }) {
  const { event, status, participations } = row;
  const settings = useSettings();
  return (
    <div className="surface flex flex-wrap items-center justify-between gap-x-3 gap-y-2 rounded-xl border px-4 py-3">
      <div className="min-w-0">
        <p className="truncate font-medium">{event.name}</p>
        <p className="truncate text-sm text-muted">
          {formatDate(event.startDate)}
          {event.type !== 'race'
            ? ` · ${eventTypeLabel(event.type, settings.eventTypes).toLowerCase()}`
            : ''}
        </p>
      </div>
      <div className="flex flex-wrap items-center justify-end gap-1.5">
        {status && <Badge tone={STATUS_TONE[status]}>{STATUS_LABEL[status]}</Badge>}
        {participations.map((p) => (
          <Link
            key={p.crew.id + p.role}
            to={`/events/${event.id}/crews/${p.crew.id}`}
            title={categoryName(p.category)}
            className="rounded-md focus:outline-none"
          >
            <Badge tone={p.role === 'reserve' ? 'neutral' : 'brand'}>
              {p.crew.name}: {p.seat ? seatLabel(p.seat) : ROLE_LABEL[p.role]}
            </Badge>
          </Link>
        ))}
      </div>
    </div>
  );
}
