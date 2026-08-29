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

      {/* Padded so the drummer sits behind the head and the tail clears the cox. */}
      <div className="relative flex flex-col gap-1.5 pb-9 pt-14">
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

/**
 * A dragon boat seen from above: head at the bow, scaled gunwales down the
 * sides, a curled tail and steering oar at the stern.
 *
 * Three pieces, because the boat stretches with its row count and a drawing
 * must not. The head and tail keep their aspect ratio; only the midsection
 * stretches — its rails stretch harmlessly, and its scale pattern stays
 * uniform because that SVG is cropped (`slice`) from a tall viewBox rather
 * than scaled to fit. Everything is currentColor at low opacity, so both
 * themes work and the seats stay legible on top.
 */
function Hull() {
  return (
    <div
      className="pointer-events-none absolute inset-0 flex flex-col text-brand-600"
      aria-hidden="true"
    >
      <DragonHead />
      <HullMidsection />
      <DragonTail />
    </div>
  );
}

/** The bow: skull and snout forward of the hull, horns swept back, whiskers. */
function DragonHead() {
  return (
    <svg viewBox="0 0 100 26" className="w-full shrink-0" style={{ aspectRatio: '100 / 26' }}>
      {/* Hull sides converging on the prow the head mounts to. */}
      <path
        d="M8 26 C8.5 18, 12 13, 22 10.5 C32 8.4, 40 7.8, 45 7.8 L55 7.8 C60 7.8, 68 8.4, 78 10.5 C88 13, 91.5 18, 92 26 Z"
        fill="currentColor"
        fillOpacity="0.17"
        stroke="currentColor"
        strokeOpacity="0.5"
        strokeWidth="1.5"
        vectorEffect="non-scaling-stroke"
      />
      {/* Skull and snout, forward of the prow. */}
      <path
        d="M44.5 7.8 C40.5 5.6, 40.5 2.4, 45 1.1 C48 0.3, 52 0.3, 55 1.1 C59.5 2.4, 59.5 5.6, 55.5 7.8 C52 9, 48 9, 44.5 7.8 Z"
        fill="currentColor"
        fillOpacity="0.42"
        stroke="currentColor"
        strokeOpacity="0.6"
        strokeWidth="1.2"
        vectorEffect="non-scaling-stroke"
      />
      {/* Horns, swept back over the hull. */}
      <path
        d="M43.8 4.4 C35 4.6, 29 7, 26 11.5 M56.2 4.4 C65 4.6, 71 7, 74 11.5"
        fill="none"
        stroke="currentColor"
        strokeOpacity="0.55"
        strokeWidth="2.4"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      {/* Whiskers curling off the snout. */}
      <path
        d="M45.2 2 C40 1.1, 36.5 2.3, 35.2 5.2 M54.8 2 C60 1.1, 63.5 2.3, 64.8 5.2"
        fill="none"
        stroke="currentColor"
        strokeOpacity="0.45"
        strokeWidth="1.2"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      {/* Mane crest running back between the horns. */}
      <path
        d="M47 8.6 L46 11 M50 9 L50 11.6 M53 8.6 L54 11"
        fill="none"
        stroke="currentColor"
        strokeOpacity="0.4"
        strokeWidth="1"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      <circle cx="46.4" cy="4.2" r="1.1" fill="currentColor" fillOpacity="0.7" />
      <circle cx="53.6" cy="4.2" r="1.1" fill="currentColor" fillOpacity="0.7" />
      <circle cx="48.3" cy="1.4" r="0.55" fill="currentColor" fillOpacity="0.55" />
      <circle cx="51.7" cy="1.4" r="0.55" fill="currentColor" fillOpacity="0.55" />
    </svg>
  );
}

/**
 * The stretch-tolerant part: side rails, painted scales, dashed keel line.
 *
 * `slice` on a tall viewBox means the width fits and the excess height is
 * cropped, so the scales keep their shape whether the boat has five rows or
 * ten — `none` would stretch each scale with the row count.
 */
