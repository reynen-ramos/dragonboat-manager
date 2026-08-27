import { useDroppable } from '@dnd-kit/core';
import { AlertTriangle, CheckCircle2, Info, Scale, Wand2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/misc';
import type { BalanceReport } from '@/domain/balance';
import type { Member } from '@/domain/types';
import type { Issue, IssueLevel } from '@/domain/validation';
import { cn } from '@/utils/cn';
import { pluralise } from '@/utils/format';
import { roleDroppableId, type DropData } from './dragTypes';
import { PaddlerChip } from './PaddlerChip';

/** Live weight distribution, with the one-tap fix. */
export function BalancePanel({
  balance,
  onAutoBalance,
  autoBalanceDisabled,
}: {
  balance: BalanceReport;
  onAutoBalance: () => void;
  autoBalanceDisabled?: boolean;
}) {
  return (
    <section className="rounded-xl border border-subtle p-3">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="flex items-center gap-1.5 text-sm font-semibold">
          <Scale className="size-4" /> Balance
        </h2>
        <span className="tabular text-xs text-muted">
          {Math.round(balance.totalKg)}kg · {balance.seatedCount} seated
        </span>
      </div>

      <SeeSaw
        label="Left / right"
        leftLabel="Left"
        rightLabel="Right"
        leftKg={balance.leftKg}
        rightKg={balance.rightKg}
        deltaKg={balance.sideDeltaKg}
        fraction={balance.sideDeltaFraction}
        withinTolerance={balance.sideWithinTolerance}
      />

      <div className="mt-3">
        <SeeSaw
          label="Bow / stern"
          leftLabel="Bow"
          rightLabel="Stern"
          leftKg={balance.bowKg}
          rightKg={balance.sternKg}
          deltaKg={balance.bowSternDeltaKg}
          fraction={balance.bowSternDeltaFraction}
          withinTolerance={balance.bowSternWithinTolerance}
        />
      </div>

      {balance.missingWeightCount > 0 && (
        <p className="mt-3 text-xs text-muted">
          {pluralise(balance.missingWeightCount, 'seated paddler')} with no weight recorded, so
          these totals are understated.
        </p>
      )}

      <Button
        className="mt-3 w-full"
        size="sm"
        onClick={onAutoBalance}
        disabled={autoBalanceDisabled}
      >
        <Wand2 /> Balance sides
      </Button>
      <p className="mt-1.5 text-center text-[0.65rem] text-muted">
        Keeps side preferences and pinned seats. Undo with ⌘Z.
      </p>
    </section>
  );
}

export function SeeSaw({
  label,
  leftLabel,
  rightLabel,
  leftKg,
  rightKg,
  deltaKg,
  fraction,
  withinTolerance,
}: {
  label: string;
  leftLabel: string;
  rightLabel: string;
  leftKg: number;
  rightKg: number;
  deltaKg: number;
  fraction: number;
  withinTolerance: boolean;
}) {
  const total = leftKg + rightKg;
  const leftPercent = total === 0 ? 50 : (leftKg / total) * 100;

  const heavierSide = deltaKg > 0 ? leftLabel : rightLabel;
  const reading =
    deltaKg === 0
      ? 'even'
      : `${Math.abs(Math.round(deltaKg))}kg ${heavierSide} (${(fraction * 100).toFixed(1)}%)`;

  // The tolerance verdict was previously carried by the text colour alone, and
  // the sentence read identically either way — so it did not reach a screen
  // reader, a colour-blind user, or a phone in bright sun on a dock.
  const verdict = withinTolerance ? 'balanced' : 'out of tolerance';

  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between gap-2 text-xs">
        <span className="text-muted">{label}</span>
        <span
          className={cn(
            'tabular flex items-center gap-1 font-medium',
            withinTolerance ? 'text-emerald-600' : 'text-amber-600',
          )}
        >
          {withinTolerance ? (
            <CheckCircle2 className="size-3.5" aria-hidden="true" />
          ) : (
            <AlertTriangle className="size-3.5" aria-hidden="true" />
          )}
          {reading}
        </span>
      </div>

      <div
        role="meter"
        aria-label={`${label} balance`}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(fraction * 1000) / 10}
        aria-valuetext={`${reading}, ${verdict}`}
        className="relative h-2.5 overflow-hidden rounded-full surface-sunken"
      >
        <div
          className={cn(
            'h-full transition-all',
            withinTolerance ? 'bg-emerald-500' : 'bg-amber-500',
          )}
          style={{ width: `${leftPercent}%` }}
        />
        {/* The centre line is where a perfectly balanced boat sits. */}
        <div className="absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-[var(--text-strong)] opacity-40" />
      </div>

      <div className="tabular mt-0.5 flex justify-between text-[0.65rem] text-muted">
        <span>
          {leftLabel} {Math.round(leftKg)}kg
        </span>
        <span>
          {rightLabel} {Math.round(rightKg)}kg
        </span>
      </div>
    </div>
  );
}

