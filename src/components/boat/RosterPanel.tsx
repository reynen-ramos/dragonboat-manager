import { useDraggable, useDroppable } from '@dnd-kit/core';
import { GripVertical } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Select } from '@/components/ui/Field';
import { Badge } from '@/components/ui/misc';
import type { AvailabilityStatus, Member } from '@/domain/types';
import { SearchInput } from '@/components/ui/SearchInput';
import { cn } from '@/utils/cn';
import { compareMembers, type MemberSortKey } from '@/utils/memberSort';
import { fullName } from '@/utils/format';
import { ROSTER_DROPPABLE_ID, rosterDraggableId, type DragData, type DropData } from './dragTypes';
import { PaddlerChip } from './PaddlerChip';


/**
 * The pool of paddlers not yet in this crew.
 *
 * Opt-in: only members signed up for the event (In, or Maybe flagged as
 * tentative) appear by default — a lineup is built from the people who are
 * actually coming, not the whole club. The "Show everyone" toggle is the
 * dock-side escape hatch for someone who turns up unannounced; it reveals
 * the unsigned and the declined, each flagged, but never changes what Fill
 * the boat may auto-seat.
 */
export function RosterPanel({
  members,
  inCrewMemberIds,
  availability,
  doubleBookedIds,
  selectedMemberId,
  onSelectMember,
}: {
  members: Member[];
  inCrewMemberIds: Set<string>;
  availability: Map<string, AvailabilityStatus>;
  doubleBookedIds: Set<string>;
  selectedMemberId?: string;
  onSelectMember: (memberId: string | undefined) => void;
}) {
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<MemberSortKey>('name');
  const [showEveryone, setShowEveryone] = useState(false);

  const { setNodeRef, isOver } = useDroppable({
    id: ROSTER_DROPPABLE_ID,
    data: { kind: 'roster' } satisfies DropData,
  });

  const signedUp = (memberId: string) => {
    const status = availability.get(memberId);
    return status === 'in' || status === 'maybe';
  };

  const available = useMemo(() => {
    const query = search.trim().toLowerCase();
    return members
      .filter((m) => !inCrewMemberIds.has(m.id))
      .filter((m) => m.status === 'active')
      .filter((m) => (showEveryone ? true : signedUp(m.id)))
      .filter((m) => (query ? fullName(m).toLowerCase().includes(query) : true))
      .sort(compareMembers(sort));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- signedUp derives from availability
  }, [members, inCrewMemberIds, availability, showEveryone, search, sort]);

  const hiddenCount = members.filter(
    (m) => !inCrewMemberIds.has(m.id) && m.status === 'active' && !signedUp(m.id),
  ).length;

  return (
    <div
      ref={setNodeRef}
      className={cn(
        'flex min-h-0 flex-col rounded-xl border transition-colors',
        isOver ? 'border-brand-600 bg-brand-50 dark:bg-brand-900' : 'border-subtle',
      )}
    >
      <div className="flex flex-col gap-2 border-b border-subtle p-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold">Signed-up paddlers</h2>
          <Badge>{available.length}</Badge>
        </div>
        <SearchInput
          inputClassName="h-9 text-sm"
          placeholder="Search"
          aria-label="Search paddlers"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <Select
          className="h-9 text-sm"
          value={sort}
          onChange={(e) => setSort(e.target.value as MemberSortKey)}
          aria-label="Sort paddlers"
        >
          <option value="name">Name</option>
          <option value="weight">Heaviest first</option>
          <option value="side">Paddling side</option>
        </Select>
        {hiddenCount > 0 && (
          <label className="flex items-center gap-2 text-xs text-muted">
            <input
              type="checkbox"
              className="size-3.5 accent-[var(--color-brand-600)]"
              checked={showEveryone}
              onChange={(e) => setShowEveryone(e.target.checked)}
            />
            Show everyone ({hiddenCount} not signed up or out)
          </label>
        )}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-2">
        {available.length === 0 ? (
          <p className="px-2 py-6 text-center text-sm text-muted">
            {availability.size === 0
              ? 'Nobody has signed up for this event yet — record sign-ups from the event page.'
              : 'Everyone signed up is already in this crew.'}
          </p>
        ) : (
          <ul className="flex flex-col gap-1">
            {available.map((member) => (
              <li key={member.id}>
                <RosterCard
                  member={member}
                  unavailable={availability.get(member.id) === 'out'}
                  notSignedUp={availability.size > 0 && !availability.has(member.id)}
                  tentative={availability.get(member.id) === 'maybe'}
                  doubleBooked={doubleBookedIds.has(member.id)}
                  selected={selectedMemberId === member.id}
                  onSelect={() =>
                    onSelectMember(selectedMemberId === member.id ? undefined : member.id)
                  }
                />
              </li>
            ))}
          </ul>
        )}
      </div>

      {isOver && (
        <p className="border-t border-subtle px-3 py-2 text-center text-xs text-brand-700 dark:text-brand-200">
          Drop to remove from the crew
        </p>
      )}
    </div>
  );
}

function RosterCard({
  member,
  unavailable,
  notSignedUp,
  tentative,
  doubleBooked,
  selected,
  onSelect,
}: {
  member: Member;
  unavailable: boolean;
  notSignedUp: boolean;
  tentative: boolean;
  doubleBooked: boolean;
  selected: boolean;
  onSelect: () => void;
}) {
  const dragData: DragData = { kind: 'roster', memberId: member.id };
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: rosterDraggableId(member.id),
    data: dragData,
  });

  return (
    <div
      className={cn(
        'flex items-center gap-1 rounded-lg border px-1.5 py-1 transition-colors',
        selected ? 'border-brand-600 bg-brand-50 dark:bg-brand-900' : 'border-transparent',
        isDragging && 'opacity-40',
        !selected && 'hover:surface-sunken',
      )}
    >
      {/*
        Two controls, not one. The drag handle carries dnd-kit's keyboard
        activator, which fires on Space and Enter, the same keys that activate
        a button. One element with both `listeners` and
        `onClick` selected the paddler *and* started a drag on one press.
      */}
      <button
        type="button"
        onClick={onSelect}
        aria-pressed={selected}
        className="min-w-0 flex-1 text-left"
      >
        <PaddlerChip
          member={member}
          unavailable={unavailable}
          notSignedUp={notSignedUp}
          tentative={tentative}
          doubleBooked={doubleBooked}
        />
      </button>
      <span
        ref={setNodeRef}
        {...listeners}
        {...attributes}
        role="button"
        aria-label={`Drag ${fullName(member)}`}
        style={{ touchAction: 'none' }}
        className="shrink-0 cursor-grab px-1 text-muted active:cursor-grabbing"
      >
        <GripVertical className="size-3.5" aria-hidden="true" />
      </span>
    </div>
  );
}
