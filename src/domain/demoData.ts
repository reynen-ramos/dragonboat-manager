import { DEFAULT_CLUB_SETTINGS } from './rules.config';
import type {
  Assignment,
  Availability,
  AvailabilityStatus,
  Gender,
  Member,
  SidePreference,
  Snapshot,
} from './types';

/**
 * A demo club, so the app is worth looking at before anyone has typed in a
 * roster.
 *
 * Everything is fixed rather than randomised: the same demo every time makes
 * screenshots and end-to-end tests reproducible. The crew is deliberately left
 * part-filled so the validation and balance panels have something to say.
 */

interface Seed {
  first: string;
  last: string;
  gender: Gender;
  weightKg: number;
  side: SidePreference;
  drum?: boolean;
  steer?: boolean;
  dob?: string;
}

const SEEDS: Seed[] = [
  { first: 'Maria', last: 'Santos', gender: 'female', weightKg: 58, side: 'left', dob: '1996-03-14' },
  { first: 'Jasmine', last: 'Reyes', gender: 'female', weightKg: 61, side: 'right', dob: '1994-11-02' },
  { first: 'Aileen', last: 'Cruz', gender: 'female', weightKg: 55, side: 'both', dob: '1999-07-21' },
  { first: 'Grace', last: 'Villanueva', gender: 'female', weightKg: 64, side: 'left', dob: '1991-01-30' },
  { first: 'Chloe', last: 'Tan', gender: 'female', weightKg: 57, side: 'right', dob: '2001-05-09' },
  { first: 'Divina', last: 'Ramos', gender: 'female', weightKg: 60, side: 'both', dob: '1988-09-17' },
  { first: 'Karla', last: 'Mendoza', gender: 'female', weightKg: 66, side: 'left', dob: '1993-12-05' },
  { first: 'Bea', last: 'Aquino', gender: 'female', weightKg: 53, side: 'right', dob: '2003-02-28' },
  { first: 'Nadine', last: 'Lim', gender: 'female', weightKg: 59, side: 'both', dob: '1997-06-11' },
  { first: 'Patricia', last: 'Gonzales', gender: 'female', weightKg: 62, side: 'left', dob: '1990-08-23' },
  { first: 'Sofia', last: 'Del Rosario', gender: 'female', weightKg: 56, side: 'right', dob: '2000-10-14' },
  { first: 'Angela', last: 'Bautista', gender: 'female', weightKg: 63, side: 'both', steer: true, dob: '1985-04-07' },
  { first: 'Rhea', last: 'Navarro', gender: 'female', weightKg: 54, side: 'left', drum: true, dob: '1998-11-19' },
  { first: 'Camille', last: 'Ocampo', gender: 'female', weightKg: 58, side: 'right', dob: '1995-03-03' },
  { first: 'Trisha', last: 'Salazar', gender: 'female', weightKg: 60, side: 'both', dob: '1992-07-26' },
  { first: 'Miguel', last: 'Dela Cruz', gender: 'male', weightKg: 82, side: 'left', dob: '1993-02-18' },
  { first: 'Paolo', last: 'Garcia', gender: 'male', weightKg: 88, side: 'right', dob: '1990-05-24' },
  { first: 'Rafael', last: 'Torres', gender: 'male', weightKg: 91, side: 'both', dob: '1989-09-12' },
  { first: 'Enzo', last: 'Fernandez', gender: 'male', weightKg: 79, side: 'left', dob: '1997-01-08' },
  { first: 'Marco', last: 'Rivera', gender: 'male', weightKg: 85, side: 'right', dob: '1994-04-15' },
  { first: 'Diego', last: 'Castillo', gender: 'male', weightKg: 94, side: 'both', dob: '1991-10-30' },
  { first: 'Luis', last: 'Morales', gender: 'male', weightKg: 77, side: 'left', dob: '1999-12-01' },
  { first: 'Javier', last: 'Pascual', gender: 'male', weightKg: 86, side: 'right', dob: '1992-08-09' },
  { first: 'Andres', last: 'Domingo', gender: 'male', weightKg: 90, side: 'both', dob: '1987-06-22' },
  { first: 'Gabriel', last: 'Herrera', gender: 'male', weightKg: 81, side: 'left', dob: '1996-11-13' },
  { first: 'Nico', last: 'Valdez', gender: 'male', weightKg: 83, side: 'right', dob: '1998-03-27' },
  { first: 'Emilio', last: 'Ilagan', gender: 'male', weightKg: 96, side: 'both', dob: '1986-07-04' },
  { first: 'Tomas', last: 'Bacani', gender: 'male', weightKg: 75, side: 'left', dob: '2002-01-16' },
  { first: 'Vincent', last: 'Alonzo', gender: 'male', weightKg: 89, side: 'right', dob: '1993-09-29' },
  { first: 'Rueben', last: 'Sarmiento', gender: 'male', weightKg: 92, side: 'both', steer: true, dob: '1984-05-06' },
  { first: 'Joaquin', last: 'Peralta', gender: 'male', weightKg: 78, side: 'left', dob: '2000-02-11' },
  { first: 'Ramon', last: 'Estrada', gender: 'male', weightKg: 87, side: 'right', drum: true, dob: '1995-10-20' },
  { first: 'Alex', last: 'Quinto', gender: 'other', weightKg: 72, side: 'both', dob: '1998-08-08' },
  { first: 'Sam', last: 'Corpuz', gender: 'other', weightKg: 68, side: 'left', dob: '2001-04-02' },
  { first: 'Iñigo', last: 'Barrera', gender: 'male', weightKg: 84, side: 'right', dob: '1994-12-15' },
  { first: 'Lorraine', last: 'Yap', gender: 'female', weightKg: 57, side: 'both', dob: '1996-06-30' },
];

