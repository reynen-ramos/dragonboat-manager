import { eventBase } from './eventTypes';
import { groupKey, groupLabel, raceCountsByStage, rankEntries } from './results';
import { ageOn } from './dates';
import type {
  Availability,
  AvailabilityStatus,
  Category,
  ClubEvent,
  Crew,
  EventTypeDef,
  Member,
  RaceEntry,
  RaceStage,
  StoredAssignment,
} from './types';

/**
 * Club-wide reports, read back out of the collections the app already keeps.
 *
 * Each builder is pure and takes only the collections it reads; the page
 * assembles one superset input object and structural typing does the rest.
 *
 * Range semantics: `from <= (endDate ?? startDate) <= to`, both ends
 * inclusive. This deliberately diverges from memberHistory's strictly-past
 * cut: a report run on race evening must include today's regatta. Events are
 * split into races and trainings by the *behaviour* of their type
 * (`eventBase`), never the raw id, and 'other'-base events count nowhere.
 *
 * Shared exclusions, matching buildMemberHistory: variant crews (Plan B
 * drafts) never count, "seated" means holding a non-reserve role, and any
 * assignment whose crew → category → event chain is broken is skipped the
 * way the lineup view skips it.
 */

export interface DateRange {
  /** ISO dates, inclusive on both ends. */
  from: string;
  to: string;
}

const inRange = (event: ClubEvent, range: DateRange): boolean => {
  const effective = event.endDate ?? event.startDate;
  return range.from <= effective && effective <= range.to;
};

/** memberId → what they hold at the event: a real seat, or only a reserve row. */
type EventParticipation = Map<string, { seated: boolean; reserve: boolean }>;

function participationByEvent(input: {
  categories: Category[];
  crews: Crew[];
  assignments: StoredAssignment[];
}): Map<string, EventParticipation> {
  const categoriesById = new Map(input.categories.map((c) => [c.id, c]));
  const crewsById = new Map(input.crews.map((c) => [c.id, c]));

  const byEvent = new Map<string, EventParticipation>();
  for (const assignment of input.assignments) {
    const crew = crewsById.get(assignment.crewId);
    if (!crew || crew.variantOf) continue;
    const category = categoriesById.get(crew.categoryId);
    if (!category) continue;

    const forEvent = byEvent.get(category.eventId) ?? new Map();
    const held = forEvent.get(assignment.memberId) ?? { seated: false, reserve: false };
    if (assignment.role === 'reserve') held.reserve = true;
    else held.seated = true;
    forEvent.set(assignment.memberId, held);
    byEvent.set(category.eventId, forEvent);
  }
  return byEvent;
}

const availabilityIndex = (rows: Availability[]): Map<string, Map<string, AvailabilityStatus>> => {
  const byEvent = new Map<string, Map<string, AvailabilityStatus>>();
  for (const row of rows) {
    const forEvent = byEvent.get(row.eventId) ?? new Map<string, AvailabilityStatus>();
    forEvent.set(row.memberId, row.status);
    byEvent.set(row.eventId, forEvent);
  }
  return byEvent;
};

const byName = (a: Member, b: Member): number =>
  a.lastName.localeCompare(b.lastName) || a.firstName.localeCompare(b.firstName);

// --- Attendance --------------------------------------------------------------

export interface AttendanceCounts {
  saidIn: number;
  saidMaybe: number;
  saidOut: number;
  unanswered: number;
  seated: number;
}

export interface AttendanceRow {
  member: Member;
  trainings: AttendanceCounts;
  races: AttendanceCounts;
}

export interface AttendanceReport {
  trainingCount: number;
  raceCount: number;
  rows: AttendanceRow[];
}

export interface AttendanceInput {
  range: DateRange;
  members: Member[];
  events: ClubEvent[];
  categories: Category[];
  crews: Crew[];
  assignments: StoredAssignment[];
  availability: Availability[];
  eventTypes: EventTypeDef[];
}

export function buildAttendanceReport(input: AttendanceInput): AttendanceReport {
  const ranged = input.events.filter((e) => inRange(e, input.range));
  const trainings = ranged.filter((e) => eventBase(e.type, input.eventTypes) === 'practice');
  const races = ranged.filter((e) => eventBase(e.type, input.eventTypes) === 'race');

  const participation = participationByEvent(input);
  const answers = availabilityIndex(input.availability);

  const countsFor = (member: Member, events: ClubEvent[]): AttendanceCounts => {
    const counts: AttendanceCounts = { saidIn: 0, saidMaybe: 0, saidOut: 0, unanswered: 0, seated: 0 };
    for (const event of events) {
      const status = answers.get(event.id)?.get(member.id);
      if (status === 'in') counts.saidIn++;
      else if (status === 'maybe') counts.saidMaybe++;
      else if (status === 'out') counts.saidOut++;
      else counts.unanswered++;
      if (participation.get(event.id)?.get(member.id)?.seated) counts.seated++;
    }
    return counts;
  };

  return {
    trainingCount: trainings.length,
    raceCount: races.length,
    rows: [...input.members].sort(byName).map((member) => ({
      member,
      trainings: countsFor(member, trainings),
      races: countsFor(member, races),
    })),
  };
}

