import { Link } from 'react-router-dom';
import { Badge, Card, EmptyState, LoadFailed, Spinner } from '@/components/ui/misc';
import { seatLabel, SIDE_LABELS, ZONE_LABELS } from '@/domain/boat';
import { formatDate, formatRaceTime } from '@/domain/dates';
import { eventTypeLabel } from '@/domain/eventTypes';
import type { MemberHistoryRow } from '@/domain/memberHistory';
import { formatDelta } from '@/domain/results';
import { disciplineLabel, progressSeries } from '@/domain/timeTrials';
import type { CrewRole, Member } from '@/domain/types';
import { useMemberHistory, useMemberResults } from '@/queries/derived';
import {
  useAllTimeTrialResults,
  useSettings,
  useTimeTrialSessions,
} from '@/queries/hooks';
import { cn } from '@/utils/cn';
import {
  categoryName,
  formatWeight,
  ordinal,
  pluralise,
  SIDE_PREFERENCE_LABEL,
} from '@/utils/format';

const ROLE_LABEL: Record<CrewRole, string> = {
  paddler: 'Paddler',
  drummer: 'Drummer',
  cox: 'Coxswain',
  reserve: 'Reserve',
};

/**
 * One member's whole story: paddling facts, contact, time-trial progress,
 * race results, and event history. Shared by the staff member page and the
 * paddler's own /me — same body, different chrome. `isSelf` softens the
 * copy; the pages own their actions (edit, delete, sign-ups).
 */
export function MemberProfile({ member, isSelf = false }: { member: Member; isSelf?: boolean }) {
  const history = useMemberHistory(member.id);
  const { summary } = history;

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2">
        <Card className="p-5">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted">
            Paddling
          </h2>
          <dl className="flex flex-col gap-2 text-sm">
            <Row label="Weight" value={formatWeight(member.weightKg)} />
            <Row label="Side" value={SIDE_PREFERENCE_LABEL[member.sidePreference]} />
            {member.preferredZones && member.preferredZones.length > 0 && (
              <Row
                label="Zones"
                value={member.preferredZones.map((z) => ZONE_LABELS[z]).join(', ')}
              />
            )}
            <Row
              label="Other roles"
              value={
                [member.canDrum ? 'Drummer' : null, member.canSteer ? 'Coxswain' : null]
                  .filter(Boolean)
                  .join(', ') || 'Paddler only'
              }
            />
            {member.joinedAt && <Row label="Joined" value={formatDate(member.joinedAt)} />}
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
            <Row label="Email" value={member.email ?? '—'} />
            <Row label="Phone" value={member.phone ?? '—'} />
            <Row label="Emergency" value={member.emergencyContactName ?? '—'} />
            <Row label="Emergency phone" value={member.emergencyContactPhone ?? '—'} />
          </dl>
          {member.notes && (
            <p className="mt-3 border-t border-subtle pt-3 text-sm">{member.notes}</p>
          )}
        </Card>
      </div>

      <TrialProgress memberId={member.id} />
      <ResultsSection memberId={member.id} isSelf={isSelf} />

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
                description={
                  isSelf
                    ? 'Past events you were seated at or answered for will collect here.'
                    : 'Past events they were seated at or answered for will collect here.'
                }
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
    </>
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

/**
 * The member's races, each ranked in its real field. "2nd of 6 · +1.42"
 * reads as the result actually felt from the boat.
 */
function ResultsSection({ memberId, isSelf }: { memberId: string; isSelf: boolean }) {
  const results = useMemberResults(memberId);
  if (results.rows.length === 0) return null;

  return (
    <section className="mt-8">
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted">
        Race results
      </h2>
      <Card className="overflow-hidden">
        <ul className="divide-y divide-[var(--border-subtle)]">
          {results.rows.map((row) => (
            <li
              key={`${row.crew.id}:${row.stage}:${row.heat ?? 1}`}
              className="flex flex-wrap items-center gap-3 px-4 py-2.5 text-sm"
            >
              <span
                className={cn(
                  'tabular grid size-8 shrink-0 place-items-center rounded-full text-sm font-semibold',
                  row.placement === 1
                    ? 'bg-amber-400 text-amber-950'
                    : row.placement
                      ? 'surface-sunken'
                      : 'border border-dashed border-subtle text-muted',
                )}
                aria-label={row.placement ? `Placed ${row.placement}` : 'No time recorded'}
              >
                {row.placement ?? '–'}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">
                  {row.event.name} · {row.raceLabel}
                </p>
                <p className="truncate text-xs text-muted">
                  {formatDate(row.event.startDate)} · {categoryName(row.category)} ·{' '}
                  {isSelf ? 'in' : 'with'} {row.crew.name}
                </p>
              </div>
              <span className="shrink-0 text-xs text-muted">
                {row.placement ? `${ordinal(row.placement)} of ${row.fieldSize}` : 'no time'}
              </span>
              <span className="tabular w-16 shrink-0 text-right text-xs text-amber-700 dark:text-amber-300">
                {formatDelta(row.deltaMs)}
              </span>
              <span className="tabular w-20 shrink-0 text-right">
                {row.timeMs != null ? formatRaceTime(row.timeMs) : '—'}
              </span>
            </li>
          ))}
        </ul>
      </Card>
    </section>
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
