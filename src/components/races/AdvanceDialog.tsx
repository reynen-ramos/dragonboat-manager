import { ChevronsRight } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Dialog, DialogClose, DialogContent, DialogTrigger } from '@/components/ui/Dialog';
import { NumberField } from '@/components/ui/NumberField';
import { RadioCards } from '@/components/ui/RadioCards';
import {
  planAdvancement,
  STAGE_LABELS,
  type AdvancementPlan,
} from '@/domain/results';
import type { RaceEntry, RaceStage } from '@/domain/types';
import { pluralise } from '@/utils/format';

/**
 * "Advance the fastest crews" for one category.
 *
 * Renders nothing until a move is actually possible: the source stage has
 * times and the stage after it is empty. Heats may skip straight to a final —
 * plenty of regattas run no semis — so that choice is the coach's, made here
 * rather than assumed.
 */
export function AdvanceDialog({
  entries,
  crewName,
  onConfirm,
  pending,
}: {
  entries: RaceEntry[];
  crewName: (crewId: string) => string;
  onConfirm: (rows: Omit<RaceEntry, 'id'>[]) => void;
  pending: boolean;
}) {
  const hasStage = (s: RaceStage) => entries.some((e) => e.stage === s);
  const timedIn = (s: RaceStage) =>
    entries.some((e) => e.stage === s && Number.isFinite(e.timeMs));

  const from: RaceStage | undefined =
    !hasStage('final') && hasStage('semi') && timedIn('semi')
      ? 'semi'
      : !hasStage('semi') && !hasStage('final') && timedIn('heat')
        ? 'heat'
        : undefined;

  const [open, setOpen] = useState(false);
  const [to, setTo] = useState<RaceStage>('final');
  const [advancing, setAdvancing] = useState(6);
  const [races, setRaces] = useState(1);

  const timedCount = useMemo(
    () =>
      from === undefined
        ? 0
        : new Set(
            entries
              .filter((e) => e.stage === from && Number.isFinite(e.timeMs))
              .map((e) => e.crewId),
          ).size,
    [entries, from],
  );

  const plan = useMemo<AdvancementPlan | undefined>(() => {
    if (from === undefined || !open) return undefined;
    const target = from === 'semi' ? 'final' : to;
    const result = planAdvancement(entries, from, target, { advancing, races });
    return 'blocked' in result ? undefined : result;
  }, [entries, from, to, advancing, races, open]);

  if (from === undefined) return null;

  const target: RaceStage = from === 'semi' ? 'final' : to;

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) {
          // Sensible defaults per opening: six lanes is the common pond.
          setAdvancing(Math.min(6, timedCount));
          setRaces(from === 'heat' && to === 'semi' ? 2 : 1);
        }
      }}
    >
      <DialogTrigger asChild>
        <Button size="sm" variant="primary">
          <ChevronsRight /> Advance from {STAGE_LABELS[from].toLowerCase()}s
        </Button>
      </DialogTrigger>
      <DialogContent
        title={`Advance the fastest crews`}
        description={`Ranked by best time across every ${STAGE_LABELS[from].toLowerCase()}.`}
        footer={
          <>
            <DialogClose asChild>
              <Button>Cancel</Button>
            </DialogClose>
            <Button
              variant="primary"
              disabled={!plan || pending}
              onClick={() => {
                if (!plan) return;
                onConfirm(plan.entries);
                setOpen(false);
              }}
            >
              Create {target === 'semi' ? pluralise(races, 'semi-final') : races > 1 ? `${races} finals` : 'the final'}
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          {from === 'heat' && (
            <RadioCards
              label="Advance into"
              className="grid grid-cols-2 gap-2"
              optionClassName="rounded-xl border border-subtle px-3 py-3 text-left transition-colors hover:surface-sunken"
              value={to}
              onChange={(next) => {
                setTo(next);
                setRaces(next === 'semi' ? 2 : 1);
              }}
              options={[
                { value: 'semi', label: 'Semi-finals', description: 'Another round before the final', selectedClassName: 'border-brand-600 bg-brand-50 dark:bg-brand-900' },
                { value: 'final', label: 'Final', description: 'Straight to the medals', selectedClassName: 'border-brand-600 bg-brand-50 dark:bg-brand-900' },
              ]}
            />
          )}

          <div className="grid grid-cols-2 gap-3">
            <NumberField
              label="Crews advancing"
              value={advancing}
              min={1}
              max={timedCount}
              onCommit={setAdvancing}
            />
            <NumberField
              label={target === 'final' ? 'Finals (A, B…)' : 'Semi-finals'}
              value={races}
              min={1}
              max={4}
              onCommit={setRaces}
            />
          </div>

          {plan && (
            <div className="rounded-xl surface-sunken p-3 text-sm">
              <p className="font-medium">
                {pluralise(plan.advancingCrewIds.length, 'crew')} advance
                {plan.advancingCrewIds.length === 1 ? 's' : ''}
                {plan.advancingCrewIds.length > advancing && ' — a tie at the cut carries both'}
              </p>
              <p className="mt-1 text-muted">
                {plan.advancingCrewIds.map(crewName).join(', ')}
              </p>
              {plan.excludedUntimed.length > 0 && (
                <p className="mt-2 text-amber-700 dark:text-amber-300">
                  No time recorded, staying behind:{' '}
                  {plan.excludedUntimed.map(crewName).join(', ')}
                </p>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
