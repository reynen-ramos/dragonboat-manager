import { ArrowRight, GitCompareArrows } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Dialog, DialogClose, DialogContent, DialogTrigger } from '@/components/ui/Dialog';
import { diffLineups, sortDiffRows, type LineupDiffRow } from '@/domain/lineupDiff';
import type { Crew } from '@/domain/types';
import { useCrewLineup, useMembersById } from '@/queries/derived';
import { fullName, pluralise } from '@/utils/format';

const KIND_LABEL: Record<LineupDiffRow['kind'], string> = {
  moved: 'Moved',
  'role-changed': 'Changed role',
  'only-b': `Only in this plan`,
  'only-a': `Only in the other`,
};

/**
 * The delta between a crew and one of its plans.
 *
 * The answer a coach wants is not two full seating charts side by side but
 * who moved, who changed jobs, and who exists in only one plan — the three
 * facts that decide whether swapping plans mid-morning is survivable.
 */
export function LineupDiffDialog({ crew, against }: { crew: Crew; against: Crew }) {
  const [open, setOpen] = useState(false);
  const mine = useCrewLineup(open ? crew.id : undefined);
  const other = useCrewLineup(open ? against.id : undefined);
  const membersById = useMembersById();

  const diff = open ? diffLineups(other.assignments, mine.assignments) : undefined;
  const rows = diff ? sortDiffRows(diff.rows, membersById) : [];

  const name = (memberId: string) => {
    const member = membersById.get(memberId);
    return member ? fullName(member) : 'Unknown member';
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="justify-start">
          <GitCompareArrows /> Compare with {against.name}
        </Button>
      </DialogTrigger>
      <DialogContent
        title={`${crew.name} vs ${against.name}`}
        description={
          diff
            ? `${pluralise(diff.unchanged, 'placement')} identical, ${pluralise(
                rows.length,
                'difference',
              )}.`
            : undefined
        }
        footer={
          <DialogClose asChild>
            <Button>Close</Button>
          </DialogClose>
        }
      >
        {rows.length === 0 ? (
          <p className="text-sm text-muted">The two plans are identical.</p>
        ) : (
          <ul className="flex flex-col gap-2 text-sm">
            {rows.map((row) => (
              <li key={`${row.kind}-${row.memberId}`} className="flex flex-wrap items-center gap-x-2">
                <span className="font-medium">{name(row.memberId)}</span>
                <span className="text-xs uppercase tracking-wide text-muted">
                  {KIND_LABEL[row.kind]}
                </span>
                <span className="tabular flex items-center gap-1 text-muted">
                  {row.a ?? '—'}
                  <ArrowRight className="size-3" aria-hidden="true" />
                  {row.b ?? '—'}
                </span>
              </li>
            ))}
          </ul>
        )}
      </DialogContent>
    </Dialog>
  );
}
