import { Download, Plus, Trash2, UserPlus } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useCanManage } from '@/auth/session';
import { BackLink } from '@/components/ui/BackLink';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Input } from '@/components/ui/Field';
import { Badge, Card, LoadFailed, PageHeader, Spinner } from '@/components/ui/misc';
import { SearchInput } from '@/components/ui/SearchInput';
import { formatDate, formatRaceTime, parseRaceTime } from '@/domain/dates';
import { formatDelta, type RankedTime } from '@/domain/results';
import { disciplineLabel, rankSession, sessionTitle } from '@/domain/timeTrials';
import type { Member, TimeTrialResult } from '@/domain/types';
import {
  useCreateTimeTrialResults,
  useDeleteTimeTrialResult,
  useDeleteTimeTrialSession,
  useMembers,
  useSettings,
  useTimeTrialResults,
  useTimeTrialSession,
  useUndoableDelete,
  useUpdateTimeTrialResult,
} from '@/queries/hooks';
import { cn } from '@/utils/cn';
import { rowsToCsv } from '@/utils/csv';
import { downloadTextFile } from '@/utils/download';
import { fullName } from '@/utils/format';
import { compareMembers } from '@/utils/memberSort';

/**
 * One session's sheet: put paddlers on it, type times as they finish.
 *
 * Rows hold name order rather than re-sorting by time — a sheet that reshuffles
 * under the stopwatch hand is unusable at the dock — so the placement badge on
 * each row carries the ranking, exactly as race day does it.
 */
export function TimeTrialSessionPage() {
  const { sessionId } = useParams();
  const canManage = useCanManage();
  const session = useTimeTrialSession(sessionId);
  const results = useTimeTrialResults(sessionId);
  const members = useMembers();
  const settings = useSettings();
  const navigate = useNavigate();
  const deleteSession = useDeleteTimeTrialSession();
  const undoableDelete = useUndoableDelete();
  const [adding, setAdding] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  if (session.isLoading || results.isLoading || members.isLoading) return <Spinner />;
  if (session.isError || results.isError || members.isError) {
    return (
      <LoadFailed
        onRetry={() => {
          void session.refetch();
          void results.refetch();
          void members.refetch();
        }}
      />
    );
  }
  if (!session.data) {
    return (
      <>
        <BackLink to="/time-trials">Time trials</BackLink>
        <p className="mt-4 text-sm text-muted">This session no longer exists.</p>
      </>
    );
  }

  const sheet = results.data ?? [];
  const memberById = new Map((members.data ?? []).map((m) => [m.id, m]));
  const ranked = rankSession(sheet);
  const rankedByResultId = new Map(ranked.map((r) => [r.row.id, r]));

  // Name order, so nothing jumps while times are typed.
  const rows = [...sheet].sort((a, b) => {
    const ma = memberById.get(a.memberId);
    const mb = memberById.get(b.memberId);
    if (!ma || !mb) return ma ? -1 : 1;
    return compareMembers('name')(ma, mb);
  });

  const title = sessionTitle(session.data, settings.disciplines);
  const timed = ranked.filter((r) => r.placement !== undefined);

  const exportCsv = () => {
    const csvRows = ranked.map((r) => {
      const member = memberById.get(r.row.memberId);
      return [
        r.placement ?? '',
        member ? fullName(member) : 'Former member',
        r.row.timeMs != null && Number.isFinite(r.row.timeMs) ? formatRaceTime(r.row.timeMs) : '',
        formatDelta(r.deltaMs),
        r.row.note ?? '',
      ];
    });
    downloadTextFile(
      `time-trial-${session.data!.date}-${session.data!.distanceM}m.csv`,
      rowsToCsv(['Place', 'Paddler', 'Time', 'Delta', 'Note'], csvRows),
    );
  };

  return (
    <>
      <BackLink to="/time-trials">Time trials</BackLink>
      <PageHeader
        title={title}
        description={[
          formatDate(session.data.date),
          `${session.data.distanceM}m`,
          session.data.discipline
            ? disciplineLabel(session.data.discipline, settings.disciplines)
            : undefined,
        ]
          .filter(Boolean)
          .join(' · ')}
        actions={
          <div className="flex flex-wrap gap-2">
            {canManage && (
              <Button onClick={() => setAdding((a) => !a)}>
                <UserPlus /> Add paddlers
              </Button>
            )}
            <Button onClick={exportCsv} disabled={sheet.length === 0}>
              <Download /> CSV
            </Button>
            {canManage && (
              <Button variant="danger" onClick={() => setConfirmingDelete(true)}>
                <Trash2 /> Delete
              </Button>
            )}
          </div>
        }
      />

      <div className="flex flex-col gap-4">
        {adding && (
          <AddPaddlersPanel
            sessionId={session.data.id}
            members={members.data ?? []}
            onSheet={new Set(sheet.map((r) => r.memberId))}
          />
        )}

        {sheet.length === 0 ? (
          <p className="rounded-xl border border-dashed border-subtle px-4 py-6 text-center text-sm text-muted">
            Nobody on the sheet yet. Add paddlers, then type times as they finish.
          </p>
        ) : (
          <Card className="overflow-hidden">
            <div className="flex items-center justify-between border-b border-subtle px-4 py-2.5">
              <h2 className="text-sm font-semibold">Results</h2>
              <Badge>
                {timed.length} of {sheet.length} timed
              </Badge>
            </div>
            <ul className="divide-y divide-[var(--border-subtle)]">
              {rows.map((result) => (
                <SheetRow
                  key={result.id}
                  ranked={rankedByResultId.get(result.id)!}
                  member={memberById.get(result.memberId)}
                  readOnly={!canManage}
                />
              ))}
            </ul>
          </Card>
        )}
      </div>

      <ConfirmDialog
        open={confirmingDelete}
        onOpenChange={setConfirmingDelete}
        title="Delete this session?"
        description="Every time recorded in it goes too."
        confirmLabel="Delete session"
        pending={deleteSession.isPending}
        onConfirm={async () => {
          const bundle = await deleteSession.mutateAsync(session.data!.id);
          undoableDelete(`Deleted ${title}.`, bundle);
          void navigate('/time-trials');
        }}
      />
    </>
  );
}

