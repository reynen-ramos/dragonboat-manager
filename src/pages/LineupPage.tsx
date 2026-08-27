import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  closestCenter,
  pointerWithin,
  useSensor,
  useSensors,
  type Announcements,
  type CollisionDetection,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import { ArrowLeft, Printer, Redo2, Undo2 } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { BalancePanel, IssuesPanel, ReservesStrip } from '@/components/boat/BalancePanel';
import { BoatView, type SeatedOccupant } from '@/components/boat/BoatView';
import { FillBoatDialog } from '@/components/boat/FillBoatDialog';
import { CrewSheet } from '@/components/boat/CrewSheet';
import type { DragData, DropData } from '@/components/boat/dragTypes';
import { PaddlerChip } from '@/components/boat/PaddlerChip';
import { RosterPanel } from '@/components/boat/RosterPanel';
import { Button } from '@/components/ui/Button';
import { Card, EmptyState, LoadFailed, Spinner } from '@/components/ui/misc';
import { planBalancedSeating, violatesSidePreference } from '@/domain/balance';
import { seatKey, seatLabel } from '@/domain/boat';
import { planDrop, type DropTarget, type SeatingChange } from '@/domain/seating';
import type { Assignment, Member, SeatPosition } from '@/domain/types';
import {
  useAvailabilityByMember,
  useCrewBalance,
  useCrewIssues,
  useCrewLineup,
  useCategoryCrewAssignments,
} from '@/queries/derived';
import {
  useApplySeatingChanges,
  useSettings,
  useCategory,
  useCrew,
  useEvent,
  useMembers,
  useReplaceCrewLineup,
  useUpdateAssignment,
} from '@/queries/hooks';
import { CrewResults } from '@/pages/RaceDayPage';
import { useLineupHistory } from '@/stores/lineupHistory';
import { categoryName } from '@/utils/format';

const MOBILE_TABS = ['roster', 'boat', 'checks'] as const;
type MobileTab = (typeof MOBILE_TABS)[number];

/**
 * Prefer whatever the pointer is actually inside.
 *
 * The droppables here are wildly different sizes — a seat is a small tile, the
 * roster is a full-height column. Comparing centres alone would let a seat two
 * hundred pixels away win over the roster the pointer is sitting inside, so
 * dragging a paddler out of the boat would silently re-seat them instead.
 * Centre distance is still the fallback for gaps between droppables.
 */
const collisionDetection: CollisionDetection = (args) => {
  const withinPointer = pointerWithin(args);
  return withinPointer.length > 0 ? withinPointer : closestCenter(args);
};

/** Screen-reader narration for the drag interaction. */
const announcements: Announcements = {
  onDragStart: ({ active }) => `Picked up ${dragLabel(active.data.current as DragData)}.`,
  onDragOver: ({ over }) => describeTarget(over?.data.current as DropData | undefined, 'Over'),
  onDragEnd: ({ over }) => {
    const drop = over?.data.current as DropData | undefined;
    if (!drop) return 'Dropped outside the boat; nothing changed.';
    if (drop.kind === 'seat') return `Placed in ${seatLabel(drop.seat)}.`;
    if (drop.kind === 'role') return `Placed as ${drop.role}.`;
    return 'Removed from the crew.';
  },
  onDragCancel: () => 'Cancelled; nothing changed.',
};

const dragLabel = (drag: DragData | undefined) =>
  drag?.kind === 'seat' ? `the paddler in ${seatLabel(drag.seat)}` : 'the paddler';

function describeTarget(drop: DropData | undefined, verb: string): string {
  if (!drop) return 'Not over a drop target.';
  if (drop.kind === 'seat') return `${verb} ${seatLabel(drop.seat)}.`;
  if (drop.kind === 'role') return `${verb} the ${drop.role} position.`;
  return `${verb} the roster; releasing removes them from the crew.`;
}

