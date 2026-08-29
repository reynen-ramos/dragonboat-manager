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

/**
 * The bow: the hull tapering to its prow, with the dragon head mounted on it
 * in profile. Composed from separate primitives — jaws, teeth, eye, horn,
 * mane — rather than one outline path; organic shapes drawn as a single
 * freehand path came out wobbly, and separate pieces can each be placed and
 * judged on their own.
 */
function DragonHead() {
  return (
    <svg
      viewBox="0 0 64 74"
      className="w-full shrink-0 overflow-visible"
      style={{ aspectRatio: '64 / 74' }}
    >
      {/* Bow: the hull sides converging on the prow. */}
      <path
        d="M18 74 C18 58, 22 46, 30 38 L34 38 C42 46, 46 58, 46 74 Z"
        fill={BODY}
        stroke={INK}
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <path
        d="M23 74 C23 60, 26 50, 31 44 L33 44 C38 50, 41 60, 41 74 Z"
        fill={DECK}
        stroke={INK}
        strokeOpacity="0.35"
        strokeWidth="1"
      />
      {/* Neck: a stout post from the prow up to the skull. */}
      <path
        d="M27 42 L26 26 L38 26 L37 42 Z"
        fill={BODY}
        stroke={INK}
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      {/* Mane: spikes off the back of the neck and skull. */}
      <path
        d="M38 27 L46 24 L39 32 L46 33 L38 38 Z"
        fill={BODY_DEEP}
        stroke={INK}
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
      {/* Lower jaw, open. */}
      <path
        d="M28 24 L12 27 C9 27.5, 9 30.5, 12 30.5 L26 29 Z"
        fill={BODY_DEEP}
        stroke={INK}
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      {/* Mouth interior. */}
      <path d="M28 20 L10 24 L13 28 L28 24 Z" fill={DECK} />
      {/* Skull and upper jaw: a long snout, slightly upturned at the tip. */}
      <path
        d="M40 26 C43 20, 43 12, 38 8 C34 5, 26 4.5, 20 7 L8 12 C6 13, 6 15.5, 8 16.5 L12 18.5 L26 22 C32 24, 37 25.5, 40 26 Z"
        fill={BODY}
        stroke={INK}
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      {/* Teeth along the upper jaw. */}
      <path
        d="M13 18 L14.5 21.5 L17 19 Z M19 20 L20.5 23.5 L23 21 Z"
        fill="white"
        stroke={INK}
        strokeWidth="0.7"
        strokeLinejoin="round"
      />
      {/* One fang on the lower jaw. */}
      <path d="M16 27 L17.5 24 L19.5 27 Z" fill="white" stroke={INK} strokeWidth="0.7" strokeLinejoin="round" />
      {/* Nose curl at the snout tip. */}
      <path d="M9 11 C6 9.5, 3.5 10.5, 3 13" fill="none" stroke={INK} strokeWidth="1.5" strokeLinecap="round" />
      {/* Whisker trailing from the jaw. */}
      <path d="M10 29 C6 31, 4.5 34.5, 6.5 37.5" fill="none" stroke={INK} strokeWidth="1.2" strokeLinecap="round" />
      {/* Horns, swept back off the skull. */}
      <path
        d="M33 7 L38 -2 C39 -3.5, 41 -3, 41 -1 L40 8 Z"
        fill={DECK}
        stroke={INK}
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
      <path
        d="M39 10 L47 4 C48.5 3, 50 4.5, 49 6 L42 14 Z"
        fill={DECK}
        stroke={INK}
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
      {/* Eye, watching the course. */}
      <circle cx="31" cy="13.5" r="3.4" fill="white" stroke={INK} strokeWidth="1.3" />
      <circle cx="30.2" cy="14" r="1.6" fill={INK} />
      <circle cx="31.1" cy="12.9" r="0.6" fill="white" />
      {/* Brow ridge. */}
      <path d="M26 9.5 C28.5 8, 32 8, 34.5 9.5" fill="none" stroke={INK} strokeWidth="1.4" strokeLinecap="round" />
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

/**
 * The stern: hull tapering to the sternpost, the tail rising off it as a
 * clean S-curve ending in a three-lobed fluke, and the steering oar to port.
 * Same discipline as the head: separate simple pieces, not one outline.
 */
function DragonTail() {
  return (
    <svg
      viewBox="0 0 64 62"
      className="w-full shrink-0 overflow-visible"
      style={{ aspectRatio: '64 / 62' }}
    >
      {/* Stern: the hull sides converging on the sternpost. */}
      <path
        d="M18 0 C18 14, 22 24, 30 30 L34 30 C42 24, 46 14, 46 0 Z"
        fill={BODY}
        stroke={INK}
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <path
        d="M23 0 C23 12, 26 20, 31 25 L33 25 C38 20, 41 12, 41 0 Z"
        fill={DECK}
        stroke={INK}
        strokeOpacity="0.35"
        strokeWidth="1"
      />
      {/* The tail: one thick S-curve, thinning as it rises. */}
      <path
        d="M30 29 C28 36, 30 42, 36 46 C42 50, 44 54, 42 58 L46 56 C49 52, 47 46, 41 42 C36 38.5, 34 34, 35 29 Z"
        fill={BODY_DEEP}
        stroke={INK}
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      {/* The fluke: three lobes fanning from the tail tip. */}
      <path
        d="M43 57 L52 50 C53.5 49, 55 50.5, 54 52 L48 60 Z"
        fill={BODY}
        stroke={INK}
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
      <path
        d="M44 59 L55 57 C56.5 57, 56.5 59.5, 55 60 L45 62 Z"
        fill={BODY}
        stroke={INK}
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
      <path
        d="M42 60 L48 66 C49 67.5, 47 69, 45.5 68 L39 62 Z"
        fill={BODY}
        stroke={INK}
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
      {/* The steering oar, trailing to port. */}
      <path d="M27 22 L13 42" fill="none" stroke={INK} strokeWidth="2.4" strokeLinecap="round" />
      <path
        d="M13 42 C9.5 46, 9.5 52, 13 55 C16.5 52, 16.5 46, 13 42 Z"
        fill={BODY}
        stroke={INK}
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
      {/* Wake off the sternpost. */}
      <path
        d="M24 34 C28 36.5, 36 36.5, 40 34 M27 39 C30 41, 34 41, 37 39"
        fill="none"
        stroke={TRIM}
        strokeWidth="1.4"
        strokeLinecap="round"
      />
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