function HullMidsection() {
  return (
    <div className="min-h-0 w-full flex-1 overflow-hidden">
      <svg
        viewBox="0 0 100 600"
        preserveAspectRatio="xMidYMin slice"
        className="h-full w-full"
      >
        <defs>
          <pattern id="hull-scales" width="4.4" height="5.2" patternUnits="userSpaceOnUse">
            <path
              d="M0 5.2 A2.2 3 0 0 1 4.4 5.2"
              fill="none"
              stroke="currentColor"
              strokeOpacity="0.45"
              strokeWidth="0.7"
            />
          </pattern>
        </defs>
        {/* Hull fill between the rails. */}
        <rect x="8" y="0" width="84" height="600" fill="currentColor" fillOpacity="0.15" />
        {/* Painted scales along both gunwales. */}
        <rect x="8.6" y="0" width="4.4" height="600" fill="url(#hull-scales)" />
        <rect x="87" y="0" width="4.4" height="600" fill="url(#hull-scales)" />
        {/* Outer hull edge and inner gunwale, each side. */}
        {[8, 92].map((x) => (
          <line
            key={`hull-${x}`}
            x1={x}
            y1="0"
            x2={x}
            y2="600"
            stroke="currentColor"
            strokeOpacity="0.45"
            strokeWidth="1.5"
            vectorEffect="non-scaling-stroke"
          />
        ))}
        {[13.6, 86.4].map((x) => (
          <line
            key={`gunwale-${x}`}
            x1={x}
            y1="0"
            x2={x}
            y2="600"
            stroke="currentColor"
            strokeOpacity="0.3"
            strokeWidth="1"
            vectorEffect="non-scaling-stroke"
          />
        ))}
        {/* The keel line down the centre of the deck. */}
        <line
          x1="50"
          y1="0"
          x2="50"
          y2="600"
          stroke="currentColor"
          strokeOpacity="0.3"
          strokeWidth="1"
          strokeDasharray="4 6"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
    </div>
  );
}

/** The stern: hull tapering in, a curled tail, and the steering oar. */
function DragonTail() {
  return (
    <svg viewBox="0 0 100 24" className="w-full shrink-0" style={{ aspectRatio: '100 / 24' }}>
      <path
        d="M8 0 C8.5 7, 12 12, 22 14.5 C32 16.6, 40 17.2, 45 17.2 L55 17.2 C60 17.2, 68 16.6, 78 14.5 C88 12, 91.5 7, 92 0 Z"
        fill="currentColor"
        fillOpacity="0.17"
        stroke="currentColor"
        strokeOpacity="0.5"
        strokeWidth="1.5"
        vectorEffect="non-scaling-stroke"
      />
      {/* The tail, curling wide of the stern. */}
      <path
        d="M52 17.2 C52.5 19.6, 54.5 21.4, 58 22 C64 23, 69.5 21.4, 71.5 18 C73.2 15, 72 11.6, 68.8 10.6 C66.4 9.9, 64 11, 63.2 13 C62.6 14.6, 63.5 16.2, 65.2 16.6"
        fill="none"
        stroke="currentColor"
        strokeOpacity="0.55"
        strokeWidth="2.2"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      {/* Fin spines along the curl. */}
      <path
        d="M56 21.6 L55.2 23.8 M60.5 22.3 L60.7 24 M65.6 21.9 L66.8 23.6 M70.4 19.4 L72.2 20.6"
        fill="none"
        stroke="currentColor"
        strokeOpacity="0.5"
        strokeWidth="1.1"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      {/* The steering oar, trailing long off the port quarter. */}
      <path
        d="M44 14.5 L28 22.5 M28 22.5 C25.8 23.7, 23.6 23.4, 22.4 22 M28 22.5 C26.9 20.9, 27.2 19.2, 28.8 18.2"
        fill="none"
        stroke="currentColor"
        strokeOpacity="0.4"
        strokeWidth="1.5"
        strokeLinecap="round"
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
        <>
          <SeatOccupantView occupant={occupant} onTogglePin={onTogglePin} />
          {highlighted && onTap && (
            <PlaceHereOverlay
              onClick={() => onTap(seat)}
              label={`Swap with ${fullName(occupant.member)}, ${seatLabel(seat)}`}
            />
          )}
        </>
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

/**
 * The tap target for an already-occupied seat or role.
 *
 * A separate layer rather than a handler on the occupant itself: that element
 * is a drag handle carrying dnd-kit's listeners, and a click handler sharing it
 * fires on every drag. This exists only while a paddler is selected, so
 * dragging behaves normally the rest of the time.
 */
function PlaceHereOverlay({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="absolute inset-0 z-10 rounded-lg bg-brand-500/10 hover:bg-brand-500/20"
    />
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
        // `relative` so the tap overlay sizes to this slot, not the boat.
        'relative mx-auto w-1/2 rounded-lg border transition-colors',
        occupant ? 'surface border-subtle' : 'border-dashed border-subtle',
        isOver && 'border-brand-600 bg-brand-100 dark:bg-brand-900',
        highlighted && !isOver && 'border-brand-400',
      )}
    >
      {occupant && dragData ? (
        <>
          <RoleOccupantView occupant={occupant} dragData={dragData} />
          {highlighted && onTap && (
            <PlaceHereOverlay
              onClick={() => onTap(role)}
              label={`Replace ${fullName(occupant.member)} as ${label.toLowerCase()}`}
            />
          )}
        </>
      ) : (
        <button
          type="button"
          onClick={() => onTap?.(role)}
          className="flex h-11 w-full items-center justify-center gap-1.5 text-[0.7rem] text-muted"
          aria-label={`Empty ${label.toLowerCase()} slot`}
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