export function LineupPage() {
  const { eventId, crewId } = useParams();
  const crew = useCrew(crewId);
  const category = useCategory(crew.data?.categoryId);
  const event = useEvent(eventId);
  const members = useMembers();
  const lineup = useCrewLineup(crewId);
  const balance = useCrewBalance(crewId, category.data);
  const issues = useCrewIssues(crewId, category.data, eventId, event.data?.startDate);
  const availability = useAvailabilityByMember(eventId);
  const categoryAssignments = useCategoryCrewAssignments(category.data?.id);
  const settings = useSettings();

  const applyChangesMutation = useApplySeatingChanges();
  const replaceLineup = useReplaceCrewLineup();
  const updateAssignment = useUpdateAssignment();

  // Selected individually: subscribing to the whole store would give a new
  // object on every history change, re-firing the effect below in a loop.
  const beginHistory = useLineupHistory((s) => s.begin);
  const clearHistory = useLineupHistory((s) => s.clear);
  const recordHistory = useLineupHistory((s) => s.record);
  const undoHistory = useLineupHistory((s) => s.undo);
  const redoHistory = useLineupHistory((s) => s.redo);
  const canUndo = useLineupHistory((s) => s.past.length > 0);
  const canRedo = useLineupHistory((s) => s.future.length > 0);

  const [dragging, setDragging] = useState<DragData>();
  const [selectedMemberId, setSelectedMemberId] = useState<string>();
  const [tab, setTab] = useState<MobileTab>('boat');

  // History belongs to one crew; navigating elsewhere must not leave an undo
  // that would write into the crew just left.
  useEffect(() => {
    if (crewId) beginHistory(crewId);
    return () => clearHistory();
  }, [crewId, beginHistory, clearHistory]);

  const membersById = lineup.membersById;
  const inCrewMemberIds = useMemo(
    () => new Set(lineup.assignments.map((a) => a.memberId)),
    [lineup.assignments],
  );

  /** Members seated in more than one crew in this category — a real clash. */
  const doubleBookedIds = useMemo(() => {
    const counts = new Map<string, Set<string>>();
    for (const { crewId: id, memberId, role } of categoryAssignments) {
      // Reserves do not race, so the validator does not count them as a
      // clash; the chip must agree or the boat and the Checks panel argue.
      if (role === 'reserve') continue;
      counts.set(memberId, (counts.get(memberId) ?? new Set()).add(id));
    }
    return new Set(
      [...counts.entries()].filter(([, crewIds]) => crewIds.size > 1).map(([memberId]) => memberId),
    );
  }, [categoryAssignments]);

  const applyChanges = useCallback(
    async (changes: SeatingChange[]) => {
      if (changes.length === 0 || !crewId) return;
      // The snapshot is captured before the write but recorded only after it
      // succeeds — recording first left a phantom undo entry when the write
      // failed: Undo lit up, and restored a state that had never changed.
      const before = lineup.assignments;
      await applyChangesMutation.mutateAsync(changes);
      recordHistory(crewId, before);
    },
    [applyChangesMutation, crewId, recordHistory, lineup.assignments],
  );

  const handleDrop = useCallback(
    (drag: DragData, drop: DropData) => {
      if (!crewId) return;
      const target: DropTarget =
        drop.kind === 'seat'
          ? { kind: 'seat', seat: drop.seat }
          : drop.kind === 'role'
            ? { kind: 'role', role: drop.role }
            : { kind: 'remove' };

      const source = {
        memberId: drag.memberId,
        assignmentId: drag.kind === 'roster' ? undefined : drag.assignmentId,
      };
      void applyChanges(planDrop(crewId, lineup.assignments, source, target));
    },
    [applyChanges, crewId, lineup.assignments],
  );

  const onDragStart = (event: DragStartEvent) => setDragging(event.active.data.current as DragData);

  const onDragEnd = (dragEvent: DragEndEvent) => {
    setDragging(undefined);
    const drag = dragEvent.active.data.current as DragData | undefined;
    const drop = dragEvent.over?.data.current as DropData | undefined;
    if (drag && drop) handleDrop(drag, drop);
  };

  /** Tap a paddler then tap a seat — easier than dragging on a small screen. */
  const placeSelected = (target: DropTarget) => {
    if (!selectedMemberId || !crewId) return;
    void applyChanges(planDrop(crewId, lineup.assignments, { memberId: selectedMemberId }, target));
    setSelectedMemberId(undefined);
  };

  const autoBalance = () => {
    if (!category.data || !crewId) return;
    const plan = planBalancedSeating(lineup.seated, category.data.boatSize);
    const changes: SeatingChange[] = plan
      .filter(({ assignmentId, seat }) => {
        const current = lineup.assignments.find((a) => a.id === assignmentId);
        return !current?.seat || seatKey(current.seat) !== seatKey(seat);
      })
      .map(({ assignmentId, seat }) => ({ op: 'update', id: assignmentId, patch: { seat } }));
    void applyChanges(changes);
  };

  const undo = useCallback(() => {
    // The pending guard is what keeps a rapid double Ctrl-Z honest: the second
    // press would otherwise read the render closure's pre-refetch assignments
    // and push that stale copy onto the redo stack.
    if (!crewId || replaceLineup.isPending) return;
    const restored = undoHistory(lineup.assignments);
    if (restored) void replaceLineup.mutateAsync({ crewId, assignments: restored });
  }, [crewId, undoHistory, lineup.assignments, replaceLineup]);

  const redo = useCallback(() => {
    if (!crewId || replaceLineup.isPending) return;
    const restored = redoHistory(lineup.assignments);
    if (restored) void replaceLineup.mutateAsync({ crewId, assignments: restored });
  }, [crewId, redoHistory, lineup.assignments, replaceLineup]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey) || e.key.toLowerCase() !== 'z') return;
      const target = e.target as HTMLElement | null;
      // Never steal undo from a text field the user is typing in.
      if (target?.matches('input, textarea, select')) return;
      e.preventDefault();
      if (e.shiftKey) redo();
      else undo();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [undo, redo]);

  const sensors = useSensors(
    // A small distance threshold keeps a tap from registering as a drag.
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 8 } }),
    useSensor(KeyboardSensor),
  );

  // `event` belongs in both guards: it is read below, and leaving it out fell
  // through to "That crew no longer exists" while it was still loading.
  if (crew.isLoading || category.isLoading || members.isLoading || event.isLoading) {
    return <Spinner />;
  }
  if (crew.isError || category.isError || members.isError || event.isError || lineup.isError) {
    return (
      <LoadFailed
        onRetry={() => {
          void crew.refetch();
          void category.refetch();
          void members.refetch();
          void event.refetch();
          lineup.refetch();
        }}
      />
    );
  }
  if (!crew.data || !category.data || !event.data) {
    return <EmptyState title="That crew no longer exists." />;
  }

  const occupantFor = <A extends Assignment>(assignment: A, member: Member) => ({
    assignment,
    member,
    wrongSide: assignment.role === 'paddler' && violatesSidePreference({ assignment, member }),
    unavailable: availability.get(member.id) === 'out',
    doubleBooked: doubleBookedIds.has(member.id),
  });

  const occupantAt = (seat: SeatPosition): SeatedOccupant | undefined => {
    const entry = lineup.bySeat.get(seatKey(seat));
    return entry ? occupantFor(entry.assignment, entry.member) : undefined;
  };

  const draggedMember = dragging ? membersById.get(dragging.memberId) : undefined;

  const rosterPanel = (
    <RosterPanel
      members={members.data ?? []}
      inCrewMemberIds={inCrewMemberIds}
      availability={availability}
      doubleBookedIds={doubleBookedIds}
      selectedMemberId={selectedMemberId}
      onSelectMember={setSelectedMemberId}
    />
  );

  const checksPanel = (
    <div className="flex flex-col gap-3">
      {crewId && category.data && members.data && (
        <div className="flex justify-end">
          <FillBoatDialog
            membersById={membersById}
            pending={applyChangesMutation.isPending}
            onApply={(changes) => void applyChanges(changes)}
            input={{
              category: category.data,
              crewId,
              assignments: lineup.assignments,
              members: members.data,
              availability,
              categoryAssignments,
              settings,
            }}
          />
        </div>
      )}
      {balance && (
        <BalancePanel
          balance={balance}
          onAutoBalance={autoBalance}
          autoBalanceDisabled={lineup.seated.length === 0}
        />
      )}
      <IssuesPanel issues={issues} />
      {crewId && <CrewResults crewId={crewId} />}
    </div>
  );

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={collisionDetection}
      // dnd-kit announces generic ids by default ("Draggable item
      // assignment-3 was moved"), which tells a screen reader user nothing
      // about who moved or where. These name the paddler and the seat.
      accessibility={{ announcements }}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onDragCancel={() => setDragging(undefined)}
    >
      <div className="no-print mb-3 flex flex-wrap items-center justify-between gap-2">
        <Button asChild variant="ghost" size="sm" className="-ml-2">
          <Link to={`/events/${event.data.id}`}>
            <ArrowLeft /> {event.data.name}
          </Link>
        </Button>
        <div className="flex gap-1">
          <Button size="icon" variant="ghost" onClick={undo} disabled={!canUndo} aria-label="Undo">
            <Undo2 />
          </Button>
          <Button size="icon" variant="ghost" onClick={redo} disabled={!canRedo} aria-label="Redo">
            <Redo2 />
          </Button>
          <Button size="sm" onClick={() => window.print()}>
            <Printer /> Crew sheet
          </Button>
        </div>
      </div>

      <div className="no-print mb-4">
        <h1 className="text-xl font-semibold sm:text-2xl">{crew.data.name}</h1>
        <p className="text-sm text-muted">
          {categoryName(category.data)} · {lineup.seated.length}/{category.data.boatSize} seated
        </p>
      </div>

      {selectedMemberId && (
        <p className="no-print mb-3 rounded-lg bg-brand-100 px-3 py-2 text-sm text-brand-900 dark:bg-brand-900 dark:text-brand-100">
          Now tap a seat to place{' '}
          <strong>{membersById.get(selectedMemberId)?.firstName ?? 'them'}</strong>, or tap them
          again to cancel.
        </p>
      )}

      {/*
        Phones get one panel at a time; there is no room for three columns.
        Real tab semantics rather than a row of `aria-pressed` buttons, which
        announce as independent toggles and say nothing about the set.

        Deliberately not @radix-ui/react-tabs: it shows exactly one panel, and
        above `lg` this layout shows all three at once with the tab bar hidden.
      */}
      <div
        role="tablist"
        aria-label="Lineup panels"
        className="no-print mb-3 flex gap-1 rounded-lg surface-sunken p-1 lg:hidden"
      >
        {MOBILE_TABS.map((value, index) => (
          <button
            key={value}
            id={`tab-${value}`}
            type="button"
            role="tab"
            aria-selected={tab === value}
            aria-controls={`panel-${value}`}
            tabIndex={tab === value ? 0 : -1}
            onClick={() => setTab(value)}
            onKeyDown={(e) => {
              const delta = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
              if (!delta) return;
              e.preventDefault();
              const next = MOBILE_TABS[(index + delta + MOBILE_TABS.length) % MOBILE_TABS.length];
              setTab(next);
              document.getElementById(`tab-${next}`)?.focus();
            }}
            className={`flex-1 rounded-md py-2 text-sm font-medium capitalize ${
              tab === value ? 'surface shadow-sm' : 'text-muted'
            }`}
          >
            {value}
          </button>
        ))}
      </div>

      <CrewSheet
        crew={crew.data}
        category={category.data}
        event={event.data}
        occupantAt={(seat) => lineup.bySeat.get(seatKey(seat))?.member}
        drummer={lineup.drummer?.member}
        cox={lineup.cox?.member}
        reserves={lineup.reserves.map((r) => r.member)}
        balance={balance}
      />

      <div className="no-print grid gap-4 lg:grid-cols-[16rem_minmax(0,1fr)_18rem]">
        <div
          id="panel-roster"
          role="tabpanel"
          aria-labelledby="tab-roster"
          className={`${tab === 'roster' ? 'flex' : 'hidden'} min-h-0 lg:flex lg:max-h-[80vh]`}
        >
          {rosterPanel}
        </div>

        <div
          id="panel-boat"
          role="tabpanel"
          aria-labelledby="tab-boat"
          className={tab === 'boat' ? 'block' : 'hidden lg:block'}
        >
          <Card className="py-2">
            <BoatView
              boatSize={category.data.boatSize}
              occupantAt={occupantAt}
              drummer={
                lineup.drummer && occupantFor(lineup.drummer.assignment, lineup.drummer.member)
              }
              cox={lineup.cox && occupantFor(lineup.cox.assignment, lineup.cox.member)}
              selectedMemberId={selectedMemberId}
              onSeatTap={(seat) => placeSelected({ kind: 'seat', seat })}
              onRoleTap={(role) => placeSelected({ kind: 'role', role })}
              onTogglePin={(assignment) =>
                updateAssignment.mutate({
                  id: assignment.id,
                  patch: { pinned: !assignment.pinned },
                })
              }
            />
          </Card>

          <div className="mt-3">
            <ReservesStrip
              reserves={lineup.reserves.map(({ assignment, member }) => ({
                assignmentId: assignment.id,
                member,
              }))}
              onRemove={(assignmentId) => void applyChanges([{ op: 'delete', id: assignmentId }])}
              selectedMemberName={
                selectedMemberId ? membersById.get(selectedMemberId)?.firstName : undefined
              }
              onTap={() => placeSelected({ kind: 'role', role: 'reserve' })}
            />
          </div>
        </div>

        <div
          id="panel-checks"
          role="tabpanel"
          aria-labelledby="tab-checks"
          className={tab === 'checks' ? 'block' : 'hidden lg:block'}
        >
          {checksPanel}
        </div>
      </div>

      <DragOverlay dropAnimation={null}>
        {draggedMember && (
          <div className="surface rounded-lg border border-brand-600 px-2 py-1.5 shadow-lg">
            <PaddlerChip member={draggedMember} />
          </div>
        )}
      </DragOverlay>
    </DndContext>
  );
}
