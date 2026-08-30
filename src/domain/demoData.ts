import { todayIso } from './dates';
import { DEFAULT_CLUB_SETTINGS, SNAPSHOT_VERSION } from './rules.config';
import type {
  Assignment,
  AssignmentInput,
  Availability,
  Category,
  ClubEvent,
  Crew,
  Gender,
  Member,
  RaceEntry,
  SeatZone,
  SidePreference,
  Snapshot,
} from './types';

/**
 * A demo club, so the app is worth looking at before anyone has typed in a
 * roster — and so every feature has something to show the moment it opens.
 *
 * The season is anchored to *today* rather than to fixed dates, so it never
 * rots: there is always a finished regatta with results behind you (member
 * history, past race sheets), practices answered and attended, a race running
 * today with timed heats waiting to be advanced, a part-planned championship
 * ahead (issues panel, fill-the-boat, a Plan B to compare), and a qualifier on
 * the horizon. Everything else is fixed rather than randomised, so the same
 * demo loads every time and screenshots stay reproducible.
 */

interface Seed {
  first: string;
  last: string;
  gender: Gender;
  /** Left blank on purpose for some members — missing weights are a state the app must show well. */
  weightKg?: number;
  side: SidePreference;
  drum?: boolean;
  steer?: boolean;
  dob?: string;
  zones?: SeatZone[];
  status?: Member['status'];
  joined?: string;
  email?: string;
  phone?: string;
  notes?: string;
}

