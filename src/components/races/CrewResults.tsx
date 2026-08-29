import { Timer } from 'lucide-react';
import { formatRaceTime } from '@/domain/dates';
import { compareGroups, rankEntries, STAGE_LABELS } from '@/domain/results';
import { useAllRaceEntries, useCrew, useCrews } from '@/queries/hooks';

/**
 * One crew's results, ranked against the races it was actually in.
 *
 * Lived inside RaceDayPage originally, which made LineupPage import from
 * another page — a layering wart, and once routes became lazy it would have
 * chained the two page chunks together.
 */
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
