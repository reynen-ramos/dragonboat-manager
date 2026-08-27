import { todayIso } from '@/domain/dates';
import type { Gender, Member, MemberStatus, SidePreference } from '@/domain/types';
import { parseCsvDate } from './csvDate';
import { parseCsvRows } from './parseCsvRows';

export { parseCsv, parseCsvRows, type CsvRow } from './parseCsvRows';

/**
 * CSV import and export for the club roster.
 *
 * Every club already keeps its roster in a spreadsheet, so import is the main
 * way real data gets in. Header matching is deliberately forgiving — case,
 * spaces, and underscores are ignored, and each field accepts the several names
 * a club might plausibly have used.
 */

export const CSV_COLUMNS = [
  'firstName',
  'lastName',
  'gender',
  'dateOfBirth',
  'weightKg',
  'sidePreference',
  'canDrum',
  'canSteer',
  'status',
  'email',
  'phone',
  'emergencyContactName',
  'emergencyContactPhone',
  'notes',
] as const;

const HEADER_ALIASES: Record<string, (typeof CSV_COLUMNS)[number]> = {
  firstname: 'firstName',
  first: 'firstName',
  givenname: 'firstName',
  lastname: 'lastName',
  last: 'lastName',
  surname: 'lastName',
  familyname: 'lastName',
  gender: 'gender',
  sex: 'gender',
  dateofbirth: 'dateOfBirth',
  dob: 'dateOfBirth',
  birthdate: 'dateOfBirth',
  weightkg: 'weightKg',
  weight: 'weightKg',
  kg: 'weightKg',
  sidepreference: 'sidePreference',
  side: 'sidePreference',
  paddlingside: 'sidePreference',
  candrum: 'canDrum',
  drummer: 'canDrum',
  cansteer: 'canSteer',
  steer: 'canSteer',
  cox: 'canSteer',
  coxswain: 'canSteer',
  status: 'status',
  email: 'email',
  emailaddress: 'email',
  phone: 'phone',
  mobile: 'phone',
  contactnumber: 'phone',
  emergencycontactname: 'emergencyContactName',
  emergencycontact: 'emergencyContactName',
  emergencycontactphone: 'emergencyContactPhone',
  emergencyphone: 'emergencyContactPhone',
  notes: 'notes',
  comments: 'notes',
};

const normaliseHeader = (header: string) => header.toLowerCase().replace(/[\s_-]/g, '');

const parseBoolean = (raw: string): boolean =>
  ['yes', 'y', 'true', '1', 'x'].includes(raw.trim().toLowerCase());

function parseGender(raw: string): Gender {
  const value = raw.trim().toLowerCase();
  if (['f', 'female', 'w', 'woman'].includes(value)) return 'female';
  if (['m', 'male', 'man'].includes(value)) return 'male';
  return 'other';
}

function parseSide(raw: string): SidePreference {
  const value = raw.trim().toLowerCase();
  if (value.startsWith('l') || value.startsWith('p')) return 'left'; // left / port
  if (value.startsWith('r') || value.startsWith('s')) return 'right'; // right / starboard
  return 'both';
}

function parseStatus(raw: string): MemberStatus {
  const value = raw.trim().toLowerCase();
  if (value.startsWith('inact')) return 'inactive';
  if (value.startsWith('alum')) return 'alumni';
  return 'active';
}

export interface CsvImportResult {
  members: Omit<Member, 'id'>[];
  /** Headers that matched nothing, so the user can see what was ignored. */
  unmatchedHeaders: string[];
  /** Rows that could not be imported at all. */
  errors: { row: number; message: string }[];
  /**
   * Rows that were imported with something dropped, plus file-level notes.
   *
   * Separate from `errors` because the two need different words: the import
   * dialog counts errors as "rows skipped", and saying that about a member who
   * was imported without their date of birth would be a lie.
   */
  warnings: { row?: number; message: string }[];
}