const SEEDS: Seed[] = [
  { first: 'Maria', last: 'Santos', gender: 'female', weightKg: 58, side: 'left', dob: '1996-03-14', zones: ['stroke'] },
  { first: 'Jasmine', last: 'Reyes', gender: 'female', weightKg: 61, side: 'right', dob: '1994-11-02', zones: ['stroke'] },
  { first: 'Aileen', last: 'Cruz', gender: 'female', weightKg: 55, side: 'both', dob: '1999-07-21' },
  { first: 'Grace', last: 'Villanueva', gender: 'female', weightKg: 64, side: 'left', dob: '1991-01-30' },
  { first: 'Chloe', last: 'Tan', gender: 'female', weightKg: 57, side: 'right', dob: '2001-05-09' },
  { first: 'Divina', last: 'Ramos', gender: 'female', weightKg: 60, side: 'both', dob: '1988-09-17' },
  { first: 'Karla', last: 'Mendoza', gender: 'female', weightKg: 66, side: 'left', dob: '1993-12-05' },
  { first: 'Bea', last: 'Aquino', gender: 'female', weightKg: 53, side: 'right', dob: '2003-02-28', zones: ['rockets'] },
  { first: 'Nadine', last: 'Lim', gender: 'female', weightKg: 59, side: 'both', dob: '1997-06-11' },
  { first: 'Patricia', last: 'Gonzales', gender: 'female', weightKg: 62, side: 'left', dob: '1990-08-23' },
  { first: 'Sofia', last: 'Del Rosario', gender: 'female', weightKg: 56, side: 'right', dob: '2000-10-14' },
  { first: 'Angela', last: 'Bautista', gender: 'female', weightKg: 63, side: 'both', steer: true, dob: '1985-04-07' },
  { first: 'Rhea', last: 'Navarro', gender: 'female', weightKg: 54, side: 'left', drum: true, dob: '1998-11-19' },
  { first: 'Camille', last: 'Ocampo', gender: 'female', weightKg: 58, side: 'right', dob: '1995-03-03', status: 'alumni' },
  { first: 'Trisha', last: 'Salazar', gender: 'female', weightKg: 60, side: 'both', dob: '1992-07-26' },
  { first: 'Miguel', last: 'Dela Cruz', gender: 'male', weightKg: 82, side: 'left', dob: '1993-02-18' },
  { first: 'Paolo', last: 'Garcia', gender: 'male', weightKg: 88, side: 'right', dob: '1990-05-24' },
  { first: 'Rafael', last: 'Torres', gender: 'male', weightKg: 91, side: 'both', dob: '1989-09-12', zones: ['engine', 'rockets'] },
  { first: 'Enzo', last: 'Fernandez', gender: 'male', weightKg: 79, side: 'left', dob: '1997-01-08' },
  { first: 'Marco', last: 'Rivera', gender: 'male', weightKg: 85, side: 'right', dob: '1994-04-15' },
  { first: 'Diego', last: 'Castillo', gender: 'male', weightKg: 94, side: 'both', dob: '1991-10-30', zones: ['engine'] },
  { first: 'Luis', last: 'Morales', gender: 'male', weightKg: 77, side: 'left', dob: '1999-12-01' },
  { first: 'Javier', last: 'Pascual', gender: 'male', weightKg: 86, side: 'right', dob: '1992-08-09' },
  { first: 'Andres', last: 'Domingo', gender: 'male', weightKg: 90, side: 'both', dob: '1987-06-22' },
  { first: 'Gabriel', last: 'Herrera', gender: 'male', weightKg: 81, side: 'left', dob: '1996-11-13' },
  { first: 'Nico', last: 'Valdez', gender: 'male', weightKg: 83, side: 'right', dob: '1998-03-27' },
  { first: 'Emilio', last: 'Ilagan', gender: 'male', weightKg: 96, side: 'both', dob: '1986-07-04', zones: ['engine'] },
  { first: 'Tomas', last: 'Bacani', gender: 'male', weightKg: 75, side: 'left', dob: '2002-01-16', zones: ['rockets'] },
  { first: 'Vincent', last: 'Alonzo', gender: 'male', weightKg: 89, side: 'right', dob: '1993-09-29' },
  { first: 'Rueben', last: 'Sarmiento', gender: 'male', weightKg: 92, side: 'both', steer: true, dob: '1984-05-06' },
  { first: 'Joaquin', last: 'Peralta', gender: 'male', weightKg: 78, side: 'left', dob: '2000-02-11' },
  { first: 'Ramon', last: 'Estrada', gender: 'male', weightKg: 87, side: 'right', drum: true, dob: '1995-10-20' },
  { first: 'Alex', last: 'Quinto', gender: 'other', weightKg: 72, side: 'both', dob: '1998-08-08' },
  { first: 'Sam', last: 'Corpuz', gender: 'other', weightKg: 68, side: 'left', dob: '2001-04-02' },
  { first: 'Iñigo', last: 'Barrera', gender: 'male', weightKg: 84, side: 'right', dob: '1994-12-15' },
  { first: 'Lorraine', last: 'Yap', gender: 'female', weightKg: 57, side: 'both', dob: '1996-06-30' },
  // --- The wide tail: appended so earlier seed indexes stay stable. --------
  // Veterans for the senior divisions, juniors, missing weights and birth
  // dates, an inactive member and a second alumna, contact details and notes,
  // spare drummers and steers — the roster states the app must handle.
  { first: 'Lourdes', last: 'Abad', gender: 'female', weightKg: 63, side: 'left', steer: true, dob: '1962-05-19', joined: '2018-03-02', email: 'lourdes.abad@example.com', notes: 'Founding member. Steered the first crew the club ever raced.' },
  { first: 'Ernesto', last: 'Buenaventura', gender: 'male', weightKg: 78, side: 'right', drum: true, dob: '1959-11-03', joined: '2019-06-15' },
  { first: 'Corazon', last: 'Dizon', gender: 'female', weightKg: 61, side: 'both', dob: '1974-02-27', zones: ['engine'], joined: '2020-01-20' },
  { first: 'Danilo', last: 'Flores', gender: 'male', weightKg: 88, side: 'left', dob: '1969-08-14', joined: '2021-09-05' },
  { first: 'Katrina', last: 'Uy', gender: 'female', weightKg: 52, side: 'right', dob: '2009-04-22', zones: ['rockets'], joined: '2026-01-10', phone: '+63 917 555 0182', notes: 'Junior — parental consent form on file.' },
  { first: 'Joshua', last: 'Mercado', gender: 'male', weightKg: 74, side: 'both', dob: '2004-07-08', joined: '2025-11-02' },
  { first: 'Bianca', last: 'Roque', gender: 'female', weightKg: 58, side: 'left', dob: '2005-12-30', joined: '2026-02-14' },
  { first: 'Oliver', last: 'Sy', gender: 'male', weightKg: 85, side: 'right', joined: '2025-08-01', notes: 'Birth date not on file yet.' },
  { first: 'Pilar', last: 'Velasco', gender: 'female', side: 'both', dob: '1987-10-05', joined: '2024-05-30', notes: 'Weight not recorded — ask before the next weigh-in.' },
  { first: 'Chester', last: 'Ong', gender: 'male', weightKg: 90, side: 'left', dob: '1992-03-11', status: 'inactive', joined: '2023-04-18', notes: 'On work assignment abroad until December.' },
  { first: 'Margarita', last: 'Salcedo', gender: 'female', weightKg: 65, side: 'right', dob: '1980-06-09', status: 'alumni', joined: '2019-02-22' },
  { first: 'Kiko', last: 'Manalo', gender: 'other', weightKg: 70, side: 'right', drum: true, steer: true, dob: '1997-01-25', joined: '2024-08-09', email: 'kiko.manalo@example.com' },
  { first: 'Teresa', last: 'Lacson', gender: 'female', weightKg: 59, side: 'left', steer: true, dob: '1991-04-17', zones: ['stroke'], joined: '2022-10-12' },
  { first: 'Bong', last: 'Padilla', gender: 'male', weightKg: 102, side: 'both', dob: '1985-09-28', zones: ['engine'], joined: '2023-07-07' },
  // --- The second intake: thirty more, so the club trains at real scale. ----
  { first: 'Ramil', last: 'Agbayani', gender: 'male', weightKg: 86, side: 'right', dob: '1990-07-12', joined: '2025-03-15' },
  { first: 'Cherry', last: 'Alcantara', gender: 'female', weightKg: 57, side: 'left', dob: '1994-03-08', joined: '2025-04-02' },
  { first: 'Dindo', last: 'Balagtas', gender: 'male', weightKg: 88, side: 'both', dob: '1988-11-23', zones: ['engine'], joined: '2024-06-19' },
  { first: 'Maricel', last: 'Buenafe', gender: 'female', weightKg: 60, side: 'right', dob: '1997-05-17', joined: '2025-01-28' },
  { first: 'Jerome', last: 'Cabrera', gender: 'male', weightKg: 80, side: 'left', dob: '1995-09-02', joined: '2024-09-14' },
  { first: 'Liza', last: 'Carandang', gender: 'female', weightKg: 55, side: 'both', dob: '2001-12-11', joined: '2025-06-07' },
  { first: 'Efren', last: 'Datu', gender: 'male', weightKg: 93, side: 'right', dob: '1983-04-26', zones: ['engine'], joined: '2023-11-30' },
  { first: 'Rowena', last: 'Escano', gender: 'female', weightKg: 62, side: 'left', dob: '1992-08-30', joined: '2024-02-25' },
  { first: 'Paulo', last: 'Feliciano', gender: 'male', weightKg: 76, side: 'both', dob: '1999-02-14', zones: ['rockets'], joined: '2025-08-11' },
  { first: 'Mae', last: 'Galang', gender: 'female', weightKg: 58, side: 'right', dob: '2000-06-21', joined: '2025-05-19' },
  { first: 'Nonoy', last: 'Habagat', gender: 'male', weightKg: 84, side: 'left', drum: true, dob: '1991-10-05', joined: '2022-07-23' },
  { first: 'Ivy', last: 'Ignacio', gender: 'female', weightKg: 61, side: 'both', dob: '1996-01-27', joined: '2024-10-06' },
  { first: 'Carding', last: 'Jimenez', gender: 'male', weightKg: 89, side: 'right', dob: '1986-12-09', joined: '2023-05-12' },
  { first: 'Len', last: 'Katigbak', gender: 'female', weightKg: 56, side: 'left', dob: '2003-03-19', joined: '2026-01-17' },
  { first: 'Bobby', last: 'Lazaro', gender: 'male', weightKg: 82, side: 'both', dob: '1993-07-04', joined: '2024-04-08' },
  { first: 'Mika', last: 'Legaspi', gender: 'female', weightKg: 59, side: 'right', steer: true, dob: '1998-04-15', joined: '2023-09-26' },
  { first: 'Ariel', last: 'Magsino', gender: 'male', weightKg: 78, side: 'left', dob: '1997-11-08', joined: '2025-02-13' },
  { first: 'Joy', last: 'Natividad', gender: 'female', weightKg: 63, side: 'both', dob: '1989-05-25', joined: '2022-12-04' },
  { first: 'Omar', last: 'Olivares', gender: 'male', weightKg: 87, side: 'right', dob: '1992-02-17', joined: '2024-08-21' },
  { first: 'Precious', last: 'Panganiban', gender: 'female', weightKg: 54, side: 'left', dob: '2004-08-03', zones: ['rockets'], joined: '2026-02-09' },
  { first: 'Quintin', last: 'Quezon', gender: 'male', weightKg: 91, side: 'both', dob: '1985-06-14', zones: ['engine'], joined: '2023-03-17' },
  { first: 'Ruby', last: 'Rosales', gender: 'female', weightKg: 60, side: 'right', dob: '1995-10-29', joined: '2025-07-30' },
  { first: 'Sandro', last: 'Sison', gender: 'male', weightKg: 79, side: 'left', dob: '2005-01-22', joined: '2026-03-05' },
  { first: 'Tintin', last: 'Trinidad', gender: 'female', weightKg: 57, side: 'both', dob: '2002-09-06', joined: '2025-09-18' },
  { first: 'Uly', last: 'Umali', gender: 'male', weightKg: 85, side: 'right', steer: true, dob: '1987-03-31', joined: '2021-06-29' },
  { first: 'Vicky', last: 'Villamor', gender: 'female', weightKg: 64, side: 'left', dob: '1979-12-18', joined: '2022-04-16' },
  { first: 'Waldo', last: 'Wenceslao', gender: 'male', weightKg: 90, side: 'both', dob: '1990-08-08', status: 'inactive', joined: '2023-08-02', notes: 'Long-haul work rotation until next year.' },
  { first: 'Xandra', last: 'Ximenes', gender: 'female', weightKg: 58, side: 'right', dob: '1996-07-07', status: 'inactive', joined: '2024-11-11' },
  { first: 'Yeng', last: 'Yuzon', gender: 'female', weightKg: 55, side: 'both', dob: '2008-10-12', joined: '2026-04-25', notes: 'Junior — parental consent form on file.' },
  { first: 'Zaldy', last: 'Zabala', gender: 'male', weightKg: 83, side: 'left', drum: true, dob: '1968-04-04', joined: '2020-10-03' },
];

