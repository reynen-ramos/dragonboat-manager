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
 * The boat itself: a slim racing canoe down the centre spine, true to a real
 * dragon boat's proportions, with the seat cards flanking it.
 *
 * The first version drew a hull wide enough to contain the cards, and it read
 * as a barge — a real dragon boat from above is a narrow sliver. So the cards
 * moved outside and the boat got its silhouette back: benches per row on a
 * pale deck, painted scales along both gunwales, and paddles reaching from
 * each occupied side out toward its card. The head and tail are drawn in
 * profile, the way this kind of illustration always cheats them, because a
 * top-view skull never reads as a dragon.
 *
 * Head and tail keep their aspect ratio; only the midsection stretches with
 * the row count, its patterns kept uniform by cropping (`slice`) a tall
 * viewBox rather than scaling it. Colours are the brand teals — bold, since
 * nothing has to stay legible on top of the narrow hull — and amber/red stay
 * reserved for warnings.
 */
function Hull() {
  return (
    <div
      className="pointer-events-none absolute inset-y-0 left-1/2 w-16 -translate-x-1/2"
      aria-hidden="true"
    >
      <div className="flex h-full flex-col">
        <DragonHead />
        <HullMidsection />
        <DragonTail />
      </div>
    </div>
  );
}

const INK = 'var(--color-brand-900)';
const BODY = 'var(--color-brand-600)';
const BODY_DEEP = 'var(--color-brand-700)';
const DECK = 'var(--color-brand-100)';
const TRIM = 'var(--color-brand-300)';

/** The head in profile, facing forward: open jaw, horn, mane, whisker. */
function DragonHead() {
  return (
    <svg viewBox="0 0 64 58" className="w-full shrink-0" style={{ aspectRatio: '64 / 58' }}>
      {/* Neck, rising out of the bow. */}
      <path
        d="M26 58 C25 48, 26 40, 30 33 L40 36 C38 44, 38 51, 39 58 Z"
        fill={BODY}
        stroke={INK}
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      {/* Mane spikes down the back of the neck. */}
      <path
        d="M40 36 L46 33 L41 41 L47 40 L42 48 L46 49 L41 54"
        fill={BODY_DEEP}
        stroke={INK}
        strokeWidth="1.2"
        strokeLinejoin="round"
      />
      {/* Skull and open jaws, facing left. */}
      <path
        d="M30 34 C22 33, 16 28, 13 22 L3 19 L10 15 C14 8, 22 4, 30 5 C38 6, 43 12, 43 20 C43 27, 38 33, 30 34 Z"
        fill={BODY}
        stroke={INK}
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      {/* The open mouth: pale inside, teeth top and bottom. */}
      <path d="M13 22 L3 19 L10 15 C12 17, 13 19, 13 22 Z" fill={DECK} stroke={INK} strokeWidth="1.2" strokeLinejoin="round" />
      <path d="M10.5 15.5 L11.5 18 L8.5 17 Z M6 17.5 L7.5 19.5 L4.8 19 Z" fill="white" stroke={INK} strokeWidth="0.6" />
      <path d="M12 21.5 L10 20.6 L8 21.2 Z" fill="white" stroke={INK} strokeWidth="0.6" />
      {/* Snout curl. */}
      <path d="M10 13.5 C7 12.5, 5.5 13.5, 5.5 15.5" fill="none" stroke={INK} strokeWidth="1.4" strokeLinecap="round" />
      {/* Whisker. */}
      <path d="M6 20.5 C2.5 22.5, 2 26, 4.5 28" fill="none" stroke={INK} strokeWidth="1.2" strokeLinecap="round" />
      {/* Horn, swept back. */}
      <path d="M33 6 C34 2, 39 0.5, 44 2 C40 4, 38 7, 38 10 Z" fill={DECK} stroke={INK} strokeWidth="1.3" strokeLinejoin="round" />
      {/* Eye. */}
      <circle cx="24" cy="15" r="3" fill="white" stroke={INK} strokeWidth="1.2" />
      <circle cx="23.4" cy="15.4" r="1.3" fill={INK} />
      {/* Brow flare. */}
      <path d="M19 11 C21 9.4, 24 9, 27 9.8" fill="none" stroke={INK} strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  );
}

/**
 * The stretch-tolerant hull: gunwales, pale deck, scales, ripples alongside.
 * `slice` on a tall viewBox keeps every pattern uniform whether the boat has
 * five rows or ten; `none` would stretch the scales with the row count.
 */
