import { useDraggable, useDroppable } from '@dnd-kit/core';
import { Drum, Pin, Ship } from 'lucide-react';
import type { ReactNode } from 'react';
import { getBoatLayout, seatLabel, ZONE_LABELS } from '@/domain/boat';
import type {
  Assignment,
  BoatSize,
  Member,
  PaddlerAssignment,
  SeatPosition,
  SeatZone,
  Side,
} from '@/domain/types';
import { cn } from '@/utils/cn';
import { fullName } from '@/utils/format';
import {
  assignmentDraggableId,
  roleDroppableId,
  seatDroppableId,
  type DragData,
  type DropData,
} from './dragTypes';
import { PaddlerChip } from './PaddlerChip';

/**
 * The boat.
 *
 * An SVG hull sits behind a real DOM grid rather than the seats being drawn in
 * SVG: dnd-kit needs measurable elements, and text in `foreignObject` is a
 * liability across browsers. The hull stretches to whatever height the row
 * count needs.
 */

export interface SeatOccupant {
  assignment: Assignment;
  member: Member;
  wrongSide: boolean;
  unavailable: boolean;
  doubleBooked: boolean;
}

/** An occupant the caller has already resolved to a seat. */
export interface SeatedOccupant extends SeatOccupant {
  assignment: PaddlerAssignment;
}

export interface BoatViewProps {
  boatSize: BoatSize;
  occupantAt: (seat: SeatPosition) => SeatedOccupant | undefined;
  drummer?: SeatOccupant;
  cox?: SeatOccupant;
  onTogglePin?: (assignment: Assignment) => void;
  /** Selected via tap-to-place, which works where dragging is awkward. */
  selectedMemberId?: string;
  onSeatTap?: (seat: SeatPosition) => void;
  onRoleTap?: (role: 'drummer' | 'cox') => void;
}

export function BoatView({
  boatSize,
  occupantAt,
  drummer,
  cox,
  onTogglePin,
  selectedMemberId,
  onSeatTap,
  onRoleTap,
}: BoatViewProps) {
  const layout = getBoatLayout(boatSize);
  const rows = Array.from({ length: layout.rows }, (_, i) => i + 1);

  return (
    <div className="relative mx-auto w-full max-w-md px-6 py-4">
      <Hull />

      <div className="relative flex flex-col gap-1.5">
        <RoleSlot
          role="drummer"
          label="Drummer"
          icon={<Drum className="size-3.5" />}
          occupant={drummer}
          highlighted={Boolean(selectedMemberId)}
          onTap={onRoleTap}
        />

        {rows.map((row) => (
          <BoatRow
            key={row}
            row={row}
            zone={layout.zoneForRow(row)}
            showZoneLabel={row === 1 || layout.zoneForRow(row) !== layout.zoneForRow(row - 1)}
            occupantAt={occupantAt}
            onTogglePin={onTogglePin}
            highlighted={Boolean(selectedMemberId)}
            onSeatTap={onSeatTap}
          />
        ))}

        <RoleSlot
          role="cox"
          label="Coxswain"
          icon={<Ship className="size-3.5" />}
          occupant={cox}
          highlighted={Boolean(selectedMemberId)}
          onTap={onRoleTap}
        />
      </div>
    </div>
  );
}