const memberId = (i: number) => `demo-member-${i + 1}`;

/** ISO date arithmetic, UTC-pinned like every stored date in the app. */
const shiftDate = (iso: string, days: number): string => {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};

/** 0 = Sunday … 6 = Saturday, matching getUTCDay. */
const dayOfWeek = (iso: string): number => new Date(`${iso}T00:00:00Z`).getUTCDay();

const lastWeekdayBefore = (today: string, dow: number): string => {
  let d = shiftDate(today, -1);
  while (dayOfWeek(d) !== dow) d = shiftDate(d, -1);
  return d;
};

// --- Ids -----------------------------------------------------------------

const PAST_REGATTA = 'demo-event-past';
const PRACTICE_1 = 'demo-event-practice-1';
const PRACTICE_2 = 'demo-event-practice-2';
const PRACTICE_3 = 'demo-event-practice-3';
const PRACTICE_4 = 'demo-event-practice-4';
const TODAY_RACE = 'demo-event-today';
const UPCOMING = 'demo-event-upcoming';
const FUTURE = 'demo-event-future';
const SOCIAL = 'demo-event-social';

const CAT_PAST_OPEN10 = 'demo-cat-past-open10';
const CAT_PAST_MIXED20 = 'demo-cat-past-mixed20';
const CAT_PRACTICE = 'demo-cat-practice';
const CAT_TODAY_OPEN10 = 'demo-cat-today-open10';
const CAT_UP_MIXED20 = 'demo-cat-up-mixed20';
const CAT_UP_WOMEN10 = 'demo-cat-up-women10';
const CAT_FUTURE_MIXED20 = 'demo-cat-future-mixed20';
const CAT_FUTURE_SENIOR10 = 'demo-cat-future-senior10';