/** Active members not yet on the sheet, searchable, added one at a time or all at once. */
function AddPaddlersPanel({
  sessionId,
  members,
  onSheet,
}: {
  sessionId: string;
  members: Member[];
  onSheet: Set<string>;
}) {
  const createResults = useCreateTimeTrialResults();
  const [search, setSearch] = useState('');

  const candidates = useMemo(() => {
    const query = search.trim().toLowerCase();
    return members
      .filter((m) => m.status === 'active' && !onSheet.has(m.id))
      .filter((m) => !query || fullName(m).toLowerCase().includes(query))
      .sort(compareMembers('name'));
  }, [members, onSheet, search]);

  const add = (memberIds: string[]) =>
    createResults.mutate(memberIds.map((memberId) => ({ sessionId, memberId })));

  return (
    <Card className="p-4">
      <div className="flex flex-wrap items-center gap-2">
        <SearchInput
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Find a paddler"
        />
        <Button
          size="sm"
          disabled={candidates.length === 0 || createResults.isPending}
          onClick={() => add(candidates.map((m) => m.id))}
        >
          <Plus /> Add all {candidates.length}
        </Button>
      </div>
      {candidates.length === 0 ? (
        <p className="mt-3 text-sm text-muted">
          {search.trim() ? 'Nobody matches that.' : 'Every active member is already on the sheet.'}
        </p>
      ) : (
        <ul className="mt-3 flex flex-wrap gap-1.5">
          {candidates.map((member) => (
            <li key={member.id}>
              <Button
                size="sm"
                variant="ghost"
                className="border border-subtle"
                disabled={createResults.isPending}
                onClick={() => add([member.id])}
              >
                <Plus /> {fullName(member)}
              </Button>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function SheetRow({
  ranked,
  member,
  readOnly = false,
}: {
  ranked: RankedTime<TimeTrialResult>;
  member: Member | undefined;
  readOnly?: boolean;
}) {
  const updateResult = useUpdateTimeTrialResult();
  const deleteResult = useDeleteTimeTrialResult();
  const { row, placement, deltaMs } = ranked;
  const name = member ? fullName(member) : 'Former member';

  const [draft, setDraft] = useState(row.timeMs != null ? formatRaceTime(row.timeMs) : '');
  const [invalid, setInvalid] = useState(false);
  const [editing, setEditing] = useState(false);

  // Adopt the stored time when it changes under a field nobody is typing in —
  // the same cross-tab guard race day's rows carry.
  useEffect(() => {
    if (!editing) {
      setDraft(row.timeMs != null ? formatRaceTime(row.timeMs) : '');
      setInvalid(false);
    }
  }, [row.timeMs, editing]);

  const commit = () => {
    const trimmed = draft.trim();
    if (!trimmed) {
      setEditing(false);
      setInvalid(false);
      if (row.timeMs != null) updateResult.mutate({ id: row.id, patch: { timeMs: undefined } });
      return;
    }
    const ms = parseRaceTime(trimmed);
    if (ms === undefined) {
      // Stay in editing state: leaving it would let the adopt-stored effect
      // wipe both the typed text and the invalid mark on the next render.
      setInvalid(true);
      return;
    }
    setEditing(false);
    setInvalid(false);
    setDraft(formatRaceTime(ms));
    if (ms !== row.timeMs) updateResult.mutate({ id: row.id, patch: { timeMs: ms } });
  };

  return (
    <li className="flex flex-wrap items-center gap-3 px-4 py-2.5">
      <span
        className={cn(
          'tabular grid size-8 shrink-0 place-items-center rounded-full text-sm font-semibold',
          placement === 1
            ? 'bg-amber-400 text-amber-950'
            : placement
              ? 'surface-sunken'
              : 'border border-dashed border-subtle text-muted',
        )}
        aria-label={placement ? `Placed ${placement}` : 'No time yet'}
      >
        {placement ?? '–'}
      </span>

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{name}</p>
        {row.note && <p className="truncate text-xs text-muted">{row.note}</p>}
      </div>

      <span className="tabular w-16 shrink-0 text-right text-xs text-amber-700 dark:text-amber-300">
        {formatDelta(deltaMs)}
      </span>

      {readOnly ? (
        <span className="tabular w-28 shrink-0 text-right text-sm">
          {row.timeMs != null ? formatRaceTime(row.timeMs) : '—'}
        </span>
      ) : (
        <>
          <Input
            className={cn('tabular h-9 w-28 shrink-0 text-right text-sm', invalid && 'border-red-600')}
            placeholder="1:05.42"
            inputMode="decimal"
            aria-label={`Time for ${name}`}
            aria-invalid={invalid}
            value={draft}
            onFocus={() => setEditing(true)}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
          />

          <Button
            size="icon"
            variant="ghost"
            aria-label={`Remove ${name} from this session`}
            onClick={() => deleteResult.mutate(row.id)}
          >
            <Trash2 />
          </Button>
        </>
      )}
    </li>
  );
}