/** The hull outline: a pointed bow at the top, tapered stern at the bottom. */
function Hull() {
  return (
    <svg
      className="pointer-events-none absolute inset-0 h-full w-full text-brand-600/25"
      viewBox="0 0 100 400"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <path
        d="M50 2 C 74 26, 92 60, 92 120 L92 300 C92 352, 76 382, 50 398 C24 382, 8 352, 8 300 L8 120 C8 60, 26 26, 50 2 Z"
        fill="currentColor"
        fillOpacity="0.18"
        stroke="currentColor"
        strokeWidth="1.5"
        vectorEffect="non-scaling-stroke"
      />
      <line
        x1="50"
        y1="30"
        x2="50"
        y2="370"
        stroke="currentColor"
        strokeWidth="1"
        strokeDasharray="4 6"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

function BoatRow({
  row,
  zone,
  showZoneLabel,
  occupantAt,
  onTogglePin,
  highlighted,
  onSeatTap,
}: {
  row: number;
  zone: SeatZone;
  showZoneLabel: boolean;
  occupantAt: (seat: SeatPosition) => SeatedOccupant | undefined;
  onTogglePin?: (assignment: Assignment) => void;
  highlighted: boolean;
  onSeatTap?: (seat: SeatPosition) => void;
}) {
  return (
    <div className="relative">
      {showZoneLabel && (
        <p className="mb-1 mt-2 text-center text-[0.6rem] font-semibold uppercase tracking-widest text-muted">
          {ZONE_LABELS[zone]}
        </p>
      )}
      <div className="flex items-stretch gap-1.5">
        {(['left', 'right'] as Side[]).map((side, index) => (
          <div key={side} className="flex flex-1 items-center gap-1.5">
            {index === 1 && (
              <span className="tabular w-4 shrink-0 text-center text-[0.65rem] font-medium text-muted">
                {row}
              </span>
            )}
            <Seat
              seat={{ row, side }}
              occupant={occupantAt({ row, side })}
              onTogglePin={onTogglePin}
              highlighted={highlighted}
              onTap={onSeatTap}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

function Seat({
  seat,
  occupant,
  onTogglePin,
  highlighted,
  onTap,
}: {
  seat: SeatPosition;
  occupant?: SeatedOccupant;
  onTogglePin?: (assignment: Assignment) => void;
  highlighted: boolean;
  onTap?: (seat: SeatPosition) => void;
}) {
  const dropData: DropData = { kind: 'seat', seat };
  const { setNodeRef, isOver } = useDroppable({ id: seatDroppableId(seat), data: dropData });

  return (
    <div
      ref={setNodeRef}
      className={cn(
        'relative min-w-0 flex-1 rounded-lg border transition-colors',
        occupant ? 'surface border-subtle' : 'border-dashed border-subtle',
        isOver && 'border-brand-600 bg-brand-100 dark:bg-brand-900',
        highlighted && !isOver && 'border-brand-400',
      )}
    >
      {occupant ? (
        <SeatOccupantView occupant={occupant} onTogglePin={onTogglePin} />
      ) : (
        <button
          type="button"
          onClick={() => onTap?.(seat)}
          className="flex h-11 w-full items-center justify-center text-[0.65rem] text-muted"
          aria-label={`Empty seat, ${seatLabel(seat)}`}
        >
          {seat.side === 'left' ? 'L' : 'R'}
        </button>
      )}
    </div>
  );
}

function SeatOccupantView({
  occupant,
  onTogglePin,
}: {
  occupant: SeatedOccupant;
  onTogglePin?: (assignment: Assignment) => void;
}) {
  const dragData: DragData = {
    kind: 'seat',
    assignmentId: occupant.assignment.id,
    memberId: occupant.member.id,
    seat: occupant.assignment.seat,
  };
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: assignmentDraggableId(occupant.assignment.id),
    data: dragData,
  });

  return (
    <div className={cn('flex h-11 items-center pl-1.5 pr-0.5', isDragging && 'opacity-40')}>
      <button
        ref={setNodeRef}
        {...listeners}
        {...attributes}
        // Without this the browser pans the page instead of starting a drag.
        style={{ touchAction: 'none' }}
        className="min-w-0 flex-1 cursor-grab text-left active:cursor-grabbing"
        aria-label={`${fullName(occupant.member)}, ${seatLabel(occupant.assignment.seat)}`}
      >
        <PaddlerChip
          member={occupant.member}
          wrongSide={occupant.wrongSide}
          unavailable={occupant.unavailable}
          doubleBooked={occupant.doubleBooked}
          pinned={occupant.assignment.pinned}
        />
      </button>
      {onTogglePin && (
        <button
          type="button"
          onClick={() => onTogglePin(occupant.assignment)}
          className={cn(
            'grid size-6 shrink-0 place-items-center rounded transition-colors hover:surface-sunken',
            occupant.assignment.pinned ? 'text-brand-600' : 'text-muted opacity-40',
          )}
          aria-label={occupant.assignment.pinned ? 'Unpin seat' : 'Pin seat'}
          aria-pressed={Boolean(occupant.assignment.pinned)}
        >
          <Pin className="size-3.5" />
        </button>
      )}
    </div>
  );
}

function RoleSlot({
  role,
  label,
  icon,
  occupant,
  highlighted,
  onTap,
}: {
  role: 'drummer' | 'cox';
  label: string;
  icon: ReactNode;
  occupant?: SeatOccupant;
  highlighted: boolean;
  onTap?: (role: 'drummer' | 'cox') => void;
}) {
  const dropData: DropData = { kind: 'role', role };
  const { setNodeRef, isOver } = useDroppable({ id: roleDroppableId(role), data: dropData });

  const dragData: DragData | undefined = occupant && {
    kind: 'crewRole',
    assignmentId: occupant.assignment.id,
    memberId: occupant.member.id,
    role,
  };

  return (
    <div
      ref={setNodeRef}
      className={cn(
        'mx-auto w-1/2 rounded-lg border transition-colors',
        occupant ? 'surface border-subtle' : 'border-dashed border-subtle',
        isOver && 'border-brand-600 bg-brand-100 dark:bg-brand-900',
        highlighted && !isOver && 'border-brand-400',
      )}
    >
      {occupant && dragData ? (
        <RoleOccupantView occupant={occupant} dragData={dragData} />
      ) : (
        <button
          type="button"
          onClick={() => onTap?.(role)}
          className="flex h-11 w-full items-center justify-center gap-1.5 text-[0.7rem] text-muted"
        >
          {icon}
          {label}
        </button>
      )}
    </div>
  );
}

function RoleOccupantView({
  occupant,
  dragData,
}: {
  occupant: SeatOccupant;
  dragData: DragData;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: assignmentDraggableId(occupant.assignment.id),
    data: dragData,
  });

  return (
    <button
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      style={{ touchAction: 'none' }}
      className={cn(
        'flex h-11 w-full cursor-grab items-center px-1.5 text-left active:cursor-grabbing',
        isDragging && 'opacity-40',
      )}
      aria-label={fullName(occupant.member)}
    >
      <PaddlerChip
        member={occupant.member}
        unavailable={occupant.unavailable}
        doubleBooked={occupant.doubleBooked}
      />
    </button>
  );
}