// --- Season results ----------------------------------------------------------

export interface ResultsRow {
  crew: Crew;
  lane?: number;
  placement?: number;
  timeMs?: number;
  deltaMs?: number;
}

export interface ResultsGroup {
  label: string;
  rows: ResultsRow[];
}

export interface ResultsCategoryBlock {
  category: Category;
  groups: ResultsGroup[];
}

export interface ResultsEventBlock {
  event: ClubEvent;
  categories: ResultsCategoryBlock[];
}

export interface ResultsReport {
  eventCount: number;
  raceCount: number;
  entryCount: number;
  events: ResultsEventBlock[];
}

export interface ResultsInput {
  range: DateRange;
  events: ClubEvent[];
  categories: Category[];
  crews: Crew[];
  raceEntries: RaceEntry[];
  eventTypes: EventTypeDef[];
}

const STAGE_ORDER: RaceStage[] = ['heat', 'semi', 'final'];

export function buildResultsReport(input: ResultsInput): ResultsReport {
  const raceEvents = input.events
    .filter((e) => inRange(e, input.range) && eventBase(e.type, input.eventTypes) === 'race')
    .sort((a, b) => a.startDate.localeCompare(b.startDate) || a.name.localeCompare(b.name));

  const crewsById = new Map(input.crews.map((c) => [c.id, c]));
  // Entries whose crew is missing or a Plan B variant are dropped up front —
  // variants should never hold entries, but a report must not trust that.
  const usable = input.raceEntries.filter((entry) => {
    const crew = crewsById.get(entry.crewId);
    return Boolean(crew && !crew.variantOf);
  });
  const entriesByCategory = new Map<string, RaceEntry[]>();
  for (const entry of usable) {
    const categoryId = crewsById.get(entry.crewId)!.categoryId;
    entriesByCategory.set(categoryId, [...(entriesByCategory.get(categoryId) ?? []), entry]);
  }

  let raceCount = 0;
  let entryCount = 0;

  const eventBlocks: ResultsEventBlock[] = [];
  for (const event of raceEvents) {
    const categoryBlocks: ResultsCategoryBlock[] = [];
    for (const category of input.categories.filter((c) => c.eventId === event.id)) {
      const entries = entriesByCategory.get(category.id) ?? [];
      if (entries.length === 0) continue;

      // Rank within this one category — rankEntries must never see two
      // categories' "Heat 1" together.
      const ranked = rankEntries(entries);
      const counts = raceCountsByStage(entries);

      const groupsByKey = new Map<string, ResultsGroup & { stage: RaceStage; heat: number }>();
      for (const { entry, placement, deltaMs } of ranked) {
        const key = groupKey(entry);
        const group =
          groupsByKey.get(key) ??
          {
            label: groupLabel(entry.stage, entry.heat, counts[entry.stage]),
            rows: [],
            stage: entry.stage,
            heat: entry.heat ?? 1,
          };
        group.rows.push({
          crew: crewsById.get(entry.crewId)!,
          lane: entry.lane,
          placement,
          timeMs: entry.timeMs,
          deltaMs,
        });
        groupsByKey.set(key, group);
      }

      const groups = [...groupsByKey.values()]
        .sort(
          (a, b) =>
            STAGE_ORDER.indexOf(a.stage) - STAGE_ORDER.indexOf(b.stage) || a.heat - b.heat,
        )
        .map(({ label, rows }) => ({ label, rows }));

      raceCount += groups.length;
      entryCount += entries.length;
      categoryBlocks.push({ category, groups });
    }
    if (categoryBlocks.length > 0) eventBlocks.push({ event, categories: categoryBlocks });
  }

  return { eventCount: eventBlocks.length, raceCount, entryCount, events: eventBlocks };
}

// --- Roster composition ------------------------------------------------------

export interface CompositionBucket {
  key: string;
  label: string;
  count: number;
}

export interface CompositionReport {
  total: number;
  status: CompositionBucket[];
  gender: CompositionBucket[];
  ageBands: CompositionBucket[];
  sides: CompositionBucket[];
  weightBands: CompositionBucket[];
  /** Mutually exclusive, so the four sum to `total`. */
  officials: { canDrum: number; canSteer: number; both: number; neither: number };
}

/**
 * Aligned to the age divisions crews are actually entered in.
 * All bands are half-open [min, max).
 */
const AGE_BANDS: { key: string; label: string; min: number; max: number }[] = [
  { key: 'junior', label: 'Junior (18 and under)', min: 0, max: 19 },
  { key: 'u24', label: 'U24 (19–23)', min: 19, max: 24 },
  { key: 'premier', label: 'Premier (24–39)', min: 24, max: 40 },
  { key: '40s', label: '40–49', min: 40, max: 50 },
  { key: '50s', label: '50–59', min: 50, max: 60 },
  { key: '60plus', label: '60 and over', min: 60, max: Infinity },
];