function HullMidsection() {
  return (
    <div className="min-h-0 w-full flex-1 overflow-hidden">
      <svg viewBox="0 0 64 600" preserveAspectRatio="xMidYMin slice" className="h-full w-full">
        <defs>
          <pattern id="gunwale-scales" width="7" height="6" patternUnits="userSpaceOnUse">
            <path d="M0 6 A3.5 4 0 0 1 7 6" fill="none" stroke={INK} strokeOpacity="0.5" strokeWidth="0.9" />
          </pattern>
        </defs>
        {/* Hull sides. */}
        <rect x="18" y="0" width="28" height="600" fill={BODY} />
        {/* The deck the benches sit on. */}
        <rect x="23" y="0" width="18" height="600" fill={DECK} />
        {/* Painted scales along both gunwales. */}
        <rect x="18" y="0" width="5" height="600" fill="url(#gunwale-scales)" />
        <rect x="41" y="0" width="5" height="600" fill="url(#gunwale-scales)" />
        {/* Gunwale edges. */}
        {[18, 46].map((x) => (
          <line key={x} x1={x} y1="0" x2={x} y2="600" stroke={INK} strokeWidth="2" vectorEffect="non-scaling-stroke" />
        ))}
        {[23, 41].map((x) => (
          <line key={x} x1={x} y1="0" x2={x} y2="600" stroke={INK} strokeOpacity="0.35" strokeWidth="1" vectorEffect="non-scaling-stroke" />
        ))}
        {/* Water alongside. */}
        <path
          d="M10 8 C7 16, 13 24, 10 32 C7 40, 13 48, 10 56 C7 64, 13 72, 10 80"
          fill="none"
          stroke={TRIM}
          strokeOpacity="0.8"
          strokeWidth="1.4"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
        <path
          d="M54 40 C51 48, 57 56, 54 64 C51 72, 57 80, 54 88 C51 96, 57 104, 54 112"
          fill="none"
          stroke={TRIM}
          strokeOpacity="0.8"
          strokeWidth="1.4"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
    </div>
  );
}

/** The stern in profile: hull tapering away, a finned tail, the steering oar. */
function DragonTail() {
  return (
    <svg viewBox="0 0 64 52" className="w-full shrink-0" style={{ aspectRatio: '64 / 52' }}>
      {/* Hull tapering to the sternpost. */}
      <path
        d="M18 0 C19 10, 23 17, 30 21 L34 21 C41 17, 45 10, 46 0 Z"
        fill={BODY}
        stroke={INK}
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <path d="M24 0 C25 7, 27 12, 31 15 L33 15 C37 12, 39 7, 40 0 Z" fill={DECK} stroke={INK} strokeOpacity="0.35" strokeWidth="1" />
      {/* The tail rising off the stern, finned like the head's mane. */}
      <path
        d="M31 20 C30 27, 32 33, 38 37 C36 30, 40 27, 45 27 C41 24, 42 20, 47 18 C42 17, 41 13, 44 9 C38 12, 33 15, 32 20 Z"
        fill={BODY_DEEP}
        stroke={INK}
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      {/* Tail tip flame. */}
      <path d="M38 37 C41 41, 41 45, 38 49 C44 47, 48 42, 47 36 C45 38, 41 38, 38 37 Z" fill={BODY} stroke={INK} strokeWidth="1.4" strokeLinejoin="round" />
      {/* The steering oar, trailing off the port quarter. */}
      <path d="M26 14 L12 34" fill="none" stroke={INK} strokeWidth="2" strokeLinecap="round" />
      <path d="M12 34 C8.5 38, 8.5 43, 12 46 C15 43, 15.5 38, 12 34 Z" fill={BODY} stroke={INK} strokeWidth="1.4" strokeLinejoin="round" />
    </svg>
  );
}

/**
 * The bench between the two seats of a row: number on the deck, and a paddle
 * reaching out toward each occupied card — the boat is rowed by whoever is
 * actually seated.
 */
function BenchCell({
  row,
  leftOccupied,
  rightOccupied,
}: {
  row: number;
  leftOccupied: boolean;
  rightOccupied: boolean;
}) {
  return (
    <div className="relative flex h-11 w-16 shrink-0 items-center justify-center">
      <div
        className="absolute h-[7px] rounded-full"
        style={{ left: 19, right: 19, background: TRIM }}
      />
      {leftOccupied && <Paddle side="left" />}
      {rightOccupied && <Paddle side="right" />}
      <span
        className="tabular relative text-[0.65rem] font-semibold"
        style={{ color: INK }}
      >
        {row}
      </span>
    </div>
  );
}

/**
 * Drawn entirely outboard — from the gunwale out over the water toward the
 * paddler's card — and mirrored with a transform so both sides share one
 * geometry. The first version reached across the deck and came out
 * asymmetric: the left blade hid under the hull while the right one showed.
 */
function Paddle({ side }: { side: Side }) {
  return (
    <svg
      viewBox="0 0 22 14"
      className={cn(
        'pointer-events-none absolute top-1/2 h-4 w-6 -translate-y-1/2 overflow-visible',
        side === 'left' ? 'left-[-5px]' : 'right-[-5px] -scale-x-100',
      )}
      aria-hidden="true"
    >
      <path d="M21 3.5 L8 9.5" stroke={INK} strokeWidth="2.4" strokeLinecap="round" />
      <ellipse
        cx="4.5"
        cy="11"
        rx="5.2"
        ry="3.1"
        transform="rotate(-24 4.5 11)"
        fill={BODY_DEEP}
        stroke={INK}
        strokeWidth="1.2"
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
        <p className="mb-1 mt-2 flex justify-center text-[0.6rem] font-semibold uppercase tracking-widest text-muted">
          {/* A solid pill, or the label is struck through by the hull behind it. */}
          <span className="surface rounded-full border border-subtle px-2 py-0.5">
            {ZONE_LABELS[zone]}
          </span>
        </p>
      )}
      <div className="flex items-stretch gap-1.5">
        {(['left', 'right'] as Side[]).map((side, index) => (
          <div key={side} className="flex flex-1 items-center gap-1.5">
            {index === 1 && (
              <BenchCell
                row={row}
                leftOccupied={Boolean(occupantAt({ row, side: 'left' }))}
                rightOccupied={Boolean(occupantAt({ row, side: 'right' }))}
              />
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