const PAST_A = 'demo-crew-past-a';
const PAST_B = 'demo-crew-past-b';
const PAST_MIXED = 'demo-crew-past-mixed';
const PRACTICE_SQUAD = 'demo-crew-practice';
const TODAY_A = 'demo-crew-today-a';
const TODAY_B = 'demo-crew-today-b';
const CREW_A_ID = 'demo-crew-1';
const CREW_B_ID = 'demo-crew-2';
const CREW_A_PLAN_B = 'demo-crew-1-plan-b';
const WOMEN_CREW_ID = 'demo-crew-3';

// --- Members ---------------------------------------------------------------

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
    preferredZones: seed.zones,
    status: seed.status ?? 'active',
    joinedAt: seed.joined ?? '2024-01-15',
    email: seed.email,
    phone: seed.phone,
    notes: seed.notes,
  }));
}

// --- Lineups ----------------------------------------------------------------

interface LineupSpec {
  crewId: string;
  left: number[];
  right: number[];
  drummer?: number;
  cox?: number;
  reserves?: number[];
}

function buildAssignments(): Assignment[] {
  const assignments: Assignment[] = [];
  let n = 0;
  const add = (a: AssignmentInput) =>
    assignments.push({ id: `demo-assignment-${++n}`, ...a } as Assignment);

  const lineup = ({ crewId, left, right, drummer, cox, reserves }: LineupSpec) => {
    left.forEach((seedIndex, row) =>
      add({ crewId, memberId: memberId(seedIndex), role: 'paddler', seat: { row: row + 1, side: 'left' } }),
    );
    right.forEach((seedIndex, row) =>
      add({ crewId, memberId: memberId(seedIndex), role: 'paddler', seat: { row: row + 1, side: 'right' } }),
    );
    if (drummer !== undefined) add({ crewId, memberId: memberId(drummer), role: 'drummer' });
    if (cox !== undefined) add({ crewId, memberId: memberId(cox), role: 'cox' });
    for (const r of reserves ?? []) add({ crewId, memberId: memberId(r), role: 'reserve' });
  };

  // Past regatta — two full 10s crews that actually raced each other, and a
  // full mixed 20 (10 women, comfortably over the minimum of 8). The same
  // people appear in both categories, which is normal at a regatta and gives
  // member histories more than one line per event.
  lineup({ crewId: PAST_A, left: [15, 18, 21, 24, 27], right: [16, 19, 22, 25, 28], drummer: 31, cox: 29 });
  lineup({ crewId: PAST_B, left: [0, 2, 4, 6, 8], right: [1, 3, 5, 7, 9], drummer: 12, cox: 11 });
  lineup({
    crewId: PAST_MIXED,
    left: [0, 2, 4, 6, 8, 15, 18, 21, 24, 27],
    right: [1, 3, 5, 7, 9, 16, 19, 22, 25, 28],
    drummer: 31,
    cox: 11,
  });

  // A practice with a boat on the water — so practices show up as crewed
  // history, not just as answers. Camille (13) was still active back then.
  lineup({ crewId: PRACTICE_SQUAD, left: [10, 13, 32, 33, 35], right: [17, 20, 23, 26, 34], drummer: 12, cox: 29 });

  // Today's race — heats are in with times, nothing advanced yet.
  lineup({ crewId: TODAY_A, left: [15, 18, 21, 24, 27], right: [16, 19, 22, 25, 28], drummer: 31, cox: 29 });
  lineup({ crewId: TODAY_B, left: [0, 2, 4, 6, 8], right: [1, 3, 5, 7, 9], drummer: 12, cox: 11 });

  // The upcoming championship: Crew A deliberately part-filled and short of
  // women, so the issues panel, the balance bars, and Fill the boat all have
  // something real to do the moment the demo loads.
  lineup({
    crewId: CREW_A_ID,
    left: [15, 18, 21, 24, 27, 30, 0],
    right: [16, 19, 22, 25, 28, 34, 1],
    drummer: 12,
    cox: 29,
    reserves: [32, 33],
  });

  // Plan B for Crew A: Miguel and Luis swap rows, Emilio comes in for Iñigo,
  // and one reserve is not carried — enough for the comparison to say
  // something. Variants never race and never clash, so this shares paddlers
  // with Crew A freely.
  lineup({
    crewId: CREW_A_PLAN_B,
    left: [21, 18, 15, 24, 27, 30, 0],
    right: [16, 19, 22, 25, 28, 26, 1],
    drummer: 12,
    cox: 29,
    reserves: [32],
  });

  // The women's 10 is complete and legal — one crew in the demo should show
  // what "Race ready" looks like.
  // Every paddler on her preferred side — "race ready" must mean it.
  lineup({ crewId: WOMEN_CREW_ID, left: [0, 3, 6, 9, 2], right: [1, 4, 7, 10, 5], drummer: 12, cox: 11 });

  return assignments;
}

