import type {
  Assignment,
  Availability,
  Category,
  ClubEvent,
  Crew,
  Member,
  RaceEntry,
  StoredAssignment,
  TimeTrialResult,
  TimeTrialSession,
} from '@/domain/types';

/**
 * camelCase entities ↔ snake_case rows, one explicit mapper per table.
 *
 * Explicit rather than a generic key camelizer for two reasons: the compiler
 * flags every mapper the moment `types.ts` gains a field (the column tables
 * below are `Record<keyof T, …>`), and two shapes don't mechanically convert
 * at all — an assignment's `seat { row, side }` flattens into two columns,
 * and availability has a composite identity instead of an id.
 *
 * Null discipline: Postgres says `null` where the app says "absent". Rows
 * going in write `null` for every absent optional; rows coming out drop
 * nulls entirely, so a round-tripped entity is `===`-comparable field by
 * field with what was stored. Patches are the subtle case — see `toPatch`.
 */

type Columns<T> = Record<Exclude<keyof T & string, 'id'>, string>;

export interface EntityMapper<T extends { id: string }> {
  table: string;
  column(field: string): string;
  toRow(value: T, clubId: string): Record<string, unknown>;
  /** Only the keys present in the patch; an explicitly-undefined value means "clear". */
  toPatch(patch: Record<string, unknown>): Record<string, unknown>;
  fromRow(row: Record<string, unknown>): T;
}

/** PostgREST serialises `numeric` as a string; the app wants a number. */
const asNumber = (v: unknown): unknown => (v == null ? v : Number(v));

/** Normalises a timestamptz ('…+00:00') back to the app's '…Z' ISO form. */
const asIsoTimestamp = (v: unknown): unknown =>
  v == null ? v : new Date(v as string).toISOString();

function makeMapper<T extends { id: string }>(
  table: string,
  columns: Columns<T>,
  casts: Partial<Record<keyof T & string, (v: unknown) => unknown>> = {},
): EntityMapper<T> {
  const entries = Object.entries(columns) as [keyof T & string, string][];

  return {
    table,

    column(field) {
      if (field === 'id') return 'id';
      const column = (columns as Record<string, string>)[field];
      if (!column) throw new Error(`No column mapping for ${table}.${field}`);
      return column;
    },

    toRow(value, clubId) {
      const row: Record<string, unknown> = { id: value.id, club_id: clubId };
      for (const [field, column] of entries) row[column] = value[field] ?? null;
      return row;
    },

    toPatch(patch) {
      const row: Record<string, unknown> = {};
      // Iterate the patch's own keys: a key that is present with value
      // `undefined` is the app clearing that field (the spread-merge the mock
      // does treats it exactly that way), so it must become an explicit null —
      // supabase-js silently DROPS undefined values, which would turn "clear
      // the race time" into a no-op.
      for (const field of Object.keys(patch)) {
        row[this.column(field)] = patch[field] ?? null;
      }
      return row;
    },

    fromRow(row) {
      const value: Record<string, unknown> = { id: row.id };
      for (const [field, column] of entries) {
        const raw = row[column];
        if (raw == null) continue; // absent optionals stay absent
        const cast = casts[field];
        value[field] = cast ? cast(raw) : raw;
      }
      return value as T;
    },
  };
}

export const memberMapper = makeMapper<Member>(
  'members',
  {
    firstName: 'first_name',
    lastName: 'last_name',
    gender: 'gender',
    dateOfBirth: 'date_of_birth',
    weightKg: 'weight_kg',
    sidePreference: 'side_preference',
    canDrum: 'can_drum',
    canSteer: 'can_steer',
    preferredZones: 'preferred_zones',
    status: 'status',
    email: 'email',
    phone: 'phone',
    emergencyContactName: 'emergency_contact_name',
    emergencyContactPhone: 'emergency_contact_phone',
    notes: 'notes',
    joinedAt: 'joined_at',
  },
  { weightKg: asNumber },
);