const LEVEL_ICON: Record<IssueLevel, typeof AlertTriangle> = {
  error: AlertTriangle,
  warning: AlertTriangle,
  info: Info,
};

const LEVEL_CLASS: Record<IssueLevel, string> = {
  error: 'text-red-600',
  warning: 'text-amber-600',
  info: 'text-muted',
};

/** Everything wrong with the crew, worst first. */
export function IssuesPanel({ issues }: { issues: Issue[] }) {
  const order: IssueLevel[] = ['error', 'warning', 'info'];
  const sorted = [...issues].sort(
    (a, b) => order.indexOf(a.level) - order.indexOf(b.level),
  );

  return (
    <section className="rounded-xl border border-subtle p-3">
      <h2 className="mb-2 text-sm font-semibold">Checks</h2>
      {sorted.length === 0 ? (
        <p className="flex items-center gap-1.5 text-sm text-emerald-600">
          <CheckCircle2 className="size-4" /> This crew is race ready.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {sorted.map((issue, i) => {
            const Icon = LEVEL_ICON[issue.level];
            return (
              <li key={`${issue.code}-${issue.memberId ?? i}`} className="flex gap-2 text-xs">
                <Icon className={cn('mt-0.5 size-3.5 shrink-0', LEVEL_CLASS[issue.level])} />
                <span>{issue.message}</span>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

/** Paddlers travelling with the crew but not seated. */
export function ReservesStrip({
  reserves,
  onRemove,
  selectedMemberName,
  onTap,
}: {
  reserves: { assignmentId: string; member: Member }[];
  onRemove: (assignmentId: string) => void;
  /** Set while a paddler is selected for tap-to-place. */
  selectedMemberName?: string;
  onTap?: () => void;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: roleDroppableId('reserve'),
    data: { kind: 'role', role: 'reserve' } satisfies DropData,
  });

  return (
    <section
      ref={setNodeRef}
      className={cn(
        'rounded-xl border p-3 transition-colors',
        isOver ? 'border-brand-600 bg-brand-50 dark:bg-brand-900' : 'border-dashed border-subtle',
      )}
    >
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-sm font-semibold">Reserves</h2>
        <Badge>{reserves.length}</Badge>
      </div>
      {selectedMemberName && onTap && (
        <button
          type="button"
          onClick={onTap}
          className="mb-2 w-full rounded-lg border border-brand-400 bg-brand-500/10 px-2 py-2
            text-xs font-medium hover:bg-brand-500/20"
        >
          Move {selectedMemberName} to the reserves
        </button>
      )}
      {reserves.length === 0 ? (
        <p className="text-xs text-muted">Drag paddlers here to keep them with the crew.</p>
      ) : (
        <ul className="flex flex-wrap gap-1.5">
          {reserves.map(({ assignmentId, member }) => (
            <li
              key={assignmentId}
              className="surface flex items-center gap-1 rounded-lg border border-subtle px-1.5 py-1"
            >
              <PaddlerChip member={member} compact />
              <button
                type="button"
                onClick={() => onRemove(assignmentId)}
                className="px-1 text-xs text-muted hover:text-red-600"
                aria-label={`Remove ${member.firstName} from reserves`}
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