// --- Availability ------------------------------------------------------------

interface AnswerSpec {
  in?: number[];
  maybe?: number[];
  out?: [index: number, note?: string][];
}

function answers(eventId: string, updatedAt: string, spec: AnswerSpec): Availability[] {
  const rows: Availability[] = [];
  for (const i of spec.in ?? []) {
    rows.push({ eventId, memberId: memberId(i), status: 'in', updatedAt });
  }
  for (const i of spec.maybe ?? []) {
    rows.push({ eventId, memberId: memberId(i), status: 'maybe', updatedAt });
  }
  for (const [i, note] of spec.out ?? []) {
    rows.push({ eventId, memberId: memberId(i), status: 'out', updatedAt, ...(note ? { note } : {}) });
  }
  return rows;
}

function buildAvailability(today: string): Availability[] {
  const at = (daysAgo: number) => `${shiftDate(today, -daysAgo)}T09:00:00.000Z`;

  return [
    // The finished regatta: nearly everyone answered, and two who said In but
    // were never seated show what "answered, not raced" history looks like.
    ...answers(PAST_REGATTA, at(80), {
      in: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 11, 12, 15, 16, 18, 19, 21, 22, 24, 25, 27, 28, 29, 31, 34, 35, 36, 37],
      out: [[30, 'Shoulder rehab']],
    }),
    ...answers(PRACTICE_1, at(16), {
      in: [0, 1, 2, 4, 5, 6, 7, 8, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 32, 33, 35, 36, 38, 39],
      maybe: [9, 26],
      out: [
        [10, 'Night shift'],
        [30, 'Shoulder rehab'],
      ],
    }),
    ...answers(PRACTICE_2, at(9), {
      in: [0, 1, 2, 10, 13, 15, 16, 17, 20, 23, 26, 29, 32, 33, 34, 35, 12],
      maybe: [21],
      out: [[3, 'Travelling for work']],
    }),
    ...answers(TODAY_RACE, at(2), {
      in: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 11, 12, 15, 16, 18, 19, 21, 22, 24, 25, 27, 28, 29, 31],
      out: [[33, 'Minding the tent']],
    }),
    // The championship: signed up only partway down the roster, so it
    // exercises all three fill tiers (reserves, In, Maybe), the opt-in
    // paddler pool, and the Show-everyone override over the unsigned.
    ...answers(UPCOMING, at(5), {
      in: [0, 1, 2, 3, 4, 6, 7, 8, 9, 10, 11, 12, 14, 15, 16, 18, 19, 21, 22, 23, 24, 25, 27, 36, 37, 40, 48, 49],
      maybe: [5, 17, 26, 41],
      out: [
        [13, 'Moved away'],
        [20, 'Away that weekend'],
        [31, 'Wedding — his own'],
        [44, 'Physio says rest this month'],
      ],
    }),
    ...answers(FUTURE, at(1), { in: [0, 15], maybe: [5] }),
  ];
}

