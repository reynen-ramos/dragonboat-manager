import { UserPlus } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Dialog, DialogClose, DialogContent, DialogTrigger } from '@/components/ui/Dialog';
import { planCrewFill, type FillInput, type FillTier } from '@/domain/fill';
import type { SeatingChange } from '@/domain/seating';
import type { Member } from '@/domain/types';
import { fullName, pluralise } from '@/utils/format';

const TIER_LABEL: Record<FillTier, string> = {
  reserve: 'From the reserves',
  in: 'Marked In',
  maybe: 'Marked Maybe',
  unanswered: 'Not asked yet',
};

/** The order tiers are shown — the same order they are picked. */
const TIERS: FillTier[] = ['reserve', 'in', 'maybe', 'unanswered'];

/**
 * "Fill the boat" — propose, preview, then apply as one undoable step.
 *
 * The eligibility rule lives in the description so it is a visible policy,
 * not folklore: reserves first, then In, then Maybe, never Out. The preview
 * names everyone by tier, because the coach saying "no, not them" is part of
 * the workflow, not a failure of it — Cancel costs nothing.
 */
export function FillBoatDialog({
  input,
  membersById,
  onApply,
  pending,
}: {
  input: FillInput;
  membersById: Map<string, Member>;
  onApply: (changes: SeatingChange[]) => void;
  pending: boolean;
}) {
  const [open, setOpen] = useState(false);

  const proposal = useMemo(() => (open ? planCrewFill(input) : undefined), [open, input]);

  const name = (memberId: string) => {
    const member = membersById.get(memberId);
    return member ? fullName(member) : 'Unknown member';
  };

  const nothingToDo = input.assignments.filter((a) => a.role === 'paddler' && a.seat).length >=
    input.category.boatSize;

  if (nothingToDo) return null;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <UserPlus /> Fill boat
        </Button>
      </DialogTrigger>
      <DialogContent
        title="Fill the boat"
        description="Seats the crew's reserves first, then paddlers marked In, then Maybe — never anyone marked Out or seated in another crew of this category."
        footer={
          <>
            <DialogClose asChild>
              <Button>Cancel</Button>
            </DialogClose>
            <Button
              variant="primary"
              disabled={!proposal || proposal.changes.length === 0 || pending}
              onClick={() => {
                if (!proposal) return;
                onApply(proposal.changes);
                setOpen(false);
              }}
            >
              Seat {pluralise(proposal?.report.seated.length ?? 0, 'paddler')}
            </Button>
          </>
        }
      >
        {proposal && (
          <div className="flex flex-col gap-3 text-sm">
            {proposal.report.seated.length === 0 ? (
              <p className="text-muted">
                Nobody eligible is left — everyone available is already seated here or racing in
                another crew of this category.
              </p>
            ) : (
              TIERS.map((tier) => {
                const picks = proposal.report.seated.filter((p) => p.tier === tier);
                if (picks.length === 0) return null;
                return (
                  <div key={tier}>
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted">
                      {TIER_LABEL[tier]} · {picks.length}
                    </p>
                    <p className="mt-0.5">{picks.map((p) => name(p.memberId)).join(', ')}</p>
                  </div>
                );
              })
            )}

            {(proposal.report.drummerAddedId || proposal.report.coxAddedId) && (
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-muted">
                  Crew positions
                </p>
                <p className="mt-0.5">
                  {proposal.report.drummerAddedId &&
                    `${name(proposal.report.drummerAddedId)} on the drum`}
                  {proposal.report.drummerAddedId && proposal.report.coxAddedId && ' · '}
                  {proposal.report.coxAddedId && `${name(proposal.report.coxAddedId)} steering`}
                </p>
              </div>
            )}

            {(proposal.report.stillEmpty > 0 ||
              proposal.report.womenShortfall > 0 ||
              proposal.report.drummerStillMissing ||
              proposal.report.coxStillMissing) && (
              <ul className="rounded-lg bg-amber-50 px-3 py-2 text-amber-900 dark:bg-amber-950 dark:text-amber-200">
                {proposal.report.stillEmpty > 0 && (
                  <li>
                    {pluralise(proposal.report.stillEmpty, 'seat')} will stay empty — the eligible
                    pool ran out.
                  </li>
                )}
                {proposal.report.womenShortfall > 0 && (
                  <li>
                    Still {pluralise(proposal.report.womenShortfall, 'woman', 'women')} short of the
                    mixed-crew minimum.
                  </li>
                )}
                {proposal.report.drummerStillMissing && <li>No available drummer is qualified.</li>}
                {proposal.report.coxStillMissing && <li>No available cox is qualified.</li>}
              </ul>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
