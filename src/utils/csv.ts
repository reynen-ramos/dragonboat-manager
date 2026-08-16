import type { Gender, Member, MemberStatus, SidePreference } from '@/domain/types';

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

/** Minimal RFC 4180 parser: handles quoted fields, escaped quotes, and CRLF. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let value = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];

    if (inQuotes) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          value += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        value += char;
      }
      continue;
    }

    if (char === '"') inQuotes = true;
    else if (char === ',') {
      row.push(value);
      value = '';
    } else if (char === '\n' || char === '\r') {
      if (char === '\r' && text[i + 1] === '\n') i++;
      row.push(value);
      rows.push(row);
      row = [];
      value = '';
    } else {
      value += char;
    }
  }

  if (value !== '' || row.length > 0) {
    row.push(value);
    rows.push(row);
  }

  return rows.filter((r) => r.some((cell) => cell.trim() !== ''));
}

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
  /** Row-level problems, reported rather than silently dropped. */
  errors: { row: number; message: string }[];
}

export function parseMembersCsv(text: string): CsvImportResult {
  const rows = parseCsv(text);
  const result: CsvImportResult = { members: [], unmatchedHeaders: [], errors: [] };
  if (rows.length === 0) return result;

  const [headerRow, ...dataRows] = rows;
  const columnFor = headerRow.map((header) => {
    const match = HEADER_ALIASES[normaliseHeader(header)];
    if (!match && header.trim()) result.unmatchedHeaders.push(header.trim());
    return match;
  });

  if (!columnFor.includes('firstName') && !columnFor.includes('lastName')) {
    result.errors.push({ row: 1, message: 'No name column found — expected "First name".' });
    return result;
  }

  dataRows.forEach((row, index) => {
    const cells: Partial<Record<(typeof CSV_COLUMNS)[number], string>> = {};
    columnFor.forEach((column, i) => {
      if (column) cells[column] = row[i] ?? '';
    });

    const firstName = (cells.firstName ?? '').trim();
    const lastName = (cells.lastName ?? '').trim();
    if (!firstName && !lastName) {
      result.errors.push({ row: index + 2, message: 'Skipped — no name.' });
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
    if (cells.dateOfBirth?.trim()) member.dateOfBirth = cells.dateOfBirth.trim();
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

const escapeCell = (value: unknown): string => {
  const text = value == null ? '' : String(value);
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
  return [header, ...rows].join('\n');
}

export function downloadTextFile(filename: string, text: string, mime = 'text/csv'): void {
  const url = URL.createObjectURL(new Blob([text], { type: `${mime};charset=utf-8` }));
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