// --- Races -------------------------------------------------------------------

function buildRaceEntries(): RaceEntry[] {
  let n = 0;
  const entry = (crewId: string, stage: RaceEntry['stage'], heat: number, lane: number, timeMs?: number): RaceEntry => ({
    id: `demo-entry-${++n}`,
    crewId,
    stage,
    heat,
    lane,
    timeMs,
  });

  return [
    // The finished regatta reads like a results sheet: a heat, then a final
    // where the B crew nearly closed the gap.
    entry(PAST_A, 'heat', 1, 1, 125_320),
    entry(PAST_B, 'heat', 1, 2, 127_850),
    entry(PAST_A, 'final', 1, 1, 124_910),
    entry(PAST_B, 'final', 1, 2, 126_400),
    entry(PAST_MIXED, 'final', 1, 3, 138_450),

    // Today: the heat is timed and nothing has been advanced — the "Advance
    // from heats" button is live the moment the page opens.
    entry(TODAY_A, 'heat', 1, 2, 68_320),
    entry(TODAY_B, 'heat', 1, 4, 69_450),
  ];
}

// --- The training season -----------------------------------------------------

interface TrainingSeason {
  events: ClubEvent[];
  categories: Category[];
  crews: Crew[];
  assignments: Assignment[];
  availability: Availability[];
}

/**
 * The club's weekly rhythm, generated from New Year's Day up to (but never
 * including) today: water training every Saturday and Sunday, land training
 * every Tuesday and Thursday.
 *
 * Sign-ups are deterministic — a small hash of member index and date decides
 * who said In, Maybe, or Out — so the same pseudo-club turns up on every
 * rebuild and screenshots stay reproducible. Water sessions get one or two
 * ten-seat training boats built from whoever said In (so attendance and
 * bench reports have seatings to count); land sessions are sign-up only, the
 * way a gym night really is.
 */