export const eventMapper = makeMapper<ClubEvent>('events', {
  name: 'name',
  startDate: 'start_date',
  endDate: 'end_date',
  location: 'location',
  type: 'type',
  trainingKind: 'training_kind',
  notes: 'notes',
});

export const categoryMapper = makeMapper<Category>('categories', {
  eventId: 'event_id',
  boatSize: 'boat_size',
  genderClass: 'gender_class',
  ageDivision: 'age_division',
  distanceM: 'distance_m',
  label: 'label',
});

export const crewMapper = makeMapper<Crew>('crews', {
  categoryId: 'category_id',
  name: 'name',
  notes: 'notes',
  variantOf: 'variant_of',
});

export const raceEntryMapper = makeMapper<RaceEntry>('race_entries', {
  crewId: 'crew_id',
  stage: 'stage',
  heat: 'heat',
  lane: 'lane',
  timeMs: 'time_ms',
  placement: 'placement',
});

export const timeTrialSessionMapper = makeMapper<TimeTrialSession>('time_trial_sessions', {
  date: 'date',
  name: 'name',
  distanceM: 'distance_m',
  discipline: 'discipline',
  notes: 'notes',
});

export const timeTrialResultMapper = makeMapper<TimeTrialResult>('time_trial_results', {
  sessionId: 'session_id',
  memberId: 'member_id',
  timeMs: 'time_ms',
  note: 'note',
});

/**
 * Assignments, fully by hand: `seat { row, side }` lives in two columns, and
 * a patch key of `seat` must fan out to both — including `seat: undefined`
 * clearing both, which is how a paddler becomes a reserve.
 */
export const assignmentMapper: EntityMapper<Assignment> = {
  table: 'assignments',

  column(field) {
    const columns: Record<string, string> = {
      id: 'id',
      crewId: 'crew_id',
      memberId: 'member_id',
      role: 'role',
      pinned: 'pinned',
    };
    const column = columns[field];
    if (!column) throw new Error(`No column mapping for assignments.${field}`);
    return column;
  },

  toRow(value, clubId) {
    const stored = value as StoredAssignment;
    return {
      id: stored.id,
      club_id: clubId,
      crew_id: stored.crewId,
      member_id: stored.memberId,
      role: stored.role,
      seat_row: stored.seat?.row ?? null,
      seat_side: stored.seat?.side ?? null,
      pinned: stored.pinned ?? null,
    };
  },

  toPatch(patch) {
    const row: Record<string, unknown> = {};
    for (const field of Object.keys(patch)) {
      if (field === 'seat') {
        const seat = patch.seat as StoredAssignment['seat'];
        row.seat_row = seat?.row ?? null;
        row.seat_side = seat?.side ?? null;
      } else {
        row[this.column(field)] = patch[field] ?? null;
      }
    }
    return row;
  },

  fromRow(row) {
    const value: StoredAssignment = {
      id: row.id as string,
      crewId: row.crew_id as string,
      memberId: row.member_id as string,
      role: row.role as StoredAssignment['role'],
    };
    if (row.seat_row != null && row.seat_side != null) {
      value.seat = { row: row.seat_row as number, side: row.seat_side as 'left' | 'right' };
    }
    if (row.pinned != null) value.pinned = row.pinned as boolean;
    // The same boundary cast the mock's storage makes: `validateCrew` is what
    // checks the union's invariants on data that has been at rest.
    return value as Assignment;
  },
};

export const availabilityToRow = (a: Availability, clubId: string): Record<string, unknown> => ({
  club_id: clubId,
  event_id: a.eventId,
  member_id: a.memberId,
  status: a.status,
  note: a.note ?? null,
  updated_at: a.updatedAt,
});

export function availabilityFromRow(row: Record<string, unknown>): Availability {
  const value: Availability = {
    eventId: row.event_id as string,
    memberId: row.member_id as string,
    status: row.status as Availability['status'],
    updatedAt: asIsoTimestamp(row.updated_at) as string,
  };
  if (row.note != null) value.note = row.note as string;
  return value;
}
