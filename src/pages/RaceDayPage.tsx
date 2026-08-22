import { ArrowLeft, Plus, Timer, Trash2, Trophy } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Field';
import { Badge, Card, EmptyState, PageHeader, Spinner } from '@/components/ui/misc';
import { formatDate, formatRaceTime, parseRaceTime } from '@/domain/dates';
import {
  compareGroups,
  formatDelta,
  groupKey,
  groupLabel,
  STAGE_LABELS,
  rankEntries,
  type RankedEntry,
} from '@/domain/results';
import type { Category, Crew, RaceStage } from '@/domain/types';
import {
  useAllRaceEntries,
  useCategories,
  useCreateRaceEntry,
  useCrew,
  useCrews,
  useDeleteRaceEntry,
  useEvent,
  useUpdateRaceEntry,
} from '@/queries/hooks';
import { cn } from '@/utils/cn';
import { categoryName } from '@/utils/format';

/**
 * Race day.
 *
 * Built around typing times fast while standing at a finish line: one row per
 * crew, one text field each, and placements that recompute as you go. Nothing
 * has to be entered in order and nothing has to be complete.
 */
export function RaceDayPage() {
  const { eventId } = useParams();
  const event = useEvent(eventId);
  const categories = useCategories(eventId);

  if (event.isLoading || categories.isLoading) return <Spinner />;
  if (!event.data) return <EmptyState title="That event no longer exists." />;

  const list = categories.data ?? [];

  return (
    <>
      <Button asChild variant="ghost" size="sm" className="mb-3 -ml-2">
        <Link to={`/events/${event.data.id}`}>
          <ArrowLeft /> {event.data.name}
        </Link>
      </Button>

      <PageHeader
        title="Race day"
        description={`${event.data.name} · ${formatDate(event.data.startDate)}`}
      />

      {list.length === 0 ? (
        <EmptyState
          icon={<Trophy />}
          title="No categories yet"
          description="Add the crew classes you are entering before recording results."
          action={
            <Button asChild variant="primary">
              <Link to={`/events/${event.data.id}`}>Back to event</Link>
            </Button>
          }
        />
      ) : (
        <div className="flex flex-col gap-8">
          {list.map((category) => (
            <CategoryResults key={category.id} category={category} />
          ))}
        </div>
      )}
    </>
  );
}

function CategoryResults({ category }: { category: Category }) {
  const crews = useCrews(category.id);
  const allEntries = useAllRaceEntries();
  const createEntry = useCreateRaceEntry();

  const crewList = crews.data ?? [];
  const crewIds = useMemo(() => new Set(crewList.map((c) => c.id)), [crewList]);

  const entries = useMemo(
    () => (allEntries.data ?? []).filter((e) => crewIds.has(e.crewId)),
    [allEntries.data, crewIds],
  );

  const ranked = useMemo(() => rankEntries(entries), [entries]);

  /** Entries bucketed by stage and heat, in the order a programme runs. */
  const groups = useMemo(() => {
    const map = new Map<string, RankedEntry[]>();
    for (const item of ranked) {
      const key = groupKey(item.entry);
      map.set(key, [...(map.get(key) ?? []), item]);
    }
    return [...map.values()].sort((a, b) => compareGroups(a[0].entry, b[0].entry));
  }, [ranked]);

  const heatCount = new Set(entries.filter((e) => e.stage === 'heat').map((e) => e.heat ?? 1)).size;

  /** Enters every crew in the category into a new race at once. */
  const addRace = (stage: RaceStage) => {
    const existingHeats = entries.filter((e) => e.stage === stage).map((e) => e.heat ?? 1);
    const heat = existingHeats.length === 0 ? 1 : Math.max(...existingHeats) + 1;
    crewList.forEach((crew, index) => {
      createEntry.mutate({ crewId: crew.id, stage, heat, lane: index + 1 });
    });
  };

  return (
    <section>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-semibold">{categoryName(category)}</h2>
        {crewList.length > 0 && (
          <div className="flex gap-2">
            {(['heat', 'semi', 'final'] as RaceStage[]).map((stage) => (
              <Button
                key={stage}
                size="sm"
                onClick={() => addRace(stage)}
                disabled={createEntry.isPending}
              >
                <Plus /> {STAGE_LABELS[stage]}
              </Button>
            ))}
          </div>
        )}
      </div>

      {crewList.length === 0 ? (
        <p className="rounded-xl border border-dashed border-subtle px-4 py-6 text-center text-sm text-muted">
          No crews in this category yet.
        </p>
      ) : groups.length === 0 ? (
        <p className="rounded-xl border border-dashed border-subtle px-4 py-6 text-center text-sm text-muted">
          No races recorded. Add a heat to enter all {crewList.length} crews at once.
        </p>
      ) : (
        <div className="flex flex-col gap-4">
          {groups.map((group) => (
            <RaceGroup
              key={groupKey(group[0].entry)}
              group={group}
              crews={crewList}
              heatCount={heatCount}
            />
          ))}
        </div>
      )}
    </section>
  );
}

