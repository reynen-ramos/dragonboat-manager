import { Plus, Timer } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/Button';
import { Dialog, DialogClose, DialogContent } from '@/components/ui/Dialog';
import { Field, Input, Select } from '@/components/ui/Field';
import { Badge, Card, EmptyState, LoadFailed, PageHeader, Spinner } from '@/components/ui/misc';
import { formatDate, formatRaceTime, todayIso } from '@/domain/dates';
import { rankTimes } from '@/domain/results';
import { COMMON_DISTANCES_M } from '@/domain/rules.config';
import {
  disciplineLabel,
  personalBests,
  sessionTitle,
  trialKey,
  type PersonalBest,
} from '@/domain/timeTrials';
import type { Member, TimeTrialResult, TimeTrialSession } from '@/domain/types';
import { useCanManage } from '@/auth/session';
import {
  useAllTimeTrialResults,
  useCreateTimeTrialSession,
  useMembers,
  useSettings,
  useTimeTrialSessions,
} from '@/queries/hooks';
import { fullName } from '@/utils/format';

/**
 * Individual time trials: the sessions the club has run, and the best-times
 * board they add up to. Trials time paddlers, not boats — this is the page a
 * coach opens when picking a crew and the page a paddler checks after one.
 */
export function TimeTrialsPage() {
  const canManage = useCanManage();
  const sessions = useTimeTrialSessions();
  const results = useAllTimeTrialResults();
  const members = useMembers();
  const settings = useSettings();
  const [creating, setCreating] = useState(false);

  if (sessions.isLoading || results.isLoading || members.isLoading) return <Spinner />;
  if (sessions.isError || results.isError || members.isError) {
    return (
      <LoadFailed
        onRetry={() => {
          void sessions.refetch();
          void results.refetch();
          void members.refetch();
        }}
      />
    );
  }

  const list = [...(sessions.data ?? [])].sort((a, b) => b.date.localeCompare(a.date));
  const resultList = results.data ?? [];
  const countBySession = new Map<string, number>();
  for (const r of resultList) {
    countBySession.set(r.sessionId, (countBySession.get(r.sessionId) ?? 0) + 1);
  }

  return (
    <>
      <PageHeader
        title="Time trials"
        description="Solo runs over a set distance — who is fast, and who is getting faster."
        actions={
          canManage ? (
            <Button variant="primary" onClick={() => setCreating(true)}>
              <Plus /> New session
            </Button>
          ) : undefined
        }
      />

      {list.length === 0 ? (
        <EmptyState
          icon={<Timer />}
          title="No time trials yet"
          description="Run a session — 200m in the OC1, a 500m erg test — and record everyone's time here."
          action={
            canManage ? (
              <Button variant="primary" onClick={() => setCreating(true)}>
                <Plus /> New session
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className="flex flex-col gap-8">
          <section>
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted">
              Sessions
            </h2>
            <div className="flex flex-col gap-2">
              {list.map((session) => (
                <Card key={session.id} className="transition-colors hover:surface-sunken">
                  <Link to={`/time-trials/${session.id}`} className="block px-4 py-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium">{sessionTitle(session, settings.disciplines)}</p>
                      <Badge tone="neutral">{session.distanceM}m</Badge>
                      {session.discipline && (
                        <Badge tone="brand">
                          {disciplineLabel(session.discipline, settings.disciplines)}
                        </Badge>
                      )}
                    </div>
                    <p className="mt-0.5 text-sm text-muted">
                      {formatDate(session.date)} ·{' '}
                      {countBySession.get(session.id) ?? 0} paddler
                      {(countBySession.get(session.id) ?? 0) === 1 ? '' : 's'}
                    </p>
                  </Link>
                </Card>
              ))}
            </div>
          </section>

          <BestTimes
            sessions={sessions.data ?? []}
            members={members.data ?? []}
            results={resultList}
          />
        </div>
      )}

      {creating && <NewSessionDialog onOpenChange={(open) => !open && setCreating(false)} />}
    </>
  );
}

/**
 * The best-times board: each member's PB, one board per kind of trial. Times
 * from different distances or craft never share a board — a 200m OC1 time
 * says nothing about a 500m erg score.
 */
function BestTimes({
  sessions,
  members,
  results,
}: {
  sessions: TimeTrialSession[];
  members: Member[];
  results: TimeTrialResult[];
}) {
  const settings = useSettings();
  const boards = useMemo(() => {
    const bests = personalBests(sessions, results);
    const byKind = new Map<string, PersonalBest[]>();
    for (const best of bests) {
      const key = trialKey(best);
      byKind.set(key, [...(byKind.get(key) ?? []), best]);
    }
    return [...byKind.values()]
      .map((board) => board.sort((a, b) => a.timeMs - b.timeMs))
      .sort(
        (a, b) =>
          a[0].distanceM - b[0].distanceM ||
          (a[0].discipline ?? '').localeCompare(b[0].discipline ?? ''),
      );
  }, [sessions, results]);

  const memberById = new Map(members.map((m) => [m.id, m]));
  if (boards.length === 0) return null;

  return (
    <section>
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted">Best times</h2>
      <div className="grid gap-4 lg:grid-cols-2">
        {boards.map((board) => {
          const { distanceM, discipline } = board[0];
          const slowest = board[board.length - 1].timeMs;
          return (
            <Card key={trialKey(board[0])} className="overflow-hidden">
              <div className="flex items-center justify-between border-b border-subtle px-4 py-2.5">
                <h3 className="text-sm font-semibold">
                  {distanceM}m
                  {discipline ? ` · ${disciplineLabel(discipline, settings.disciplines)}` : ''}
                </h3>
                <Badge>{board.length === 1 ? '1 paddler' : `${board.length} paddlers`}</Badge>
              </div>
              <ol className="divide-y divide-[var(--border-subtle)]">
                {/* rankTimes, not index+1: two equal PBs share a placement
                    here exactly as they do on the session sheet. */}
                {rankTimes(board).map(({ row: best, placement }) => {
                  const member = memberById.get(best.memberId);
                  return (
                    <li key={best.memberId} className="flex items-center gap-3 px-4 py-2">
                      <span className="tabular w-6 shrink-0 text-right text-sm text-muted">
                        {placement}
                      </span>
                      <span className="min-w-0 flex-1 truncate text-sm font-medium">
                        {member ? fullName(member) : 'Former member'}
                      </span>
                      <span className="h-2 w-24 shrink-0 overflow-hidden rounded-full surface-sunken max-sm:hidden">
                        <span
                          className="block h-full rounded-full bg-brand-600"
                          style={{ width: `${(best.timeMs / slowest) * 100}%` }}
                        />
                      </span>
                      <span className="tabular w-20 shrink-0 text-right text-sm">
                        {formatRaceTime(best.timeMs)}
                      </span>
                    </li>
                  );
                })}
              </ol>
            </Card>
          );
        })}
      </div>
    </section>
  );
}

function NewSessionDialog({ onOpenChange }: { onOpenChange: (open: boolean) => void }) {
  const settings = useSettings();
  const create = useCreateTimeTrialSession();
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [date, setDate] = useState(todayIso());
  const [distance, setDistance] = useState('200');
  const [discipline, setDiscipline] = useState(settings.disciplines[0]?.id ?? '');
  const [error, setError] = useState<string>();

  const submit = async () => {
    const distanceM = Number(distance);
    if (!Number.isFinite(distanceM) || distanceM <= 0) {
      setError('Give the trial a distance in metres.');
      return;
    }
    setError(undefined);
    const session = await create.mutateAsync({
      date,
      distanceM,
      ...(name.trim() ? { name: name.trim() } : {}),
      ...(discipline ? { discipline } : {}),
    });
    onOpenChange(false);
    void navigate(`/time-trials/${session.id}`);
  };

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent
        title="New time-trial session"
        footer={
          <>
            <DialogClose asChild>
              <Button>Cancel</Button>
            </DialogClose>
            <Button variant="primary" onClick={submit} disabled={create.isPending}>
              {create.isPending ? 'Saving…' : 'Create session'}
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <Field label="Name" hint="Optional">
            {(id) => (
              <Input
                id={id}
                autoFocus
                placeholder="Selection Trial"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            )}
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Date">
              {(id) => (
                <Input id={id} type="date" value={date} onChange={(e) => setDate(e.target.value)} />
              )}
            </Field>
            <Field label="Distance (m)">
              {(id) => (
                <Input
                  id={id}
                  type="number"
                  min={1}
                  inputMode="numeric"
                  list="trial-distances"
                  value={distance}
                  onChange={(e) => setDistance(e.target.value)}
                />
              )}
            </Field>
          </div>
          <datalist id="trial-distances">
            {COMMON_DISTANCES_M.map((d) => (
              <option key={d} value={d} />
            ))}
          </datalist>
          <Field label="Discipline">
            {(id) => (
              <Select id={id} value={discipline} onChange={(e) => setDiscipline(e.target.value)}>
                <option value="">Unspecified</option>
                {settings.disciplines.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.label}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>
      </DialogContent>
    </Dialog>
  );
}