const memberId = (i: number) => `demo-member-${i + 1}`;

const EVENT_ID = 'demo-event-1';
const MIXED_20_ID = 'demo-category-1';
const WOMEN_10_ID = 'demo-category-2';
const CREW_A_ID = 'demo-crew-1';
const CREW_B_ID = 'demo-crew-2';
const WOMEN_CREW_ID = 'demo-crew-3';

function buildMembers(): Member[] {
  return SEEDS.map((seed, i) => ({
    id: memberId(i),
    firstName: seed.first,
    lastName: seed.last,
    gender: seed.gender,
    dateOfBirth: seed.dob,
    weightKg: seed.weightKg,
    sidePreference: seed.side,
    canDrum: seed.drum ?? false,
    canSteer: seed.steer ?? false,
    status: 'active',
    joinedAt: '2024-01-15',
  }));
}

/**
 * Seats 14 of 20 paddlers in Crew A, all of them on their preferred side.
 *
 * Six seats are left empty and the crew is short of women for a mixed boat, so
 * both the issues panel and the balance bars have something real to show.
 */
function buildAssignments(): Assignment[] {
  const assignments: Assignment[] = [];
  let n = 0;
  const add = (a: Omit<Assignment, 'id'>) =>
    assignments.push({ id: `demo-assignment-${++n}`, ...a });

  // Crew A: rows 1-7, left and right.
  const leftPaddlers = [15, 18, 21, 24, 27, 30, 0]; // indices into SEEDS
  const rightPaddlers = [16, 19, 22, 25, 28, 34, 1];

  leftPaddlers.forEach((seedIndex, row) =>
    add({
      crewId: CREW_A_ID,
      memberId: memberId(seedIndex),
      role: 'paddler',
      seat: { row: row + 1, side: 'left' },
    }),
  );
  rightPaddlers.forEach((seedIndex, row) =>
    add({
      crewId: CREW_A_ID,
      memberId: memberId(seedIndex),
      role: 'paddler',
      seat: { row: row + 1, side: 'right' },
    }),
  );

  add({ crewId: CREW_A_ID, memberId: memberId(12), role: 'drummer' });
  add({ crewId: CREW_A_ID, memberId: memberId(29), role: 'cox' });
  add({ crewId: CREW_A_ID, memberId: memberId(32), role: 'reserve' });
  add({ crewId: CREW_A_ID, memberId: memberId(33), role: 'reserve' });

  // Women's 10s crew: all 10 seats filled, so one crew in the demo is legal.
  const womenLeft = [0, 2, 4, 6, 8];
  const womenRight = [1, 3, 5, 7, 10];
  womenLeft.forEach((seedIndex, row) =>
    add({
      crewId: WOMEN_CREW_ID,
      memberId: memberId(seedIndex),
      role: 'paddler',
      seat: { row: row + 1, side: 'left' },
    }),
  );
  womenRight.forEach((seedIndex, row) =>
    add({
      crewId: WOMEN_CREW_ID,
      memberId: memberId(seedIndex),
      role: 'paddler',
      seat: { row: row + 1, side: 'right' },
    }),
  );
  add({ crewId: WOMEN_CREW_ID, memberId: memberId(12), role: 'drummer' });
  add({ crewId: WOMEN_CREW_ID, memberId: memberId(11), role: 'cox' });

  return assignments;
}

function buildAvailability(): Availability[] {
  const updatedAt = '2026-08-01T09:00:00.000Z';
  const out = new Set([13, 20, 31]);
  const maybe = new Set([5, 17, 26]);

  return SEEDS.map((_, i): Availability => {
    const status: AvailabilityStatus = out.has(i) ? 'out' : maybe.has(i) ? 'maybe' : 'in';
    const entry: Availability = { eventId: EVENT_ID, memberId: memberId(i), status, updatedAt };
    if (status === 'out') entry.note = 'Away that weekend';
    return entry;
  });
}

export function buildDemoSnapshot(): Snapshot {
  return {
    version: 1,
    exportedAt: '2026-08-01T09:00:00.000Z',
    members: buildMembers(),
    events: [
      {
        id: EVENT_ID,
        name: 'Summer Regatta',
        startDate: '2026-09-12',
        endDate: '2026-09-13',
        location: 'Manila Bay',
        type: 'race',
        notes: 'Club championship weekend.',
      },
      {
        id: 'demo-event-2',
        name: 'Saturday Water Session',
        startDate: '2026-08-22',
        location: 'Club dock',
        type: 'practice',
      },
    ],
    categories: [
      {
        id: MIXED_20_ID,
        eventId: EVENT_ID,
        boatSize: 20,
        genderClass: 'mixed',
        distanceM: 500,
      },
      {
        id: WOMEN_10_ID,
        eventId: EVENT_ID,
        boatSize: 10,
        genderClass: 'women',
        distanceM: 200,
      },
    ],
    crews: [
      { id: CREW_A_ID, categoryId: MIXED_20_ID, name: 'A Crew' },
      { id: CREW_B_ID, categoryId: MIXED_20_ID, name: 'B Crew' },
      { id: WOMEN_CREW_ID, categoryId: WOMEN_10_ID, name: 'Women A' },
    ],
    assignments: buildAssignments(),
    availability: buildAvailability(),
    raceEntries: [],
    settings: DEFAULT_CLUB_SETTINGS,
  };
}