// Upper bounds exclusive: a 59.5kg paddler belongs under 60, not nowhere.
const WEIGHT_BANDS: { key: string; label: string; min: number; max: number }[] = [
  { key: 'under60', label: 'Under 60kg', min: 0, max: 60 },
  { key: '60s', label: '60–69kg', min: 60, max: 70 },
  { key: '70s', label: '70–79kg', min: 70, max: 80 },
  { key: '80s', label: '80–89kg', min: 80, max: 90 },
  { key: '90plus', label: '90kg and over', min: 90, max: Infinity },
];

export function buildCompositionReport(input: { today: string; members: Member[] }): CompositionReport {
  const { members, today } = input;

  const bucketise = <T extends { key: string; label: string }>(
    defs: T[],
    pick: (m: Member) => string | undefined,
  ): CompositionBucket[] => {
    const counts = new Map<string, number>(defs.map((d) => [d.key, 0]));
    let unknown = 0;
    for (const member of members) {
      const key = pick(member);
      if (key === undefined) unknown++;
      else counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    const buckets = defs.map((d) => ({ key: d.key, label: d.label, count: counts.get(d.key) ?? 0 }));
    return [...buckets, { key: 'unknown', label: 'Unknown', count: unknown }];
  };

  const band = (defs: typeof AGE_BANDS, value: number | undefined): string | undefined =>
    value == null ? undefined : defs.find((d) => value >= d.min && value < d.max)?.key;

  const statusDefs = [
    { key: 'active', label: 'Active' },
    { key: 'inactive', label: 'Inactive' },
    { key: 'alumni', label: 'Alumni' },
  ];
  const genderDefs = [
    { key: 'female', label: 'Female' },
    { key: 'male', label: 'Male' },
    { key: 'other', label: 'Other' },
  ];
  const sideDefs = [
    { key: 'left', label: 'Left only' },
    { key: 'right', label: 'Right only' },
    { key: 'both', label: 'Either side' },
  ];

  const officials = { canDrum: 0, canSteer: 0, both: 0, neither: 0 };
  for (const member of members) {
    if (member.canDrum && member.canSteer) officials.both++;
    else if (member.canDrum) officials.canDrum++;
    else if (member.canSteer) officials.canSteer++;
    else officials.neither++;
  }

  // Status, gender, and side are total on every member, so no Unknown bucket.
  const dropUnknown = (buckets: CompositionBucket[]) => buckets.filter((b) => b.key !== 'unknown');

  return {
    total: members.length,
    status: dropUnknown(bucketise(statusDefs, (m) => m.status)),
    gender: dropUnknown(bucketise(genderDefs, (m) => m.gender)),
    ageBands: bucketise(AGE_BANDS, (m) =>
      band(AGE_BANDS, m.dateOfBirth ? ageOn(m.dateOfBirth, today) : undefined),
    ),
    sides: dropUnknown(bucketise(sideDefs, (m) => m.sidePreference)),
    weightBands: bucketise(WEIGHT_BANDS, (m) => band(WEIGHT_BANDS, m.weightKg)),
    officials,
  };
}

// --- Bench -------------------------------------------------------------------

export interface BenchRow {
  member: Member;
  saidIn: number;
  seated: number;
  benched: number;
  benchedEvents: { event: ClubEvent; reserveOnly: boolean }[];
}

export interface BenchReport {
  /** Events that could bench anyone: in range, race/training base, lineup built. */
  consideredEvents: number;
  /** Members who said In at least once and were seated every time. */
  fullySeatedCount: number;
  rows: BenchRow[];
}

export interface BenchInput {
  range: DateRange;
  members: Member[];
  events: ClubEvent[];
  categories: Category[];
  crews: Crew[];
  assignments: StoredAssignment[];
  availability: Availability[];
  eventTypes: EventTypeDef[];
}

export function buildBenchReport(input: BenchInput): BenchReport {
  const participation = participationByEvent(input);
  // An event with no lineup at all benches nobody — a training where no boat
  // was ever built is not sixteen people passed over.
  const considered = input.events.filter((event) => {
    const base = eventBase(event.type, input.eventTypes);
    if (base === 'other' || !inRange(event, input.range)) return false;
    const atEvent = participation.get(event.id);
    return Boolean(atEvent && [...atEvent.values()].some((p) => p.seated));
  });
  const answers = availabilityIndex(input.availability);

  const rows: BenchRow[] = [];
  let fullySeatedCount = 0;

  for (const member of [...input.members].sort(byName)) {
    let saidIn = 0;
    let seated = 0;
    const benchedEvents: BenchRow['benchedEvents'] = [];

    for (const event of considered) {
      if (answers.get(event.id)?.get(member.id) !== 'in') continue;
      saidIn++;
      const held = participation.get(event.id)?.get(member.id);
      if (held?.seated) seated++;
      else benchedEvents.push({ event, reserveOnly: Boolean(held?.reserve) });
    }

    if (benchedEvents.length > 0) {
      rows.push({ member, saidIn, seated, benched: benchedEvents.length, benchedEvents });
    } else if (saidIn > 0) {
      fullySeatedCount++;
    }
  }

  rows.sort((a, b) => b.benched - a.benched || byName(a.member, b.member));
  return { consideredEvents: considered.length, fullySeatedCount, rows };
}