function buildTrainingSeason(today: string, members: Member[], skip: Set<string>): TrainingSeason {
  const season: TrainingSeason = { events: [], categories: [], crews: [], assignments: [], availability: [] };
  const seasonStart = `${today.slice(0, 4)}-01-01`;
  const activeIds = members.filter((m) => m.status === 'active').map((m) => m.id);
  const hashDay = (iso: string) => Number(iso.slice(5, 7)) * 31 + Number(iso.slice(8, 10));

  for (let d = seasonStart; d < today; d = shiftDate(d, 1)) {
    if (skip.has(d)) continue;
    const dow = dayOfWeek(d);
    const water = dow === 6 || dow === 0;
    const land = dow === 2 || dow === 4;
    if (!water && !land) continue;

    const eventId = `demo-training-${d}`;
    season.events.push({
      id: eventId,
      name: water
        ? dow === 6
          ? 'Saturday Water Session'
          : 'Sunday Water Session'
        : dow === 2
          ? 'Tuesday Land Training'
          : 'Thursday Land Training',
      startDate: d,
      location: water ? 'Club dock' : 'Boathouse gym',
      type: 'practice',
      trainingKind: water ? 'water' : 'land',
    });

    const attending: string[] = [];
    activeIds.forEach((memberId, i) => {
      const h = (i * 7 + hashDay(d) * 13) % 20;
      const status = h < 6 ? 'in' : h === 6 ? 'maybe' : h === 7 ? 'out' : undefined;
      if (!status) return;
      season.availability.push({ eventId, memberId, status, updatedAt: `${d}T09:00:00.000Z` });
      if (status === 'in') attending.push(memberId);
    });

    if (!water) continue;

    // One boat, or two when the dock is busy enough to fill most of both.
    const boats = attending.length >= 14 ? 2 : 1;
    for (let boat = 0; boat < boats; boat++) {
      const paddlers = attending.slice(boat * 10, boat * 10 + 10);
      if (paddlers.length === 0) break;
      const categoryId = `demo-training-cat-${d}-${boat + 1}`;
      const crewId = `demo-training-crew-${d}-${boat + 1}`;
      season.categories.push({ id: categoryId, eventId, boatSize: 10, genderClass: 'open' });
      season.crews.push({ id: crewId, categoryId, name: boats === 1 ? 'Training Boat' : `Boat ${boat + 1}` });
      paddlers.forEach((memberId, j) => {
        season.assignments.push({
          id: `demo-training-a-${d}-${boat + 1}-${j + 1}`,
          crewId,
          memberId,
          role: 'paddler',
          seat: { row: (j % 5) + 1, side: j < 5 ? 'left' : 'right' },
        } as Assignment);
      });
    }
  }

  return season;
}

// --- The snapshot ------------------------------------------------------------