function RaceGroup({
  group,
  crews,
  heatCount,
}: {
  group: RankedEntry[];
  crews: Crew[];
  heatCount: number;
}) {
  const crewName = (id: string) => crews.find((c) => c.id === id)?.name ?? 'Unknown crew';
  const { stage, heat } = group[0].entry;

  // Lane order, not placement order. Sorting by placement would make a row jump
  // the moment its time is typed — unusable when entering times at a finish
  // line — and lane order is how the boats are read off the water anyway. The
  // placement badge on each row carries the result.
  const sorted = [...group].sort((a, b) => (a.entry.lane ?? 0) - (b.entry.lane ?? 0));

  return (
    <Card className="overflow-hidden">
      <div className="flex items-center justify-between border-b border-subtle px-4 py-2.5">
        <h3 className="text-sm font-semibold">{groupLabel(stage, heat, heatCount)}</h3>
        <Badge>{group.length === 1 ? '1 crew' : `${group.length} crews`}</Badge>
      </div>
      <ul className="divide-y divide-[var(--border-subtle)]">
        {sorted.map((item) => (
          <ResultRow key={item.entry.id} item={item} crewName={crewName(item.entry.crewId)} />
        ))}
      </ul>
    </Card>
  );
}

function ResultRow({ item, crewName }: { item: RankedEntry; crewName: string }) {
  const updateEntry = useUpdateRaceEntry();
  const deleteEntry = useDeleteRaceEntry();
  const { entry, placement, deltaMs } = item;

  const [draft, setDraft] = useState(entry.timeMs != null ? formatRaceTime(entry.timeMs) : '');
  const [invalid, setInvalid] = useState(false);

  const commit = () => {
    const trimmed = draft.trim();
    if (!trimmed) {
      setInvalid(false);
      if (entry.timeMs != null) updateEntry.mutate({ id: entry.id, patch: { timeMs: undefined } });
      return;
    }
    const ms = parseRaceTime(trimmed);
    if (ms === undefined) {
      setInvalid(true);
      return;
    }
    setInvalid(false);
    setDraft(formatRaceTime(ms));
    if (ms !== entry.timeMs) updateEntry.mutate({ id: entry.id, patch: { timeMs: ms } });
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
        <p className="truncate text-sm font-medium">{crewName}</p>
        {entry.lane != null && <p className="text-xs text-muted">Lane {entry.lane}</p>}
      </div>

      <span className="tabular w-16 shrink-0 text-right text-xs text-amber-700 dark:text-amber-300">
        {formatDelta(deltaMs)}
      </span>

      <Input
        className={cn('tabular h-9 w-28 shrink-0 text-right text-sm', invalid && 'border-red-600')}
        placeholder="2:05.42"
        inputMode="decimal"
        aria-label={`Finish time for ${crewName}`}
        aria-invalid={invalid}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
      />

      <Button
        size="icon"
        variant="ghost"
        aria-label={`Remove ${crewName} from this race`}
        onClick={() => deleteEntry.mutate(entry.id)}
      >
        <Trash2 />
      </Button>
    </li>
  );
}

/** Compact results for one crew, shown on its lineup page. */
export function CrewResults({ crewId }: { crewId: string }) {
  const entries = useAllRaceEntries();
  const crew = useCrew(crewId);
  const siblings = useCrews(crew.data?.categoryId);

  const all = entries.data ?? [];
  const mine = all.filter((e) => e.crewId === crewId);
  if (mine.length === 0) return null;

  // Rank against the whole race, then pick this crew out of it. Ranking a
  // crew's own entries alone would make it first in everything, and ranking
  // across categories would merge two unrelated "Heat 1"s into one race.
  const categoryCrewIds = new Set((siblings.data ?? []).map((c) => c.id));
  const mineIds = new Set(mine.map((e) => e.id));
  const ranked = rankEntries(all.filter((e) => categoryCrewIds.has(e.crewId)))
    .filter((r) => mineIds.has(r.entry.id))
    .sort((a, b) => compareGroups(a.entry, b.entry));

  return (
    <section className="rounded-xl border border-subtle p-3">
      <h2 className="mb-2 flex items-center gap-1.5 text-sm font-semibold">
        <Timer className="size-4" /> Results
      </h2>
      <ul className="flex flex-col gap-1.5">
        {ranked.map(({ entry, placement }) => (
          <li key={entry.id} className="flex items-center justify-between gap-2 text-xs">
            <span className="text-muted">{STAGE_LABELS[entry.stage]}</span>
            <span className="tabular">
              {entry.timeMs != null ? formatRaceTime(entry.timeMs) : 'no time'}
              {placement ? ` · ${ordinal(placement)}` : ''}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function ordinal(n: number): string {
  const suffix = ['th', 'st', 'nd', 'rd'][(n % 100 > 10 && n % 100 < 14) || n % 10 > 3 ? 0 : n % 10];
  return `${n}${suffix}`;
}