export function parseMembersCsv(text: string, today = todayIso()): CsvImportResult {
  const rows = parseCsvRows(text);
  const result: CsvImportResult = {
    members: [],
    unmatchedHeaders: [],
    errors: [],
    warnings: [],
  };
  if (rows.length === 0) return result;

  const [headerRow, ...dataRows] = rows;
  const columnFor = headerRow.cells.map((header) => {
    const match = HEADER_ALIASES[normaliseHeader(header)];
    if (!match && header.trim()) result.unmatchedHeaders.push(header.trim());
    return match;
  });

  if (!columnFor.includes('firstName') && !columnFor.includes('lastName')) {
    result.errors.push({
      row: headerRow.line,
      message: 'No name column found - expected "First name".',
    });
    return result;
  }

  // A missing gender column used to make the whole roster 'other' in silence.
  // Nothing downstream reports it either: 'other' satisfies neither the
  // women's class nor the mixed-crew minimum, so every crew built from such an
  // import fails validation with nothing pointing back at the import.
  if (!columnFor.includes('gender')) {
    result.warnings.push({
      message:
        "No gender column found, so everyone was imported as 'other'. " +
        "Mixed and women's crew checks cannot pass until this is set.",
    });
  }

  dataRows.forEach((row) => {
    const cells: Partial<Record<(typeof CSV_COLUMNS)[number], string>> = {};
    columnFor.forEach((column, i) => {
      if (column) cells[column] = row.cells[i] ?? '';
    });

    const firstName = (cells.firstName ?? '').trim();
    const lastName = (cells.lastName ?? '').trim();
    if (!firstName && !lastName) {
      result.errors.push({ row: row.line, message: 'Skipped - no name.' });
      return;
    }

    const weight = Number.parseFloat((cells.weightKg ?? '').trim());
    const member: Omit<Member, 'id'> = {
      firstName,
      lastName,
      gender: cells.gender ? parseGender(cells.gender) : 'other',
      sidePreference: cells.sidePreference ? parseSide(cells.sidePreference) : 'both',
      canDrum: parseBoolean(cells.canDrum ?? ''),
      canSteer: parseBoolean(cells.canSteer ?? ''),
      status: cells.status ? parseStatus(cells.status) : 'active',
    };

    if (Number.isFinite(weight) && weight > 0) member.weightKg = weight;

    if (cells.dateOfBirth?.trim()) {
      const parsed = parseCsvDate(cells.dateOfBirth, today);
      if (parsed.ok) {
        member.dateOfBirth = parsed.date;
      } else {
        // The member is still worth importing; the age checks are what break.
        result.warnings.push({
          row: row.line,
          message: `Date of birth ${parsed.reason} - imported without it, so age divisions will not be checked.`,
        });
      }
    }

    if (cells.email?.trim()) member.email = cells.email.trim();
    if (cells.phone?.trim()) member.phone = cells.phone.trim();
    if (cells.emergencyContactName?.trim())
      member.emergencyContactName = cells.emergencyContactName.trim();
    if (cells.emergencyContactPhone?.trim())
      member.emergencyContactPhone = cells.emergencyContactPhone.trim();
    if (cells.notes?.trim()) member.notes = cells.notes.trim();

    result.members.push(member);
  });

  return result;
}


/**
 * A cell a spreadsheet will read back as text, not as a command.
 *
 * Excel, Sheets and LibreOffice all treat a leading =, +, -, @, tab or CR as
 * the start of a formula, so an exported `notes` field is a way to run
 * something on the machine of whoever opens the file. Prefixing an apostrophe
 * is the standard neutralisation.
 *
 * Genuine numbers are left alone: "-5" is a weight, not an attack, and
 * quoting it would break the round trip back into the app.
 */
const RISKY_PREFIX = /^[=+\-@\t\r]/;

const escapeCell = (value: unknown): string => {
  let text = value == null ? '' : String(value);
  if (RISKY_PREFIX.test(text) && !Number.isFinite(Number(text))) {
    text = `'${text}`;
  }
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

export function membersToCsv(members: Member[]): string {
  const header = CSV_COLUMNS.join(',');
  const rows = members.map((member) =>
    CSV_COLUMNS.map((column) => {
      const value = member[column];
      if (typeof value === 'boolean') return value ? 'yes' : 'no';
      return escapeCell(value);
    }).join(','),
  );

  // BOM and CRLF: without them Excel on Windows reads UTF-8 as the local
  // codepage, so the accented names already in the demo roster come back
  // mangled by a plain export-then-reopen.
  return `\ufeff${[header, ...rows].join('\r\n')}\r\n`;
}