export function buildDemoSnapshot(today: string = todayIso()): Snapshot {
  // The two hand-built practices sit on the club's real weekly grid — the
  // last Saturday water session and the last Tuesday land session — and the
  // generated season skips their dates so no day trains twice.
  const lastSaturday = lastWeekdayBefore(today, 6);
  const lastTuesday = lastWeekdayBefore(today, 2);

  const events: ClubEvent[] = [
    {
      id: PAST_REGATTA,
      name: 'Autumn Sprints',
      startDate: shiftDate(today, -70),
      endDate: shiftDate(today, -69),
      location: 'Manila Bay',
      type: 'race',
      notes: 'Season opener. The B crew surprised everyone in the final.',
    },
    {
      id: PRACTICE_1,
      name: 'Saturday Water Session',
      startDate: lastSaturday,
      location: 'Club dock',
      type: 'practice',
      trainingKind: 'water',
    },
    {
      id: PRACTICE_2,
      name: 'Erg & Technique Night',
      startDate: lastTuesday,
      location: 'Boathouse',
      type: 'practice',
      trainingKind: 'land',
    },
    // Two trainings ahead, so the dashboard's races/trainings split and all
    // three training kinds have something to show.
    {
      id: PRACTICE_3,
      name: 'Evening Water Session',
      startDate: shiftDate(today, 4),
      location: 'Club dock',
      type: 'practice',
      trainingKind: 'water',
    },
    {
      id: PRACTICE_4,
      name: 'Core & Mobility Circuit',
      startDate: shiftDate(today, 6),
      location: 'Boathouse gym',
      type: 'practice',
      trainingKind: 'supplementary',
    },
    {
      id: TODAY_RACE,
      name: 'Harbour Sprint Cup',
      startDate: today,
      location: 'Pasig River',
      type: 'race',
      notes: 'Heats this morning; finals after lunch.',
    },
    {
      id: UPCOMING,
      name: 'Summer Regatta',
      startDate: shiftDate(today, 16),
      endDate: shiftDate(today, 17),
      location: 'Manila Bay',
      type: 'race',
      notes: 'Club championship weekend.',
    },
    {
      id: FUTURE,
      name: 'Nationals Qualifier',
      startDate: shiftDate(today, 60),
      location: 'Boracay',
      type: 'race',
    },
    // One 'other' event so the calendar demonstrates all three colours.
    {
      id: SOCIAL,
      name: 'Clubhouse Fundraiser',
      startDate: shiftDate(today, 9),
      location: 'Boathouse',
      type: 'other',
      notes: 'Raising for the new 10s hull. Bring somebody who has never paddled.',
    },
  ];

  const categories: Category[] = [
    { id: CAT_PAST_OPEN10, eventId: PAST_REGATTA, boatSize: 10, genderClass: 'open', distanceM: 200 },
    { id: CAT_PAST_MIXED20, eventId: PAST_REGATTA, boatSize: 20, genderClass: 'mixed', distanceM: 500 },
    // The squad boat belongs to the water session — a gym night has no hull.
    { id: CAT_PRACTICE, eventId: PRACTICE_1, boatSize: 10, genderClass: 'open' },
    { id: CAT_TODAY_OPEN10, eventId: TODAY_RACE, boatSize: 10, genderClass: 'open', distanceM: 250 },
    { id: CAT_UP_MIXED20, eventId: UPCOMING, boatSize: 20, genderClass: 'mixed', distanceM: 500 },
    { id: CAT_UP_WOMEN10, eventId: UPCOMING, boatSize: 10, genderClass: 'women', distanceM: 200 },
    { id: CAT_FUTURE_MIXED20, eventId: FUTURE, boatSize: 20, genderClass: 'mixed', distanceM: 500 },
    // No crew yet on purpose: an age-division category to build from scratch,
    // now that the roster has enough over-40 paddlers to fill it.
    { id: CAT_FUTURE_SENIOR10, eventId: FUTURE, boatSize: 10, genderClass: 'open', distanceM: 500, ageDivision: 'seniorA' },
  ];

  const crews: Crew[] = [
    { id: PAST_A, categoryId: CAT_PAST_OPEN10, name: 'A Crew' },
    { id: PAST_B, categoryId: CAT_PAST_OPEN10, name: 'B Crew' },
    { id: PAST_MIXED, categoryId: CAT_PAST_MIXED20, name: 'A Crew' },
    { id: PRACTICE_SQUAD, categoryId: CAT_PRACTICE, name: 'Squad' },
    { id: TODAY_A, categoryId: CAT_TODAY_OPEN10, name: 'A Crew' },
    { id: TODAY_B, categoryId: CAT_TODAY_OPEN10, name: 'B Crew' },
    { id: CREW_A_ID, categoryId: CAT_UP_MIXED20, name: 'A Crew' },
    { id: CREW_B_ID, categoryId: CAT_UP_MIXED20, name: 'B Crew' },
    { id: CREW_A_PLAN_B, categoryId: CAT_UP_MIXED20, name: 'A Crew · Plan B', variantOf: CREW_A_ID },
    { id: WOMEN_CREW_ID, categoryId: CAT_UP_WOMEN10, name: 'Women A' },
  ];

  const members = buildMembers();
  const season = buildTrainingSeason(
    today,
    members,
    new Set([today, lastSaturday, lastTuesday]),
  );

  return {
    version: SNAPSHOT_VERSION,
    exportedAt: new Date().toISOString(),
    members,
    events: [...events, ...season.events],
    categories: [...categories, ...season.categories],
    crews: [...crews, ...season.crews],
    assignments: [...buildAssignments(), ...season.assignments],
    availability: [...buildAvailability(today), ...season.availability],
    raceEntries: buildRaceEntries(),
    settings: DEFAULT_CLUB_SETTINGS,
  };
}
